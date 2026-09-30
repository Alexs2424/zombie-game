> Historical pass 3 snapshot, superseded by ../README.md. Links below were relative to the original gun-audio folder.

# Gun report redesign

The user requested more inventive gun sounds and authorized trying the ElevenLabs key in `.env`.

## Working sound direction

Gritty, physical crime-film reports with distinct silhouettes: the Dead Man’s Hand has a heavy low bark; High Roller a sharper magnum crack; Room Service and Double or Nothing move more air; Thompson fire has a chunky receiver character; compact automatics stay short and bright. The launcher keeps a hollow discharge. Four collectible guns add deliberately comic accents as specified below; the remaining eleven retain the grounded palette. These are generated effects, not verified recordings of specific real firearms.

## Current personality palette

User direction: vary the guns further to give them more personality. This supersedes the first pass’s subtle brightness/body-only processing. Agent-selected identities are baked into the report files; the latest comic additions appear in this current table:

| Gun | Sound identity |
| --- | --- |
| House Special | Dry snap, compact slide tick |
| Room Service | Ragged low thunder, heavy receiver knock |
| Dealer’s Choice | Clipped bright pap, short stamped-steel chatter |
| Pit Boss | Hard midrange bark, bolt slap |
| Dead Man’s Hand | Smoky, saturated low bark and iron-frame resonance |
| High Roller | Bright whip crack, ringing cylinder and cash-register ding |
| Chicago Typewriter | Chunky low bark, hollow drum, literal typewriter clacks and occasional carriage chirp |
| Double or Nothing | Rough torn-air boom and deep walnut resonance |
| Snake Eyes | Small hot cracks, glassy slide accents |
| The Enforcer | Rasping snap with a three-part tinny bolt accent |
| Silver Dollar | Dry frontier crack, woody stock knock and bouncing silver coin |
| Last Call | Compressed boom and two short gas-action accents |
| Eye in the Sky | Needle-like crack above a longer dark body |
| House Edge | Saturated industrial thud and loose feed-link accents |
| Debt Collector | Hollow thoomp, oversized cork pop and short springy boing |

Each weapon has its own resonant EQ, saturation and tail envelope. Three takes vary source timing, tonal focus, bass weight, and seeded material resonances. Brief mechanical accents are part of the shot texture; the existing action/reload cues still own their animation timing. This pass reuses the accepted ElevenLabs sources with original synthesized accents; no additional API credits were spent. The personality descriptions are design intent, with subjective listening still open.

[Short personality sampler](personality-preview.wav): revolver, magnum, Thompson, double-barrel, machine pistol, launcher. [Sampler cue times](personality-preview-cues.json).

## Selectively outlandish accents

**User-established direction:** some guns should sound funny and a little outlandish.

**Working selection, implemented in the assets:** High Roller ends in a cash-register bell; Chicago Typewriter adds literal key clacks and a tiny carriage-return chirp; Silver Dollar adds accelerating coin bounces; Debt Collector has an exaggerated cork-pop/boing. These are original synthesized effects mixed over the existing reports. They are sonic jokes, not new reward signals or lore claims.

The first two takes use lighter accents; take three has the strongest flourish (roughly one-third of shots over time with a fully loaded bank). The eleven other guns retain their prior reports. The pressure front stays immediate, accents begin at least 25 ms later, and no new runtime scheduling or reload cues were introduced. No further ElevenLabs requests were made.

[Comic gun sampler](oddball-preview.wav): High Roller → Chicago Typewriter → Silver Dollar → Debt Collector, three takes each with the largest flourish last. [Cue times](oddball-preview-cues.json). Subjective audibility and comic timing remain for listening review.

## Implemented

All 15 firearms use new ElevenLabs-derived shot reports. Each has three processed timing, resonant-color, body and mechanical-accent variations, per-weapon nonrepeating selection, modest pitch variation and a quieter reverb send. Double or Nothing has three additional two-barrel reports, built with a 9 ms separation. Snake Eyes keeps left/right placement. Reloads, melee and explosions retain their existing assets and timing.

A loaded new report takes priority; a partially loaded bank uses an available take. If none load, the collectible guns retain their original sample and starter guns use procedural fallback. The starter pistol preloads at audio unlock; switching weapons preloads even without a collectible viewmodel rig. All playback remains local and follows pause/disposal behavior; no key or provider request goes to the browser.

## Sources and reproduction

- Accepted generated MP3s: `assets/source/gun-audio/` (tracked).
- Exact provider requests, source/output hashes, processing and output measurements: [provenance.json](provenance.json).
- Generator: `python3 tools/gun-audio/generate.py --weapon revolver`, or omit `--weapon` for the 15-gun batch. Requires the configured key and network access. Cached responses are skipped; uncertain requests block automatic retries.
- Mastering: `python3 tools/gun-audio/process.py` with NumPy and macOS `afconvert`. Uses accepted source MP3s, caches decoded WAVs in ignored `outputs/gun-audio/`, writes `report-*.wav`, the manifest and preview. To replace an accepted source, explicitly replace its MP3 and remove its cached decoded WAV first.
- Provider reference: [ElevenLabs sound generation](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert).

The initial PCM pilot was superseded by MP3 generation because the raw response lacked channel metadata. Its 192,000 bytes are consistent with two seconds of stereo 24 kHz PCM. The accepted MP3s have explicit stereo 44.1 kHz metadata; mastering folds them to mono. Sixteen two-second generations were requested in total, including that pilot; receipts reported 20 character credits per request (320 total).

## Listening and validation

[Preview reel](gun-sound-preview.wav): all three takes of each gun, plus six-shot bursts for SMG, Thompson, machine pistol and LMG. [Cue times](preview-cues.json) identify each chapter. Order: pistol, shotgun, SMG, rifle, revolver, magnum, Thompson, double-barrel, dual pistols, machine pistol, lever rifle, auto shotgun, sniper, LMG, launcher. The reel demonstrates mastered dry assets; the game's room bus and mix alter the final sound.

Measured checks cover PCM format, finite output, peak headroom, transient onset, fades and file availability. Focused runtime tests cover variation, panning, two-barrel selection, missing/partial downloads, reload fallback and pause. Subjective listening in the actual game remains a user playtest item; this pass does not claim an audible human review.

Validation result: 60 focused audio/weapon tests passed; TypeScript and focused ESLint checks passed. All 48 WAVs passed format/headroom/fade checks; substantial attack begins within 0.05–1.04 ms.

Pass 2 asset audit: all 48 files retain headroom and clean end fades; every primary report starts within 12 ms and all 15 banks contain measurably different takes. Runtime code and sample filenames are unchanged.

Pass 3 validation: 41 focused audio tests passed. All 48 mastered assets passed onset, headroom, fade and provenance-hash checks; only the four selected weapons have nonzero comic layers and their third takes have the strongest accents.
