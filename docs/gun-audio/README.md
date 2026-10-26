# Weapon audio — selected B direction

## Established direction

On 2026-09-29 the user selected **B — heavy action** and requested distinct sounds for all weapons. B means a violent crack, dense powder blast, forceful midrange punch and short room slap. The user rejected C, describing its sound as dog-like. Most weapons should sound authentic and cool; only one or two may be humorously outlandish.

## Current bank

The B bank covers **16 firearm definitions**, including the flare pistol, plus new cane/axe impacts and an axe swing. The three approved B source clips (revolver, pump shotgun, Thompson) are reused; their first takes preserve the audition mastering. Every other firearm has its own freshly generated source. Each gun has three mastered takes derived from its source, with subtle time variation; these are not three independent provider recordings. Double or Nothing also has three two-barrel reports.

The palette differentiates compact pistol snaps, broad shotgun pressure, magnum cracks, rifle barks, stamped automatic actions, the launcher’s hollow thump and a flare-pistol pop/puff/hiss. These are generated effects aimed at believable weapon texture, not authenticated real firearm recordings.

**Working humorous exceptions:** only Thompson take three gets a short typewriter-carriage friction zip, and launcher take three an oversized breathy cork pop. No bells, coins, pitched boings or animal sounds are intentionally added. Their other takes stay straight. These touches remain agent-selected; B’s overall direction is user-selected.

Stickman retains its established A/D cane swipes with new woody impact takes. Fire Exit gets a new weighty swing and crunchy chop impacts. Existing weapon-specific reload, dry-fire, pickup, action, explosion and break cues remain where already provided. This pass changes firing/impact identities rather than regenerating every handling cue. Flare playback is wired, while its acquisition/visual integration remains separate unfinished work.

## Listen and inspect

- [Current B arsenal preview](selected-b-preview.wav), with [weapon cue times](selected-b-cues.json): all 16 gun reports followed by cane impact, axe impact and axe swing.
- [Current provenance](selected-b-provenance.json): each source request/hash and all 57 installed output cues.
- [Arsenal reference](../arsenal.md): verified stats, upgrade names, acquisition, handling and sound direction.
- [Original B comparison](auditions-01/b-heavy.wav): the user-selected three-gun audition.

Earlier natural/personality/oddball reels and `provenance.json` are retained as historical alternatives, not the currently installed B bank. All new outputs require listening in the game to judge the complete mix; file checks do not substitute for that.

## Production and playback

Accepted sources and exact requests: `assets/source/gun-audio/production-b/`. Run `python3 tools/gun-audio/production_b.py --generate` to fill missing sources (network and configured key); omit the flag to master locally using NumPy and macOS afconvert. Cached sources are skipped and uncertain requests block automatic retries. The old `process.py` reproduces the historical natural bank and must not be used to rebuild current B assets.

Mastering follows B’s audition: onset trim, DC removal, tiny start fade, 25 ms end fade and 0.8 peak ceiling. Later takes vary time slightly; original generated timbre is retained. First takes have no added bass synth, resonant EQ or saturation. Source hashes identify decoded caches.

Local playback keeps nonrepeating take selection, partial-bank recovery, fallback sounds, dual-hand panning, double-barrel alternate fire and pause/disposal behavior. No provider requests or credentials run in the browser. No gameplay balance was changed.

## Validation

60 focused audio/weapon tests, TypeScript and focused ESLint passed. All 57 outputs passed format, finite data, headroom, endpoint fades and hash checks; firearm onsets passed a 15 ms bound. The three approved B first takes match their audition WAVs sample-for-sample. Sixteen new two-second requests reported 320 character credits total; three approved sources were reused without another request.
