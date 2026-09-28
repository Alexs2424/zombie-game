# Last Jackpot — Blender-authored Art Deco slot machines

These two original cabinets were modeled and exported using the installed **Blender 5.2.2 LTS**, `/Applications/Blender.app/Contents/MacOS/Blender`. All cabinet geometry, hardware, printed artwork, jackpot symbols and wood grain were authored for this project. No borrowed game art, downloaded models, photos, branded graphics, or asset packs are used. The title LAST JACKPOT is the project's own theme. Rendered lettering uses system Arial; the font itself is not redistributed.

## Deliverables

Runtime GLBs are in `public/models/`. The saved editable source is [`assets/source/slot-machines.blend`](../../assets/source/slot-machines.blend), with separate authoring PNGs/atlas regions in `assets/source/slot-machines/`. Python sources live in `tools/slot-assets/`. Previews and reports are beside this README. The generator uses the filename `last-jackpot-slot-machines.blend` in its output directory; the delivered repository copy is named `slot-machines.blend`.

| File | Purpose |
|---|---|
| `slot-machine-emerald.glb` | Emerald lacquer / walnut / brass runtime cabinet |
| `slot-machine-burgundy.glb` | Oxblood lacquer / walnut / brass runtime cabinet |
| `last-jackpot-slot-machines.blend` | Compressed, editable native Blender scene, with packed textures |
| `slots-blender-preview.png` | Actual Cycles CPU render of both source cabinets, 980 × 900 |
| `slots-blender-detail.png` | Actual Cycles CPU close-up of the emerald cabinet, 720 × 760 |
| `generate_slots_blender.py` | Reproducible Blender modeling/export source with configurable output directory |
| `make_textures.py` | Original Pillow artwork/wood-grain generator with configurable output directory |
| `render_slots_preview.py` | Rerender the saved native source without modifying GLBs |
| `validate_slots.py` | Independent GLB validator using NumPy/Pillow, with configurable asset/report directories |
| `slot-atlas.png`, `slot-walnut.png`, `atlas-regions.json` | Original authoring inputs, also embedded or packed in deliverables |
| `asset-manifest.json` | Dimensions, object/triangle/material counts, provenance and rendering settings |
| `validation-report.json` | Independent GLB audit and SHA-256 hashes |
| `blender-source-validation.json` | Native Blender packed-image/source-object verification |

## Runtime contract

Both GLBs use **metres, +Y up, FRONT +Z**, with the origin at floor level and centered in the complete XZ footprint. The pull lever, feet, controls and payout tray are included in the bounds. Each measures **0.962 m wide × 1.920 m high × 1.1635 m deep**, satisfying the 0.98 × 1.92 × 1.30 m maximum. Import at scale 1. The modeled native Blender fronts face -Y; Blender's glTF exporter converts them to +Z.

Each cabinet has **15,612 triangles**, **8 materials**, **8 fixed material batches** and a named root (`SlotMachine_emerald` / `SlotMachine_burgundy`). Geometry is joined by material for runtime; the editable source keeps **225 individual objects per cabinet**, with bevel and weighted-normal modifiers, meshes, and round decorative metalwork curves. The eight surfaces are walnut, variant lacquer, brass, steel, ebony, printed ivory graphics, illuminated graphics, and oxblood Bakelite. Exports use ordinary glTF metallic/roughness shading, normals, UVs, and modest emission, with no required procedural shader dependencies or external files. Their embedded images are a 2048 × 2048 atlas and 1024 × 512 walnut grain.

The cabinets are static environmental props. The three physical curved reels, brass window bezels, chip acceptor, CHIP METER, BET ONE / COLLECT / SPIN REELS controls, return hardware, payout tray, token chips, side crest, pull handle and rear service vents are modeled individually in the native source, then included in the runtime material batches. Currency artwork consistently uses **chips**.

The source `.blend` has two `SOURCE` collections, two hidden `EXPORT CACHE` collections, and a `STUDIO` collection. The studio floor, lights and cameras are excluded from GLB exports. Packed images make the native file self-contained. Source cabinets are placed side by side for the preview; exports independently recenter each cabinet at its complete footprint origin.

## Regeneration

Run these commands from the repository root. The texture helper needs Python with Pillow and NumPy. Blender handles all geometry creation, bevel evaluation, editable native saving, glTF exporting and rendering. Generated output stays in the ignored `outputs/` directory.

```sh
python3 tools/slot-assets/make_textures.py --output-dir outputs/slot-assets
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/slot-assets/generate_slots_blender.py -- --output-dir outputs/slot-assets
```

For an export-only regeneration, append `--no-render`. To render an existing native file without changing its exported GLBs:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/source/slot-machines.blend --threads 2 --python tools/slot-assets/render_slots_preview.py -- --output-dir outputs/slot-assets
```

Renders explicitly use **Cycles CPU, two threads, 12 samples**, denoising and small resolutions. The final pair took approximately **18 seconds combined** on the current machine. Blender runs in background mode and exits when complete; no GUI or ongoing render is left active. In the desktop sandbox, Blender's native Metal backend detection required authorized local execution even though the render device was CPU.

Independent validation can target copied game assets directly:

```sh
python3 tools/slot-assets/validate_slots.py --asset-dir public/models --report-dir docs/slot-assets
```

The authoring/check environment used Python 3.10.12, NumPy 1.26.4 and Pillow 11.1.0. No SciPy dependency is required for slot validation. The helper's font paths target standard macOS Arial; another platform can substitute its installed sans-serif font paths.

## Validation result

The final GLBs pass binary structure, finite attribute arrays, unit normals, index bounds, face winding, complete transformed bounds, footprint centering, triangle budget, material batching and embedded-PNG decoding/dimension checks. Native Blender verification confirms both authoring textures are packed. The renderer was visually checked after correcting reel direction, circular decal UVs and panel clearance.

A transparent audit note: the ebony hardware batch contains **40 zero-area bevel triangles per cabinet (0.26%)**. They do not rasterize and have no invalid normals or visual effect. The finalized integration GLBs were intentionally preserved; the validator reports `passed_with_notes` and includes this count rather than claiming zero degenerate faces. All substantive dimensional, shading, index, image and batching checks pass.
