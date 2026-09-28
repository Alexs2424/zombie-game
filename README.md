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
| Knife slash         | V                                          |
| Throw grenade       | G                                          |
| Sprint              | Shift                                      |
| Reload              | R; an empty trigger also starts a reload   |
| Buy/interact        | E when close to a purchase                 |
| Switch weapons      | 1 / 2 / 3 / 4 / 5 / 6                      |
| Pause/release mouse | Escape                                     |

The start and pause screens provide mouse sensitivity, sound volume, and optional frame statistics. Losing focus pauses the run and clears held input. Controller support is deferred.

## First five rounds

Start with a pistol and 400 chips. Each damaging hit awards a random integer from 5–10 chips (each shotgun pellet counts). Headshots add 100 chips, including nonfatal headshots; non-headshot kills add 50. A headshot kill does not also award the 50-chip body-kill bonus. The first five rounds contain 6, 9, 12, 16, and 20 zombies, with a 14-enemy active cap. Health regenerates after 5.5 seconds without damage. Every run resets weapons, chips, doors, and upgrades.

Zombies use three original Blender designs: Pit Boss, Crooked Dealer, and Last Showman. They shamble, snarl, recoil, and cycle through a backhand rake, overhead hammer, and two-arm snatch with windup and recovery. Wounds remain bloody; 32 cumulative damage to an arm or leg severs that limb permanently for that zombie. Losing one leg reduces movement to 48%; losing both reduces it to 23%. Shared animation poses drive bullet hit volumes, excluding missing limbs. See `docs/zombie-assets` for the editable Blender source and preview, and `tools/zombie-assets/generate_zombies.py` to regenerate assets.

- Pistol reserve: 150 chips, near the starting foyer.
- Room Service shotgun: 800 chips, on the west casino wall. Return there for a 300-chip reserve refill.
- Cocktail lounge: 900 chips, at the shutter on the east side of the main floor.
- Staff passage: 1,200 chips, purchased from inside the staff area after opening the lounge. It completes the second movement loop.
- High Roller Club: 1,300 chips from the lounge. Opens a 12 × 24 metre poker room and both its lounge and staff entrances. A private entrance starts spawning zombies only after the room opens.
- The Devil’s Tables: 1,500 chips from the High Roller Club. Opens a 14 × 24 metre room, two connected entrances, and a delayed dealer spawn. Craps and roulette are broad training islands.
- Seven’s Curse craps wager: 250 chips, once per round. Two fair six-sided dice roll while combat continues. A total of seven slows walking and sprinting by 20% for that round; other totals pay 500 chips (250 net). During intermission, the wager and any curse apply to the upcoming round.
- Lucky Four roulette: 200 chips on every spin, charged when the spin starts. A fair 0–36 wheel spins for six seconds while combat continues. **4 and 24** refill the equipped gun’s magazine and reserve; **7** refills every owned gun; **0** refills every owned gun and grants **double damage for 30 seconds**. Other numbers give no reward. There is no additional charge at the result and no refund on a win. Return to the table for another spin once the wheel stops.
- Dealer’s Choice SMG: 1,100 chips in the lounge; 400-chip reserve refill.
- Pit Boss rifle: 1,600 chips on the east wall of the High Roller Club; 500-chip reserve refill.
- The Dead Man’s Hand revolver: complete a five-card flush at either High Roller Club card table. One free chosen-card exchange per table, per round; hands persist between visits. The first flush grants and equips the six-shot revolver in slot 5; the other table’s flush refills it.
- Marlowe, the lounge bartender: **E** from the customer side of the bar opens the menu and pauses the solo run. House Reserve costs 1,500 (+50 maximum health); Quick Pour costs 1,000 (reload time ×0.7); Night Shift costs 900 (sprint speed ×1.15). Perks are one-time purchases for the current run.
- Double Down: 2,000 chips per owned weapon, at Marlowe’s menu or the VIP workshop. Increases magazine capacity by 50%, damage by approximately 35%, and fills the magazine once. The revolver retains six chambers and gets a 25% faster reload instead of extra magazine capacity. Select the gun to upgrade in the bar menu; the workshop upgrades your equipped gun. Both locations share upgrade state.

The five-round income model leaves 500 chips for ammunition after the shotgun, the original lounge/staff/VIP unlocks, and one weapon upgrade. Extra guns and perks are competing build choices; buying everything is a longer-run goal. Values are initial playtest tuning, not final balance. Rounds continue after five with bounded enemy speed and health.

## Architecture

