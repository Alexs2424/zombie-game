# Last Call lounge redesign — September 28, 2026

The lounge now uses original Blender furniture: a marble and fluted-walnut bar,
illuminated arched bottle display, two burgundy banquette islands, cocktail
table, two stools, tabletop dressing, and a tiered crystal chandelier. The game
adds an oxblood fan-pattern carpet, silk wall panels, brass trim, opal sconces,
and warm room lighting. The editable source and furnishing-study render are
documented in [README.md](README.md).

## Gameplay and geometry

The counter and six additional solid furniture footprints feed the same
collision rectangles used by player movement, projectile obstruction, and
zombie navigation. Small tabletop decorations are visual props. A clear aisle
connects the casino entrance and VIP door; the staff passage remains reachable
around the northern seating island. Existing unlock costs and perks are unchanged.

Six new behavioral regression tests verify furniture blocking, access to the
bar/SMG/doors, the staff escape loop, locked-room boundaries, actual navigation
grid connectivity, and simulated pursuit around the obstacles. The behind-bar
spawn can walk around the counter without the stuck-enemy relocation fallback.

The independent Babylon NullEngine audit loads the shipped GLB with the normal
left-handed glTF conversion root intact. It verifies positive-X placement,
room bounds, geometry in every furniture footprint, bar-front/top/backbar ray
intersections, and clear entrance, bartender, and staff approach rays. See
[runtime-validation.json](runtime-validation.json) for the asset hash and results.
Minor decorative handle/capital overhangs remain inside the player's padded
collision clearance. Runtime geometry totals 14 material meshes and 126,772
triangles in a roughly 5.8 MiB self-contained GLB.

## Browser check

Inspected the actual game in desktop Chrome at the dedicated local preview on
port 5176, using the existing development controls at `/?playtest=1`.

- Inspected room overview, bartender close-up, and seating/staff-passage views.
- Confirmed the final modeled LAST CALL lettering reads correctly; removed a
  subtitle occluded by the backbar cornice.
- Opened Marlowe's menu and purchased Quick Pour: the game paused, chips fell
  by 1,000, and the perk became owned.
- Walked into the counter boundary with the actual simulation movement control.
- Exercised the 14-enemy crowd scenario with the lounge/VIP route unlocked.
- Browser error/warning log was empty after the checks.

The new accent lights are limited to lounge furniture, finishes, Marlowe, and
zombies currently inside the lounge. Their priority keeps the dedicated shadow
light inside the eight-light material cap without displacing other rooms' lights.

`npm test` passes all 112 tests; TypeScript, ESLint, and the production build
pass. The build retains existing Vinext JSON-import, dynamic-import, and route
classification notices. Production output includes the lounge GLB.

These were targeted visual and gameplay checks, not a sustained performance
benchmark or a full mouse-capture survival playthrough.
