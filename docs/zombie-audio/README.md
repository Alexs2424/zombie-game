# Zombie voice assets

These are actual one-off AI-generated WAVs from Stability AI's official public
[Stable Audio 3 demo](https://huggingface.co/spaces/stabilityai/stable-audio-3),
using `stabilityai/stable-audio-3-small-sfx`. The game loads the local audio files;
it does not call an AI service while running.

| Asset | Intended cue | Length | RMS | Peak |
| --- | --- | ---: | ---: | ---: |
| `chase-01.wav` | A nearby zombie is pursuing the player; tired exertion grunts | 3 s | -22.383 dBFS | -3.000 dBFS |
| `last-01.wav` | Only one zombie remains; confused groan and disappointed sigh | 3 s | -21.000 dBFS | -5.776 dBFS |
| `horde-01.wav` | Nearby group; quiet disorganized overlapping groans | 4 s | -21.000 dBFS | -3.740 dBFS |

The prompt direction is soft, nonverbal, mildly comic, without music, screaming,
or a jump-scare attack. AI output adherence has not been verified by listening;
the generating agent performed objective audio checks only. Auditioning these
three clips remains useful for judging the performance and humor.

## Generation and reproducibility

- Exact prompts, seeds, and parameters: `tools/zombie-audio/prompts.json`.
- Actual asset hashes, generation event IDs, source format, processing recipe,
  and measured levels: `docs/zombie-audio/provenance.json`.
- Generator and offline processor: `tools/zombie-audio/generate.py`.
- Raw stereo WAVs and original service response records:
  `outputs/zombie-audio/`, deliberately excluded by the existing `/outputs/`
  Git ignore rule. These files are local generation intermediates, not shipped.

The generator uses the service's public Gradio API, `POST
/gradio_api/call/infer`, followed by its SSE result endpoint. Each request uses
the Small SFX model, eight steps, CFG 1, and the `pingpong` sampler. Generation
was anonymous and incurred no subscription or payment.

The first three files succeeded. The fourth request (`chase-02.wav`, event
`6ae1d8d3f9644f2d9f33407643f4bd4e`) was rejected with `ZeroGPU quota exceeded`
(`90s requested vs. 0s left`). Generation stopped immediately. The `-02` prompts
remain in the manifest for a later batch; **those three files have not been
generated or included**. There is no quota workaround or automatic retry.

From the repository root, with Python 3, NumPy, and SciPy installed:

```sh
# Reprocess locally available raw files; never contacts the service.
python3 tools/zombie-audio/generate.py --process-only

# Explicitly generate missing assets using the public service's available quota.
# Existing raw files are reused. Stops at the first service error.
python3 tools/zombie-audio/generate.py
```

If `certifi` is installed, its trusted CA bundle is used for HTTPS verification;
otherwise Python's default trust store is used. Certificate verification remains
enabled.

## Audio processing

The assets are mono 24 kHz PCM16 WAV. Stereo channels are averaged, resampled
using SciPy's polyphase resampler, then filtered with second-order zero-phase
Butterworth filters at 80 Hz (highpass) and 6 kHz (lowpass). Both ends receive
25 ms sine-squared fades. The full-clip RMS target is -21 dBFS, with a hard gain
ceiling of -3 dBFS peak. The chase clip's crest factor means the peak ceiling
takes priority, so its RMS is slightly lower. No dynamic compressor or distortion
was applied.

These file levels are separate from gameplay volume, distance attenuation,
cooldowns, and simultaneous-voice limits in the playback system.

## Source and usage terms

The service and model are published by Stability AI. Keep this provenance with
the assets. See the current [Stability AI license page](https://stability.ai/license),
[Community License Agreement](https://stability.ai/community-license-agreement),
and [model card](https://huggingface.co/stabilityai/stable-audio-3-small-sfx).

At generation time, the license page includes Stable Audio 3 in the free
Community tier for creators and organizations below $1M annual revenue and says
creators own generated outputs. The agreement excludes model outputs from its
definition of model derivative works and specifies registration for commercial
use of the model. This repository ships generated audio, not model weights or
a hosted model service.

Anonymous availability is governed by Hugging Face's
[ZeroGPU quotas](https://huggingface.co/docs/hub/spaces-zerogpu); availability and
quotas may change.
