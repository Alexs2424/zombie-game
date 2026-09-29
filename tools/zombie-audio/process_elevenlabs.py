#!/usr/bin/env python3
"""Process downloaded ElevenLabs scream takes offline.

Requires numpy and scipy. Reads elevenlabs-prompts.json and only the seven
explicit WAV mappings below. Optional <raw-name>.wav.json sidecars are preserved.
No remote calls, credentials, generation, or active-game manifest changes.
"""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

from process_medium import db, input_format, sha256, stats

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "outputs/zombie-audio-elevenlabs"
DEST = ROOT / "public/audio/zombies"
REPORT = ROOT / "docs/zombie-audio/elevenlabs-provenance.json"
MANIFEST = Path(__file__).with_name("elevenlabs-prompts.json")
MAPPINGS = {
    "piercing-01-raw.wav": "scream-elevenlabs-01.wav",
    "rasp-01-raw.wav": "scream-elevenlabs-02.wav",
    "layered-01-raw.wav": "scream-elevenlabs-03.wav",
    "high-scream-01-raw.wav": "scream-elevenlabs-high-01.wav",
    "high-scream-02-raw.wav": "scream-elevenlabs-high-02.wav",
    "high-scream-03-raw.wav": "scream-elevenlabs-high-03.wav",
    "high-scream-04-raw.wav": "scream-elevenlabs-high-04.wav",
}
PROCESSING = (
    "Average channels to mono; scipy polyphase resample to 24000 Hz; "
    "second-order zero-phase Butterworth highpass 80 Hz and lowpass 8000 Hz "
    "(wider than the Medium batch to retain more upper-frequency scream content); "
    "25 ms sine-squared fades; target -21 dBFS full-clip RMS with -3 dBFS "
    "peak ceiling; signed PCM16 WAV. No pitch shift, trimming, or compression."
)


def process(asset, generation_settings):
    source_name, output_name = asset["rawFile"], asset["file"]
    source = RAW / source_name
    fmt = input_format(source)
    rate, samples = wavfile.read(source)
    if samples.ndim not in (1, 2) or len(samples) == 0 or rate <= 0:
        raise ValueError(f"Empty or invalid audio: {source_name}")
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
        raise ValueError(f"Non-finite samples: {source_name}")
    audio = decoded.mean(axis=1) if decoded.ndim == 2 else decoded.copy()
    divisor = math.gcd(rate, 24000)
    audio = signal.resample_poly(audio, 24000 // divisor, rate // divisor)
    if len(audio) < 32:
        raise ValueError(f"Audio too short for filtering: {source_name}")
    for cutoff, kind in ((80, "highpass"), (8000, "lowpass")):
        audio = signal.sosfiltfilt(signal.butter(2, cutoff, btype=kind, fs=24000, output="sos"), audio)
    fade = min(round(0.025 * 24000), len(audio) // 2)
    ramp = np.sin(np.linspace(0, math.pi / 2, fade)) ** 2
    audio[:fade] *= ramp
    audio[-fade:] *= ramp[::-1]
    rms = np.sqrt(np.mean(audio * audio))
    peak = np.max(np.abs(audio))
    if rms < 1e-6 or peak < 1e-5:
        raise ValueError(f"Near-silent source: {source_name}")
    gain = min(10 ** (-21 / 20) / rms, 10 ** (-3 / 20) / peak)
    pcm = np.round(audio * gain * 32767).astype(np.int16)
    measured = pcm.astype(np.float64) / 32768
    sidecar = source.with_name(source.name + ".json")
    metadata = json.loads(sidecar.read_text()) if sidecar.exists() else None
    record = {
        "file": output_name,
        "direction": asset["direction"],
        "usage": asset.get("usage", "Audition only; not included in the active game sound manifest"),
        "raw_file": str(source.relative_to(ROOT)),
        "raw_sha256": sha256(source),
        "raw_bytes": source.stat().st_size,
        "input_format": {**fmt, "decoded_dtype": str(samples.dtype)},
        "source_duration_seconds": round(len(samples) / rate, 4),
        "source_signal": stats(decoded),
        "sample_rate": 24000,
        "channels": 1,
        "format": "PCM16 WAV",
        "duration_seconds": round(len(pcm) / 24000, 4),
        "normalization_gain_db": db(gain),
        **stats(measured),
        "clipped_samples": int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        "generation_metadata_file": str(MANIFEST.relative_to(ROOT)),
        "raw_sidecar_metadata_file": str(sidecar.relative_to(ROOT)) if sidecar.exists() else None,
        "generation_metadata": {**generation_settings, **asset},
        "raw_sidecar_metadata": metadata,
        "generation_metadata_status": "Captured browser settings and prompt from the generation manifest. The model ID is inferred from official documentation, not shown by the website. No seed was available.",
    }
    return pcm, record


def atomic_write(path, writer):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=path.suffix, delete=False) as temp:
        temporary = Path(temp.name)
    try:
        writer(temporary)
        temporary.chmod(0o644)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate present sources without writing assets or provenance.")
    args = parser.parse_args()
    config = json.loads(MANIFEST.read_text())
    generation_settings = {key: value for key, value in config.items() if key != "assets"}
    assets = config.get("assets", [])
    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a nonempty assets list")
    seen = set()
    for asset in assets:
        if not isinstance(asset, dict) or asset.get("rawFile") not in MAPPINGS or MAPPINGS[asset["rawFile"]] != asset.get("file"):
            raise ValueError("Manifest asset does not match an allowed raw/output filename pair")
        if asset["file"] in seen:
            raise ValueError(f"Duplicate output filename: {asset['file']}")
        seen.add(asset["file"])
        if not isinstance(asset.get("prompt"), str) or not asset["prompt"].strip():
            raise ValueError(f"Missing captured prompt: {asset['file']}")
    results = []
    for asset in assets:
        source_name, output_name = asset["rawFile"], asset["file"]
        if not (RAW / source_name).is_file():
            print(f"{source_name}: missing; skipped", flush=True)
            continue
        pcm, record = process(asset, generation_settings)
        results.append((pcm, record))
        print(f"{output_name}: {record['duration_seconds']}s, RMS {record['rms_dbfs']} dBFS, peak {record['peak_dbfs']} dBFS", flush=True)
    if args.dry_run or not results:
        print(f"Validated {len(results)} present asset(s); no files written.", flush=True)
        return
    prior = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    records = {record["file"]: record for record in prior.get("assets", [])}
    for pcm, record in results:
        path = DEST / record["file"]
        atomic_write(path, lambda temp: wavfile.write(temp, 24000, pcm))
        record.update({"sha256": sha256(path), "bytes": path.stat().st_size})
        records[record["file"]] = record
    report = {
        "service": "ElevenLabs Sound Effects",
        "generation_settings": generation_settings,
        "generation_manifest": str(MANIFEST.relative_to(ROOT)),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "usage": "Scream takes for gameplay and comparison; see each asset's usage",
        "created_by": "Offline processing of downloaded generated audio; no remote generation by this tool",
        "processing": PROCESSING,
        "auditory_qa": "Not performed by this processor; objective signal checks only. Downloaded variants are unranked.",
        "assets": list(records.values()),
    }
    atomic_write(REPORT, lambda temp: temp.write_text(json.dumps(report, indent=2) + "\n"))
    print(f"Wrote {len(results)} scream asset(s) and {REPORT.relative_to(ROOT)}.", flush=True)


if __name__ == "__main__":
    main()
