#!/usr/bin/env python3
"""Process downloaded slot and craps-stick WAVs offline.

Requires numpy and scipy. Reads prompts.json and processes only the eight
allowed output names. Never generates, downloads, retries, or changes gameplay.
"""

import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/zombie-audio"))
from process_medium import db, input_format, sha256, stats
from process_elevenlabs import atomic_write

RAW = ROOT / "outputs/casino-effects"
DEST = ROOT / "public/audio/casino"
REPORT = ROOT / "docs/casino-effects/provenance.json"
MANIFEST = Path(__file__).with_name("prompts.json")
ALLOWED = {
    f"{kind}-elevenlabs-{number:02d}.wav"
    for kind in ("slot-attract", "craps-stick-swipe")
    for number in range(1, 5)
}
RATE = 48000
PROCESSING = (
    "Average channels to mono; preserve 48000 Hz sources (polyphase resample "
    "other source rates to 48000 Hz); first-order zero-phase Butterworth "
    "highpass at 60 Hz, with no added lowpass; 2 ms sine-squared attack fade; "
    "25 ms sine-squared tail fade for slots and 15 ms for stick swipes; "
    "target -21 dBFS full-clip RMS with -3 dBFS peak ceiling; signed PCM16 WAV. "
    "No pitch shift, time stretch, trimming, layering, or dynamic compression."
)


def activity(audio, rate):
    window = max(1, round(0.005 * rate))
    padded = np.pad(audio, (0, (-len(audio)) % window))
    levels = np.sqrt(np.mean(padded.reshape(-1, window) ** 2, axis=1))
    threshold_db = max(-45.0, db(np.max(levels)) - 25.0)
    active = np.flatnonzero(levels >= 10 ** (threshold_db / 20))
    return {
        "rms_window_ms": 5,
        "threshold_rule": "25 dB below peak 5 ms RMS, with an absolute floor of -45 dBFS; not a listening judgment",
        "threshold_dbfs": round(threshold_db, 3),
        "start_seconds": round(float(active[0]) * window / rate, 4) if len(active) else None,
        "end_seconds": round(min((float(active[-1]) + 1) * window, len(audio)) / rate, 4) if len(active) else None,
    }