- `lib/game/simulation.ts`: pure gameplay rules, economy, rays, collisions, and shared navigation flow field.
- `lib/game/poker.ts`: persistent five-card hands, finite shuffled decks, suit matching, and discarded-card recycling. `card-art.ts` draws the live tabletop card prints.
- `lib/game/renderer.ts`: casino environment, local GLB weapon loading, animation, lighting, and frame sampling.
- `lib/game/characters.ts`: articulated casino guests and Marlowe, with clothing and facial details.
- `lib/game/runtime.ts`: fixed-step updates, input, pointer lock, pause/resume, restart, and HUD snapshots.
- `lib/game/audio.ts`: synthesized weapons/interaction cues, round stingers, and local AI-generated positional zombie voices.
- `lib/game/zombie-audio-director.ts`: proximity, crowd, last-survivor timing, and shared voice cooldowns.
- `app/page.tsx`: title, HUD, settings, pause, and results.
- `tests/simulation.test.mjs`: economy, ammunition, line of sight, corner navigation, gate states, spawn access, wave completion, and reset tests.

## Validation and limitations

106 automated checks pass (45 core simulation/combat, 20 card-table/revolver, 15 roulette rules, six roulette motion, nine audio regressions, nine zombie cue scheduling checks, and two zombie-asset checks), including five-round progression and fresh-run resets. Type checking and production build are separate checks. The initial target device is the user's M3 Max MacBook Pro with 128 GB RAM. No sustained 30-minute gameplay or real-device frame-time benchmark is claimed yet.

This is a rough playable: stylized geometry and humanoids, synthesized effects plus AI-generated zombie voices, no aim-down-sights, jump, crouch, random weapon station, persistent records, native app, controller support, or co-op. Mouse capture needs a focused browser and a genuine user gesture. The final feel and difficulty need a hands-on mouse playtest.

Press **V** for a knife slash: 100 damage to the nearest target in a forward 1.65-meter reach, with a 0.18-second windup and 0.75-second cooldown. It consumes no ammunition. Press **G** to throw a grenade: 2.2-second fuse, bouncing trajectory, and a 4.5-meter blast with damage falloff and cover checks. Nearby explosions can hurt you. Start with two grenades; each round after the first supplies two more, capped at four. Both attacks cancel reloads and award the same hit chips and 50-chip non-headshot kill bonus as gunfire. Pause freezes windups, fuses, and blast effects.

## Assets

Casino geometry, characters, signs, and most sounds are generated by this source. Three zombie vocal clips were generated with Stable Audio 3 Small SFX; their prompts, processing, and provenance are in `docs/zombie-audio/`. Five original local GLB weapon assets use named components and PBR materials; see `docs/weapon-models.md`, `tools/generate_weapons.py`, and `docs/revolver-assets/`. The wallpaper is an ImageGen texture documented in `docs/wallpaper-asset.md`. The worn carpet albedo in `public/textures/casino-carpet.png` was generated with the built-in OpenAI ImageGen tool; its prompt and provenance are in `docs/carpet-asset.md`. The social-preview image was generated with OpenAI ImageGen specifically for Last Jackpot; it is promotional art, not an in-game screenshot. Babylon.js is Apache-2.0 licensed; package licenses remain in their respective dependencies. No Call of Duty assets are included.

## Environment pass — September 27, 2026

At this checkpoint the footprint became 44 × 24 metres, up from 32 × 24 (37.5% larger). The original casino, lounge, and staff loop remain; the High Roller Club adds two poker islands and a second route connecting the lounge and staff area. World bounds are shared by collisions and navigation. The room's two gates share a purchase, and its new spawn has its own opening delay.

Visual additions include a woven carpet texture, walnut wall panels and brass trim, coffered ceilings, chandeliers and sconces, detailed slot cabinets, bar shelves and bottles, poker cards/chips, a velvet banquette, room labels, prominent door prices, two shadow-casting lights, and restrained bloom. Fixed scenery is batched by material. Rendering now uses up to 1.5 device pixels per CSS pixel, correcting the old under-resolution setting.

Verified the main floor, lounge, VIP room, closed purchase gate, and a 14-zombie crowd in the local browser, with textures fully loaded and no reported browser errors. These brief checks are not a sustained gameplay benchmark. The temporary visual-check page is excluded from the delivered build.

## Bar, arsenal, and detail pass — September 27, 2026

