# Zombie audio validation

## Merge with current main

Merged `origin/main` at `a06362f` (PR #4) into the sound-effects branch.
Resolved README, runtime import, and development-control conflicts by preserving
both feature sets. Reviewed the automatic audio/test merges: poker cues remain
on the UI bus while gameplay is paused; roulette, revolver, knife, grenade, and
explosion cues coexist with the zombie director and sampled-voice lifecycle.
New zombie wound and limb fields remain compatible with the sound scenarios.

- All 106 tests pass, including the upstream combat/casino/asset regressions and
  the zombie audio routing, pause, disposal, and scheduling checks.
- TypeScript, production build, focused audio/runtime/test ESLint, and diff
  whitespace checks pass. Existing framework build warnings remain.
- No additional browser or subjective listening pass was performed for this
  merge; the original browser checks below apply to the initial sound feature.

## Original sound feature

Validated September 27, 2026 on `codex/zombie-sound-effects`.

- `npm test`: 49 passing checks: 34 simulation, six audio graph/lifecycle,
  nine director timing/state checks.
- `npm run typecheck`: passed.
- `npm run build`: completed; all three WAVs copied into
  `dist/client/audio/zombies/`. Existing Vite JSON-import and dynamic-import
  warnings remain.
- Focused ESLint for audio, director, runtime, and their tests: passed.
  Including `app/page.tsx` reports the pre-existing
  `react-hooks/set-state-in-effect` error at line 84 (`setPlaytesting`), also
  present at base commit `66cefe2`.
- Chrome at `http://127.0.0.1:5174/?playtest=1`: all three WAVs decoded (`3/3
  clips ready`). The real simulation's **Hear chase**, **Hear last zombie**, and
  **Hear horde** scenarios each reported their intended category as `AI clip`,
  rather than the synthesized fallback. Escape displayed the paused screen.
  Captured browser warning/error logs were empty. Preview left paused.
- Asset processing verified mono 24 kHz PCM16, 3/3/4-second durations, silence at
  fade endpoints, finite samples, peaks at or below -3 dBFS, and provenance hashes.

These checks verify files, scheduling, routing, loading, and UI behavior. They
do not claim a subjective listening assessment, a long playtest, or final tuning
of vocal timbre and humor. A human listening pass is still useful.
