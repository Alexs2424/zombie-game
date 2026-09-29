# Casino reconfiguration — implemented layout and design record

Status: implemented in the local game. The dimensions below became the shared
room definitions in `lib/game/casino-layout.ts`. The casino has 48 slot machines,
two craps tables, two roulette tables and one flush table; High Roller contains
the second existing flush table. Lobby renovation belongs to another task;
this reconfiguration changes only the supply-room connection at its boundary.
Basis: the user's annotated Step 1 sketch and the current local game source,
including the newer hotel reception and concealed service-gallery additions.

## Implementation decisions

| Door | Chips | Unlock |
| --- | ---: | --- |
| Bar north | 900 | This entrance only |
| Bar south | 600 | This entrance only |
| High Roller west | 1,300 | This entrance only |
| High Roller east | 800 | This entrance only |
| Hotel | 2,000 | Existing lobby and upstairs access |
| Supply | 1,200 | From inside the hotel |
| Cashier | 600 | Public counter room only |

Either bar or High Roller entrance grants room access and starts that room's
spawn grace period once. The other entrance stays closed until purchased.
Both starting craps tables accept a separate 250-chip wager for each round,
including an upcoming-round wager during intermission. Their rolls and payouts
resolve independently. Seven's Curse remains a nonstacking 20% movement penalty;
a win at the other table does not clear it. Both roulette tables have independent
spins, results and wheel animations, retaining existing reward rules.

The cashier's glass blocks players, zombies and projectiles while allowing sight.
The rear cash, shelves and safe are scenery. A clear rear zone is reserved for
future stairs/trapdoor work, with no traversal or reward implemented there.

The records below preserve the approved design reasoning. Where they describe
targets or proposals, the shared geometry and generated map show the final local
implementation. The 48 cabinets reuse the original assets through instancing;
the shifted bar and truck/storage retain their original furniture assets.

## Integration with the current main branch

The PR also preserves the main branch's newer 1970s arsenal, weapon sights,
place-number chip betting and Velvet Hour secret room. The portrait/keypad now
connects the cashier's public room to a 10 × 24 m speakeasy east of it; the glass
cash area remains inaccessible. The clue cards follow the High Roller flush table.

Both craps tables retain one roll per table per round. A roll with no placed
chips uses the approved 250-chip quick wager and 500-chip win. Optional placed
bets use the imported place-number odds, lock while rolling and remain on the
table until collected or cleared by seven; rolling those bets costs no extra fee.
Each table keeps its own chips, results and aiming targets.

The generated map includes the speakeasy and its concealed door. Overall ground
bounds are now 98 × 89 m, while the casino and hotel footprints stay unchanged.

## Implementation validation

- The merged suite contains 231 automated tests. All pass after a focused
  re-run correcting the layout test to use the actual combined collision geometry.
  Coverage includes both betting modes, the arsenal, secret-room puzzle, hotel
  mystery, curved-stair navigation and restaurant challenge.
- Full TypeScript checking, ESLint, production build and whitespace checks pass.
  The build retains existing Vinext advisory messages about configuration and
  dynamic imports; they do not prevent the build.
- Local Chrome checks exercised all individual door prices, the hotel-to-supply
  purchase route, the moved rifle, four simultaneous table-game result cards,
  independent roulette results and the starting flush-table revolver reward.
  A fresh-page check also exercised independent placed-chip bets, the portrait
  shot sequence, Mystery Box and weapon aiming. No browser console errors or
  uncaught page errors were reported.
- Visually inspected the casino, bar, High Roller, cashier, supply room, rifle
  rack, hotel and table models. Moved the rifle rack to the supply room's west
  wall so shelving does not obscure its purchase approach.
- Regenerated and inspected the accurate source-derived room map. Current game
  screenshots are `grand-casino-preview.png` and `cashier-preview.png` beside it.

The browser checks used development controls for repeatable positioning and
starting funds. Sustained combat balance and a long-run frame-time benchmark
remain hands-on follow-up work; the local build is ready to play.