Added Marlowe’s perk/upgrade shop, two buyable weapons, detailed models for all four guns, magazine/action movement, modeled gloves, and articulated casino guests. The environment now includes damask wallcovering, a modeled cashier booth, staff pipework/service panels, wall-mounted weapon racks, and an expanded upgrade cabinet. Room/price signs have correct single-sided orientation, proportional lettering, and placements clear of wall trim. The bar shelving clears its back-of-house entrance, and counter props leave Marlowe’s face visible.

Round starts and clears have different original horror stingers, large announcements, and an eight-second restocking countdown. Notification text occupies a separate area from round cues.

For repeatable local visual QA, `/?playtest=1` in development shows controls for a seeded run, room viewpoints, movement, purchases, firing/reloading, round transitions, and a 14-zombie crowd. These exercise the real simulation and menus without requiring automated pointer lock. They are excluded by production guards. A fresh normal URL retains standard mouse capture and starting economy.

Next fidelity priorities: polished character locomotion and attack animation, bespoke hand reload animations, surface roughness/normal maps, and sparse environmental storytelling. These remain future work; current characters and weapons use component animation rather than full skeletal animation.

## Tables, hands, lighting, and sound — September 27, 2026

The map now spans **58 × 24 metres**. The Devil’s Tables extends the club eastward with two connected entrances, craps and roulette furniture, numbered ivory dice, chip storage, brass/wood details, and a new spawn. The rifle display moved south along the club wall to clear the new doorway. Both table footprints participate in collisions and zombie navigation.

Lighting uses warm chandelier pools, cool ambient fill, local jade/warm table-room bounce, three filtered shadow maps, subtle screen-space contact shading, ACES tone mapping, restrained bloom, and a weapon-only fill light. Gunfire briefly illuminates nearby scenery. Four original fitted glove/forearm assets replace the earlier palm placeholders, with finger grips, seams, leather textures, wrist pivots, and support-hand reload/pump motion. Character geometry is batched within rigid animation groups to reduce draw calls.

Audio adds a quiet electrical/room bed, occasional distant slot notes and chips/glass, footsteps, and distance-panned zombie breath, groans, and attack calls. Round stingers duck ambience. Pause and focus loss mute the world bus immediately; purchases, denials, and death retain their separate cue path. These are original synthesized sounds, not recorded actors or licensed game audio. Audio graph tests cover pause/routing/disposal; their timbre still needs a human listening pass.

New asset sources, dimensions, pivots, and geometry validation are documented under `docs/table-assets/` and `docs/hand-assets/`; generators live under `tools/`. Run these generators with Python, NumPy, SciPy, and Pillow installed. They write to ignored `outputs/table-assets/` and `outputs/hand-assets/`. Generated textures are embedded in the GLBs. Hands are fitted posed meshes, not skeletal finger animation. Roulette began as visual ambience in this pass and is now playable alongside craps.

## Blender slot machines

The main room's two slot islands use 12 original Blender-modeled cabinets in emerald and burgundy. Beveled panels, brass trim, curved mechanical reels, illuminated headers, control buttons, side levers, and payout trays replace the earlier block-based machines. Each style shares its geometry and materials across six hardware instances. Island footprints and walking routes are unchanged; bullet-cover height matches the taller cabinets. Slot machines remain scenery, without a new wager mechanic.

The editable source is `assets/source/slot-machines.blend`; browser exports are `public/models/slot-machine-emerald.glb` and `public/models/slot-machine-burgundy.glb`. Reproduction instructions and previews are in `docs/slot-assets/`, with Blender Python sources under `tools/slot-assets/`. Development playtest controls include west, east, and second-bank slot viewpoints.

## Zombie voices — September 27, 2026

Three short local AI-generated clips add soft, nonverbal character: tired chase
grunts, a confused final-survivor sigh, and a disorganized group groan. The source
is Stability AI’s public Stable Audio 3 Small SFX demo. See
[`docs/zombie-audio/README.md`](docs/zombie-audio/README.md) for exact prompts,
provenance, levels, source terms, and the free-quota limit on this first batch.
The game requires no AI account, API key, or service calls.

- A nearby zombie within 8 metres can call every 5–8 seconds.
- Five or more zombies within 10 metres can produce a horde cue every 12–18 seconds.
- The last-survivor cue plays once per round after a short hold, only when no more
  zombies are waiting to spawn and the survivor is within 18 metres.
- All three share a minimum five-second gap and a single sampled voice. Moving
  zombies retain positional panning and distance attenuation. Attack grunts are
  rate limited; round stingers take priority. Pause, focus loss, and restart stop
  sampled voices. Sound volume still controls the whole mix.
