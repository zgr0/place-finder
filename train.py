"""
Fine-tuning script for cyberpunk quest generation (Alpaca format).
Compatible: transformers>=5.x, trl>=1.6, peft>=0.19, bitsandbytes>=0.43

Optimization techniques:
  1. QLoRA  — 4-bit NF4 quantization (bitsandbytes) → 4-6x VRAM reduction
  2. LoRA   — trainable rank-decomposed adapters only (r=16, α=32)
  3. Gradient checkpointing — recompute activations, saves ~30% VRAM
  4. Paged AdamW 8-bit      — optimizer states 8-bit + CPU paging
  5. bf16 / fp16 auto-select — bf16 on Ampere+ (RTX 30xx/40xx), fp16 fallback
  6. Gradient accumulation   — effective batch = per_device × accum_steps
  7. completion_only_loss    — loss only on output tokens, not prompt
  8. group_by_length         — group similar-length seqs, minimize padding waste
"""

import json
import math
import os
import argparse

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, AutoPeftModelForCausalLM
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer


# ─── GPU auto-detection ───────────────────────────────────────────────────────

def detect_gpu() -> dict:
    if not torch.cuda.is_available():
        return {"available": False, "name": "CPU", "vram_gb": 0, "is_ampere_plus": False}
    props = torch.cuda.get_device_properties(0)
    return {
        "available": True,
        "name": torch.cuda.get_device_name(0),
        "vram_gb": round(props.total_memory / 1024 ** 3, 1),
        "is_ampere_plus": props.major >= 8,  # RTX 30xx/40xx = sm8x
    }


def recommend_model(vram_gb: float) -> str:
    if vram_gb >= 8:
        return "mistralai/Mistral-7B-v0.1"           # ~5.5 GB in 4-bit + overhead
    elif vram_gb >= 6:
        return "microsoft/phi-2"                      # ~1.8 GB in 4-bit
    else:
        return "TinyLlama/TinyLlama-1.1B-Chat-v1.0"  # ~0.7 GB in 4-bit


# ─── Alpaca prompt ────────────────────────────────────────────────────────────

ALPACA_TEMPLATE = (
    "Below is an instruction that describes a task, paired with an input that provides "
    "further context. Write a response that appropriately completes the request.\n\n"
    "### Instruction:\n{instruction}\n\n"
    "### Input:\n{input}\n\n"
    "### Response:\n{output}"
)


def format_prompt(example: dict) -> str:
    return ALPACA_TEMPLATE.format(
        instruction=example["instruction"],
        input=example["input"],
        output=example["output"],
    )


# ─── Dataset ──────────────────────────────────────────────────────────────────

def load_split(path: str, val_split: float = 0.1) -> tuple[Dataset, Dataset]:
    with open(path, "r", encoding="utf-8") as f:
        records = json.load(f)
    dataset = Dataset.from_list(records)
    dataset = dataset.map(lambda x: {"text": format_prompt(x)})
    split = dataset.train_test_split(test_size=val_split, seed=42)
    return split["train"], split["test"]


# ─── QLoRA ────────────────────────────────────────────────────────────────────

def build_bnb_config(is_ampere_plus: bool) -> BitsAndBytesConfig:
    dtype = torch.bfloat16 if is_ampere_plus else torch.float16
    return BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",         # NF4 beats fp4 for LLM weights
        bnb_4bit_compute_dtype=dtype,
        bnb_4bit_use_double_quant=True,    # nested quant → extra VRAM saving
    )


# ─── LoRA ─────────────────────────────────────────────────────────────────────

LORA_TARGET_MODULES = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]


def build_lora_config() -> LoraConfig:
    return LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        target_modules=LORA_TARGET_MODULES,
        lora_dropout=0.05,
        bias="none",
    )


# ─── SFTConfig ────────────────────────────────────────────────────────────────

