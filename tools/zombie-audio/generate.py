#!/usr/bin/env python3
"""Generate one-off zombie assets with the official free Stable Audio 3 Space.

Requires Python, numpy, scipy. No credentials, accounts, or paid endpoints.
Stops on any service error; it does not evade quota or retry generation.
Raw downloads and service responses go to ignored outputs/zombie-audio/.
Existing raw files are reused, so processing can run without generation.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import ssl
import urllib.error
import urllib.request

import numpy as np
from scipy import signal
from scipy.io import wavfile

try:
    import certifi
    TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    TLS_CONTEXT = ssl.create_default_context()

ROOT = Path(__file__).resolve().parents[2]
PROMPTS = Path(__file__).with_name("prompts.json")
RAW = ROOT / "outputs/zombie-audio"
DEST = ROOT / "public/audio/zombies"
REPORT = ROOT / "docs/zombie-audio/provenance.json"


def read_json(url, payload=None, headers=None):
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=60, context=TLS_CONTEXT) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read(2048).decode("utf-8", errors="replace")
        for value in (headers or {}).values():
            detail = detail.replace(value, "[redacted]").replace(value.removeprefix("Bearer "), "[redacted]")
        raise RuntimeError(f"Service HTTP {error.code}: {detail[:600]}") from None


def generate(config, asset, auth_headers=None):
    record_path = RAW / (asset["file"] + ".json")
    if record_path.exists():
        previous = json.loads(record_path.read_text())
        if previous.get("response"):
            return previous["response"][0]["url"]
    request_data = {"data": [config["variant_key"], asset["prompt"], asset["duration"],
                             config["steps"], config["cfg_scale"], config["sampler_type"], asset["seed"]]}
    endpoint = config["api_origin"] + "/gradio_api/call/infer"
    event = read_json(endpoint, request_data, headers=auth_headers)
    record = {"generated_at": datetime.now(timezone.utc).isoformat(), "request": request_data, "event": event}
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    print(f"{asset['file']}: generation submitted ({event['event_id']})", flush=True)
    event_kind = None
    response_data = None
    result_request = urllib.request.Request(endpoint + "/" + event["event_id"], headers=auth_headers or {})
    with urllib.request.urlopen(result_request, timeout=60, context=TLS_CONTEXT) as stream:
        for raw_line in stream:
            line = raw_line.decode().strip()
            if line.startswith("event:"):
                event_kind = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data = json.loads(line.split(":", 1)[1].strip())
                if event_kind == "error":
                    record["error"] = data
                    record_path.write_text(json.dumps(record, indent=2) + "\n")
                    raise RuntimeError(f"Generation failed; no retry attempted: {data}")
                if event_kind == "complete":
                    response_data = data
                    break
    if not response_data:
        raise RuntimeError("No completed generation result; no retry attempted")
    record["response"] = response_data
    record_path.write_text(json.dumps(record, indent=2) + "\n")
    return response_data[0]["url"]


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def process(asset):
    source = RAW / asset["file"]
    rate, samples = wavfile.read(source)
    source_channels = samples.shape[1] if samples.ndim == 2 else 1
    if np.issubdtype(samples.dtype, np.integer):
        if samples.dtype == np.uint8:
            audio = (samples.astype(np.float64) - 128) / 128
        else:
            audio = samples.astype(np.float64) / (np.iinfo(samples.dtype).max + 1)
    else:
        audio = samples.astype(np.float64)
    if audio.ndim == 2:
        audio = audio.mean(axis=1)
    if not np.isfinite(audio).all():
        raise ValueError(f"Non-finite samples: {asset['file']}")
    divisor = math.gcd(rate, 24000)
    audio = signal.resample_poly(audio, 24000 // divisor, rate // divisor)
    # A gentle band limit removes sub-bass rumble and brittle high-frequency hiss.
    audio = signal.sosfiltfilt(signal.butter(2, 80, btype="highpass", fs=24000, output="sos"), audio)
    audio = signal.sosfiltfilt(signal.butter(2, 6000, btype="lowpass", fs=24000, output="sos"), audio)
    fade = min(round(0.025 * 24000), len(audio) // 2)
    ramp = np.sin(np.linspace(0, math.pi / 2, fade)) ** 2
    audio[:fade] *= ramp
    audio[-fade:] *= ramp[::-1]
    rms = np.sqrt(np.mean(audio * audio))
    peak = np.max(np.abs(audio))
    if rms < 1e-6 or peak < 1e-5:
        raise ValueError(f"Near-silent generation: {asset['file']}")
    gain = min(10 ** (-21 / 20) / rms, 10 ** (-3 / 20) / peak)
    audio *= gain
    pcm = np.round(audio * 32767).astype(np.int16)
    destination = DEST / asset["file"]
    wavfile.write(destination, 24000, pcm)
    measured = pcm.astype(np.float64) / 32768
    record_path = RAW / (asset["file"] + ".json")
    generation = json.loads(record_path.read_text()) if record_path.exists() else {}
    return {**asset, "generated_at": generation.get("generated_at"),
            "event_id": generation.get("event", {}).get("event_id"),
            "raw_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "source_sample_rate": rate, "source_channels": source_channels,
            "sample_rate": 24000, "channels": 1, "format": "PCM16 WAV",
            "duration_seconds": round(len(pcm) / 24000, 4),
            "rms_dbfs": db(np.sqrt(np.mean(measured * measured))),
            "peak_dbfs": db(np.max(np.abs(measured))), "bytes": destination.stat().st_size}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--process-only", action="store_true", help="Never call the service; use existing raw files.")
    args = parser.parse_args()
    config = json.loads(PROMPTS.read_text())
    for directory in (RAW, DEST, REPORT.parent):
        directory.mkdir(parents=True, exist_ok=True)
    assets = []
    for asset in config["assets"]:
        source = RAW / asset["file"]
        if not source.exists():
            if args.process_only:
                continue
            url = generate(config, asset)
            with urllib.request.urlopen(url, timeout=60, context=TLS_CONTEXT) as response:
                source.write_bytes(response.read())
        result = process(asset)
        assets.append(result)
        report = {key: value for key, value in config.items() if key != "assets"}
        report.update({"created_by": "one-off public hosted AI generation; no runtime AI dependency",
                       "processing": "Average channels to mono; scipy polyphase resample to 24000 Hz; second-order zero-phase Butterworth highpass 80 Hz and lowpass 6000 Hz; 25 ms sine-squared fades; target -21 dBFS full-clip RMS with -3 dBFS peak ceiling; signed PCM16 WAV.",
                       "auditory_qa": "Not performed by the generating agent; objective signal checks only.",
                       "license_url": "https://stability.ai/license",
                       "license_agreement_url": "https://stability.ai/community-license-agreement",
                       "assets": assets})
        REPORT.write_text(json.dumps(report, indent=2) + "\n")
        print(f"{asset['file']}: {result['duration_seconds']}s, RMS {result['rms_dbfs']} dBFS, peak {result['peak_dbfs']} dBFS", flush=True)


if __name__ == "__main__":
    main()
