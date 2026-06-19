"""
Mission inference server — loads Mistral-7B + LoRA adapter once, serves HTTP.
Run: python inference_server.py
Port: 8000
"""

import json
import threading
from flask import Flask, request, jsonify
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel

app = Flask(__name__)

MODEL_PATH = "./outputs/quest-model/lora-adapter"
ALPACA_PROMPT = (
    "Below is an instruction that describes a task, paired with an input that provides "
    "further context. Write a response that appropriately completes the request.\n\n"
    "### Instruction:\n{instruction}\n\n"
    "### Input:\n{input}\n\n"
    "### Response:\n"
)
INSTRUCTION = "Generate a tactical cyberpunk quest for a player."

_model = None
_tokenizer = None
_lock = threading.Lock()


def load_model():
    global _model, _tokenizer

    gpu_available = torch.cuda.is_available()
    if gpu_available:
        props = torch.cuda.get_device_properties(0)
        dtype = torch.bfloat16 if props.major >= 8 else torch.float16
        device_map = {"": 0}
        print(f"GPU: {torch.cuda.get_device_name(0)} ({round(props.total_memory / 1024**3, 1)} GB)")
    else:
        dtype = torch.float32
        device_map = "cpu"
        print("No GPU — using CPU (slow)")

    print(f"Loading adapter from {MODEL_PATH}...")
    _tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    if _tokenizer.pad_token is None:
        _tokenizer.pad_token = _tokenizer.eos_token
    _tokenizer.padding_side = "left"

    with open(f"{MODEL_PATH}/adapter_config.json") as f:
        adapter_cfg = json.load(f)
    base_model_id = adapter_cfg["base_model_name_or_path"]
    print(f"Base model: {base_model_id}")

    if gpu_available:
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
    else:
        base = AutoModelForCausalLM.from_pretrained(
            base_model_id,
            torch_dtype=dtype,
            device_map=device_map,
        )

    _model = PeftModel.from_pretrained(base, MODEL_PATH)
    _model.eval()
    print("Model ready.")


def _infer(venue: str, status: str) -> str:
    prompt = ALPACA_PROMPT.format(
        instruction=INSTRUCTION,
        input=f"Venue: {venue}, Status: {status}",
    )
    device = next(_model.parameters()).device
    inputs = _tokenizer(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        out_ids = _model.generate(
            **inputs,
            max_new_tokens=350,
            do_sample=True,
            temperature=0.75,
            top_p=0.92,
            repetition_penalty=1.15,
            eos_token_id=_tokenizer.eos_token_id,
            pad_token_id=_tokenizer.pad_token_id,
        )
    new_ids = out_ids[0][inputs["input_ids"].shape[1]:]
    return _tokenizer.decode(new_ids, skip_special_tokens=True).strip()


def _parse(text: str, venue: str, status: str) -> dict:
    commander = "HEX-RUNNER"
    rest = text

    if text.startswith("[") and "]:" in text:
        end = text.index("]:")
        commander = text[1:end]
        # Strip trailing " KOMUTANI" suffix if present
        commander = commander.replace(" KOMUTANI", "").strip()
        rest = text[end + 2:].strip()

    # Split off briefing vs objectives at "Görev:"
    objective_block = rest
    for marker in ["Görev:", "Görev :"]:
        if marker in rest:
            objective_block = rest.split(marker, 1)[1].strip()
            break

    # Split multi-step objectives on trained separators (priority order)
    objectives: list[str] = []
    for sep in [". Ardından ", ". Son olarak ", ". ardından ", ". son olarak "]:
        if sep in objective_block:
            raw_parts = objective_block.split(sep)
            parts = [p.strip().rstrip("!.,") for p in raw_parts if p.strip()]
            if len(parts) >= 2:
                objectives = parts
                break

    # Fallback: split on ". " sentences
    if not objectives and ". " in objective_block:
        parts = [p.strip().rstrip("!.,") for p in objective_block.split(". ") if p.strip()]
        if len(parts) >= 2:
            objectives = parts

    # Final fallback: single objective
    if not objectives:
        objectives = [objective_block.rstrip("!.,")]

    return {
        "commander": commander,
        "venue": venue,
        "status": status,
        "rawText": text,
        "objectives": [{"text": obj, "done": False} for obj in objectives],
    }


@app.route("/health")
def health():
    return jsonify({"status": "ok", "ready": _model is not None})


@app.route("/generate", methods=["POST"])
def generate():
    if _model is None:
        return jsonify({"error": "Model loading"}), 503
    data = request.get_json(force=True)
    venue = (data.get("venue") or "").strip()
    status = (data.get("status") or "Contested").strip()
    if not venue:
        return jsonify({"error": "venue required"}), 400
    with _lock:
        text = _infer(venue, status)
    return jsonify(_parse(text, venue, status))


if __name__ == "__main__":
    load_model()
    app.run(host="0.0.0.0", port=8000, threaded=False)