## Confirmed direction

- Keep the hotel lobby exactly its current size. The fixed footprint is the
  octagon with vertices (-15,15), (7,15), (15,23), (15,43), (7,51), (-15,51),
  (-23,43), (-23,23), in world X/Z metres. Bounds: 38 × 36 m.
- Make one grand central casino the player's starting room, containing slots,
  craps, roulette and the existing flush-poker game. Its approved size is 60 × 32 m.
  Add more slots and existing game tables as needed to fill it coherently; the
  sparse original sketch is a zoning guide, not a limit on furnishing count.
- Move the bar to the west of that casino.
- Create a separate cashier room to the east, with a glass-secured cash area.
  Reserve a future trapdoor location; its destination and mechanic are later work.
- Put the supply room northwest of the hotel, with a relocated gun purchase.
- Retain a separate High Roller room south of the main casino. Move one existing
  flush table to the main casino and the other into High Roller; keep both existing
  persistent hands and their current revolver reward/refill behavior.
- Only the central casino and its games are accessible at the start. Buy access
  to the bar, hotel, relocated supply room, High Roller and cashier public room.
- The cashier back area stays inaccessible, reserved for future stairs/trapdoor.
- Move the truck/storage Staff Passage into the northwest supply room and relocate
  the Pit Boss rifle there. Keep the hotel's concealed luggage gallery and mystery.
- Each of the two craps tables permits one bet per round, tracked independently.
- Buy each bar and High Roller entrance separately. Opening the first entrance
  grants room access; the second entrance remains closed until separately purchased.
- Limit this task's hotel work to the supply-room doorway and its local collision,
  navigation and trim. Another task owns all other lobby/interior changes. Preserve
  its current and subsequent work rather than restoring an earlier snapshot.

## Implemented dimensions and connections

The hotel footprint and 60 × 32 m casino size are fixed. The annex dimensions
below were selected during implementation, not inferred from the sketch's scale.

| Area | Size / bounds | Connection |
| --- | --- | --- |
| Grand starting casino | 60 × 32 m; X -33…27, Z -20…12 | Central hub; hotel entrance remains aligned at X -3 |
| Bar / Last Call Lounge | 12 × 24 m; X -45…-33, Z -20…4 | West side of casino; two spaced openings proposed for a combat loop |
| Cashier | 16 × 24 m; X 27…43, Z -20…4 | Public approach from east side of casino; secure area behind glass |
| High Roller | 22 × 18 m; X -28…-6, Z -38…-20 | South side of casino; two openings proposed to avoid a large dead end |
| Supply | 14 × 14 m; X -37…-23, Z 35…49 | New lobby west-wall opening around Z 40, clear of the curved stair |
| Hotel foyer | Existing 5 × 3 m connecting section | Casino → lobby at ground height |
| Hotel lobby | Exact existing octagon; 38 × 36 m bounds | Retain footprint; add supply doorway without enlarging lobby |
| Upstairs restaurant | Existing polygon at Y +4 m | Keep both existing stair connections as the baseline |

The approved starting casino is four times the current 20 × 24 m starting room,
and larger than the entire current 58 × 24 m casino wing. Use the blockout to tune
the furnishing density and routes within that approved size. Populate the space
with repeated banks, table groups, seating and architectural detail.

## Room design

### Grand casino

- Merge the current casino/lounge/staff/club/table-room gameplay distribution
  into the new central floor and its surrounding rooms. Retire the old eastward
  chain of partitions; The Devil's Tables can remain a named table zone.
- Keep the sketch's zoning: roulette west, grouped slot islands across the
  middle/north, flush poker east, and craps tables on the southern half.
- Initial furnishing target: eight six-cabinet slot banks (48 machines), two
  craps tables, two roulette tables, and one flush table on the main floor.
  This is a design target to tune during the furnishing pass, not a new fixed
  requirement. Preserve the second existing flush table in High Roller.
