# Service corridor props

Original geometry and materials authored in Blender for this room. The editable
source is `assets/source/service-props.blend`; its game export is
`public/models/service-props.glb`.

Rebuild from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --background --python tools/service-assets/build_props.py
```

On macOS, Blender needs access to the normal graphics services even for a
background CPU render. The generator embeds its original mathematical kraft
paper and timber grain maps; no downloaded textures, asset packs, or fonts are
used. The saved source retains separate named parts, bevel modifiers, editable
lettering, and assembly metadata. The runtime export joins objects by material
and excludes the preview floor, walls, camera, and lights.

The set contains a stacked delivery pallet, taped cartons with folded flaps,
shipping labels and handling marks, industrial shelving with punched posts and
cross bracing, open tool totes, a loaded hydraulic pallet jack, a vented steel
utility cabinet, wall switchgear and conduit, suspended pipes with unions and
valve wheels, fluorescent fittings, a fire extinguisher, and floor safety paint.

`props-report.json` records evaluated bounds, triangle counts, and collision
contracts for every assembly. The generator checks the solid assembly bounds
against their declared footprints before export. All coordinates in the report
are intended game metres with Y up. Source Blender coordinates are `(x,-z,y)`;
the GLB reflects X so Babylon's default left-handed `__root__` conversion restores
the intended game positions. Keep that root. Lettering receives a local mirror
before the export reflection to preserve reading order in the game camera.

Floor paint is 3 mm thick, centered at world Y 20 mm to clear the runtime floor
and its expansion joints. The main travel lane between Z 7.4 and 9.7 and
the lounge route at X 11.7 have no floor-standing props. Overhead services sit
above player clearance. Wall-mounted equipment is decorative and does not claim
an additional gameplay floor obstacle. Source lighting and shell geometry are
only for the art-study render `props-preview.png`; the game supplies its own shell
and illumination.
