# Grand Hotel expansion

The hotel branches from the main casino at ground level. The agreed layout has
two broad, mirrored curved staircases, a double-height lobby, and a restaurant
upstairs. Normal walking and sprinting are supported; continuous guards prevent
falling or jumping between levels.

## Milestone 1 — playable vertical loop

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

User verification is pending. Complete that review before starting the next stages.

## Milestone 2 — progression and restaurant gameplay

- Purchase hotel access with chips; initial proposed price is 2,000.
- Add restaurant layout, booths, tables, a kitchen, and deliberate training routes.
- Add appropriately placed hotel enemy entrances and tune pressure upstairs.
- Consider a ground-floor service return to the existing staff passage.
- Keep both stairs usable and avoid making the restaurant a dead end.

## Milestone 3 — atmosphere and detail

- Detailed Blender stairs, railings, reception furnishings, restaurant seating,
  and fixtures that respect the verified walkable space.
- Art Deco materials, patterned flooring, lighting, and environmental sound.
- Verify signs, combat readability, and performance on the user's Mac in Chrome.

A follow-up reminder is configured to prompt continuation after milestone 1 is
implemented and the user confirms the playable prototype.
