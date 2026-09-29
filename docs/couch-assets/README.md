# High Roller Club couch

Original five-seat oxblood leather banquette, modeled and rendered in Blender 5.2.2 LTS for the room containing the two flush card games. The source geometry and procedural textures were authored specifically for Last Jackpot; no downloaded models, photographs, or third-party texture assets are used.

![Blender studio view](couch-blender-preview.png)

## Delivered files

- `assets/source/vip-couch.blend`: editable named upholstery, seams, buttons, arm rolls, joinery, legs, and studio setup. All four texture images are packed.
- `public/models/vip-couch.glb`: self-contained browser asset with embedded PBR maps and six material batches.
- `assets/source/couch/`: original leather base color, tangent normal, roughness, and walnut maps.
- `tools/couch-assets/`: deterministic texture generator, Blender geometry/export/render generator, and independent GLB validator.
- `couch-blender-preview.png`, `couch-blender-detail.png`, `couch-in-game.png`: studio and runtime visual checks.
- `asset-manifest.json`, `validation-report.json`: provenance, texture metadata, and geometry audit.

## Construction and placement

The back has sculpted diamond quilting with recessed covered buttons. Five separate seat cushions include shallow compression, edge wrinkles, upper/lower leather piping, and modeled front saddle stitches. Rounded arm rolls have inset welting and brass nailheads. A walnut plinth and eight tapered wooden legs have brass reveals, collars, and floor-contact ferrules. Seam geometry remains distinct and editable in the Blender source; the export merges parts by material to limit draw calls.

Runtime dimensions are approximately **4.956 m wide × 1.195 m high × 1.063 m deep**. Blender uses Z up and front −Y; glTF uses Y up and front +Z. The pivot is floor-centered. Babylon places the High Roller couch at **(-7.2, 0, -27)** with Y rotation **−π/2**, facing west toward the card tables. This fits the existing **1.1 × 5 m** collision rectangle and **1.2 m** cover height. Gameplay dimensions and routes are unchanged.

The final export contains approximately **106,490 triangles**, six materials, six rendered mesh batches, three 1024² leather maps, and one 512² walnut map. The exact counts, dimensions, byte size, and SHA-256 are recorded by the validator. The same geometry and textures are shared by eight static couches; each uses six rendered mesh batches and one room-appropriate shadow map. No sustained frame-time benchmark is claimed.

## Regenerate

From the project root, with Python, NumPy, Pillow, and Blender installed:

```sh
python3 tools/couch-assets/make_textures.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 8 --python tools/couch-assets/generate_couch_blender.py
python3 tools/couch-assets/validate_couch.py
```

The Blender script saves the native file before creating temporary material batches for export. Studio cameras, lights, and floor are excluded from the GLB. Use `-- --no-render` to skip the two Cycles previews. Native images are packed, so the `.blend` can be opened independently of the source PNG directory. CPU rendering uses eight threads, 40 samples, and denoising. On this Mac, Blender's graphics-backend initialization needed local execution outside the restricted sandbox even for CPU rendering.

## Runtime behavior and verification

The renderer keeps each block couch as a temporary loading fallback, removing it only after all detailed placements are ready. An unavailable couch asset leaves all eight fallbacks playable. Imported meshes receive/cast shadows and use the room's existing lights. Asset disposal follows the other furnishing containers.

Start `npm run dev`, open `/?playtest=1`, click **Seed run**, then **VIP couch**, **Casino north couch**, **Casino south couch**, or **Lounge couch**. The viewpoint unlocks the lounge and High Roller room for inspection. The couch was visually checked there for west-facing orientation, scale, floor contact, material response, and placement against the wall. Browser warning/error logs were empty during this check.

The independent validator checks GLB chunks/accessors, finite positions and UVs, unit normals, indices, winding, zero-area triangles, embedded images, material references, world bounds, floor origin, triangle budget, and material batches. The final asset passed with no zero-area triangles or winding mismatches. All 125 existing automated tests, TypeScript checks, and the production build also passed. Build output contains existing framework/bundler advisory warnings.

![In the High Roller Club](couch-in-game.png)

![Upholstery detail](couch-blender-detail.png)

## Restored casino and lounge seating

The original GLB was still present on main. The new map's two casino benches and north lounge bench were rendered as procedural blocks. They now reuse the original leather couch with its tufting, rolled arms, piping, stitches, woodwork, and embedded textures.

| Placement | Center X / Z | Y rotation | Width scale |
| --- | --- | --- | --- |
| High Roller Club | -7.2 / -27 | -PI/2 | 1 |
| Casino north | -12.8 / 10.8 | PI | 1 |
| Casino northwest addition | -23.5 / 10.8 | PI | 1 |
| Casino north-center addition | 3.5 / 10.8 | PI | 1 |
| Casino northeast addition | 18.5 / 10.8 | PI | 1 |
| Casino south-center addition | 5.5 / -18.9 | 0 | 1 |
| Casino south | 21 / -18.9 | 0 | 0.76 |
| Last Call north | -39 / 2.9 | PI | 1 |

All couches face into their rooms, sit on the floor, and fit their shared render/collision footprints. The original southeast couch is shortened only along its width. Hotel sofas and armchairs keep their original green velvet assets. The model downloads once; cloned meshes share its geometry and materials while retaining individual room lighting. Lounge lighting includes the couch regardless of which asset finishes loading first.

Restoration checks: TypeScript, ESLint on the changed code, 21 casino/lounge/reconfiguration tests, and the existing GLB geometry/texture audit passed. Browser inspection verified all four placements, floor contact, bounds, six material batches per couch, shared geometry, and room lighting. Missing-file and delayed-loading browser checks also passed: fallback seating remains available on failure, and lounge lighting remains correct when the couch import completes last.

Four additional full-width couches bring the casino room to six, with one more in High Roller and one in Last Call. Three additions line the north wall; the fourth sits on the south wall east of the ammo rack. North seating leaves a 2.25 m aisle in front of the slot banks. The hotel entrance, game approaches, and spawn points remain clear. The source-derived map has been refreshed.

Expansion checks: TypeScript and all 15 casino-layout/reconfiguration tests passed. Browser checks verified all eight detailed models load from one shared download, face into the rooms, rest on the floor, and fit their collision bounds. All four new placements were visually inspected; no browser warnings or errors were reported.