- Arrange slots in four paired groups using the existing emerald/burgundy assets,
  consistent orientation, aligned carpet insets and coordinated lights. Keep
  furniture at its current physical scale and vary cabinet finishes within a
  coherent rhythm rather than scattering unrelated objects across the hall.
- The second roulette table reuses the current roulette game. Additional tables
  can be added if the walking review shows useful gaps; do not invent new game
  rules or duplicate the two existing flush rewards just to fill floor area.
- Place one existing flush table on the east side of the starting casino and the
  other in the south High Roller room. Main-floor table is usable immediately;
  the southern table becomes usable after that room's purchase.
- Keep a clear approximately 5 m approach on the starting position → hotel axis,
  a continuous perimeter route, and generous circulation around each island.
  Final furniture positions and approach distances must be checked in blockout.
- Target 3 m or more for primary cross-aisles, measured between full furniture
  footprints (including chairs/stools where present). Keep door approaches and
  interaction positions out of through-traffic. Fill peripheral gaps with matching
  seating, planters, signage and lighting while preserving the escape routes.
- Begin with the existing table and slot assets at their current physical sizes.
  Add grandeur through the room proportions, ceiling treatment, chandelier
  rhythm, carpet borders, sightlines and grouped furniture rather than inflating
  the tabletop models.
- Move the player start onto the southern central aisle, facing the hotel.
  Distribute spawn entrances around the perimeter and preserve initial breathing
  room, sightline checks and each area's unlock/grace rules.

### Bar

- Relocate Marlowe, the whole counter/backbar, booths, lighting, SMG purchase,
  interaction approach and audio together.
- Two separated casino-side doors are recommended, with a usable loop around the
  seating after both entrances are purchased. Each entrance has its own price and
  persistent unlock for the run; opening one does not open the other.
- Keep existing perk and weapon-upgrade behavior unless separately changed.

### Cashier

- Separate public counter/queue space from the staff cash-counting area with
  glass partitions, brass frames and a secure counter.
- Make cash stacks, shelves and a safe visible behind glass. Those are scenery
  unless a cash-collection mechanic is separately specified.
- Glass must block player and zombie movement. Recommend intact glass also
  blocks bullets while allowing sight; this requires distinguishing visual line
  of sight from physical/projectile collision in the current shared system.
- Keep the staff/cash side inaccessible in this phase. Reserve a staff-access
  location and clear future trapdoor footprint. No new basement, usable stairs,
  traversal or secret reward is included.
- The sketch's stairs are shown as reserved space, not a new working level.

### Supply room

- Connect from the northwest part of the lobby, beyond the left stair's upper
  extent, without altering the lobby outline or putting storage in stair travel.
- Relocate the old Staff Passage truck/storage assets here. Add loading-door
  dressing to explain the parked truck and maintain clear routes around it.
- Relocate the Pit Boss rifle here. Keep the early shotgun on the
  main floor and the SMG in the bar. Revisit rifle access price because hotel access
  would now gate it instead of High Roller access.
- Preserve the current hotel ledger → suitcase → concealed gallery sequence,
  including its key-based access and supply cache. This is distinct from the
  relocated, purchased truck/storage room.

### High Roller

- A separate south annex preserves an upgrade/progression destination after
  moving common games onto the starting floor.
- Contents: the second existing flush table, VIP couch, and Double Down workshop.
- Preserve the two-table reward rules: the first completed flush unlocks the
  revolver; completing the other table refills it. No new poker rules are needed.
- Two casino connections are recommended; a single entrance remains an option
  only if the user later chooses an intentionally enclosed room. Each of the two
  proposed entrances is purchased separately.

## Progression and implementation consequences

