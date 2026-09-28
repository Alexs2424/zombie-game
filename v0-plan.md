## Current implementation — tables and atmosphere pass, September 27, 2026

The latest requested expansion adds a 14 × 24 m table room east of the High Roller Club, expanding the map to 58 × 24 m. Pay 1,500 chips to open both entrances. The craps table offers one 250-chip roll per round: a seven applies −20% movement for its round; other totals pay 500. Intermission rolls target the next round. Roulette spins as ambient scenery. A delayed dealer spawn and table collision/navigation keep the new space part of survival.

The fidelity pass adds original detailed table GLBs, four fitted glove/forearm models, layered warm/cool lighting, contact shading, filmic tone mapping, muzzle spill, zombie vocal synthesis, and room-specific casino ambience. Current rules and limits are in `README.md`. Earlier exclusions of gambling minigames and ambient work below describe the original v0 scope; the user's later request supersedes them. There are 36 regression checks, including audio pause/routing and wager/round transitions.

## Current implementation — bartender and arsenal pass, September 27, 2026

The latest authorized expansion adds Marlowe’s bar menu with three run-only perks (health, reload, sprint), a per-weapon Double Down upgrade available at the bar and VIP workshop, a lounge SMG and VIP rifle, four detailed original GLB weapons, articulated casino characters, damask wallcovering, refined props and corrected signage. Round-start and round-clear announcements have distinct original synthesized stingers and a visible restocking countdown. Keys 1–4 select weapons. Solo, mouse-first and controller-later remain unchanged.

There are now 29 simulation regression checks. Chrome visual QA uses development-only visible controls to exercise room views, movement, purchases, menus, firing/reloading, transitions and a 14-enemy crowd. This is not a sustained performance or final game-feel benchmark. Current playable rules and prices are documented in `README.md`. Earlier checkpoint counts and scope below are historical.

## Latest refinement — September 27, 2026

User requested higher fidelity, a somewhat larger map, and a purchaseable room. Implemented a first environment pass: 44 × 24 m total footprint (37.5% larger), new High Roller Club with two linked entrances for 1,300 chips, two poker islands and an upholstered banquette. The 2,000-chip shotgun upgrade moves from the cashier counter into the club. Lounge and staff unlocks remain. A new private-entrance spawn activates only after the club opens, with a three-second delay. All purchases now total 6,200 chips, leaving 500 from the first-five-round income model; the staff shortcut remains an optional competing purchase.

Added worn carpet texture, wall panels/trim, ceiling coffers, chandeliers, sconces, bar shelving/bottles, cards/chips, clearer room signage, shadows/bloom, and sharper rendering. This is an environment fidelity pass; weapons and enemies still use procedural models. Twenty-two simulation checks cover the expanded layout. The older first-build plan below is historical where it differs from this checkpoint.

# Last Jackpot — proposed v0 plan

Status: rough v0 implemented in `game/` following the user's request to build it. Confirmed direction: Last Jackpot, an original abandoned Las Vegas casino; solo first; opening areas, training zombies, fun upgrades, and a little difficulty; a rough playable before the atmosphere pass; testing on the current Mac; mouse first, controller support later. Chrome is the initial browser target. The two unlocks and one shotgun upgrade are implemented with editable first-pass tuning.

## Implementation checkpoint — 2026-09-27

The browser build includes the procedural casino, mouse/keyboard input, pistol and shotgun, health/regeneration, rounds, chips, ammunition purchases, lounge and staff passage unlocks, one High Roller shotgun upgrade, pause/resume, death/results, restart, sensitivity/volume, and optional frame statistics. Seventeen automated simulation checks, TypeScript checking, lint, and the production build pass. No sustained performance benchmark or completed human playtest is claimed. Focused Chrome mouse-capture and game-feel validation remain the next hands-on checkpoint.

## Confirmed target hardware

