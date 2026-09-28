# LAST JACKPOT hotel supply truck

Original truck authored in Blender for the service corridor. The compact vintage delivery body uses sage enamel, ivory cargo panels and petrol-and-champagne hotel supply branding. No third-party meshes, image textures, photographs or fonts were downloaded.

## Files and rebuild

- `tools/service-assets/build_truck.py`: deterministic authoring, packed texture generation, source save, material consolidation, game export, geometry report and Cycles preview.
- `assets/source/service-truck.blend`: editable separate components, native text, modifiers, packed textures and a preview camera/light rig.
- `public/models/service-truck.glb`: game-only geometry consolidated into 14 material meshes. Preview floor, camera and lights are excluded.
- `docs/service-assets/truck-report.json`: evaluated triangle counts, intended game bounds, material count and exported byte size.
- `docs/service-assets/truck-preview.png`: rendered front three-quarter study of the editable source.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/service-assets/build_truck.py
```

Built and rendered with Blender 5.2.2 LTS. The script uses Blender's built-in Bfont and NumPy, which ships with Blender. The enamel and rubber base-color maps are created deterministically in memory and packed directly into both deliverables; there are no external image dependencies or unsupported procedural material nodes.

## Geometry and placement

The model is authored at its service-corridor position in world metres: footprint center `(x=7.8, z=5.65)`, requested envelope `5.5 × 2.55 × 2.95 m`, cab facing negative X, tire contact height `0.025 m`. Exact evaluated bounds are in the report. Keep the asset's world placement and the Babylon importer's default glTF root transform.

Source Blender coordinates are `(game x, -game z, game y)`. Only the GLB is reflected on X so Babylon's default left-handed glTF conversion restores the intended position. Text is locally reflected at export, matching the existing lounge convention so signs read correctly in the left-handed game view. The saved source and its preview retain natural Blender text orientation.

Details include a shaped cab with open wheel arches, separate roof panel, sloped split windshield, quarter lights, wipers, mirrors and braces, polished door handles and fleet numbering; grooved tires, wheel cooling apertures, hexagonal lug nuts, rolled rim lips and hub caps; a ladder chassis, leaf springs, axles, differential, fuel tank, locker and exhaust; corrugated cargo panels with riveted rails and original raised livery; double cargo doors with hinge barrels, locking rods, latch handles, safety lamps, mudflaps and a loading step. Restrained modeled edge chips and scuffs survive GLB export.

Small hardware uses economical chamfers; major silhouette edges retain smooth radii. The GLB consolidates meshes by material while preserving the original component editing workflow in the `.blend` file.
