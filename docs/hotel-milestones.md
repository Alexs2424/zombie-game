# Grand Hotel expansion

The hotel branches from the main casino at ground level. The agreed layout has
two broad, mirrored curved staircases, a double-height lobby, and a restaurant
upstairs. Normal walking and sprinting are supported; continuous guards prevent
falling or jumping between levels.

## Milestone 1 — playable vertical loop

Completed and approved. The notes below document the initial layout pass;
current gameplay and art are described under milestones 2 and 3.

- Level entrance through the main casino's north wall, centred at x=-3, z=12.
- An octagonal lobby with a tall ceiling, a short entrance foyer, and two stairs.
- Three-metre-wide curved stairways rising four metres to a shared upper walkway.
- Layer-aware player movement, zombie pursuit, collision, and combat.
- Simple materials and clear wayfinding; the entrance is open for this playtest.
- Verify the whole route before proceeding with restaurant gameplay or detailed art.

### Verification

In a development preview, add `?playtest=1` to show the existing developer controls.
`Hotel entrance` starts a safe run at the casino side of the doorway. `Walk hotel
loop` walks the actual simulation through the foyer, up the left staircase,
across the upper walkway, down the right staircase, and back to the casino.
Keyboard input interrupts the guided walk. `Test upstairs pursuit` places zombies
below the upper walkway so their route upstairs can be observed.

Also walk and sprint manually in both directions, push against stair and balcony
guards, fire between levels through the open atrium, and throw a grenade onto the
walkway. Check that floors block attacks and that an enemy directly underneath
the player can still find a staircase. The original casino routes must still work.

Implementation verification completed on 2026-09-28:

- The original 106 game checks and 15 hotel checks pass, including sprinting in
  both directions and pursuit using the other staircase when one is blocked.
- TypeScript, lint on changed gameplay modules, and the production build pass.
- Chrome completed the guided casino-to-hotel loop and returned to ground level.
- Three zombies placed directly below the upper walkway reached the player upstairs.
- A live Chrome sample with those three zombies showed 119 FPS and 9.5 ms p95
  frame time; this is a spot check, not a sustained performance benchmark.
- The original casino sign was relocated to clear the new hotel entrance sign.

The user approved this first layout, then requested a much larger restaurant and
ground-floor lobby. The expanded layout below is the next local playtest.

## Expanded layout — lobby furnishings and restaurant

- Ground-floor polygon enlarged from 656 to 1,240 square metres; upper floor from
  147 to 451 square metres. The casino entrance remains at ground level.
- Both curved staircases move outward while retaining their three-metre width,
  four-metre rise, smooth walking/sprinting, and continuous guards.
- Lobby reception desk, upholstered lounge seating, coffee tables, luggage cart,
  palms, and an arched brass-and-walnut jukebox. The user explicitly chose a
  static jukebox prop for now; music and interaction are future work.
- Upstairs has four dining groups, side booths, a host stand, and a service
  counter, with paths through the center and around the rear counter.
- Rendered furniture and height-aware collision use the same placement data.
  Upper furniture does not block the lobby underneath it. Navigation and combat
  bounds derive from the enlarged geometry.
- These are local procedural furnishings to evaluate layout and scale. Detailed
  Blender art and the final lighting pass remain in milestone 3.

The development controls now include `Restaurant` and `Lobby jukebox`. `Walk hotel
loop` crosses the casino entrance, climbs the left stair, traverses the restaurant
and rear service aisle, descends the right stair, tours the rear lobby, and returns
to the casino. `Test upstairs pursuit` tests zombies starting below the restaurant.

Expanded implementation verification:

- All 123 gameplay tests pass, including 17 hotel tests covering the furnished
  loop, far-rear pursuit on both floors, and stacked furniture collision.
- TypeScript, lint on changed modules, and the production build pass.
- Babylon construction checks verify merged geometry, upward-facing floors,
  jukebox face orientation, expanded bounds, and mesh/light cleanup.
