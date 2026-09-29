#!/usr/bin/env python3
"""Explicitly generate the Medium batch with the public Stable Audio 3 API.

Uses HF_TOKEN or --prompt-token for account quota, otherwise anonymous demo
allowance. Browser login is not reused. Stops on the first service error or
quota limit. No generation retries or paid endpoints.
Use process_medium.py separately for offline conversion.
"""

import argparse
import getpass
import json
import os
from pathlib import Path
import urllib.request

import generate as original


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generate", action="store_true", required=True,
                        help="Explicitly authorize remote generation of missing raw files.")
    parser.add_argument("--asset", help="Generate only the named manifest file.")
    parser.add_argument("--prompt-token", action="store_true", help="Read token without echo; keep it in process memory only.")
    args = parser.parse_args()
    token = getpass.getpass("Hugging Face token (hidden): ").strip() if args.prompt_token else os.environ.get("HF_TOKEN", "").strip()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    root = Path(__file__).resolve().parents[2]
    config = json.loads(Path(__file__).with_name("medium-prompts.json").read_text())
    assets = [a for a in config["assets"] if not args.asset or a["file"] == args.asset]
    if not assets:
        parser.error("Asset not present in medium-prompts.json")
    original.RAW = root / "outputs/zombie-audio-medium"
    original.RAW.mkdir(parents=True, exist_ok=True)
    for asset in assets:
        destination = original.RAW / asset["file"]
        if destination.exists():
            print(f"{asset['file']}: reusing downloaded raw file", flush=True)
            continue
        url = original.generate(config, asset, auth_headers=headers)
        if not url.startswith(config["api_origin"] + "/gradio_api/file="):
            raise ValueError("Unexpected result host/path; refusing credential forwarding")
        metadata_path = original.RAW / (asset["file"] + ".json")
        metadata = json.loads(metadata_path.read_text())
        metadata.update({"model": config["model"], "authentication": "Hugging Face token (account quota)" if token else "anonymous public demo API"})
        metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=60, context=original.TLS_CONTEXT) as response:
            data = response.read()
        if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
            raise ValueError("Service result is not a WAV file; refusing to save")
        destination.write_bytes(data)
        print(f"{asset['file']}: downloaded {len(data)} bytes", flush=True)


if __name__ == "__main__":
    main()
