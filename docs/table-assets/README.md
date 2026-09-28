# Last Jackpot casino furniture

Original, procedural casino furniture authored for this project. No imported geometry, photographic textures, brands, game artwork, or external asset packs were used. The table layouts and wood grain are drawn algorithmically with Pillow. The only font input is the operating system's Arial font, rendered into the original betting-layout textures; no font files are distributed.

## Deliverables

- `craps-table.glb` — 4.80 × 2.50 m footprint, 1.00 m overall height. Emerald padded and stitched rail, lowered well, printed craps baize, textured diamond rubber end walls, chip tray and stacks, dealer stick, two small red presentation dice, turned walnut legs, paneled apron, brass inlay, foot rail.
- `roulette-table.glb` — 3.40 × 2.50 m footprint, 1.00 m overall height. Oxblood padded rail and original betting felt, sculpted walnut bowl, real 37-pocket geometry, printed European single-zero sequence, brass spindle and stringing, ball and deflectors, chip tray and stacks, matching turned furniture base.
- `ivory-die-a.glb`, `ivory-die-b.glb` — independent ivory dice, each with a 0.100 m body, beveled edges, and all 21 pips modeled on the six faces. Pips stand 0.00007 m proud of each face to prevent z-fighting.
- `tables-preview.png` — actual mesh/material/texture contact sheet rendered with the included CPU z-buffer rasterizer. It is a geometry preview, not an image-generation concept.
- `asset-manifest.json` — measured geometry bounds, dimensions, triangle counts, sizes, pivots, and dice orientations.
- `generate_tables.py`, `geometry_base.py` — reproducible authoring sources. Geometry helpers in `geometry_base.py` are adapted from this project's existing original procedural weapon generator.
- `walnut.png`, `craps_layout.png`, `roulette_layout.png`, `wheel_numbers.png` — source textures; the GLBs embed all required images and need no runtime image files.

## Coordinates and placement

All GLBs use glTF's right-handed coordinates, metres, and +Y up. Table origins are at the center of their footprint on the floor (Y=0). Dimensions in the manifest are X, Y, Z. The craps bed is Y=0.810; the rail top is Y=1.000. The roulette betting surface is Y=0.842. Import tables at scale 1.

Dice have their body centers at (0,0,0); place the center at Y=0.8601 to rest on the craps felt. To keep scene framing clear, the table's two tiny red dice can be hidden using the mesh-name prefixes `Presentation red die A` and `Presentation red die B` when the game creates the larger animated ivory dice.

The named parent transform `roulette_wheel` has local pivot/translation **(-0.735, 0.860, 0)**. All rotor components, pockets, number ring, spindle, and rotor decoration are children of this transform. Animate that transform's local Y rotation. The walnut outer bowl is a separate static mesh. The ball mesh is named `roulette_ball` and is separately movable.

For Babylon.js, keep the importer's glTF root/conversion node intact. Animate the named imported wheel node in its own local coordinates. The orientation values below are glTF local values; when dice are children of the imported glTF root, they preserve the documented face mapping. If reparented directly into a left-handed scene, apply the same glTF coordinate conversion used for the imported geometry before interpreting a world-space quaternion.

## Dice face mapping

Opposite faces sum to seven: +Y=1, -Y=6, +Z=2, -Z=5, +X=3, -X=4. All orientations below put the requested face normal along +Y. Rotations are in radians and quaternions use [X,Y,Z,W].

| Up face | Euler XYZ  | Quaternion XYZW |
| ------- | ---------- | --------------- |
| 1       | [0,0,0]    | [0,0,0,1]       |
| 2       | [-π/2,0,0] | [-√½,0,0,√½]    |
| 3       | [0,0,π/2]  | [0,0,√½,√½]     |
| 4       | [0,0,-π/2] | [0,0,-√½,√½]    |
| 5       | [π/2,0,0]  | [√½,0,0,√½]     |
| 6       | [π,0,0]    | [1,0,0,0]       |

A further rotation around world Y changes the resting heading while keeping the upper face unchanged.

## Regeneration and verification

Run `python3 tools/table-assets/generate_tables.py` from the repository root with NumPy, SciPy, and Pillow installed. The font paths currently target standard macOS Arial; substitute another installed sans-serif font for use on a different OS. Generation is deterministic and does not use the network. The GLBs are uncompressed glTF 2.0 with embedded PNGs, PBR materials, normals, UVs and 32-bit indices, compatible with the existing Babylon.js loader. Table meshes remain below 25,000 triangles apiece. `validate_assets.py` independently reads the generated GLB JSON/binary accessors, checks index bounds, finite geometry and textures, compares measured dimensions, validates winding against normals, and verifies the wheel hierarchy and dice quaternion orientations.

## Repository layout

Runtime assets are in `public/models/`; the generators and validators are in `tools/table-assets/`. Run generators from the repository root; output goes to ignored `outputs/table-assets/`. Copy reviewed GLBs into `public/models/` and their updated manifests into this documentation directory. Repository validators check the delivered public models and write the report here. The original generation contact sheets and reports document the supplied geometry, not a browser screenshot.
