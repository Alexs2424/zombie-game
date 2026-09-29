#!/usr/bin/env python3
"""Process downloaded Medium WAVs offline; never generate or download audio.

Requires numpy and scipy. Uses medium-prompts.json and the present raw WAVs in
outputs/zombie-audio-medium/. Missing assets are skipped, never fabricated.
Writes game assets and a separate medium-provenance.json; the original Small
SFX provenance.json is left untouched. --dry-run validates without any writes.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import struct
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("medium-prompts.json")
RAW = ROOT / "outputs/zombie-audio-medium"
DEST = ROOT / "public/audio/zombies"
REPORT = ROOT / "docs/zombie-audio/medium-provenance.json"
PROCESSING = (
    "Average channels to mono; scipy polyphase resample to 24000 Hz; "
    "second-order zero-phase Butterworth highpass 80 Hz and lowpass 6000 Hz; "
    "25 ms sine-squared fades; target -21 dBFS full-clip RMS with -3 dBFS "
    "peak ceiling; signed PCM16 WAV."
)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def db(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def stats(audio):
    return {
        "rms_dbfs": db(np.sqrt(np.mean(audio * audio))),
        "peak_dbfs": db(np.max(np.abs(audio))),
        "dc_offset": round(float(np.mean(audio)), 8),
    }


def input_format(path):
    """Read fmt metadata without confusing 24-bit PCM with its int32 decoder."""
    with path.open("rb") as stream:
        if stream.read(4) != b"RIFF":
            raise ValueError(f"Expected a little-endian RIFF WAV: {path.name}")
        stream.read(4)
        if stream.read(4) != b"WAVE":
            raise ValueError(f"Expected WAVE container: {path.name}")
        while True:
            header = stream.read(8)
            if len(header) != 8:
                raise ValueError(f"Missing WAV fmt chunk: {path.name}")
            chunk, size = struct.unpack("<4sI", header)
            if chunk == b"fmt ":
                data = stream.read(size)
                if len(data) < 16:
                    raise ValueError(f"Invalid WAV fmt chunk: {path.name}")
                code, channels, rate, _, _, bits = struct.unpack("<HHIIHH", data[:16])
                actual_code = struct.unpack("<H", data[24:26])[0] if code == 65534 and len(data) >= 40 else code
                return {
                    "container": "RIFF WAV",
                    "encoding": {1: "PCM integer", 3: "IEEE float"}.get(actual_code, f"WAVE format {actual_code}"),
                    "format_code": code,
                    "bits_per_sample": bits,
                    "channels": channels,
                    "sample_rate": rate,
                }
            stream.seek(size + size % 2, 1)


def validate_manifest(config):
    assets = config.get("assets")
    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a nonempty assets list")
    names = set()
    for asset in assets:
        if not isinstance(asset, dict):
            raise ValueError("Each manifest asset must be an object")
        name = asset.get("file")
        if not isinstance(name, str) or Path(name).name != name or not name.endswith(".wav"):
            raise ValueError(f"Asset file must be a WAV basename: {name!r}")
        if name in names:
            raise ValueError(f"Duplicate asset filename: {name}")
        names.add(name)
        if not isinstance(asset.get("prompt"), str) or not asset["prompt"].strip():
            raise ValueError(f"Missing prompt: {name}")
        if not isinstance(asset.get("duration"), (int, float)) or not math.isfinite(asset["duration"]) or asset["duration"] <= 0:
            raise ValueError(f"Invalid requested duration: {name}")
        if not isinstance(asset.get("seed"), int):
            raise ValueError(f"Invalid seed: {name}")
    return assets


def process(asset):
    source = RAW / asset["file"]
    source_format = input_format(source)
    rate, samples = wavfile.read(source)
    if samples.ndim not in (1, 2) or len(samples) == 0 or rate <= 0:
        raise ValueError(f"Empty or invalid audio: {asset['file']}")
    if np.issubdtype(samples.dtype, np.integer):
        if samples.dtype == np.uint8:
            decoded = (samples.astype(np.float64) - 128) / 128
        else:
            decoded = samples.astype(np.float64) / (np.iinfo(samples.dtype).max + 1)
    elif np.issubdtype(samples.dtype, np.floating):
        decoded = samples.astype(np.float64)
    else:
        raise ValueError(f"Unsupported source sample type: {samples.dtype}")
    if not np.isfinite(decoded).all():
        raise ValueError(f"Non-finite samples: {asset['file']}")
    audio = decoded.mean(axis=1) if decoded.ndim == 2 else decoded.copy()
    divisor = math.gcd(rate, 24000)
    audio = signal.resample_poly(audio, 24000 // divisor, rate // divisor)
    if len(audio) < 32:
        raise ValueError(f"Audio too short for filtering: {asset['file']}")
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
    measured = pcm.astype(np.float64) / 32768
    metadata_path = source.with_name(source.name + ".json")
    metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else None
    record = {
        **asset,
        "raw_file": str(source.relative_to(ROOT)),
        "raw_sha256": sha256(source),
        "input_format": {**source_format, "decoded_dtype": str(samples.dtype)},
        "source_sample_rate": rate,
        "source_channels": samples.shape[1] if samples.ndim == 2 else 1,
        "source_duration_seconds": round(len(samples) / rate, 4),
        "source_signal": stats(decoded),
        "sample_rate": 24000,
        "channels": 1,
        "format": "PCM16 WAV",
        "duration_seconds": round(len(pcm) / 24000, 4),
        "normalization_gain_db": db(gain),
        **stats(measured),
        "clipped_samples": int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        "generation_metadata_file": str(metadata_path.relative_to(ROOT)) if metadata_path.exists() else None,
        "generation_metadata": metadata,
        "generation_metadata_status": "Recorded sidecar metadata" if metadata is not None else "Unavailable; manifest contains requested parameters only",
    }
    return pcm, record


def write_asset(pcm, record):
    destination = DEST / record["file"]
    with tempfile.NamedTemporaryFile(dir=DEST, suffix=".wav", delete=False) as temp:
        temporary_path = Path(temp.name)
    try:
        wavfile.write(temporary_path, 24000, pcm)
        record.update({"sha256": sha256(temporary_path), "bytes": temporary_path.stat().st_size})
        temporary_path.replace(destination)
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Read and validate present raw WAVs, without writing assets or provenance.")
    args = parser.parse_args()
    config = json.loads(MANIFEST.read_text())
    assets = validate_manifest(config)
    processed = []
    for asset in assets:
        if not (RAW / asset["file"]).is_file():
            print(f"{asset['file']}: raw WAV missing; skipped", flush=True)
            continue
        pcm, record = process(asset)
        processed.append((pcm, record))
        print(f"{asset['file']}: {record['duration_seconds']}s, RMS {record['rms_dbfs']} dBFS, peak {record['peak_dbfs']} dBFS", flush=True)
    if args.dry_run or not processed:
        print(f"Validated {len(processed)} present asset(s); no files written.", flush=True)
        return
    DEST.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    # Retain earlier Medium records when their raw downloads are no longer here.
    prior = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    records = {record["file"]: record for record in prior.get("assets", [])}
    for pcm, record in processed:
        write_asset(pcm, record)
        records[record["file"]] = record
    report = {key: value for key, value in config.items() if key != "assets"}
    report.update({
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "Offline processing of downloaded generated audio; no runtime AI dependency",
        "manifest_parameters": "Requested generation parameters; consult each asset's generation_metadata for captured service metadata.",
        "processing": PROCESSING,
        "auditory_qa": "Not performed by this processor; objective signal checks only.",
        "original_provenance": "docs/zombie-audio/provenance.json (preserved unchanged)",
        "assets": list(records.values()),
    })
    with tempfile.NamedTemporaryFile(mode="w", dir=REPORT.parent, suffix=".json", delete=False) as temp:
        temporary_path = Path(temp.name)
        temp.write(json.dumps(report, indent=2) + "\n")
    try:
        temporary_path.replace(REPORT)
    finally:
        temporary_path.unlink(missing_ok=True)
    print(f"Wrote {len(processed)} asset(s) and {REPORT.relative_to(ROOT)}.", flush=True)


if __name__ == "__main__":
    main()
