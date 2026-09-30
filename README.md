# Last Jackpot

A solo first-person zombie survival game set in an original abandoned Las Vegas casino. Built with Babylon.js, TypeScript, React, and Vinext. All gameplay runs locally in the browser. No accounts, networked gameplay, or paid assets are required for local play.

## Grand casino reconfiguration

Start in a **60 × 32 metre Grand Casino** with eight slot banks (48 cabinets),
two independent craps tables, two roulette tables, and one flush-poker table.
The west bar and south High Roller each have two separately purchased doors.
The east cashier has a public counter room with a glass-secured cash area;
its rear space is inaccessible and reserved for future stairs or a trapdoor.
The truck/storage room and Pit Boss rifle are northwest of the hotel.

The hotel lobby keeps its exact footprint, stairs, reception and hidden-gallery
investigation; this reconfiguration only adds the supply-room doorway there.
The second existing flush table remains in High Roller alongside its couch and
workshop. Slots remain scenery with positional sounds.

See the [current floor plan](docs/maps/last-jackpot-map.svg) and
[implementation notes](docs/maps/reconfiguration-plan.md). Dated environment-pass
sections below document earlier layouts and are retained as development history.

## Grand Hotel reception and mystery

The hotel now has an ornate side reception, expanded architectural detail and
an optional missing-guest investigation. Start with the guest ledger on the
reception counter, inspect the tagged suitcase, and follow its service key into
a concealed luggage gallery. Documents pause the solo run and remain available
in the pause-menu journal. The discovered passage opens a permanent route for
the current run, usable by both player and zombies, with a one-time supply cache.

See [the renovation notes](docs/hotel-renovation.md) for gameplay, asset sources
and validation. Development `?playtest=1` includes reception/mystery viewpoints
and collapsible controls.

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

## Last Call lounge

The cocktail lounge has original Blender-built marble and walnut furniture, an
illuminated arched backbar, burgundy booths, cocktail tables and stools, and a
crystal chandelier. Furniture blocks players and zombies while preserving the
cross-room aisle and staff escape route. See [asset source and rebuild details](docs/bar-assets/README.md)
and [validation notes](docs/bar-assets/playtest.md). Development previews offer
**Lounge overview**, **Lounge entry view**, and **Lounge seating** camera controls.

## Northwest supply room

The purchased supply room contains an original Blender-built hotel-supply truck,
stacked shipping cartons, wooden pallets, loaded shelving, a pallet jack, and
detailed utility fixtures. The parked truck and storage assemblies provide
solid cover with a clear route from the hotel's west doorway to the rifle rack.
Editable Blender sources, rebuild scripts, previews, and placement
checks are documented in [service assets](docs/service-assets/README.md).
Development playtests include **Service overview**, **Service truck**, and
**Service storage** viewpoints.

## Controls

| Action              | Control                                    |
| ------------------- | ------------------------------------------ |
| Move                | W A S D                                    |
| Look                | Mouse                                      |
| Fire                | Left mouse button, hold for repeated shots |
| Aim                 | Hold Shift or right mouse button           |
| Both barrels        | B (Double or Nothing)                      |
| Knife slash         | V                                          |
| Throw grenade       | G                                          |
| Sprint              | Space (hold; uses stamina)                 |
| Reload              | R; an empty trigger also starts a reload   |
| Buy/interact        | E when close to a purchase; also puts chips away |
| Switch weapons      | 1–5 house guns, 6–0 Mystery Box finds; wheel or Q cycles |
| Hold casino chips   | C (then aim at a craps number and fire)    |
| Cash out table bets | X near the craps table                     |
| Pause/release mouse | Escape                                     |

The start and pause screens provide mouse sensitivity, sound volume, and optional frame statistics. Losing focus pauses the run and clears held input. Controller support is deferred.

## First five rounds

Start with a pistol and 400 chips. Each damaging hit awards a random integer from 5–10 chips (each shotgun pellet counts). Headshots add 100 chips, including nonfatal headshots; non-headshot kills add 50. A headshot kill does not also award the 50-chip body-kill bonus. The first five rounds contain 6, 9, 12, 16, and 20 zombies, with a 14-enemy active cap. Health regenerates after 5.5 seconds without damage. Every run resets weapons, chips, doors, and upgrades.