Moving an object alone will not make it usable in its new room. Flush poker is
currently gated by the old VIP unlock; craps/roulette by the old Tables unlock;
the rifle by VIP; and the SMG by Lounge. Replace these checks with the agreed new
room/game access rules. Confirmed starting access is the central casino only:
main-floor poker, both craps interaction points, and roulette work immediately.
Slots retain their current scenery/proximity-sound behavior. Surrounding room
entrances are paid; the hotel's existing hidden-gallery puzzle remains intact.
Leave exact new door prices open until the route is set. Existing prices (bar 900,
High Roller 1,300, hotel 2,000) are useful baselines; cashier and supply need prices.

There is one current craps state and one per-round wager allowance. Replace that
with two table IDs, each owning its dice roll, result, payout resolution, and
last-wager round. The confirmed rule is one wager per table per round. Preserve
the current wager and payout amounts initially; access to two bets changes the
starting economy and should be playtested. Proposed curse behavior: either table
can apply the existing 20% movement penalty for the round, but two cursed rolls do
not stack it, and a later winning roll does not clear it. Intermission wagers
continue to count against the upcoming round, independently for each table.

Support multiple roulette placements with unique table IDs, approach positions,
spin/result state and wheel/ball visuals. Preserve current per-spin price and
reward rules, with each purchase and result resolved exactly once. Shared player
ammunition and damage rewards still follow the existing nonstacking refresh rules.
Give every added slot cabinet a unique identity and location while retaining
global audio concurrency/cooldowns so more machines do not create a sound flood.

Track each purchased door independently. A room becomes accessible when any of
its entrances opens, while its other doors retain their own closed state. Table,
weapon and spawn access follow the room's actual accessibility, not an obsolete
VIP flag or an assumption that paired gates open together. A second-door purchase
creates the extra escape route; it should not restart room spawns or reset games.

Use shared room polygons and fixture placements for floors, barriers, navigation,
labels, audio and interactions. The present rectangular casino bounds and
coordinate-threshold room naming will misclassify the new northwest/south/west
extensions. Generalize ground coverage and room lookup before adding those wings.

The lounge GLB has baked placements. Relocate its model origin/parent, decorations,
lights and furniture as one assembly. Slots, poker cards, roulette animation,
craps dice, wall guns, prompts and their approach anchors all need the same
placement update as their colliders.

Treat the other task's hotel work as authoritative: exact lobby/upper outlines,
curved stairs, reception, mystery documents/anchors, service gallery, Last Service
bell, Tommy reward/ammunition, jukebox and hotel spawns. Only cut and finish the
agreed supply doorway and connect its route. Before implementation, reread the
latest hotel geometry and fixtures to ensure that doorway clears the other task's
layout. Make narrow integration edits to shared files; do not replace whole hotel
modules with older copies or reposition its furniture as part of this work.

## Build order after design decisions

1. Finalize annex dimensions, assign door prices and check the supply doorway
   against the other task's latest hotel work. Casino size and scope are settled.
2. Build a simple geometry blockout with shared room/door definitions; move the
   start and verify every route, especially the unchanged hotel and new supply door.
3. Relocate and connect real gameplay: table state/rewards, purchases, gun racks,
   bar, collision, audio positions and enemy navigation/spawn permissions.
4. Dress the grand casino, bar, supply and cashier; adjust the proposed 48-machine
   layout and table groups until the hall feels populated and cohesive, reserve
   future secret space, and preserve clear walking/combat routes.
5. Check walking/sprinting and zombie routes through all doors and stairs, intact
   glass behavior, prompts and shots at moved fixtures, all unlock orders, rewards,
   round/reset behavior, hotel mystery, and performance in the larger hall.
6. Regenerate the accurate final room map from the implemented geometry.

## Follow-up playtesting

- Tune encounter pacing, door prices and the economy of two starting craps tables
  from sustained hands-on runs in the implemented layout.
- The other task owns lobby changes beyond the supply doorway. No further lobby
  redesign decision is required for this task.
- Glass blocking bullets and nonstacking curses are the implemented defaults.
- The future cashier stairs and trapdoor destination are deliberately deferred.
