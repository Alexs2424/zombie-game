# Main casino Art Deco architecture

The entire main casino perimeter uses the user's smoky oxblood Art Deco direction.
The north wall and Grand Hotel entrance belong to the [hotel entrance assembly](../hotel-assets/entry/README.md).
Eight fitted wall spans complete the south, east and west sides. They share the
same lacquer fields, cast fan reliefs, limestone stiles, stepped brass inlays,
walnut dado panels, cornices, opal sconces and recessed warm coves.

Five room entrances replace the old industrial shutters and bare upper walls:

| Entrances | Original Blender gate design |
| --- | --- |
| Last Call Lounge, both doors | Twin cast fans and bronze chevrons |
| High Roller Club, both doors | Repeated champagne-brass diamonds |
| Cashier | A finer bronze security grille |

Each surround has fluted stone jambs, fitted lanterns, an oxblood nameplate,
a full-height fan transom and a finished reverse face marked GRAND CASINO.
Gate leaves have hinges, pulls, kick panels and an inset purchase plaque.
Prices remain live game text on both faces. Purchasing a gate removes its grille
and both price labels while retaining the surround. Each entrance is independent;
prices remain 900/600, 1,300/800 and 600 chips respectively. The existing instant
unlock is retained; these models do not introduce a swinging-door animation.

## Placement and gameplay

`lib/game/casino-architecture-layout.ts` derives wall spans and portal positions
from the existing shared casino collision layout. Wall panels are redistributed
to fit each span, with allowances for the 42 cm casings; decorative bays are not
cut arbitrarily at a doorway. The old floating casino nameboards are replaced by
a deliberately quieter south-wall sign bay. The ammunition cabinet and shotgun
rack stand in front of the deeper new cladding.

The five main-room portals retain their four-metre widths and their X/Z positions.
Their clear height changes from 4.8 m to **4 m**, leaving room for legible reverse
nameplates below the adjoining rooms' 4.8 m ceilings. Fixed transoms extend from
4 m to the casino's 6.8 m ceiling. Collision and bullet rays use the same new
height: purchased openings remain traversable, while shots above the opening
hit the transom. The hotel entrance keeps its existing 4.8 m width and 3.07 m head.
The remote Supply & Receiving door is outside this main-room assembly.

Local +Z points into the destination room; the ornamented facade faces -Z.
The wall and door transforms are exported to `layout.json` before authoring.
Front/rear signs and price planes use the same orientation. The editable Blender
scene is assembled at the actual world positions for inspection.

## Assets and loading

- Source: `assets/source/casino-architecture.blend`, with named, editable parts.
- Exports: fourteen `public/models/casino-deco-*.glb` files.
- Authoring: `tools/casino-architecture/build_blender.py`, sharing modeling and
  materials with `tools/hotel-assets/build_entry.py`.
- Runtime: `lib/game/casino-architecture-assets.ts`.

The fourteen exports total approximately 17.2 MB and 250,820 triangles. Each
contains at most eight material meshes, fewer than 50,000 triangles and less
than 3 MiB. Shared gate/surround variants are downloaded once and reused for the
two lounge and two High Roller entrances. Materials and geometry are shared
between placed copies. All textures are original, embedded local assets.

Loading is atomic across these wall and entrance assets. Separate oxblood wall,
frame and door fallbacks remain usable until the full assembly succeeds. A failed
asset disposes all partial roots and retains the fallbacks. The north hotel
assembly loads independently. Fallbacks are excluded from permanent scenery
batches, preventing old wallpaper or shutters from showing through the models.
Coverage antialiasing uses up to four samples so fine raised trim remains stable
in distant views, in addition to the existing FXAA finish.

## Rebuild and verify

```sh
node --experimental-strip-types tools/casino-architecture/export-layout.mjs
blender --background --factory-startup --python tools/casino-architecture/build_blender.py
node --experimental-strip-types tools/casino-architecture/validate.mjs
node --experimental-strip-types tools/hotel-assets/validate_entry.mjs
```

The generator writes the editable scene, GLBs, `asset-report.json` and an
architectural `blender-preview.png`. The Babylon audit tests the actual exports
at runtime placements, including all four walls, both faces of each doorway,
clear openings, transoms, ceiling contact and gate visibility. Its **4,249 samples**
are recorded in `validation.json`. Browser checks and screenshots are in
[playtest.md](playtest.md).

## Creative status

**Established:** the user requested cohesive ornate Art Deco treatment across
all main casino walls, smoky oxblood rather than green, and original Blender
models for the other room gates.

**Working decisions:** use the same material and moulding family throughout;
distinguish the lounge, High Roller and Cashier through their grille motifs;
fit lower doorway heads and complete upper transoms. Existing gaming felt and
furnishings retain their material identities. Motifs are architectural ornament,
without introducing clues, quest conditions or new lore.

**Implemented:** the perimeter, five independently purchased gates, fitted
surrounds, reverse faces and atomic fallback behavior described above.