Inspected locally on 2026-09-27: MacBook Pro (Mac15,9), Apple M3 Max, 128 GB RAM, macOS 26.0.1 (25A362). This is the primary test machine, replacing the source spec's hypothetical M1/8 GB baseline. Hardware identification is not a performance benchmark. Use mouse and keyboard first; controller support is a later expansion. Target desktop Chrome initially unless the user requests another browser.

## Product intent

Create a compact, replayable first-person zombie survival game whose appeal comes from responsive weapons, gathering and leading a crowd around the map (training), opening playable space, and buying noticeable upgrades. Run purchases reset on death. Test the first five rounds; later rounds may continue with simple scaling.

Difficulty should start forgiving and introduce manageable pressure through crowd positioning, ammunition, and reload timing. Rounds 1–2 teach the loop; rounds 3–5 should make movement and purchases useful. Do not rely on surprise spawns beside the player, sudden speed spikes, or excessive enemy health. Tune through playtesting rather than treating these intentions as validated balance.

The original product specification is reference material, not a commitment to implement its entire roadmap. Its fuller map, perks, power, full weapon-upgrade system, enemy roster, native app, and co-op milestones remain separate from this first build.

## Proposed first-build scope

- Solo is confirmed. Desktop browser delivery remains the proposed baseline.
- Walk, sprint, mouse look, fire, reload, interact, switch weapons, pause.
- Mouse/keyboard controls in v0, with adjustable sensitivity. Keep input actions separate from gameplay rules so controller bindings can be added later; controller mapping, aim assist, and controller-friendly menus are deferred.
- A starting pistol and one buyable shotgun, with headshot feedback, limited ammunition, distinct sounds, recoil, and reload timing.
- One zombie family with readable pursuit and attacks; escalating rounds and a provisional 12–16 concurrent enemy cap.
- Health, delayed regeneration, death, a simple results screen, and restart.
- Chips earned from kills, weapon/ammunition purchases, and two proposed route purchases: access to the lounge and a staff-passage shortcut.
- One proposed shotgun upgrade, bought once per run at the outside cashier counter: a larger magazine and a modest damage boost with immediate feedback. Exact values and cost require testing; no upgrade tiers, power prerequisite, random rolls, or machine animation sequence.
- HUD, sensitivity and volume controls, and reliable start/pause/focus behavior.

The user's priorities justify a small proposed extension to the earlier draft: a buyable lounge entrance in addition to the shortcut, and one simple gun upgrade. These are design recommendations, not user-confirmed feature counts. Build reliable combat and rounds before implementing progression. Keep both spatial purchases and the upgrade affordable within the five-round test without requiring perfect accuracy.

## Map recommendation

Begin with roughly a 30 × 25 metre total footprint; revise dimensions after testing movement, sightlines, and attacks. Keep the map on one level.

1. **Casino floor:** the starting combat space, with two offset, broad slot-machine islands. Keep the floor navigable as a loop before any purchase. Use few collision shapes and generous lanes; slot decoration must not create snag points or hide every approaching enemy.
2. **Cocktail lounge:** a shallow side room with a wide connection to the floor. Proposed change: start it closed, with a paid entrance that opens actual playable space. It provides a different sightline, but cannot serve as a permanently safe camping spot. A visible closed lounge and clear purchase prompt should make the first unlock understandable.
3. **Staff passage:** a short connector from the rear of the lounge to the far side of the floor. A separate paid gate completes the second loop for both the player and zombies. Its closed state must not strand a zombie or prevent round completion. No active spawn inside the passage in v0. Initially purchase it from the lounge side only, so it cannot bypass the first area unlock; make that restriction visually clear from the floor side.
4. **Cashier cage:** a locked visual landmark on the casino floor. Its interior stays inaccessible. The outside counter can serve as the proposed simple shotgun-upgrade purchase point without another room or unlock.

The earlier conversation schematic expresses adjacency, not final dimensions or a validated collision/navigation layout. It predates the newly proposed paid lounge entrance and upgrade counter. Depending on the physical gate position, part of the passage may be accessible as a dead end before purchase. Keep it short and readable.

