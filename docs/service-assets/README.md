# Service corridor / loading bay

Original Blender assets for the casino's back-of-house service room. A compact
sage and cream hotel-supply truck anchors the loading bay, with stacked taped
cartons, wooden pallets, storage shelving, a pallet jack, utility cabinet,
switchgear, pipework, safety equipment, and industrial lighting fixtures.

## Editable assets and exports

| Asset | Editable Blender source | Game export | Generator |
| --- | --- | --- | --- |
| Delivery truck | `assets/source/service-truck.blend` | `public/models/service-truck.glb` | `tools/service-assets/build_truck.py` |
| Corridor furnishings | `assets/source/service-props.blend` | `public/models/service-props.glb` | `tools/service-assets/build_props.py` |

Paths above are relative to the repository root. Both sources retain named,
editable components and a preview stage. Preview cameras, lights and staging
surfaces are excluded from the game exports. The GLBs contain their textures
and use material batching to keep the rendered mesh count bounded. Geometry,
livery, labels and procedural textures were authored for this project; no
downloaded asset packs or external runtime services are required.

## Rebuild and verify

From the repository root, with Blender and Node 22.13+ installed:

```sh
blender --background --factory-startup --python tools/service-assets/build_truck.py
blender --background --factory-startup --python tools/service-assets/build_props.py
node --experimental-strip-types tools/service-assets/validate_runtime.mjs
npm test
npm run typecheck
npm run lint
npm run build
```

On macOS the Blender executable may be
`/Applications/Blender.app/Contents/MacOS/Blender`. Blender background rendering
needs normal access to the graphics service. Each generator saves editable
source, writes the game export, and renders its asset preview.

## Placement and gameplay

Assets are authored in game metres, with Blender coordinates `(x, -z, y)`.
Only the export is reflected in X, with corrected winding, to account for
Babylon's default left-handed glTF conversion. Keep the loader's root transform.
Text receives a local orientation correction for the game camera.

`lib/game/service-layout.ts` owns the five solid assembly footprints. The same
rectangles drive player collision, zombie navigation and bullet/grenade cover.
Small fixtures on walls, overhead pipes and floor paint are decorative.
The truck faces west inside the south loading bay. The cross-room lane at
Z=8.6 connects the staff shortcut and VIP exit; the lounge passage at X=11.7
remains clear. Closed-room gates continue to control progression.

The truck is parked scenery. The pallet jack and cartons are static props.
Simplified solid collision volumes intentionally include the open spaces
under the truck and inside shelving. Footprint-matched temporary fallbacks
remain visible if a model fails to load.

The independent runtime audit loads the actual GLBs through Babylon, checks
finite geometry/normals, embedded textures, room placement, material/geometry
budgets and geometry in every solid footprint, then casts rays through the
walking lanes and against the new cover. Its results and asset hashes are in
`runtime-validation.json`. Development previews at `/?playtest=1` expose
**Service overview**, **Service truck**, and **Service storage** viewpoints.

See [playtest.md](playtest.md) for the completed validation pass. Blender asset
previews are furnishing studies; lighting and architecture in the game differ.
