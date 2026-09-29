# Casino sound effects

These are ElevenLabs Sound Effects studies for a slot-machine attract cue and a
craps-stick swipe. Three user-selected takes are active in gameplay.

## User selection

- Craps-stick swipe **A and D** (`craps-stick-swipe-elevenlabs-01.wav` and
  `craps-stick-swipe-elevenlabs-04.wav`): choose randomly between these two takes
  for each swing, with an independent 50/50 draw (consecutive repeats are allowed).
- Slot **D** (`slot-attract-elevenlabs-04.wav`): play on the **speakeasy slot-handle
  pull only**. It is not selected for a pass-by attract cue.
- The other five takes remain available for comparison and are not selected
  for gameplay.

The slot filename and original prompt retain their generation-time “attract”
label. The later user selection changes the intended trigger to the handle pull;
it does not rewrite the original prompt or alter the audio. The manifest and
provenance record this distinction.

Exactly one generation batch was completed for each sound. The interface creates
four variations automatically per batch; exporting those variations does not
mean four generation submissions. Requested lengths are 1.5 seconds for slots
and 0.6 seconds for the stick swipe. No additional generation or retry is part
of the offline processor.

All eight variations were downloaded and processed. The slot downloads measure
1.48 seconds each despite the 1.5-second request; the four stick downloads
measure 0.6 seconds each. Processing preserves those actual source lengths.
The completed interface showed 60 credits for the slot batch (9,400 → 9,340)
and 24 for the stick batch (9,340 → 9,316): **84 credits total**.

All outputs are mono 48 kHz PCM16 WAVs. Source/output hashes, exact durations,
format, edge fades, captured metadata, and absence of full-scale clipping were
checked. No listening review or subjective ranking has been performed by the
processor; prompt adherence remains for audition.

| Asset | Actual length | RMS | Peak |
| --- | ---: | ---: | ---: |
| `slot-attract-elevenlabs-01.wav` | 1.48 s | -23.594 dBFS | -3.000 dBFS |
| `slot-attract-elevenlabs-02.wav` | 1.48 s | -28.115 dBFS | -3.000 dBFS |
| `slot-attract-elevenlabs-03.wav` | 1.48 s | -25.510 dBFS | -3.000 dBFS |
| `slot-attract-elevenlabs-04.wav` | 1.48 s | -25.801 dBFS | -3.000 dBFS |
| `craps-stick-swipe-elevenlabs-01.wav` | 0.60 s | -23.678 dBFS | -3.000 dBFS |
| `craps-stick-swipe-elevenlabs-02.wav` | 0.60 s | -21.000 dBFS | -6.226 dBFS |
| `craps-stick-swipe-elevenlabs-03.wav` | 0.60 s | -21.000 dBFS | -3.594 dBFS |
| `craps-stick-swipe-elevenlabs-04.wav` | 0.60 s | -21.000 dBFS | -3.516 dBFS |

## Runtime behavior

`WeaponSounds` loads only the two selected AI swing takes alongside the original
weapon foley. Each stick `melee` event draws A or D independently; axe swings,
impacts, and stick breaks keep their own cues. If the selected recording fails
to load, the original local swing remains available.

Accepted speakeasy handle pulls emit `mysterySpin`, which plays Slot D once.
Rejected or duplicate pulls emit no spin cue. Actual craps rolls and cabinet
pass-by sounds retain their original routing. New recordings stop with pause,
fresh-run reset, and disposal. No generation service is called during gameplay.

## Files and provenance

- Captured prompts, settings, variations, batch identifiers, and credit evidence:
  `tools/casino-effects/prompts.json`.
- Original downloaded WAVs: `outputs/casino-effects/`, excluded from Git by the
  existing `/outputs/` rule. Their exact names are recorded in the manifest.
- Final slot files: `public/audio/casino/slot-attract-elevenlabs-01.wav` through
  `slot-attract-elevenlabs-04.wav`.
- Final stick files: `public/audio/casino/craps-stick-swipe-elevenlabs-01.wav`
  through `craps-stick-swipe-elevenlabs-04.wav`.
- Measured formats, lengths, levels, activity thresholds, raw/output SHA-256
  hashes, and exact generation metadata: `docs/casino-effects/provenance.json`.

The manifest attributes the model to `eleven_text_to_sound_v2` from official
documentation; the website did not display a model selector. Prompt influence
was 30%, with looping, automatic prompt enhancement, and public sharing off.
The provider's four variations per batch are preserved in their displayed order.

## Offline processing

Run from the repository root with Python 3, NumPy, and SciPy installed:

```sh
# Validate actual downloaded WAVs without writing files.
python3 tools/casino-effects/process.py --dry-run

# Process present WAVs and write separate casino-effects provenance.
python3 tools/casino-effects/process.py
```

The processor reads only the eight allowed output names and their manifest
sources, skips missing downloads, and never generates substitutes. It preserves
the raw files, averages channels to mono, and keeps 48 kHz PCM16 output. Other
source rates are resampled to 48 kHz without changing playback duration. Asset
usage and user-selection metadata come from the manifest and survive processing
reruns; reprocessing does not revert selected takes to audition-only status.

A first-order zero-phase 60 Hz highpass removes DC and low rumble; there is no
added lowpass. A 2 ms attack fade and short tail fades suppress edge clicks while
preserving the brief cues: 25 ms for slots and 15 ms for the stick swipe. Gain
targets -21 dBFS full-clip RMS with a -3 dBFS peak ceiling. The peak ceiling takes
priority, so a transient-heavy take can measure below the RMS target. No pitch
shift, time stretch, trimming, layering, or dynamic compression is applied.

Activity measurements use 5 ms RMS windows, with a threshold 25 dB below the
peak window RMS and a -45 dBFS absolute floor. They describe signal activity,
not a listening judgment about the attack, decay, or suitability of a take.
