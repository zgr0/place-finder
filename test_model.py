"""
Test script for the fine-tuned cyberpunk quest model.

Usage:
  # Interactive mode (default)
  python test_model.py

  # Single inference
  python test_model.py --venue "Galata Kulesi" --status "Contested"

  # Batch test against dataset samples
  python test_model.py --batch --n 10

  # Use merged model instead of LoRA adapter
  python test_model.py --model_path outputs/quest-model/merged-model
"""

import argparse
import json
import random
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

DEFAULT_ADAPTER = "./outputs/quest-model/lora-adapter"

ALPACA_PROMPT = (
    "Below is an instruction that describes a task, paired with an input that provides "
    "further context. Write a response that appropriately completes the request.\n\n"
    "### Instruction:\n{instruction}\n\n"
    "### Input:\n{input}\n\n"
    "### Response:\n"
)

INSTRUCTION = "Generate a tactical cyberpunk quest for a player."

STATUSES = [
    "Controlled by Red Reapers",
    "Controlled by Blue Sentinels",
    "Controlled by Green Guardians",
    "Contested",
    "Liberated",
    "Under Attack",
]


def detect_gpu():
    if not torch.cuda.is_available():
        return {"available": False, "is_ampere_plus": False}
    props = torch.cuda.get_device_properties(0)
    return {
        "available": True,
        "name": torch.cuda.get_device_name(0),
        "vram_gb": round(props.total_memory / 1024 ** 3, 1),
        "is_ampere_plus": props.major >= 8,
    }


def load_model(model_path: str, is_merged: bool, gpu: dict):
    dtype = torch.bfloat16 if gpu["is_ampere_plus"] else torch.float16
    device_map = {"": 0} if gpu["available"] else "cpu"

    if is_merged:
        print(f"Loading merged model from {model_path}...")
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=dtype,
            device_map=device_map,
        )
    else:
        print(f"Loading LoRA adapter from {model_path}...")
        tokenizer = AutoTokenizer.from_pretrained(model_path)

        # Load base model in 4-bit, then apply adapter
        import json as _json
        adapter_cfg_path = f"{model_path}/adapter_config.json"
        with open(adapter_cfg_path) as f:
            adapter_cfg = _json.load(f)
        base_model_id = adapter_cfg["base_model_name_or_path"]
        print(f"Base model: {base_model_id}")

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=dtype,
            bnb_4bit_use_double_quant=True,
        )
        base = AutoModelForCausalLM.from_pretrained(
            base_model_id,
            quantization_config=bnb_config,
            device_map=device_map,
            trust_remote_code=True,
        )
        model = PeftModel.from_pretrained(base, model_path)

    model.eval()
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "left"  # left-pad for generation
    return model, tokenizer


def build_input(venue: str, status: str) -> str:
    return ALPACA_PROMPT.format(
        instruction=INSTRUCTION,
        input=f"Venue: {venue}, Status: {status}",
    )


def generate(model, tokenizer, prompt: str, max_new_tokens: int = 150) -> str:
    device = next(model.parameters()).device
    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.1,
            eos_token_id=tokenizer.eos_token_id,
            pad_token_id=tokenizer.pad_token_id,
        )
    # Decode only newly generated tokens
    new_ids = output_ids[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_ids, skip_special_tokens=True).strip()


def run_interactive(model, tokenizer):
    print("\n=== Interactive Quest Generator ===")
    print("Type 'quit' to exit, 'random' for random venue+status.\n")
    while True:
        venue = input("Venue  : ").strip()
        if venue.lower() == "quit":
            break
        if venue.lower() == "random":
            venue = random.choice([
                "Galata Kulesi", "Taksim Meydanı", "Kadıköy Çarşı",
                "İstanbul Modern", "Mandabatmaz", "Büyükada Milli Parkı",
            ])
            status = random.choice(STATUSES)
            print(f"Venue  : {venue}")
            print(f"Status : {status}")
        else:
            print("Status options:", ", ".join(STATUSES))
            status = input("Status : ").strip()

        prompt = build_input(venue, status)
        print("\nGenerating...", flush=True)
        result = generate(model, tokenizer, prompt)
        print(f"\nOUTPUT : {result}\n")
        print("-" * 60)


def run_batch(model, tokenizer, dataset_path: str, n: int):
    with open(dataset_path, encoding="utf-8") as f:
        data = json.load(f)
    samples = random.sample(data, min(n, len(data)))

    print(f"\n=== Batch Test ({len(samples)} samples) ===\n")
    for i, sample in enumerate(samples, 1):
        venue_status = sample["input"]   # "Venue: X, Status: Y"
        parts = venue_status.split(", Status: ")
        venue = parts[0].replace("Venue: ", "")
        status = parts[1]

        prompt = build_input(venue, status)
        result = generate(model, tokenizer, prompt)

        print(f"[{i}/{len(samples)}]")
        print(f"INPUT    : {venue_status}")
        print(f"EXPECTED : {sample['output']}")
        print(f"GENERATED: {result}")
        print("-" * 60)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", default=DEFAULT_ADAPTER)
    parser.add_argument("--merged",     action="store_true", help="Model is a merged (non-adapter) model")
    parser.add_argument("--venue",      default=None)
    parser.add_argument("--status",     default=None, choices=STATUSES)
    parser.add_argument("--batch",      action="store_true")
    parser.add_argument("--n",          type=int, default=10, help="Number of batch samples")
    parser.add_argument("--dataset",    default="dataset.json")
    parser.add_argument("--max_tokens", type=int, default=150)
    args = parser.parse_args()

    gpu = detect_gpu()
    if gpu.get("name"):
        print(f"GPU: {gpu['name']} ({gpu['vram_gb']} GB)")

    model, tokenizer = load_model(args.model_path, args.merged, gpu)

    if args.batch:
        run_batch(model, tokenizer, args.dataset, args.n)
    elif args.venue and args.status:
        prompt = build_input(args.venue, args.status)
        result = generate(model, tokenizer, prompt, max_new_tokens=args.max_tokens)
        print(f"\nOUTPUT: {result}")
    else:
        run_interactive(model, tokenizer)


if __name__ == "__main__":
    main()
