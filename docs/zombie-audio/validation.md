# Zombie audio validation

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
