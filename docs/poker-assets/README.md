# High Roller poker table

Original casino furniture authored and exported in the installed **Blender 5.2.2 LTS**, matching the emerald baize, oxblood leather, walnut and antique brass of the other Last Jackpot tables. The table is one reusable GLB intended for both existing poker placements. No downloaded models, photographs, branded art or game artwork were used. All felt markings, deck backs, chip crests and wood grain were drawn procedurally for this project. System Arial was rendered into the artwork; no font file is redistributed.

## Runtime contract

- File: `public/models/poker-table.glb`.
- Metres, **+Y up**, floor-centered origin; import at scale 1.
- Measured X/Y/Z dimensions: **3.798671 × 0.950000 × 2.399011 m**, within the existing **3.8 × 2.4 m** footprints.
- **45,330 triangles**, **10 fixed mesh/material batches**, three embedded PNG textures. Shared geometry/material instantiation can serve both tables.
- Felt surface **Y = 0.865 m**; padded leather rail maximum **Y = 0.950 m**.
- No static face-up hand cards are included. The small dealer deck is face-down; it is scenery rather than a fake puzzle hand.

The source has a shaped walnut pedestal and plinth, fluted turning and brass collars, an oval brass footrest, layered and inlaid apron, twelve upholstered rail segments with geometric double stitching, a polished wooden drink racetrack with eight actual boolean-cut cup recesses, brushed metal cup liners, patterned original baize, a dealer chip bank, layered clay chip stacks, a layered paper deck with an original back design, and an ivory dealer button. All props remain within the existing footprint and below the 0.95 m rail height.

The GLB uses standard metallic/roughness materials, baked normals and explicit UVs. It has no external runtime texture dependencies, procedural shader requirements, studio lighting or cameras. Identical position/normal/UV corners are shared losslessly within material batches. The editable source remains separate from those batches.

## Five-card puzzle mounting coordinates

Place dynamic cards directly in the renderer's world coordinates, adding the following offsets to table centers **(22, 0, -3)** and **(22, 0, 5)**. The player approaches from the south, world -Z.

| Card | X offset | Y | Z offset |
|---|---:|---:|---:|
| 1 | -0.56 | 0.870 | -0.36 |
| 2 | -0.28 | 0.870 | -0.36 |
| 3 | 0 | 0.870 | -0.36 |
| 4 | 0.28 | 0.870 | -0.36 |
| 5 | 0.56 | 0.870 | -0.36 |

Suggested size is **0.22 m across X × 0.31 m along Z**, with the face upward (+Y). Y=0.870 puts the face 5 mm above the felt and avoids z-fighting. The reserved rectangle is X **[-0.78, +0.78]**, Z **[-0.55, -0.16]** relative to each table center. The validator clips every exported triangle against this rectangle and confirms no static geometry rises above the felt within it.

Keep the imported glTF conversion root intact. In the current left-handed Babylon scene that root mirrors asset X; the table and reserved X range are symmetric, so the world-space card offsets above work directly. Native Blender +Y maps to the player-facing world -Z side. Artwork orientation is already authored for that approach. Do not use these offsets blindly inside an extra rotated/scaled gameplay parent; apply that parent's transform if the table placements change.

## Files and regeneration

- `tools/poker-assets/make_textures.py`: original Pillow/NumPy artwork generator.
- `tools/poker-assets/generate_poker_blender.py`: Blender modeling, bevel evaluation, geometry cleanup, material batching, lossless corner sharing, export and preview rendering.
- `tools/poker-assets/validate_poker.py`: independent GLB and clear-card-area audit using NumPy/Pillow; Blender and SciPy are not required for validation.
- `docs/poker-assets/poker-table.blend`: compressed editable source with all three authoring textures packed. The source collection retains modifiers, geometry, decorative curves and eight cuphole cutters. The hidden export collection contains the runtime material batches; the studio collection is excluded from GLB export.
- `docs/poker-assets/poker-table-preview.png` and `poker-table-top-preview.png`: actual Blender Cycles CPU renders of the authored table.
- `asset-manifest.json`, `validation-report.json`, `blender-source-validation.json`: measured contract, independent audit/hashes, and packed-source verification.
- `poker-felt.png` (2048 × 1024), `poker-walnut.png` (1024 × 512), `poker-deck-atlas.png` (1024 × 1024), `atlas-regions.json`: original packed/embedded texture sources.

From the repository root:

```sh
python3 tools/poker-assets/make_textures.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/poker-assets/generate_poker_blender.py
python3 tools/poker-assets/validate_poker.py
```

The texture helper accepts `--output-dir`; the Blender generator accepts `--docs-dir`, `--model-path` and `--no-render` after Blender's `--` separator. The validator accepts `--model-path` and `--report-dir`. This allows regeneration in another output directory without modifying the application.

The Python helpers use NumPy and Pillow. They were run with Python 3.10.12, NumPy 1.26.4 and Pillow 11.1.0. Font paths currently point to standard macOS Arial; another OS can substitute an installed sans-serif font. Blender is run locally in background mode; its native backend initialization needs the authorized local context on this Mac even for CPU rendering.

Both previews explicitly use **Cycles CPU, 2 threads and 12 samples** at modest resolutions. The pair completed in approximately **20 seconds**. Blender exits afterwards, and export-only optimization does not run another render.

## Validation

The asset passes GLB structure, finite position/normal/UV arrays, unit normals, index bounds, face winding, footprint and origin checks, triangle/material budgets, and embedded PNG decoding/dimensions. Collapsed bevel triangles are removed before export: **zero degenerate triangles** and **zero winding mismatches** remain. The five-card mounting rectangle is clear. No renderer, simulation, UI or existing roulette files were changed by this asset work.
