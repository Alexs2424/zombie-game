# Zombie voice assets

The game plays local WAV files generated once with ElevenLabs Sound Effects and
Stability AI's official
[Stable Audio 3 demo](https://huggingface.co/spaces/stabilityai/stable-audio-3).
It does not call an AI service during gameplay.

## Selected higher-pitch ElevenLabs variations

Four user-selected three-second variations from one ElevenLabs Sound Effects prompt appear
first on `/audio/zombies/medium-preview.html`: Take A–D map to
`scream-elevenlabs-high-01.wav` through `scream-elevenlabs-high-04.wav`.
The prompt explicitly requests a zombie noise for a survival-horror video game,
with a piercing upper register, shredded rasp, upward pitch breaks, a faint low
growl, and a ragged sustain ending in a snarl. It requests no speech, music,
ambience, or reverb. This one batch used 120 credits, leaving 9,520 at generation
time. Exact prompts and recorded batches are in
`tools/zombie-audio/elevenlabs-prompts.json`.

These are four variations of the same requested direction, without assigned
character differences or quality rankings. The user approved all four Takes A–D;
they now form the active last-zombie pool, rotating across rounds without an
immediate repeat. The previous `scream-elevenlabs-03.wav` is retained beside them
for comparison only. The zombie section has 13 players: eight active cues (these four plus
four Medium cues) and five comparisons.

## ElevenLabs scream selection and comparisons

Three original wordless, higher-register scream directions are also available on
`/audio/zombies/medium-preview.html`: `scream-elevenlabs-01.wav` (piercing shriek),
`scream-elevenlabs-02.wav` (raspy scream), and `scream-elevenlabs-03.wav` (scream
with a quieter growl). The user initially selected direction 03 for gameplay,
then replaced it with all four higher-pitch Takes A–D. All three original
directions are now comparison assets only.

Each prompt produced four variants in ElevenLabs Sound Effects. Variation 1
from each batch was initially exported for comparison, without ranking by
listening. The user's first gameplay selection was `scream-elevenlabs-03.wav`,
before the later Takes A–D selection.
Settings were 3 seconds, 30% prompt influence, looping off, prompt enhancement
off, and public sharing disabled. The three successful batches used 360 credits
from the account's free allowance, leaving 9,640 at generation time.

Exact prompts and captured settings are in
`tools/zombie-audio/elevenlabs-prompts.json`; signal measurements and hashes are
in `elevenlabs-provenance.json`. The website did not display a model ID; the
recorded v2 identifier is inferred from the official Sound Effects API default.
Original 48 kHz WAV downloads remain under `outputs/zombie-audio-elevenlabs/`.
Reprocess those local files with `python3 tools/zombie-audio/process_elevenlabs.py`.
The local playback copies are mono 24 kHz PCM16, all 3 seconds and -21 dBFS RMS, with
80 Hz highpass, 8 kHz lowpass, short fades, and a -3 dBFS peak ceiling. No pitch
shift or dynamic compression was applied. Objective checks passed. The gameplay
selection records the user's choice; cue descriptions remain prompt directions,
not an agent's listening assessment.

## Medium batch

Six takes use `stabilityai/stable-audio-3-medium` (the demo's Medium general audio
model), with eight steps, CFG 1, and the `pingpong` sampler. All six files were
generated, downloaded, and processed successfully. Four Medium cues are active
in gameplay: both chase variations, attack, and death. Both Medium last-zombie
takes are retained for comparison only.

| Asset | Intended cue | Length | RMS | Peak |
| --- | --- | ---: | ---: | ---: |
| `last-medium-02.wav` | Previous drawn-out raspy open-vowel moan; comparison only | 4 s | -23.329 dBFS | -3.000 dBFS |
| `last-medium-01.wav` | Previous Medium last-zombie groan and sigh; comparison only | 3 s | -21.000 dBFS | -6.184 dBFS |
| `chase-medium-01.wav` | Husky exertion grunts and raspy exhale | 3 s | -22.346 dBFS | -3.000 dBFS |
| `chase-medium-02.wav` | Higher gravelly growl and wheezing grunt | 3 s | -21.000 dBFS | -6.272 dBFS |
| `attack-medium-01.wav` | Compact attack grunt and breathy snarl | 2 s | -22.090 dBFS | -3.000 dBFS |
| `death-medium-01.wav` | Defeated groan falling into a soft exhale | 2 s | -21.000 dBFS | -3.639 dBFS |

`last-medium-02.wav` initially replaced `last-medium-01.wav` in gameplay. Its
requested refinement was a longer, raspy, open-vowel “aaahhh-AH-ah” moan, with
wavering pitch and a ragged finish, taking its general vocal direction from
classic COD Zombies. It is a generated performance; no original game recording
was reused. ElevenLabs `scream-elevenlabs-03.wav` subsequently replaced it; the
current last-zombie pool uses the four selected higher-pitch Takes A–D.
Both Medium last-zombie takes and the original Small SFX `last-01.wav` remain as
historical files, outside the active last-zombie playback pool. Both Medium chase
takes join the original `chase-01.wav`; the original `horde-01.wav` remains the
horde cue. The Medium attack and death takes voice those gameplay events.

Open `/audio/zombies/medium-preview.html` on the running game server to audition
the four selected higher-pitch last-zombie variations, all three original
ElevenLabs scream comparisons, four current Medium cues, and both previous
Medium last-zombie performances. The original Small SFX take is no longer on this page.
The page uses native audio controls, never autoplays, and pauses other clips when
one is played. It can also be opened directly from
`public/audio/zombies/medium-preview.html`.

Objective file and signal checks passed: all six outputs are mono 24 kHz
PCM16 WAVs, have finite samples, contain no full-scale clipped samples, and have
peaks at or below -3 dBFS. These checks do not verify the Medium takes' perceived
sound. Their cue descriptions are prompt directions, not verified descriptions
of the generated performances.

The revised last-zombie take uses seed `26092906` and a requested duration of
four seconds. Its measured activity spans approximately 0.08–3.15 seconds,
with no full-scale clipped samples. Its higher crest factor makes the -3 dBFS
peak ceiling take priority over the -21 dBFS RMS target. These measurements do
not establish whether the generated delivery matches the requested moan.

### Initial five-take integration validation

- 183 automated tests pass, including attack priority, chase variation, death
  throttling, source death, floor height, partial loads, and pause/reset/disposal.
- TypeScript, scoped ESLint, and the production build pass. The build retains
  the existing Vinext configuration and dynamic-import warnings.
- The running development game reports `7/7 clips ready`, and its survivor
  audition reports `last (AI clip)`; attack playback also reports `attack (AI clip)`.
- At this validation, all six audition-page players (the initial five Medium
  takes plus the Small SFX survivor comparison) loaded their actual WAV durations
  without media errors or autoplay.
- The survivor development audition keeps its zombie stationary so the higher
  priority attack cue does not cut off the comparison. Normal gameplay is unchanged
  by that development-only setup.

### Medium provenance and commands

- Exact prompts, requested durations, seeds, and parameters:
  `tools/zombie-audio/medium-prompts.json`.
- Actual hashes, source formats, captured generation metadata, processing recipe,
  and measured output levels: `docs/zombie-audio/medium-provenance.json`.
- Explicit generator: `tools/zombie-audio/generate_medium.py`.
- Offline processor: `tools/zombie-audio/process_medium.py`.
- Raw WAVs and captured service responses: `outputs/zombie-audio-medium/`,
  excluded from Git by the existing `/outputs/` rule.

The initial three Medium takes (last zombie and both chase variations) used the
anonymous public demo API. The attack and death takes and the revised last-zombie
take used a user-approved, fine-grained Hugging Face token for account quota.
The token was held only in
process memory; it was not persisted in scripts, manifests, raw metadata, or
provenance. Browser login is not automatically reused by the Python generator.
Service errors occurred during the batch; the death take eventually completed
successfully. No asset is pending.

From the repository root, with Python 3, NumPy, and SciPy installed:

```sh
# Explicitly generate missing raw files with account quota.
# The token prompt is hidden and the token stays in process memory.
python3 tools/zombie-audio/generate_medium.py --generate --prompt-token

# Optional: restrict generation to one manifest entry.
python3 tools/zombie-audio/generate_medium.py --generate --prompt-token --asset last-medium-02.wav

# Validate present raw files offline without writing assets or provenance.
python3 tools/zombie-audio/process_medium.py --dry-run

# Process present raw files offline and write separate Medium provenance.
python3 tools/zombie-audio/process_medium.py
```

The generator also accepts `HF_TOKEN` from the process environment; do not put a
token in a checked-in file or command argument. Existing raw files are reused,
and the generator stops at the first service error or quota limit. There is no
automatic generation retry. Running without a token uses the anonymous allowance.
Generation consumes the applicable Hugging Face quota; it is not part of game
runtime. HTTPS certificate verification remains enabled.

The offline processor averages channels to mono, resamples to 24 kHz, applies
second-order zero-phase Butterworth filters at 80 Hz and 6 kHz, and adds 25 ms
sine-squared fades. It targets -21 dBFS full-clip RMS with a -3 dBFS peak ceiling;
the ceiling takes priority for higher-crest-factor clips. It records raw and
processed hashes and preserves captured service metadata without claiming
listening review. Missing raw files are skipped, never generated or substituted.
The original `docs/zombie-audio/provenance.json` remains unchanged.

These file levels are separate from gameplay volume, spatial attenuation,
cooldowns, and simultaneous-voice limits. Keep the provenance files with the
assets. See the [Medium model card](https://huggingface.co/stabilityai/stable-audio-3-medium)
and the source and usage links in the original batch record below.

## Original Small SFX batch — historical record

The following records the earlier Small SFX batch, including its original quota
failure. It does not describe the status or model of the completed Medium batch.

The original batch consists of one-off AI-generated WAVs from Stability AI's official public
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

### Original generation and reproducibility

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
remain in the manifest for a later batch; **those three original Small SFX follow-up files were not
generated or included in that batch**. There is no quota workaround or automatic retry.

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

### Original audio processing

The assets are mono 24 kHz PCM16 WAV. Stereo channels are averaged, resampled
using SciPy's polyphase resampler, then filtered with second-order zero-phase
Butterworth filters at 80 Hz (highpass) and 6 kHz (lowpass). Both ends receive
25 ms sine-squared fades. The full-clip RMS target is -21 dBFS, with a hard gain
ceiling of -3 dBFS peak. The chase clip's crest factor means the peak ceiling
takes priority, so its RMS is slightly lower. No dynamic compressor or distortion
was applied.

These file levels are separate from gameplay volume, distance attenuation,
cooldowns, and simultaneous-voice limits in the playback system.

### Original source and usage terms

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
