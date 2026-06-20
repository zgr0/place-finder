"""
Convert Mistral-7B + LoRA adapter to GGUF Q4_K_M for CPU VPS deployment.

Prerequisites (run on a machine with enough RAM, ~16GB):
  pip install peft transformers torch
  git clone https://github.com/ggerganov/llama.cpp /tmp/llama.cpp
  cd /tmp/llama.cpp && pip install -r requirements.txt
  # Build quantize tool: cmake -B build && cmake --build build --target llama-quantize

Usage:
  python scripts/convert_to_gguf.py
  python scripts/convert_to_gguf.py --adapter outputs/quest-model/lora-adapter --output models/
  python scripts/convert_to_gguf.py --skip-merge  # if merged/ already exists

After conversion, upload models/quest-model-q4km.gguf to the VPS:
  scp models/quest-model-q4km.gguf user@VPS_IP:/opt/venuewar/models/
"""

import argparse
import json
import os
import subprocess
import sys

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def merge_lora(adapter_path: str, merged_path: str):
    print(f"Reading adapter config from {adapter_path}...")
    with open(os.path.join(adapter_path, "adapter_config.json")) as f:
        cfg = json.load(f)
    base_model_id = cfg["base_model_name_or_path"]
    print(f"Base model: {base_model_id}")

    print("Loading base model in float16 (this may take several minutes)...")
    base = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=torch.float16,
        device_map="cpu",
    )
    tokenizer = AutoTokenizer.from_pretrained(adapter_path)

    print("Merging LoRA adapter...")
    model = PeftModel.from_pretrained(base, adapter_path)
    model = model.merge_and_unload()
    model.eval()

    os.makedirs(merged_path, exist_ok=True)
    print(f"Saving merged model to {merged_path}...")
    model.save_pretrained(merged_path)
    tokenizer.save_pretrained(merged_path)
    print("Merge complete.")


def convert_to_gguf(merged_path: str, output_path: str, llama_cpp_dir: str):
    convert_script = os.path.join(llama_cpp_dir, "convert_hf_to_gguf.py")
    if not os.path.exists(convert_script):
        print(f"ERROR: {convert_script} not found.")
        print("Clone llama.cpp: git clone https://github.com/ggerganov/llama.cpp /tmp/llama.cpp")
        sys.exit(1)

    os.makedirs(output_path, exist_ok=True)
    gguf_f16 = os.path.join(output_path, "quest-model-f16.gguf")
    gguf_q4km = os.path.join(output_path, "quest-model-q4km.gguf")

    print(f"Converting HF model to GGUF (f16)...")
    subprocess.run(
        [sys.executable, convert_script, merged_path, "--outfile", gguf_f16, "--outtype", "f16"],
        check=True,
    )

    # Find quantize binary
    quantize_bin = None
    for candidate in [
        os.path.join(llama_cpp_dir, "build", "bin", "llama-quantize"),
        os.path.join(llama_cpp_dir, "build", "bin", "Release", "llama-quantize.exe"),
        os.path.join(llama_cpp_dir, "llama-quantize"),
    ]:
        if os.path.exists(candidate):
            quantize_bin = candidate
            break

    if quantize_bin:
        print(f"Quantizing to Q4_K_M...")
        subprocess.run([quantize_bin, gguf_f16, gguf_q4km, "Q4_K_M"], check=True)
        os.remove(gguf_f16)
        size_gb = os.path.getsize(gguf_q4km) / 1024**3
        print(f"\nDone: {gguf_q4km} ({size_gb:.1f} GB)")
        print(f"\nUpload to VPS:")
        print(f"  scp {gguf_q4km} USER@VPS_IP:/opt/venuewar/models/quest-model-q4km.gguf")
    else:
        print(f"llama-quantize not found. Raw f16 GGUF at {gguf_f16}")
        print("Build llama.cpp first: cd /tmp/llama.cpp && cmake -B build && cmake --build build --target llama-quantize")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert LoRA adapter to GGUF for CPU deployment")
    parser.add_argument("--adapter", default="outputs/quest-model/lora-adapter", help="Path to LoRA adapter directory")
    parser.add_argument("--output", default="models", help="Output directory for GGUF files")
    parser.add_argument("--llama-cpp", default="/tmp/llama.cpp", help="Path to cloned llama.cpp repo")
    parser.add_argument("--skip-merge", action="store_true", help="Skip merge step if merged/ already exists")
    args = parser.parse_args()

    merged_path = os.path.join(args.output, "merged-mistral7b")

    if not args.skip_merge:
        merge_lora(args.adapter, merged_path)
    else:
        print(f"Skipping merge, using existing {merged_path}")

    convert_to_gguf(merged_path, args.output, args.llama_cpp)