- Chrome rendered reception, the furnished restaurant, and the jukebox correctly.
  The guided furnished loop returned to the casino at ground height, and zombies
  starting below the restaurant reached the upstairs player via the stairs.
- The furnished hotel adds 30 static meshes, about 62,000 vertices, four lights,
  and no new shadow maps or animation loops.

The user approved this expanded layout and requested milestones 2 and 3 together.
Keep this preview local.

## Milestone 2 — progression and restaurant gameplay

- A 2,000-chip gate opens the entire hotel for this run.
- Five service entrances add pressure on both floors after a three-second grace.
- The upstairs Last Service bell starts a 35-second challenge with 12 finite
  ambushers, up to six active within the global 14-enemy cap. Regular wave budgets
  pause; already-living normal enemies continue to pursue and attack.
- Stay upstairs and clear the ambushers to unlock the Tommy gun once. Taking the
  stairs fails the challenge; clear survivors before retrying. Ambushers pay no
  chips to prevent repeated free challenge attempts becoming a chip farm.
- The Chicago Typewriter uses key 6, a 50-round drum and 250 reserve rounds.
  Nearby ammo costs 500 chips; upgrades and roulette rewards support the gun.
- Gate, quest, weapon, and jukebox states reset each run. Pause freezes timers.
- No kitchen expansion or additional corridor connection was added in this pass.

## Milestone 3 — atmosphere and detail

- Eleven detailed Blender furniture types plus Tommy gun and fitted hands,
  with editable sources, original textures, and geometry validation.
- Shared-geometry stairs with ornamental Art Deco railings, warm chandeliers,
  coffered ceilings, marble, carpet, framed art, clocks, and visible service doors.
- Interactive jukebox with an original synthesized lounge instrumental, spatial
  attenuation, hotel ambience, and bell/reward cues. All follow pause and volume.
- Static contact shading and instanced furniture avoid adding shadow maps.
- Gameplay capped at 60 FPS, menus/pause at 15 FPS, no background rendering.

### Combined milestone verification — 2026-09-28

- All 141 game tests pass, including gate purchases, challenge progression,
  failure/retry, pause/reset, reward accounting, ammo, and hotel audio routing.
- TypeScript, targeted lint, whitespace checks, and the final production build
  pass. The build retains existing framework chunking warnings.
- Actual Babylon loading validates all 13 GLBs and all 21 furniture placements:
  floor contact, authored scale, collision envelopes, UVs/indices, booth and
  jukebox orientation, weapon pivots, and muzzle alignment. Loading replaces all
  eleven furniture fallback types without new warnings.
- Chrome verifies the 2,000-chip purchase and opening grille, live upstairs
  ambushers, a paused challenge timer, and one-time Tommy delivery after the
  full timer and enemy budget. The development ambusher-clear control was used
  to exercise completion; combat difficulty still needs the user's playtest.
- Chrome verifies the Tommy's 50/250 loadout, firing/reloading, host-bell
  placement, full-size furnishings, and free jukebox on/off interaction.
- With the final furniture loaded, Chrome completes the guided route through
  the ground-floor entrance, both stairs, restaurant service aisle, and rear
  lobby, returning to the casino at floor height 0.00 m without getting stuck.
  The final browser console contains no errors or new warnings.
- A Chrome restaurant spot check reached the 60 FPS cap with approximately
  17 ms p95 frame time. This is not a sustained combat benchmark.
- Hotel rendering uses four lights, no new shadow maps, and shared furniture
  instances. All meshes, lights, and transforms are removed on disposal.

The layout reminder was delivered and paused after the user's verification.

## PR integration

Merged main through `cc13a66` to retain the detailed Last Call lounge, High Roller
couch, positional slot audio, and service-corridor loading bay. The combined
gameplay and audio suite passes all 173 tests. TypeScript, targeted lint, and the
production build pass after conflict resolution. Chrome smoke checks confirm
that the hotel restaurant, service truck, Last Call lounge, and High Roller couch
all load correctly in the combined scene.
