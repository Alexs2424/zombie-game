# Casino undead — model fidelity pass

Original Blender geometry and procedurally authored surface maps. The direction is gaunt, weathered casino staff with restrained decay: existing dinner jackets, dealer visor, showman's top hat, muted skin and clothes, recessed amber eyes, worn teeth, torn hems and cuffs, and small healed wounds. No military outfits or heavy gore were introduced.

## Review files

- `casino-undead.blend`: editable named parts in Pit Boss, Crooked Dealer, and Last Showman collections; packed textures and a separate studio collection.
- `lineup.png`: neutral studio render of the three variants.
- `face-detail.png`: close view of the actual dealer mesh.
- `pose-preview.png`: the meshes at the game's shoulder, elbow, hip, head, and jaw pivots.
- `surface-preview.png`: the original skin, cloth, and leather surface maps.
- `validation-report.json`: generated vertex, triangle, and mesh-group counts.
- `../../public/models/casino-undead.glb`: neutral portable model, batched by variant, animated part, and material; excludes the studio and hidden damage overlays.
- `../../public/models/zombies.json`: the browser game's geometry, in meters, grouped by rigid pivot and material. This is the asset the game loads.

The three characters retain the existing gameplay silhouettes and pivot locations. Lofted anatomy and clothes replace overlapping rounded primitives. Facial geometry includes recessed eye sockets, a shaped nasal bridge, hollow cheeks, a separate mandible, and missing teeth. Clothing has layered lapels, shaped sleeves and trousers, folds, pockets, frayed hems, and shoe soles. Each hand has tapered, articulated fingers and tendons.

## Rebuild

From the repository root, with Python 3, NumPy, Pillow, and Blender installed:

```sh
python3 tools/zombie-assets/make_textures.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/zombie-assets/generate_zombies.py
/Applications/Blender.app/Contents/MacOS/Blender --background docs/zombie-assets/casino-undead.blend --python tools/zombie-assets/render_zombie_poses.py
```

Use `-- --no-render` to regenerate assets without studio renders. The generator is deterministic. Its `.blend` source keeps parts separate for editing; it duplicates and batches only the portable export. The GLB explicitly retains each material's palette tint because Blender's glTF exporter omits the constant tint from the layered vertex-color material graph.

## Game integration and budget

`lib/game/zombies.ts` loads `zombies.json`, including authored normals, UVs, neutral vertex patina, and per-variant palettes. Normals preserve smooth surfaces and hard cloth edges. Surface maps are cached once per Babylon scene; all enemies share six color/normal textures. Prepared vertex data is cached per asset mesh. The standard game materials use the authored roughness scalar; the detailed roughness maps are used in Blender and the PBR GLB.

The normal visible geometry is batched into at most 30 groups per variant, with an 18,000-triangle ceiling including hidden damage geometry. The prior models used approximately 16,800–17,200 triangles each. The new download is larger because it now includes normals, UVs, and colors; the JSON budget is 4 MB, with shared 512-pixel textures loaded separately. This is a game asset pass, not a cinematic sculpt.

The original head, jaw, shoulder, elbow, and hip pivots remain unchanged. `lib/game/zombie-pose.ts` continues to define the attacks and hit volumes. Animation is procedural in the game; the GLB contains neutral geometry, not baked skeletal clips. Permanent limb severing, wound visibility, headshot flash, hotel elevation, and the original attack timing remain intact.

Impact stains and bone-capped stumps remain separate hidden geometry, revealed by simulation damage. Stumps stay attached to the body; forearms inherit their upper-arm pivot so they disappear with severed arms. Corpses retain the existing removal behavior.

## Validation

`tests/zombie-assets.test.mjs` verifies modular parts, indices, finite buffers, outward jacket winding, normalized shading normals, UV/color lengths, texture dimensions, palette preservation in GLB, and geometry budgets. The complete game test suite, TypeScript check, and production build also cover integration. A separate Babylon NullEngine audit covers enemy creation, all attack styles, damage visibility, elevation, shared textures, disposal, and respawn; it does not measure GPU performance or replace an in-game visual playtest.

Run the runtime audit with `node tools/zombie-assets/validate_runtime.mjs` after installing the project dependencies. It checks 108 attack/variant/damage cases and 864 transformed limb-versus-hit-volume samples. The fidelity pass passed all 175 game tests, TypeScript, production build, Blender visual inspection, and the runtime audit. Final meshes have zero degenerate triangles or opposing authored normals; the portable GLB has 84 visible mesh groups and nine embedded surface maps.
