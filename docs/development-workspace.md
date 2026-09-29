# Local development workspace

Run `npm run dev`, then open `http://127.0.0.1:5173/?playtest=1`.
Development tools are absent from production and hidden initially in the local viewport.

- **F2 / Developer tools** opens the dock and pauses the run for inspection. The game canvas resizes to leave room for the panel; narrow windows stack the panel below the game.
- **Seed run** starts a fresh sandbox with 12,000 chips, invulnerability and a long intermission. Use **Open all doors** and **+10,000 chips** for the current run.
- **Play · capture mouse** returns to FPS controls and hides the dock. **Esc** releases the mouse and freezes the scene; the development view uses a small Resume control instead of a full-screen pause card.
- If an embedded browser blocks mouse capture, development mode falls back to right-drag to look, WASD movement and left-click firing, with an on-screen hint. Use a full Chrome window for normal captured-mouse FPS controls.
- Search across all tools or select Session, Locations, Weapons, Combat, Casino or Audio. Weapon grants include every Mystery Box gun and both special melee weapons.
- Scene actions can run without capturing the pointer, so animations and audio can be inspected. **Inspect** freezes the run. Hotel and audio scenario presets reset the run; ordinary grants and door/chip buttons preserve it.
- The footer shows frame rate, frame timing, living enemies, chips, room and last action. Expand diagnostics for audio/scene details.

Normal `http://127.0.0.1:5173/` keeps the regular game menus. Follow `AGENTS.md` for focused verification; use the full suite for merges or shared-system changes, not every UI edit.
