# 1970s arsenal foley — source notes

Every file in this folder is original and **synthesized** by
`tools/weapon-1970s/make_sounds.py` from noise, damped partials and filters. There are no recordings,
library samples or commercial weapon sounds. The recipe and length of each file are in `notes.json`.

Format: 44.1 kHz, mono, 16-bit PCM WAV, peak-normalised (reports to −0.45 dBFS, mechanical foley lower).
Stereo placement, per-weapon gain and ±2.5% pitch variation are applied at runtime (`lib/game/weapon-audio.ts`).

## Building blocks

| Layer | Model |
| --- | --- |
| Muzzle report | 0.1 ms-attack noise blast + low-passed "bright" and "dark" bodies + pitch-falling sine thump, each normalised and mixed so the transient sits ~10 dB above the body by 30 ms, then soft-clipped |
| Supersonic crack | 0.18–0.34 ms N-wave (magnum, rifles, LMG, 9 mm); absent on subsonic .45 and shotguns |
| Steel parts | Modal synthesis: 5–6 inharmonic partials (620 Hz–9.8 kHz), 4–40 ms decays, noise strike |
| Brass | Long bright ring (3.3–12.8 kHz, up to 160 ms) with bounce trains for dropped cases |
| Wood / Bakelite / plastic | Low, fast-decaying partials (150 Hz–3.6 kHz) with soft strikes; stick-slip pulse trains for fore-end creak |
| Slides, springs, air | Band-limited friction noise with grain, damped chirps, band-swept whooshes for melee |
| Room | Casino room baked lightly into every file: six early reflections (7–40 ms) + energy-normalised 0.4–1.8 s warm diffuse tail (carpet and velvet roll off the highs); the game adds its own reverb send on top |

## Per-weapon signatures

- **High Roller** (`magnum`): double-action click 12 ms before a bright magnum crack, 115→55 Hz thump, cylinder ring; six separate brass impacts on eject; crane closes with a hard snap.
- **Chicago Typewriter** (`tommy`): three low subsonic reports with a heavy receiver clack and drum rattle; hollow drum-cavity thump on insertion (170/310/520 Hz); long, heavy bolt pull.
- **Double or Nothing** (`doublebarrel`): 72→36 Hz boom; `fire-alt` is both barrels 7 ms apart; lever click, fore-end creak, extractor pop, brass breech snap, two hammer cocks.
- **Snake Eyes** (`dual`): separate right (.25, brighter) and left (.32, lower) reports with their own slide clicks, panned ±0.3 at runtime.
- **The Enforcer** (`machinepistol`): thin forceful 9 mm with four rapid bolt clicks per shot, so the rate reads through rhythm rather than bass.
- **Silver Dollar** (`lever`): crisp rifle crack + walnut resonance; lever `cycle` / `cycle-close` clacks; spring-loaded gate and tube for each cartridge.
- **Last Call** (`autoshotgun`): broad report with the gas bolt cycling underneath; brass-and-plastic shell clicks; distinct final bolt closure.
- **The Eye in the Sky** (`sniper`): restrained crack and long wooden resonance; dry bolt lift/throw and close; stripper clip rounds.
- **House Edge** (`lmg`): deep report with link, case and carrier in every shot; `belt-end` clatter on the last link; cover latch, box slide, box seat, cover slam, charging-handle slam.
- **The Debt Collector** (`launcher`): hollow 155→95 Hz tube thump, `flight` hiss, concussive `explode` (40 Hz boom, debris, long tail); reload in four beats: latch, hinge, shell, latch.
- **Stickman** (`stick`): cane whistle and dry wood creak, three blunt impact variants, fibrous wooden crack, splinters and tumbling wood on `break`.
- **Fire Exit** (`axe`): heavy low whoosh, chop impacts, break-glass cabinet on pickup.

Objective checks (onset position, level at 30/110/300 ms, spectrogram shape) were run while tuning.
These are synthetic approximations and have not yet been judged by ear in a playtest.

Thrown grenades and launcher impacts share the revised heavy blast cue: sharp pressure front, falling low-frequency body, irregular rumble, scattered debris and warm room reflections. It is original synthesized sound, not a live-explosive recording. Grenade throws preload the sample; the runtime retains a layered fallback when audio loading fails.

All 94 game cues are packed into `assets/source/weapons-1970s/weapon-sound-audition.blend` as editable sound strips with weapon chapter markers. Open it in Blender and press Space to audition. Synthesis remains reproducible in Python; Blender is the native model authoring and sound audition workspace. A 32-second mixed preview is in `docs/weapon-1970s-assets/weapon-sound-showcase.wav`.
