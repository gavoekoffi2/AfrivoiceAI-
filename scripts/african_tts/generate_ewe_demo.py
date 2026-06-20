#!/usr/bin/env python3
"""Generate an Éwé TTS demo audio file using Meta MMS-TTS.

This is a prototype/demo integration for African-language voices.
Model: facebook/mms-tts-ewe
License note: the model is CC-BY-NC-4.0, so use for demos/R&D only unless
commercial rights are cleared.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import scipy.io.wavfile
import torch
from transformers import AutoTokenizer, VitsModel

DEFAULT_TEXT = (
    "Ŋdi na mi. Nye nye AfriVoiceAI ƒe gbe ƒe kpɔɖeŋu. "
    "Míele dɔ wɔm be míaƒe agentwo nate ŋu ado go le Eʋegbe me."
)
MODEL_ID = "facebook/mms-tts-ewe"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Éwé demo audio with Meta MMS-TTS")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Éwé text to synthesize")
    parser.add_argument(
        "--output",
        default="artifacts/african_tts/ewe_demo.wav",
        help="Output WAV path",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Torch random seed for repeatable demo audio",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    torch.manual_seed(args.seed)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = VitsModel.from_pretrained(MODEL_ID)
    model.eval()

    inputs = tokenizer(args.text, return_tensors="pt")
    with torch.no_grad():
        waveform = model(**inputs).waveform

    audio = waveform.squeeze().cpu().numpy()
    # Write standard PCM16 WAV for maximum compatibility with browsers,
    # ffmpeg, Telegram, and telephony preprocessing tools.
    peak = max(float(abs(audio).max()), 1e-8)
    pcm16 = (audio / peak * 32767.0).astype("int16")
    scipy.io.wavfile.write(output_path, rate=model.config.sampling_rate, data=pcm16)

    metadata = {
        "model": MODEL_ID,
        "license": "cc-by-nc-4.0",
        "language": "Éwé / Ewe",
        "text": args.text,
        "sampling_rate": model.config.sampling_rate,
        "output": str(output_path.resolve()),
        "bytes": output_path.stat().st_size,
    }
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    # Avoid noisy tokenizer parallelism warnings in server environments.
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    main()