## Entrances and purchases

- Four authored zombie entrances: the front entrance, a side security opening, a staff doorway onto the main floor, and an opening behind the cocktail bar.
- Activate floor entrances from the start. Keep the behind-bar entrance inactive until the lounge is reachable, then include it in the existing round spawn budget rather than adding bonus enemies. Apply a short activation delay and minimum player-distance check after opening the lounge. Never queue enemies into inaccessible space. Spawn outside the immediate player area, with readable approach and distance checks. Decorative entry barriers cannot be repaired in v0.
- Place starting pistol ammunition near the foyer.
- Put the shotgun and its ammunition refill on a visible casino-floor wall, accessible without buying a door. This preserves the early choice between equipment and space.
- Put purchase prompts on the lounge door and passage gate, clear of narrow interaction pockets. The lounge door is purchased from the floor; the staff gate is initially purchased from the lounge side. Open doors permit travel in both directions.
- Put the upgrade prompt on the cashier counter. Require owning the shotgun; show the resulting improvement, charge once, and reset the upgrade on a new run.
- Tune early income so the shotgun and opening space compete as the first major purchase. The upgrade and second route are later savings goals. Reserve enough ammunition access to avoid forcing a doomed run after an ordinary purchase. Establish exact costs after checking pistol ammunition and first-round income; no untested prices are requirements.

## Atmosphere and asset limits

The user chose a rough playable first. Use simple recognizable geometry, clear lighting, basic weapon/enemy sounds, and immediate hit feedback for validation. Decorative environment work must not delay that checkpoint.

After the playable is validated, add faded patterned carpet, dim slot screens, an empty bar, overturned stools used sparingly, and the locked cage. Use readable emergency/ceiling lighting, localized electrical flicker, machine hum, distant noises, and clear nearby zombie cues. Avoid sustained aggressive flashes or darkness that conceals attacks. This is the later presentation pass for showing friends.

Start with one reusable slot-cabinet model, two island arrangements, simple walls, one bar, and one cage facade. Add simple recognizable zombie and weapon placeholders. Prioritize movement, gunshots, hit reactions, and enemy readability. Slot machines are scenery; casino simulation is outside the scope.

Exclude stairs, balconies, elevators, destructible scenery, gambling minigames, cashier interior access, repairable barriers, perks, power activation, random weapons, multi-tier weapon upgrades, special enemies, and permanent progression.

## Build checkpoints and acceptance

1. **Combat:** flat blockout, movement/collision, pistol, one zombie, sound and damage feedback.
2. **Survival:** both guns, ammunition, chips, rounds, health, death, pause, and complete restart.
3. **Progression and validation:** paid lounge entrance, passage gate, navigation/spawn updates, one shotgun upgrade, early economy, and target-device testing.
4. **Atmosphere after validation:** casino dressing, refined lighting and ambient sound, then a version to show friends.

Acceptance: complete five escalating rounds without stuck enemies or stalled transitions; exercise three consecutive death/restart cycles; verify every door-state combination, accessible-spawn activation, one-time rewards and charges, upgrade reset, no damage through solid cover, and reliable pause/resume. Measure performance on the confirmed target Mac at the selected enemy cap. Through playtesting, confirm that training is possible, opening space changes available routes, both guns feel distinct, the upgrade is noticeable, and early difficulty remains forgiving.

Co-op is deferred; solo first is confirmed. Revisit a separate networking experiment only if the user later prioritizes it.

## Working defaults and later decisions

There are no blocking product questions before beginning implementation. Use desktop Chrome, mouse/keyboard controls, placeholder or free licensed assets, and no paid asset purchases. Treat the two spatial purchases and one shotgun upgrade as the working progression design, with prices, map dimensions, and difficulty refined through playtesting.

A target date and art/sound budget can be supplied later; neither is needed for the rough playable. Make no delivery promise until the initial combat and hardware test. Controller support and the atmosphere pass follow validation of the solo mouse/keyboard version.
