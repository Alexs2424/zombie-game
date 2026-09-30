# Grand Hotel entrance and north casino wall

Original Blender architecture forms one continuous, full-height facade around
Grand Hotel's purchased entrance. The fixed portal has limestone cornices,
subtle ivory marble, bronze fluting, opal lanterns, raised hotel lettering and
an inset sunburst above the sign. Nine evenly sized smoky oxblood panels on each wing
have beveled cast fan blades, stepped brass borders, geometric pendants and
walnut dado panels with corner inlays. Satin lacquer, polished stone, aged
bronze and fine-grained wood have distinct material finishes. Both wings
meet the casino corners; the crown meets the 6.8 m ceiling.

- Editable source: `assets/source/hotel-entry.blend` (named, unmerged parts).
- Exports: `public/models/hotel-entry-{portal,gate,wall-west,wall-east}.glb`.
- Generator: `tools/hotel-assets/build_entry.py`.
- Runtime loading: `lib/game/hotel-entry-assets.ts`.

All four exports use `HOTEL_GATE` as their origin. The portal's 13 cm forward
setback is baked in Blender; the loader must not apply it again. Wall bodies
are centered 25 cm behind that origin, matching the north wall at Z=12.
The original 4.8 m clear passage, 3.07 m gate head, gate collision and 2,000-chip
purchase remain unchanged. The grille has fitted hinge barrels, lower diamond
ironwork, stepped escutcheons and a recessed oxblood purchase plaque. It disappears on purchase; the fixed
portal and wall wings remain. Price lettering is supplied dynamically by the game.

The renderer retains separate simple wall/surround fallbacks until all four
assets load, then hides them. They are excluded from permanent scenery batches
to prevent duplicate faces or old trim protruding through the new facade.
If any export fails, partial assets are disposed and the fallbacks remain.

## Selected palette

The user selected smoky oxblood for the casino architecture, superseding the initial jade
working palette. The wall lacquer and nameplates use **#5B3038**, paired with
champagne brass **#C2A574**, dark walnut **#3B2923**, warm ivory marble and darker
oxblood reveals **#40252A**. Color swatches are sRGB; the generator explicitly
converts solid hex colors to linear RGB for Blender/glTF materials. Scene
lighting, metallic reflections and tonemapping affect their displayed appearance.
The dynamic purchase label and loading fallbacks follow the selected palette.

Fan blades and stepped geometric frames are actual beveled cast geometry.
Fine ornament uses one-segment bevels and reduced curve profiles, retaining
its silhouette without spending geometry on subpixel roundovers. The large
panel fields remain quiet enough to separate the ornament from the background.

## Rebuild and verify

```sh
blender --background --factory-startup --python tools/hotel-assets/build_entry.py
node --experimental-strip-types tools/hotel-assets/validate_entry.mjs
```

The generator saves the editable source, material-batched GLBs, `asset-report.json`
and `preview.png`. All textures are original, generated locally and embedded.
The audit imports the actual exports with Babylon's left-handed loader and checks
clear passage, jambs, lintel, full-height closure, wing seams, rear faces, ceiling
contact, opened gate visibility, finite geometry and bounded asset costs.
`runtime-validation.json` records its results. Each export has at most eight
material meshes and fewer than 40,000 triangles; the four total about 7.1 MB.
The shared sconces and recessed cove now match the rest of the
[main casino architecture](../../casino-architecture/README.md).

`preview.png` is a Blender architectural study; game lighting is deliberately
darker. Browser verification and screenshots are recorded in `playtest.md`.