def build_sft_config(
    output_dir: str,
    vram_gb: float,
    is_ampere_plus: bool,
    num_epochs: int,
    learning_rate: float,
    max_length: int,
) -> SFTConfig:
    per_device_batch = 1 if vram_gb < 12 else 2
    grad_accum = max(1, 8 // per_device_batch)  # effective batch ≈ 8

    return SFTConfig(
        output_dir=output_dir,
        # ── epochs / batch
        num_train_epochs=num_epochs,
        per_device_train_batch_size=per_device_batch,
        per_device_eval_batch_size=per_device_batch,
        gradient_accumulation_steps=grad_accum,
        # ── memory optimizations
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        # ── precision
        bf16=is_ampere_plus,
        fp16=not is_ampere_plus,
        # ── LR schedule
        learning_rate=learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        # ── SFT-specific
        max_length=max_length,
        dataset_text_field="text",
        completion_only_loss=True,         # loss only on ### Response: tokens
        packing=False,
        # ── logging / checkpointing
        logging_steps=20,
        eval_strategy="steps",
        eval_steps=100,
        save_strategy="steps",
        save_steps=200,
        save_total_limit=3,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        loss_type="nll",                   # pin until trl 1.7 default is stable
        report_to="none",
        seed=42,
    )


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset",        default="dataset.json")
    parser.add_argument("--model",          default=None)
    parser.add_argument("--output_dir",     default="./outputs/quest-model")
    parser.add_argument("--epochs",         type=int,   default=3)
    parser.add_argument("--lr",             type=float, default=2e-4)
    parser.add_argument("--max_length",     type=int,   default=1024)
    parser.add_argument("--no_flash_attn",  action="store_true")
    parser.add_argument("--merge_and_save", action="store_true")
    args = parser.parse_args()

    # ── GPU
    gpu = detect_gpu()
    print(f"\n{'='*60}")
    print(f"GPU      : {gpu['name']}")
    print(f"VRAM     : {gpu['vram_gb']} GB")
    print(f"Ampere+  : {gpu['is_ampere_plus']}")
    print(f"Precision: {'bf16' if gpu['is_ampere_plus'] else 'fp16'}")

    model_id = args.model or recommend_model(gpu["vram_gb"])
    attn_impl = (
        "flash_attention_2"
        if (gpu["is_ampere_plus"] and not args.no_flash_attn)
        else "eager"
    )
    print(f"Model    : {model_id}")
    print(f"Attention: {attn_impl}")
    print(f"{'='*60}\n")

    # ── Data
    print("Loading dataset...")
    train_ds, eval_ds = load_split(args.dataset)
    print(f"Train: {len(train_ds)} | Eval: {len(eval_ds)}\n")

    # ── Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # ── Model (4-bit QLoRA)
    bnb_config = build_bnb_config(gpu["is_ampere_plus"])
    print("Loading model with 4-bit quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map={"": 0} if gpu["available"] else "cpu",
        trust_remote_code=True,
        attn_implementation=attn_impl,
    )
    # ── LoRA config (SFTTrainer applies prepare_model_for_kbit_training + get_peft_model internally)
    lora_config = build_lora_config()

    # ── SFTConfig
    os.makedirs(args.output_dir, exist_ok=True)
    sft_config = build_sft_config(
        output_dir=args.output_dir,
        vram_gb=gpu["vram_gb"],
        is_ampere_plus=gpu["is_ampere_plus"],
        num_epochs=args.epochs,
        learning_rate=args.lr,
        max_length=args.max_length,
    )

    effective_batch = (
        sft_config.per_device_train_batch_size
        * sft_config.gradient_accumulation_steps
    )
    steps_per_epoch = math.ceil(len(train_ds) / effective_batch)
    print(f"\nEffective batch : {effective_batch}")
    print(f"Steps/epoch     : {steps_per_epoch}")
    print(f"Total steps     : {steps_per_epoch * args.epochs}\n")

    # ── Trainer
    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        processing_class=tokenizer,
        peft_config=lora_config,
    )

    # ── Train
    print("Starting training...\n")
    trainer.train()

    # ── Save adapter
    adapter_path = os.path.join(args.output_dir, "lora-adapter")
    trainer.model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)
    print(f"\nLoRA adapter saved → {adapter_path}")

    # ── Optional merge
    if args.merge_and_save:
        print("\nMerging LoRA into base model...")
        dtype = torch.bfloat16 if gpu["is_ampere_plus"] else torch.float16
        merged = AutoPeftModelForCausalLM.from_pretrained(
            adapter_path, device_map="auto", torch_dtype=dtype
        )
        merged = merged.merge_and_unload()
        merged_path = os.path.join(args.output_dir, "merged-model")
        merged.save_pretrained(merged_path)
        tokenizer.save_pretrained(merged_path)
        print(f"Merged model saved → {merged_path}")

    print("\nDone.")


if __name__ == "__main__":
    main()
