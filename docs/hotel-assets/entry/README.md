# Grand Hotel entrance

Original Blender marble piers, carved cornice, gilded fluting, inset enamel
lettering, opal lanterns and matching bronze fanlight grille replace the layered
procedural entrance. The marble texture is generated locally and embedded.

- Editable source: `assets/source/hotel-entry.blend`.
- Exports: `public/models/hotel-entry-portal.glb` and `hotel-entry-gate.glb`.
- Generator: `tools/hotel-assets/build_entry.py`.
- Runtime loading: `lib/game/hotel-entry-assets.ts`.

The exports use the existing `HOTEL_GATE` origin; the fixed facing sits 13 cm
forward to cover the casino wall trim, while the grille keeps its original plane.
They preserve the 4.8 m clear
foyer width and 3.07 m gate opening. The separately loaded grille disappears
when hotel access is purchased. Price lettering stays dynamic on its inset
plaque. A simple surround and grille remain available if loading fails.

Rebuild with Blender, then use Node 22.13+ to inspect the actual exports:

```sh
blender --background --factory-startup --python tools/hotel-assets/build_entry.py
node --experimental-strip-types tools/hotel-assets/validate_entry.mjs
```

The asset audit verifies the real clear opening, wall contacts, gate visibility,
finite geometry, embedded textures, and rendering budgets. `preview.png` is an
architectural study; the game supplies its own scene lighting and price label.
