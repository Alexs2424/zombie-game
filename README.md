# Last Jackpot

A solo first-person zombie survival game set in an original abandoned Las Vegas casino. Built with Babylon.js, TypeScript, React, and Vinext. All gameplay runs locally in the browser. No accounts, networked gameplay, or paid assets are required for local play.

## Run locally

Requires Node.js 22.13+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the printed localhost URL in **a focused desktop Chrome tab**. Click **Enter the Casino** to capture the mouse and activate audio. Embedded browser previews and background automation may reject pointer lock; open the URL directly in Chrome. Escape releases the mouse and pauses the run.

```sh
npm test
npm run typecheck
npm run build
```

The Sites preview uses a local Worker runtime; the development process must remain running while playing locally.

## Controls

| Action              | Control                                    |
| ------------------- | ------------------------------------------ |
| Move                | W A S D                                    |
| Look                | Mouse                                      |
| Fire                | Left mouse button, hold for repeated shots |
| Sprint              | Shift                                      |
| Reload              | R; an empty trigger also starts a reload   |
| Buy/interact        | E when close to a purchase                 |
| Switch weapons      | 1 / 2 / 3 / 4                              |
| Pause/release mouse | Escape                                     |

The start and pause screens provide mouse sensitivity, sound volume, and optional frame statistics. Losing focus pauses the run and clears held input. Controller support is deferred.

## First five rounds

Start with a pistol and 400 points. Kills award 100 points. The first five rounds contain 6, 9, 12, 16, and 20 zombies, with a 14-enemy active cap. Health regenerates after 5.5 seconds without damage. Every run resets weapons, points, doors, and upgrades.

- Pistol reserve: 150 points, near the starting foyer.
- Room Service shotgun: 800 points, on the west casino wall. Return there for a 300-point reserve refill.
- Cocktail lounge: 900 points, at the shutter on the east side of the main floor.
- Staff passage: 1,200 points, purchased from inside the staff area after opening the lounge. It completes the second movement loop.
- High Roller Club: 1,300 points from the lounge. Opens a 12 × 24 metre poker room and both its lounge and staff entrances. A private entrance starts spawning zombies only after the room opens.
- Dealer’s Choice SMG: 1,100 points in the lounge; 400-point reserve refill.
- Pit Boss rifle: 1,600 points on the east wall of the High Roller Club; 500-point reserve refill.
- Marlowe, the lounge bartender: **E** from the customer side of the bar opens the menu and pauses the solo run. House Reserve costs 1,500 (+50 maximum health); Quick Pour costs 1,000 (reload time ×0.7); Night Shift costs 900 (sprint speed ×1.15). Perks are one-time purchases for the current run.
- Double Down: 2,000 points per owned weapon, at Marlowe’s menu or the VIP workshop. Increases magazine capacity by 50%, damage by approximately 35%, and fills the magazine once. Select the gun to upgrade in the bar menu; the workshop upgrades your equipped gun. Both locations share upgrade state.

The five-round income model leaves 500 points for ammunition after the shotgun, every area unlock, and one weapon upgrade. Extra guns and perks are competing build choices; buying everything is a longer-run goal. Values are initial playtest tuning, not final balance. Rounds continue after five with bounded enemy speed and health.

## Architecture

- `lib/game/simulation.ts`: pure gameplay rules, economy, rays, collisions, and shared navigation flow field.
- `lib/game/renderer.ts`: casino environment, local GLB weapon loading, animation, lighting, and frame sampling.
- `lib/game/characters.ts`: articulated casino guests and Marlowe, with clothing and facial details.
- `lib/game/runtime.ts`: fixed-step updates, input, pointer lock, pause/resume, restart, and HUD snapshots.
- `lib/game/audio.ts`: original synthesized weapon/interaction sounds, distinct round-start/round-clear stingers, and positional threat panning.
- `app/page.tsx`: title, HUD, settings, pause, and results.
- `tests/simulation.test.mjs`: economy, ammunition, line of sight, corner navigation, gate states, spawn access, wave completion, and reset tests.

## Validation and limitations

29 automated simulation checks pass, including five-round progression and three fresh-run resets. Type checking and production build are separate checks. The initial target device is the user's M3 Max MacBook Pro with 128 GB RAM. No sustained 30-minute gameplay or real-device frame-time benchmark is claimed yet.

This is a rough playable: stylized geometry and humanoids, synthesized audio, no aim-down-sights, melee, grenades, jump, crouch, random weapon station, persistent records, native app, controller support, or co-op. Mouse capture needs a focused browser and a genuine user gesture. The final feel and difficulty need a hands-on mouse playtest.

## Assets

Casino geometry, characters, signs, and sounds are generated by this source. Four original local GLB weapon assets use named components and PBR materials; see `docs/weapon-models.md` and `tools/generate_weapons.py`. The wallpaper is an ImageGen texture documented in `docs/wallpaper-asset.md`. The worn carpet albedo in `public/textures/casino-carpet.png` was generated with the built-in OpenAI ImageGen tool; its prompt and provenance are in `docs/carpet-asset.md`. The social-preview image was generated with OpenAI ImageGen specifically for Last Jackpot; it is promotional art, not an in-game screenshot. Babylon.js is Apache-2.0 licensed; package licenses remain in their respective dependencies. No Call of Duty assets are included.

## Environment pass — September 27, 2026

The footprint is now 44 × 24 metres, up from 32 × 24 (37.5% larger). The original casino, lounge, and staff loop remain; the High Roller Club adds two poker islands and a second route connecting the lounge and staff area. World bounds are shared by collisions and navigation. The room's two gates share a purchase, and its new spawn has its own opening delay.

Visual additions include a woven carpet texture, walnut wall panels and brass trim, coffered ceilings, chandeliers and sconces, detailed slot cabinets, bar shelves and bottles, poker cards/chips, a velvet banquette, room labels, prominent door prices, two shadow-casting lights, and restrained bloom. Fixed scenery is batched by material. Rendering now uses up to 1.5 device pixels per CSS pixel, correcting the old under-resolution setting.

Verified the main floor, lounge, VIP room, closed purchase gate, and a 14-zombie crowd in the local browser, with textures fully loaded and no reported browser errors. These brief checks are not a sustained gameplay benchmark. The temporary visual-check page is excluded from the delivered build.

## Bar, arsenal, and detail pass — September 27, 2026

Added Marlowe’s perk/upgrade shop, two buyable weapons, detailed models for all four guns, magazine/action movement, modeled gloves, and articulated casino guests. The environment now includes damask wallcovering, a modeled cashier booth, staff pipework/service panels, wall-mounted weapon racks, and an expanded upgrade cabinet. Room/price signs have correct single-sided orientation, proportional lettering, and placements clear of wall trim. The bar shelving clears its back-of-house entrance, and counter props leave Marlowe’s face visible.

Round starts and clears have different original horror stingers, large announcements, and an eight-second restocking countdown. Notification text occupies a separate area from round cues.

For repeatable local visual QA, `/?playtest=1` in development shows controls for a seeded run, room viewpoints, movement, purchases, firing/reloading, round transitions, and a 14-zombie crowd. These exercise the real simulation and menus without requiring automated pointer lock. They are excluded by production guards. A fresh normal URL retains standard mouse capture and starting economy.

Next fidelity priorities: polished character locomotion and attack animation, bespoke hand reload animations, room-specific ambient loops, surface roughness/normal maps, and sparse environmental storytelling. These remain future work; current characters and weapons use component animation rather than full skeletal animation.