- Failed asset downloads/decodes fall back to the existing synthesized groans.

In development, `/?playtest=1` adds **Hear chase**, **Hear last zombie**, and
**Hear horde** buttons. Each starts a repeatable real simulation; the small
status line reports decoded clips and the latest playback category. The controls
and diagnostics are excluded from the production interface. Objective waveform
checks and automated routing/timing checks do not replace a human listening pass
for tone and humor.

## Roulette rewards

Interact with the customer side of the roulette table in The Devil’s Tables using **E**. The room must be unlocked and you need 200 chips. The number is chosen once at the start, with all 37 pockets equally likely, and the wheel and ball settle on that number. The four lucky pockets give a combined win chance of 4/37 (about 10.8%). Spins continue while you move and fight; only one roulette spin can run at a time.

Ammo rewards fill both magazine and reserve, respect upgraded magazine sizes, and cancel an active reload. The 4/24 reward uses the weapon equipped when the ball lands. Unowned weapons stay unowned. A second zero refreshes the 30-second double-damage timer instead of stacking its multiplier; the bonus also applies to upgraded weapons. Spin, result-display, and damage-bonus timers freeze during pause and the bartender/card menus. Starting a new run clears all roulette state and bonuses.

## High Roller card tables

Both poker islands now use a detailed shared GLB with stitched oxblood rails, inlaid walnut, brass trim, genuinely recessed cupholders, printed emerald felt, a pedestal base, dealer tray, and detailed chip stacks. Five live cards sit on each felt surface and match that table’s hand. Original footprints and walking routes are preserved. Editable Blender source, previews, regeneration instructions, and geometry checks are in `docs/poker-assets/` and `tools/poker-assets/`.

Approach the south/customer side and press **E**. The solo game pauses while you select a card and confirm a free swap. Keep matching suits: a flush means five of the same suit, regardless of rank or order. Each table has its own hand, 52-card deck, and one-swap-per-round limit. Leaving, reopening, or entering intermission does not refresh that limit. A new actual round does. Previously discarded cards are shuffled back only when the draw pile runs out; cards still in the hand cannot be drawn again.

The first flush unlocks **THE DEAD MAN’S HAND** for this run: a six-shot, 110-damage revolver with 48 reserve rounds. It equips automatically and uses weapon key **5**. Completing the other table refills it once. Completed tables retain their flush without granting repeated rewards. Roulette’s ammo rewards include the revolver once owned; Marlowe and the workshop can upgrade it to **ACE OF SPADES**. New runs reset both hands and the reward. Flush completion is represented separately from weapon ownership, ready for a future map-unlock reward; this pass adds no new room.

## Grand Hotel and Last Service

Buy the north casino gate for **2,000 chips** to open the Grand Hotel lobby and
upstairs restaurant for the run. Two curved staircases connect the floors;
continuous guards prevent dropping between levels. Five hotel service entrances
become active after a three-second opening grace period, with modestly tougher
hotel enemies.

At the upstairs host stand, press **E** to ring the **Last Service** bell. Stay in
the restaurant for **35 seconds** and clear all **12 ambushers**. Up to six
ambushers can be active within the normal 14-enemy cap. Existing round enemies
keep pursuing, while the normal spawn budget and intermission timer pause.
Leaving for either stair fails the challenge; clear the survivors and ring again
to retry. Ambushers award no chips, preventing free retry farming.

Success equips **THE CHICAGO TYPEWRITER**, a Blender-modeled Tommy gun with a
50-round drum, 250 reserve rounds, and a three-second reload. Select it with **6**.
The crate beside the host stand refills its reserve for **500 chips**. Existing
roulette ammo rewards and weapon upgrades support it; its upgraded form is
**THE HOUSE COLLECTOR**, with a 75-round drum and heavier hits. It unlocks once
per run and resets with a new game.

Eleven original Blender furniture assets replace the lobby and restaurant
placeholders. Marble, woodwork, Art Deco rails, chandeliers, wall art, clocks,
service doors, and contact shading complete this hotel pass. Press **E** beside
the lobby jukebox to start or stop an original, distance-panned lounge instrumental.
Music and hotel cues follow the volume control and pause with the game.

Gameplay rendering is capped at 60 FPS; menus and paused scenes use 15 FPS, and
background rendering is disabled. This preview stays local. The development
`?playtest=1` controls include the locked entrance, service bell, guided hotel
loop, and an explicit ambusher-clear button for reward QA. Detailed editable
asset sources and validation live in `docs/hotel-assets/` and `tools/hotel-assets/`.
