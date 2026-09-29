# Restaurant service bell

The user selected Bell A, `restaurant-bell-01.wav`, as the restaurant service
bell that starts Last Service. The existing `hotelBell` event now plays this
local ElevenLabs Sound Effects recording. Bells B–D remain comparison files.
The challenge trigger and timing are unchanged: 35 seconds, a budget of 12
ambush zombies, and a first spawn delay of 0.7 seconds.

Only Bell A is loaded by gameplay. If loading or decoding fails, the original
synthesized bell remains available. The recording uses the world volume bus,
keeps the existing two-second ambience duck, and stops on pause, focus loss,
new-run reset, retrigger, or disposal. Playback never calls an AI service.

## Requested sound

All four variants use the same direction: one firm press of a vintage metal
counter bell, a mechanical click followed immediately by a bright DING, rich
metal overtones, and a roughly two-second decay. The prompt excludes repeated
strikes, voices, zombies, music, ambience, and reverb. Bell A–D are variation
labels, not quality rankings or claimed differences in the performances.

## Playback and comparison files

| Take | Local file | Requested length | Status |
| --- | --- | ---: | --- |
| Bell A | `public/audio/restaurant/restaurant-bell-01.wav` | 3 s | Selected; active hotelBell cue |
| Bell B | `public/audio/restaurant/restaurant-bell-02.wav` | 3 s | Comparison only |
| Bell C | `public/audio/restaurant/restaurant-bell-03.wav` | 3 s | Comparison only |
| Bell D | `public/audio/restaurant/restaurant-bell-04.wav` | 3 s | Comparison only |

Open `/audio/zombies/medium-preview.html` on the running game server. The four
bell players are in the restaurant-bell section; all 13 existing zombie players
remain in a separate expandable section. Native controls require manual playback and pause other
clips when one starts. Bell A is marked as selected; the other three takes
remain available for comparison.

## Generation and processing record

One batch produced all four variants with 3-second duration, 30% prompt influence,
looping off, prompt enhancement off, and public sharing disabled. It used 120
credits, leaving 9,400 at generation time. The website did not show a model ID;
`eleven_text_to_sound_v2` is recorded from the documented API default, with that
limitation preserved in the metadata.

- Exact prompt and captured settings: `tools/restaurant-bell/prompts.json`.
- File hashes, measurements, and processing recipe: `docs/restaurant-bell/provenance.json`.
- Original stereo WAV downloads: `outputs/restaurant-bell/`.
- Offline processor: `tools/restaurant-bell/process.py`.

The playback files are mono 48 kHz PCM16 WAVs. Processing averages channels,
removes low rumble with a 60 Hz highpass, retains the bell's upper frequencies
without a lowpass, and applies 2 ms attack and 40 ms tail fades. The -3 dBFS peak
ceiling takes priority over the -21 dBFS RMS target; measured RMS ranges from
-28.104 to -23.496 dBFS. No pitch shift, time stretch, trimming, or dynamic
compression was applied. All four files measure 3 seconds with no full-scale
clipped samples. These objective checks do not rank their sound.

Run `python3 tools/restaurant-bell/process.py --dry-run` from the repository root
to validate local raw files, or omit `--dry-run` to reprocess them. This processor
makes no generation requests and spends no credits.
