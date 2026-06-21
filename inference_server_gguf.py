"""
Mission inference server — llama-cpp-python + GGUF model.
CPU-optimized for VPS deployment. Port: 8000

Convert your LoRA adapter first:
  python scripts/convert_to_gguf.py --adapter outputs/quest-model/lora-adapter --output models/
"""

import os
import threading
from flask import Flask, request, jsonify
from llama_cpp import Llama

app = Flask(__name__)

MODEL_PATH = os.getenv("MODEL_PATH", "/models/quest-model-q4km.gguf")
N_THREADS = int(os.getenv("N_THREADS", str(os.cpu_count() or 4)))

ALPACA_PROMPT = (
    "Below is an instruction that describes a task, paired with an input that provides "
    "further context. Write a response that appropriately completes the request.\n\n"
    "### Instruction:\n{instruction}\n\n"
    "### Input:\n{input}\n\n"
    "### Response:\n"
)
INSTRUCTION = "Generate a tactical cyberpunk quest for a player."

_model: "Llama | None" = None
_lock = threading.Lock()


def load_model():
    global _model
    if not os.path.exists(MODEL_PATH):
        print(f"WARNING: GGUF model not found at {MODEL_PATH}. "
              "Server starting without model — /generate returns 503. "
              "Run scripts/convert_to_gguf.py then mount the models/ volume.")
        return
    print(f"Loading GGUF from {MODEL_PATH} ({N_THREADS} threads)...")
    _model = Llama(
        model_path=MODEL_PATH,
        n_ctx=2048,
        n_threads=N_THREADS,
        n_gpu_layers=0,
        verbose=False,
    )
    print("Model ready.")


def _infer(venue: str, status: str) -> str:
    prompt = ALPACA_PROMPT.format(
        instruction=INSTRUCTION,
        input=f"Venue: {venue}, Status: {status}",
    )
    output = _model(  # type: ignore[misc]
        prompt,
        max_tokens=350,
        temperature=0.75,
        top_p=0.92,
        repeat_penalty=1.15,
        stop=["### Instruction:", "### Input:"],
        echo=False,
    )
    return output["choices"][0]["text"].strip()


def _parse(text: str, venue: str, status: str) -> dict:
    commander = "HEX-RUNNER"
    rest = text

    if text.startswith("[") and "]:" in text:
        end = text.index("]:")
        commander = text[1:end].replace(" KOMUTANI", "").strip()
        rest = text[end + 2:].strip()

    objective_block = rest
    for marker in ["Görev:", "Görev :"]:
        if marker in rest:
            objective_block = rest.split(marker, 1)[1].strip()
            break

    objectives: list[str] = []
    for sep in [". Ardından ", ". Son olarak ", ". ardından ", ". son olarak "]:
        if sep in objective_block:
            raw_parts = objective_block.split(sep)
            parts = [p.strip().rstrip("!.,") for p in raw_parts if p.strip()]
            if len(parts) >= 2:
                objectives = parts
                break

    if not objectives and ". " in objective_block:
        parts = [p.strip().rstrip("!.,") for p in objective_block.split(". ") if p.strip()]
        if len(parts) >= 2:
            objectives = parts

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
