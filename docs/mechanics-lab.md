# Mechanics lab

Run `npm run dev`, then open `http://127.0.0.1:5173/?playtest=1&range=1`.
The casino developer launcher also has a Mechanics lab button. This interface
is development-only. Casino integration tests remain at `/?playtest=1`.

Use a repeatable loop: select a scenario, select a weapon, click Play scenario,
perform the test, press Escape, inspect health/ammunition/enemies, then Reset.
Changing a scenario creates a fresh simulation with the same initial state.
Use Add enemies to add 1, 5 or 10 pursuing zombies or stationary targets to any
scenario without resetting position, health, ammo or pause state. Spawn placement
favors free space ahead of the player, avoids cover and other enemies, and keeps
a four-metre buffer around the player. The lab allows up to 60 living enemies.
Changing a weapon or using other inspector utilities pauses the simulation. Click Play
to continue. Reset restores damage, health, all weapons and twenty grenades.
Invulnerability is opt-in. There are no automatic waves or automatic ammo refills.

- Weapon range: three stationary, 100 HP zombies at marked 5, 10 and 20 metre
  depth lines. Test sights, reloads, spread, hit reactions and death. Targets still
  attack if approached; they use actual enemies rather than invulnerable props.
- Combat: three pursuing zombies for movement, aiming under pressure and melee.
- Explosions: empty blast lane with tall and low cover. Throw grenades with G;
  compare exposed damage against the tall wall. Use Restore for repeated trials.
- Movement: empty bounded floor with obstacles and the same movement/collision
  system used by the casino.

The inspector occupies a separate column. Normal mouse capture works in browsers
that support it. In an embedded preview, right-drag looks around and left click
fires; click the canvas before using WASD. Full mouse capture is preferable for
judging aiming feel. The range requests 60 FPS; hardware determines actual FPS.

The greybox uses shared dimensions for render geometry and colliders. It is a
separate, disconnected ground area at x=90–118, z=-4–30. Production gameplay
cannot enter it. Range sessions select only range colliders. Simulation, weapon
models, audio, damage, grenade physics and zombie AI are shared with the game.
The renderer currently also loads casino assets, so this is a mechanics harness,
not an isolated loading-time or performance benchmark. Test casino interactions
and final lighting in the casino workspace. Add new scenarios in
`lib/game/test-range.ts`, keeping initial state deterministic and documenting
which variables the scenario holds fixed.

Validation: `tests/test-range.test.mjs` covers initial/reset state, loadout,
walkable bounds, cover occlusion and scenario actors. Run those checks for scenario
changes; shared navigation changes warrant broader game tests.

Hold Space to sprint; hold Shift (or RMB) to aim down sights. Sprint stamina is
shown under health. Restore supplies also restores stamina. The inspector’s
Show tips & explanation cards checkbox hides optional explanations and saves
your preference across reloads; the same setting is in the game Settings panel.
