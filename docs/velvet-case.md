# The Velvet Case

Current implementation, 2026-09-30. The user requested an opening mystery box,
visible optional weapon pickup, music/sounds, and return after 20 seconds. The
following prop, music and price choices are agent-selected working direction.

## Appearance and interaction

A low walnut presentation case stands on slender brass legs in the existing
Velvet Hour secret room. Burgundy velvet covers the tray, weapon bolsters and
inside lid. Brushed brass bindings, latches, piano hinges and a small maker plate
fit a private 1970s casino lounge. It has no screen, reel or modern lighting strip.
“PRIVATE RESERVE” is a prop inscription, not a new quest or character identity.

- F opens it for 400 chips. Every opening offers one random existing house gun;
  this replaces the old 50% chance of an empty result. No extra pickup charge.
- During 2.8 seconds the lid hinges back and the selected gun rises from its
  padded tray. The full 20-second choice window starts after opening.
- F takes the displayed gun; X declines. The prompt names the gun that will be
  replaced when both firearm slots are occupied. Duplicate guns restock their
  existing slot. The offer itself never equips anything.
- Expiry or decline lowers the gun before closing the lid, over 1.2 seconds.
  Taking it removes the display immediately and closes the lid. A second paid
  opening cannot interrupt closing.
- Pause freezes lid motion, weapon motion and countdown. Audio stops immediately
  and resumes from the matching simulation offset. Walking away lets it expire.

## Blender production

`assets/source/velvet-case/velvet-case.blend` is the editable native source.
`public/models/velvet-case.glb` is the runtime export, approximately 188 KB.
`tools/velvet-case/build.py` rebuilds both with Blender in background mode:

```sh
blender --background --python tools/velvet-case/build.py
```

`CaseHinge` is the rear pivot with all lid meshes parented underneath; runtime
rotates its local X axis. Beveled edges and separate brass, velvet and wood
materials support close inspection. The source includes procedural wood grain;
the lightweight glTF currently uses a flat walnut base color because procedural
nodes are not exported. Camera and light remain in the source, not the export.
Displayed guns reuse the existing Blender arsenal models without per-frame
loading or geometry creation. One local amber light brightens when open.

## Original sound palette

All four mono 44.1 kHz / 16-bit WAVs under `public/audio/velvet-case/` are original
deterministic synthesis, not sampled songs or recorded mechanical foley.
`tools/velvet-case/sounds.py` rebuilds them with Python and NumPy.

| Cue | Duration | Direction |
| --- | --- | --- |
| opening | 2.8 s | Two latch clicks, low hinge creak, rising six-note chime phrase |
| offer | 8 s loop | Quiet music-box/vibraphone-like minor-key figure with soft ticks |
| closing | 1.2 s | Descending notes, tray slide, wooden lid thud, final latch |
| take | 1.2 s | Short bright pickup interval followed by lid and latch |

Music is intentionally small and local: a strange mechanical keepsake in a
lounge, not a full soundtrack. Playback pans with listener direction and fades
out within 15 metres. One decoded source plays at a time; the offer loop ends
on pickup, decline, timeout, pause, reset or disposal. Existing casino pass-by
sounds and craps cues remain separate. Subjective sound approval is open.

## Focused verification

Run casino, loadout, case and audio tests for changes to this feature:

```sh
node --experimental-strip-types --test tests/casino.test.mjs tests/loadout-progression.test.mjs tests/mystery-case.test.mjs tests/audio.test.mjs
```

For visual edits, verify closed, opening, offered and returned states in the
casino. F2 developer tools → Seed run, Open all doors, Velvet Case provides quick
access. Test pickup with two guns, walk-away expiry and pause during the offer.
