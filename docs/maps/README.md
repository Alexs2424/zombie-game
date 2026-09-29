# Current 2D room map

`last-jackpot-map.png` is the full-size **2270 × 1650** map.
`last-jackpot-map.svg` is the editable, resolution-independent version.
`map-data.json` records the source world coordinates, geometry and placements.

The implemented map contains the **60 × 32 m Grand Casino**, west Last Call
Lounge, south High Roller, east cashier public room and inaccessible secure cash
area, northwest Supply Room, hotel entrance, unchanged Grand Hotel Lobby, and
upstairs restaurant. The hotel’s concealed luggage gallery is shown within the
lobby. The Velvet Hour speakeasy is east of the cashier public room, preserving
the portrait/keypad and Mystery Slot features integrated from the main branch. Ground and upper plans both use **14 pixels per metre**, with +Z north.
The overall ground bounds are **98 × 89 m**; the restaurant is four metres above
its rear lobby.

The main casino shows all **8 slot banks / 48 cabinets**, **2 craps tables**,
**2 roulette tables**, and **1 existing flush table**. The second existing flush
table is in High Roller. Six leather couches line the casino perimeter, keeping
the hotel entrance and slot aisles clear. Colors follow the approved sketch: blue slots, red
craps, purple roulette, green flush poker.

Geometry, furniture, purchases, prices and spawns come directly from
`lib/game/casino-layout.ts`, `simulation.ts`, `world.ts`, and the current hotel
and furniture modules. Room-label placement and explanatory notes are curated.
The source foyer floor overlaps the adjoining rooms to connect walking surfaces;
its visible connecting corridor is labeled 5 × 3 m.

## Regeneration

From the project directory with Node 22.13+:

```sh
node tools/maps/export-map.mjs
node tools/maps/render-map.mjs
```

The second command writes the SVG. To also regenerate the PNG, provide Sharp
through normal Node module resolution or set `MAP_SHARP_MODULE` to the absolute
path of an available Sharp package, then run:

```sh
node tools/maps/render-map.mjs --png
```

No browser, network request or image-generation service is required. If rooms
move again, update the curated annotations as well as regenerating geometry.

## Reading the map

- Only the central casino starts open. Each gold door is purchased separately:
  A lounge north 900, B lounge south 600, C High Roller west 1,300, D High Roller
  east 800, E hotel 2,000, F supply 1,200, G cashier 600 chips.
- The supply room is reached through the lobby, after purchasing hotel access.
  Its rifle marker points to the relocated Pit Boss purchase.
- Cashier hatching marks inaccessible staff space. The teal glass barrier
  blocks actors and shots while allowing sight. Future stairs and a trapdoor
  are reserved; no usable lower level is implied by the map.
- Purple hotel panels belong to the existing key puzzle. They provide access
  to the concealed luggage gallery and are separate from the purchased supply
  room and its moved truck/storage assets. The purple doorway east of the cashier
  belongs to the separate portrait/keypad puzzle; it leads to the Velvet Hour
  without opening the glass-secured cash area.
- Room sizes are nominal bounds. The hotel lobby and restaurant are polygons;
  their bounding rectangles are not fully walkable floor area.
- Furniture rectangles are physical collision footprints, not mesh outlines.
  Slot cabinet subdivisions show the actual source cabinet roots. Overhead
  lintels and wall-mounted decoration are omitted.
- Dashed lines identify the restaurant overhead. The lobby continues beneath
  it; ground movement cannot cross the curved stair footprints.
- Enemy-entry diamonds are source spawn positions. Hotel service panels do not
  imply additional rooms beyond them.

Validation: generators executed successfully; cabinet/door counts and prices
checked against the shared source; final SVG rasterized and visually inspected.
Geometry tests cover the preserved hotel polygon, all door crossings, annex
navigation, clear purchase/spawn positions, and cashier-glass behavior.