def process(asset, settings):
    source = RAW / asset["rawFile"]
    fmt = input_format(source)
    rate, samples = wavfile.read(source)
    if samples.ndim not in (1, 2) or len(samples) == 0 or rate <= 0:
        raise ValueError(f"Empty or invalid source: {source.name}")
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
        raise ValueError(f"Non-finite source samples: {source.name}")
    audio = decoded.mean(axis=1) if decoded.ndim == 2 else decoded.copy()
    if rate != RATE:
        divisor = math.gcd(rate, RATE)
        audio = signal.resample_poly(audio, RATE // divisor, rate // divisor)
    if len(audio) < 32:
        raise ValueError(f"Audio too short for filtering: {source.name}")
    audio = signal.sosfiltfilt(signal.butter(1, 60, btype="highpass", fs=RATE, output="sos"), audio)
    tail_ms = 25 if asset["file"].startswith("slot-attract-") else 15
    attack = min(round(0.002 * RATE), len(audio) // 2)
    tail = min(round(tail_ms / 1000 * RATE), len(audio) // 2)
    audio[:attack] *= np.sin(np.linspace(0, math.pi / 2, attack)) ** 2
    audio[-tail:] *= (np.sin(np.linspace(0, math.pi / 2, tail)) ** 2)[::-1]
    rms = np.sqrt(np.mean(audio * audio))
    peak = np.max(np.abs(audio))
    if not np.isfinite(audio).all() or rms < 1e-6 or peak < 1e-5:
        raise ValueError(f"Non-finite or near-silent processed source: {source.name}")
    gain = min(10 ** (-21 / 20) / rms, 10 ** (-3 / 20) / peak)
    pcm = np.round(audio * gain * 32767).astype(np.int16)
    measured = pcm.astype(np.float64) / 32768
    sidecar = source.with_name(source.name + ".json")
    record = {
        "file": asset["file"],
        "direction": asset.get("direction"),
        "usage": asset.get("usage", "Audition only; not selected for gameplay"),
        "raw_file": str(source.relative_to(ROOT)),
        "raw_sha256": sha256(source),
        "raw_bytes": source.stat().st_size,
        "input_format": {**fmt, "decoded_dtype": str(samples.dtype)},
        "source_duration_seconds": round(len(samples) / rate, 4),
        "source_signal": stats(decoded),
        "sample_rate": RATE,
        "channels": 1,
        "format": "PCM16 WAV",
        "duration_seconds": round(len(pcm) / RATE, 4),
        "attack_fade_ms": 2,
        "tail_fade_ms": tail_ms,
        "normalization_gain_db": db(gain),
        **stats(measured),
        "rms_activity": activity(measured, RATE),
        "clipped_samples": int(np.count_nonzero(np.abs(pcm.astype(np.int32)) >= 32767)),
        "generation_metadata_file": str(MANIFEST.relative_to(ROOT)),
        "generation_metadata": {**settings, **asset},
        "raw_sidecar_metadata_file": str(sidecar.relative_to(ROOT)) if sidecar.exists() else None,
        "raw_sidecar_metadata": json.loads(sidecar.read_text()) if sidecar.exists() else None,
        "generation_metadata_status": "Exact prompt and settings copied from the captured manifest; model identity evidence is recorded there. No seed or subjective quality ranking is inferred.",
    }
    return pcm, record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate present raw WAVs without writing assets or provenance.")
    args = parser.parse_args()
    config = json.loads(MANIFEST.read_text())
    settings = {key: value for key, value in config.items() if key != "assets"}
    assets = config.get("assets", [])
    if not isinstance(assets, list) or not assets:
        raise ValueError("Manifest must contain a nonempty assets list")
    seen = set()
    raw_names = set()
    for asset in assets:
        if not isinstance(asset, dict) or asset.get("file") not in ALLOWED:
            raise ValueError("Manifest asset does not match an allowed output name")
        raw = asset.get("rawFile")
        if not isinstance(raw, str) or Path(raw).name != raw or not raw.endswith(".wav"):
            raise ValueError("Raw source must be a WAV basename")
        if asset["file"] in seen or raw in raw_names:
            raise ValueError(f"Duplicate output or raw source: {asset['file']}")
        seen.add(asset["file"])
        raw_names.add(raw)
        if not isinstance(asset.get("prompt"), str) or not asset["prompt"].strip():
            raise ValueError(f"Missing captured prompt: {asset['file']}")
    results = []
    for asset in assets:
        if not (RAW / asset["rawFile"]).is_file():
            print(f"{asset['rawFile']}: missing; skipped", flush=True)
            continue
        pcm, record = process(asset, settings)
        results.append((pcm, record))
        print(f"{asset['file']}: {record['duration_seconds']}s, RMS {record['rms_dbfs']} dBFS, peak {record['peak_dbfs']} dBFS", flush=True)
    if args.dry_run or not results:
        print(f"Validated {len(results)} present asset(s); no files written.", flush=True)
        return
    prior = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    records = {record["file"]: record for record in prior.get("assets", [])}
    for pcm, record in results:
        path = DEST / record["file"]
        atomic_write(path, lambda temp: wavfile.write(temp, RATE, pcm))
        record.update({"sha256": sha256(path), "bytes": path.stat().st_size})
        records[record["file"]] = record
    report = {
        "service": "ElevenLabs Sound Effects",
        "generation_settings": settings,
        "generation_manifest": str(MANIFEST.relative_to(ROOT)),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "usage": settings.get("usage", "Casino sound effects; see each asset's usage"),
        "created_by": "Offline processing of downloaded generated audio; no remote generation by this tool",
        "processing": PROCESSING,
        "auditory_qa": "Not performed by this processor; objective signal checks only. Variants are not ranked by listening.",
        "assets": list(records.values()),
    }
    atomic_write(REPORT, lambda temp: temp.write_text(json.dumps(report, indent=2) + "\n"))
    print(f"Wrote {len(results)} casino audition asset(s) and {REPORT.relative_to(ROOT)}.", flush=True)


if __name__ == "__main__":
    main()
