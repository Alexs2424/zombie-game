# THE DEAD MAN’S HAND

Original fictional casino revolver, upgraded name **ACE OF SPADES**. The new gun uses blued steel, a six-chamber fluted cylinder, gold chamber rims and barrel inlay, an octagonal barrel shroud with an actual bore, raised front/rear sights, a modeled hammer and ejector, and sculpted walnut grip panels. All art is procedural; no external models, textures, logos, or brand references are used.

## Delivered assets

| File | Triangles | Size |
| --- | ---: | ---: |
| `public/models/revolver.glb` | 10,226 | 493,324 bytes |
| `public/models/hands-revolver.glb` | 19,076 | 1,212,628 bytes |

Both are self-contained glTF 2.0 binaries. Units are metres; +Y is up, +Z is muzzle-forward; receiver origin and scale 1 match the current gun pipeline. Gun bounds are approximately `(-0.0387, -0.1655, -0.123)` to `(0.0387, 0.120, 0.307)`.

- **Muzzle:** `(0, 0.070, 0.307)`.
- **Cylinder center:** `(0, 0.048, 0.038)`, rotating around local Z.
- **Display:** no baked rotation. Use the current rack convention, yaw ±π/2 according to the wall. For a free-standing reward display, yaw 0 retains the original +Z-forward pose.
- **Moving components:** all cylinder components start with `Cylinder `. Group these beneath a shared pivot at the cylinder center for a coherent rotation or swing-out animation. `Thumb latch`, `Hammer`, sights, frame, barrel, and ejector are separate named parts. There is no `Magazine` or `Slide` node.

The renderer can load the pair with its existing `/models/${id}.glb` and `/models/hands-${id}.glb` convention after `revolver` is added to `WEAPON_ORDER` and its viewmodel-root record. Weapon data, unlock logic, audio, and renderer changes are owned by the integrating task.

## Fitted-hand compatibility

The pistol’s `Grip frame`, `Rear backstrap`, `Trigger`, `Trigger guard`, and `Trigger guard right` geometry are preserved. The sculpted grip panels use the same vertices with walnut materials and new fine checkering. The large cylinder sits above those contact surfaces.

`hands-revolver.glb` is a byte-for-byte copy of the existing `hands-pistol.glb`, explicitly reused because those contact surfaces are unchanged. Its embedded leather color/normal textures, five fingers per hand, forearms, and `RightHand`/`LeftHand` wrist pivots remain intact. The hand meshes and gun should be siblings under the common weapon root; preserve the hand node translations.

The inherited hand data has 16 sleeve-cap triangles whose interpolated vertex normals disagree with the cap face direction. The validator records this inherited shading detail rather than altering the shared hand source. The new revolver passes the stricter face-winding check on every triangle.

## Reproduce and inspect

Requires Python, NumPy, SciPy and Pillow:

```sh
python3 tools/revolver-assets/generate_revolver.py
python3 tools/revolver-assets/validate_assets.py
python3 tools/revolver-assets/render_preview.py
```

The authoring script imports primitives from `tools/generate_weapons.py` and only writes the new revolver pair plus files in this documentation directory. It does not run or overwrite the original weapon generator outputs.

`asset-manifest.json` records integration coordinates and names. `validation-report.json` records container/accessor checks, finite geometry, unit normals, winding for the new gun, triangle budgets, six unobstructed chamber openings, hashes, exact pistol contact geometry, and exact hand reuse.

The preview images rasterize the exported GLBs themselves:

- `weapon.png`: weapon detail, gold inlay and walnut grip.
- `front.png`: cylinder/chamber and barrel perspective.
- `grip.png`: actual two-hand grip contact.
- `shooter.png`: root `(0.29, -0.21, 0.61)` and runtime FOV 1.32 radians.
- `shooter-close.png`: suggested root `(0.26, -0.18, 0.48)` and the same FOV.

CPU previews show actual geometry and materials; the engine adds its own image-based lighting and embedded hand normal mapping.