Zombies use three original Blender designs: Pit Boss, Crooked Dealer, and Last Showman. They shamble, snarl, recoil, and cycle through a backhand rake, overhead hammer, and two-arm snatch with windup and recovery. Wounds remain bloody; 32 cumulative damage to an arm or leg severs that limb permanently for that zombie. Losing one leg reduces movement to 48%; losing both reduces it to 23%. Shared animation poses drive bullet hit volumes, excluding missing limbs. See `docs/zombie-assets` for the editable Blender source and preview, and `tools/zombie-assets/generate_zombies.py` to regenerate assets.

- Pistol reserve: 150 chips, on the south casino wall near the start.
- Room Service shotgun: 800 chips, on the east casino wall; 300-chip reserve refill.
- Cocktail lounge: 900 chips for the north entrance; its south entrance is a separate 600-chip purchase. Either entrance grants access to the west bar.
- High Roller Club: 1,300 chips for the west entrance; its east entrance is a separate 800-chip purchase. Either entrance grants access to the south poker room and workshop.
- Northwest supply room: 1,200 chips from inside the purchased hotel; contains the relocated truck/storage and rifle.
- Cashier: 600 chips for the east public room. Glass blocks movement and projectiles while allowing sight. The cash behind it is scenery.
- Seven’s Curse craps wager: 250 chips, **once per table per round**. Each table owns its roll and result. Two fair six-sided dice roll while combat continues. A total of seven slows walking and sprinting by 20% for that round; other totals pay 500 chips (250 net). Two curses do not stack, and a win at the other table does not remove a curse. During intermission, the wager and any curse apply to the upcoming round.
- Craps: hold physical 25-chip stacks with **C**, then aim/fire at 4, 5, 6, 8, 9, or 10. Standard place-bet minimums and payouts are used (6/8 in multiples of 6; 4/10 pay 9:5, 5/9 pay 7:5, and 6/8 pay 7:6). Each table has its own bets and one roll per round. With chips on the felt there is no additional roll fee. Bets stay on the felt between rounds; **X** returns the remaining principal. A seven clears the table, while a hit number pays profit automatically.
- Speakeasy easter egg: the High Roller poker table has fixed suit/value cards. Shoot the matching suit and number sequence into the keypad hidden behind the portrait in the cashier public room to open the adjoining secret room. The room contains a Blender-built Velvet Fortune mystery slot: 400 chips per spin, 50% chance of one of the ten 1970s house guns below (an already-owned gun is restocked), otherwise no reward. The cabinet shuffles 3D models of the arsenal while it spins and the HUD reel shows the payout.
- The 1970s Mystery Box arsenal ([spec](docs/weapon-spec-1970s.md), [assets](docs/weapon-1970s-assets/README.md)): High Roller magnum (the spec's `revolver`, shipped as `magnum` because the poker revolver owns that id), Chicago Typewriter drum SMG, Double or Nothing coach gun (B fires both barrels), Snake Eyes twin pocket pistols, The Enforcer machine pistol, Silver Dollar lever action (penetrates three), Last Call auto shotgun, The Eye in the Sky scoped bolt action (penetrates four), House Edge belt-fed LMG (−22% speed, staggers) and The Debt Collector 40 mm launcher (splash can hurt you). Lever and Last Call load one round at a time and can fire mid-reload; automatic guns lose accuracy under a held trigger.
- Stickman craps rake: free, leaning on the craps table on the starting casino floor. A 2.8 m, 100° sweep that damages every zombie in the fan; it survives **3 successful sweeps** (misses are free), then splinters and returns you to your last firearm.
- Fire Exit axe: free, in the break-glass cabinet on the northwest supply room's north wall. Slow, heavy single-target chop that never breaks; no firearm use mid-swing.
- Lucky Four roulette: 200 chips on every spin, charged when the spin starts. A fair 0–36 wheel spins for six seconds while combat continues. **4 and 24** refill the equipped gun’s magazine and reserve; **7** refills every owned gun; **0** refills every owned gun and grants **double damage for 30 seconds**. Other numbers give no reward. There is no additional charge at the result and no refund on a win. Return to the table for another spin once the wheel stops.
- Dealer’s Choice SMG: 1,100 chips in the lounge; 400-chip reserve refill.
- Pit Boss rifle: 1,600 chips in the northwest supply room; 500-chip reserve refill.
- The Dead Man’s Hand revolver: complete a five-card flush at either the starting casino or High Roller card table. One free chosen-card exchange per table, per round; hands persist between visits. The first flush grants and equips the six-shot revolver in slot 5; the other table’s flush refills it.
- Marlowe, the lounge bartender: **E** from the customer side of the bar opens the menu and pauses the solo run. House Reserve costs 1,500 (+50 maximum health); Quick Pour costs 1,000 (reload time ×0.7); Night Shift costs 900 (sprint speed ×1.15). Perks are one-time purchases for the current run.
- Double Down: 2,000 chips per owned weapon, at Marlowe’s menu or the VIP workshop. Increases magazine capacity by 50%, damage by approximately 35%, and fills the magazine once. The revolver retains six chambers and gets a 25% faster reload instead of extra magazine capacity. Select the gun to upgrade in the bar menu; the workshop upgrades your equipped gun. Both locations share upgrade state.

Extra guns, separately purchased escape routes, and perks are competing build choices; buying everything is a longer-run goal. Door prices and the economy with two starting craps tables are initial playtest tuning. Rounds continue after five with bounded enemy speed and health.

## Architecture

- `lib/game/simulation.ts`: pure gameplay rules, economy, rays, collisions, and shared navigation flow field.
- `lib/game/casino-layout.ts`: shared room footprints, individual doors, table and slot placements, weapon anchors, and room spawn points.
- `lib/game/poker.ts`: persistent five-card hands, finite shuffled decks, suit matching, and discarded-card recycling. `card-art.ts` draws the live tabletop card prints.
- `lib/game/renderer.ts`: casino environment, local GLB weapon loading, animation, lighting, and frame sampling.
- `lib/game/casino-architecture-assets.ts`: original Blender wall spans and room gates; [architecture and playtest notes](docs/casino-architecture/README.md).
- `lib/game/characters.ts`: articulated casino guests and Marlowe, with clothing and facial details.
- `lib/game/runtime.ts`: fixed-step updates, input, pointer lock, pause/resume, restart, and HUD snapshots.
- `lib/game/audio.ts`: synthesized weapons/interaction cues, round stingers, and local AI-generated positional zombie voices.
- `lib/game/weapon-expansion.ts`: 1970s arsenal stats, Mystery Box pool, penetration, bloom, recoil and melee timing.
- `lib/game/weapon-viewmodels.ts` / `weapon-rig.ts`: per-weapon first-person placement and hand-authored action/reload choreography applied to named Blender nodes and fitted hands.
- `lib/game/weapon-audio.ts`: lazily loaded weapon foley, round-robin variants, and reload/action cues locked to the animation timeline.
- `lib/game/zombie-audio-director.ts`: proximity, crowd, last-survivor timing, and shared voice cooldowns.
- `app/page.tsx`: title, HUD, settings, pause, and results.
- `tests/simulation.test.mjs`: economy, ammunition, line of sight, corner navigation, gate states, spawn access, wave completion, and reset tests.

## Validation and limitations

Automated checks cover combat, economy, independent door purchases and table wagers, reachable room routes, glass behavior, hotel stairs and mystery progression, card rewards, audio and assets. Type checking and production build are separate checks. The initial target device is the user's M3 Max MacBook Pro with 128 GB RAM. No sustained 30-minute gameplay or real-device frame-time benchmark is claimed yet.

This is a rough playable: stylized geometry and humanoids, synthesized effects plus AI-generated zombie voices, no jump, crouch, persistent records, native app, controller support, or co-op. Mouse capture needs a focused browser and a genuine user gesture. The final feel and difficulty need a hands-on mouse playtest.

Press **V** for a knife slash: 100 damage to the nearest target in a forward 1.65-meter reach, with a 0.18-second windup and 0.75-second cooldown. It consumes no ammunition. Press **G** to throw a grenade: 2.2-second fuse, bouncing trajectory, and a 4.5-meter blast with damage falloff and cover checks. Nearby explosions can hurt you. Start with two grenades; each round after the first supplies two more, capped at four. Both attacks cancel reloads and award the same hit chips and 50-chip non-headshot kill bonus as gunfire. Pause freezes windups, fuses, and blast effects.

## Assets

Casino geometry, characters, signs, and most sounds are generated by this source. Zombie vocals use Stable Audio 3 Small SFX, four active Medium takes, and four selected ElevenLabs Sound Effects last-zombie variations; prompts, processing, provenance, and an audition page are documented in `docs/zombie-audio/`. Five original local GLB weapon assets use named components and PBR materials; see `docs/weapon-models.md`, `tools/generate_weapons.py`, and `docs/revolver-assets/`. The twelve 1970s Mystery Box weapons, their HUD renders and their synthesized foley are built in Blender and numpy by `tools/weapon-1970s/`; see `docs/weapon-1970s-assets/README.md`. The wallpaper is an ImageGen texture documented in `docs/wallpaper-asset.md`. The worn carpet albedo in `public/textures/casino-carpet.png` was generated with the built-in OpenAI ImageGen tool; its prompt and provenance are in `docs/carpet-asset.md`. The social-preview image was generated with OpenAI ImageGen specifically for Last Jackpot; it is promotional art, not an in-game screenshot. Babylon.js is Apache-2.0 licensed; package licenses remain in their respective dependencies. No Call of Duty assets are included.

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

Audio adds a quiet electrical/room bed, occasional distant slot notes and chips/glass, footsteps, and distance-panned zombie breath, groans, and attack calls. Round stingers duck ambience. Pause and focus loss mute the world bus immediately; purchases, denials, and death retain their separate cue path. Room and interaction effects are synthesized locally; zombie voices use the generated clips documented below. Audio graph tests cover pause/routing/disposal; their timbre still needs a human listening pass.

New asset sources, dimensions, pivots, and geometry validation are documented under `docs/table-assets/` and `docs/hand-assets/`; generators live under `tools/`. Run these generators with Python, NumPy, SciPy, and Pillow installed. They write to ignored `outputs/table-assets/` and `outputs/hand-assets/`. Generated textures are embedded in the GLBs. Hands are fitted posed meshes, not skeletal finger animation. Roulette began as visual ambience in this pass and is now playable alongside craps.

## Blender slot machines

The main room's eight slot islands use 48 original Blender-modeled cabinets in emerald and burgundy. Beveled panels, brass trim, curved mechanical reels, illuminated headers, control buttons, side levers, and payout trays replace the earlier block-based machines. Cabinets share geometry and materials through hardware instances. Each island has a matching collision footprint; bullet-cover height matches the taller cabinets. Slot machines remain scenery, without a new wager mechanic.

The editable source is `assets/source/slot-machines.blend`; browser exports are `public/models/slot-machine-emerald.glb` and `public/models/slot-machine-burgundy.glb`. Reproduction instructions and previews are in `docs/slot-assets/`, with Blender Python sources under `tools/slot-assets/`. Development playtest controls include west, east, and second-bank slot viewpoints.

## Zombie voices

Ten active local AI-generated clips cover three chase performances, a horde,
four last-survivor variations, attacks, and deaths. Four active takes use Stable
Audio 3 Medium; the original chase and horde use Small SFX. The last-survivor
pool uses the user-selected, three-second ElevenLabs Sound Effects Takes A–D:
`scream-elevenlabs-high-01.wav` through `scream-elevenlabs-high-04.wav`.
They rotate across rounds without an immediate repeat. All three earlier
ElevenLabs screams and both Medium survivor takes remain comparison assets;
the original Small SFX survivor remains a historical asset. See
[`docs/zombie-audio/README.md`](docs/zombie-audio/README.md) for exact prompts,
provenance, levels, source terms, and an audition page with thirteen zombie players:
eight current cues and five comparisons. Bell A is selected for the restaurant
ambush; see [`docs/restaurant-bell/README.md`](docs/restaurant-bell/README.md).
Slot D plays on the speakeasy handle pull; craps-stick swings choose randomly
between Swipes A and D. The selected clips and comparison takes lead the audition page; see [`docs/casino-effects/README.md`](docs/casino-effects/README.md).
The game requires no AI account, API key, or service calls.

- A nearby zombie within 8 metres can call every 5–8 seconds.
- Five or more zombies within 10 metres can produce a horde cue every 12–18 seconds.
- The last-survivor cue plays once per round after a short hold, only when no more
  zombies are waiting to spawn and the survivor is within 18 metres.
- Chase, horde, and survivor cues share a minimum five-second gap. Moving zombies
  retain positional panning and distance attenuation. Attacks interrupt lower
  priority vocals; deaths are restrained and rate limited. Voices stop when their
  source dies, and death cues retain the final position, including floor height.
  Round stingers take priority. Pause, focus loss, and restart stop all zombie
  voices. Sound volume still controls the whole mix.
- Failed asset downloads/decodes fall back to the existing synthesized groans.

In development, `/?playtest=1` adds **Hear chase**, **Hear last zombie**, and
**Hear horde** buttons. Each starts a repeatable real simulation; the small
status line reports decoded clips and the latest playback category. The controls
and diagnostics are excluded from the production interface. Objective waveform
checks and automated routing/timing checks do not replace a human listening pass
for tone and humor.

## Roulette rewards

Interact with the customer side of either starting-casino roulette table using **E**. Each spin costs 200 chips. The number is chosen once at the start, with all 37 pockets equally likely, and the wheel and ball settle on that number. The four lucky pockets give a combined win chance of 4/37 (about 10.8%). Spins continue while you move and fight; each table can run one independent spin at a time.

Ammo rewards fill both magazine and reserve, respect upgraded magazine sizes, and cancel an active reload. The 4/24 reward uses the weapon equipped when the ball lands. Unowned weapons stay unowned. A second zero refreshes the 30-second double-damage timer instead of stacking its multiplier; the bonus also applies to upgraded weapons. Spin, result-display, and damage-bonus timers freeze during pause and the bartender/card menus. Starting a new run clears all roulette state and bonuses.

## Flush card tables

The Grand Casino and High Roller poker islands use a detailed shared GLB with stitched oxblood rails, inlaid walnut, brass trim, recessed cupholders, printed emerald felt, a pedestal base, dealer tray, and detailed chip stacks. Five live cards sit on each felt surface and match that table’s hand. Editable Blender source, previews, regeneration instructions, and geometry checks are in `docs/poker-assets/` and `tools/poker-assets/`.

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

## Slot-machine pass-by sounds — September 28, 2026

The 12 slot cabinets now give occasional quiet, positional greetings when you
walk past their front panels. Three short original synthesized variations use
padded reel ticks, soft electronic chimes, and coin-tray chatter. A gently sagging
last note suits the abandoned casino. These require no additional downloads,
AI service, or third-party audio license.

Sounds trigger within 3.5 metres, pan with the listener, soften with distance,
and fade completely by 5 metres. Cabinets behind walls or the back of a slot
island stay quiet. Only one plays at a time; a four-second shared cooldown, a
20-second cabinet cooldown, and leaving beyond 4.5 metres prevent repeated
greetings while camping beside a machine. The old floor-wide slot melody has
been replaced by these cabinet sounds. Zombie calls and round stingers have
priority; pause, focus loss, restart, and disposal stop active slot audio.

Development `/?playtest=1` has **Walk slots west**, **Walk slots east**, and
**Walk second bank** controls for repeatable real movement past each aisle.
The slot status names the emitting cabinet and sound. See
[`docs/slot-audio.md`](docs/slot-audio.md) for implementation and validation.

## Blender High Roller couch

The couch beside the flush card games now uses an original Blender-built oxblood leather banquette with sculpted diamond tufting, five shaped cushions, stitched piping, rolled arms, walnut joinery, and brass feet. The existing footprint and cover height remain unchanged. The editable source is `assets/source/vip-couch.blend`; the game loads `public/models/vip-couch.glb`. See `docs/couch-assets/` for previews, regeneration instructions, and validation. Development playtest controls include a **VIP couch** viewpoint.

Sprint stamina lasts five seconds, recovers after a one-second delay, and requires 30% recovery after exhaustion. Settings → Show tips & explanation cards controls optional help overlays and remembers your choice on this browser. Essential gameplay status remains visible.
