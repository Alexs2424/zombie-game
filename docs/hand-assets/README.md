# Last Jackpot fitted first-person hands

Four self-contained glTF 2.0 binaries fit the supplied weapon geometry at scale 1:

- `hands-pistol.glb`: dominant trigger/grip hand with the support hand wrapping around it.
- `hands-shotgun.glb`: dominant hand around the stock wrist, support hand under the wooden pump.
- `hands-smg.glb`: dominant pistol grip, support hand around the perforated fore-end.
- `hands-rifle.glb`: dominant pistol grip, support hand under the wooden fore-end.

All geometry, leather color/normal textures, stitches, cuffs, and glove patterns are original procedural work. No imported or external licensed art is used. Guns are unchanged.

## Integration

Units are metres, +Y is up, +Z is muzzle-forward, and the receiver is the origin. Parent the matching gun scene and hand scene under the same group. Keep both scene scales at 1. The requested common root is camera-local `(0.29, -0.25, 0.61)` in a +Z-forward viewmodel convention.

Every GLB has two separately movable mesh nodes, `RightHand` and `LeftHand`. Each node's translation is its anatomical wrist pivot; vertices are local to that pivot. Preserve the initial translations and use copies of those rest poses when adding reload motion. The whole hand and its forearm move together. These are modeled posed grips, not skeletal finger rigs.

```js
weaponRoot.add(weaponGLTF.scene, handsGLTF.scene);
const rightHand = handsGLTF.scene.getObjectByName("RightHand");
const leftHand = handsGLTF.scene.getObjectByName("LeftHand");
const leftRestPosition = leftHand.position.clone();
const leftRestQuaternion = leftHand.quaternion.clone();
// During reload: apply offsets relative to these saved rest transforms.
```

The forearms terminate below and behind the camera so their ends are not exposed. At the specified root and 70-degree FOV, the pistol's lower hands/cuffs are cropped by the bottom screen edge. Exact-root shooter renders document the framing; raise the common root if more glove/cuff visibility is desired.

## Contents and validation

`asset-manifest.json` records dimensions, triangle counts, named nodes, and pivots. Every hands asset is below 20,000 triangles and includes its own leather color and pore normal textures.

Each weapon has three renders of actual triangles: `*-shooter.png`, `*-side.png`, and `*-grip-detail.png`. Weapon triangles for these renders are decoded from the unchanged supplied GLBs, copied byte-for-byte into `weapon-reference/` only for reproducible QA. The CPU renderer shows geometry and smooth normals; the embedded normal map is additionally available to the engine's PBR renderer.

`validation-report.json` records GLB container/accessor checks, finite unit normals, index ranges, nondegenerate triangles, triangle budgets, and hashes of the unchanged weapon references.

## Regeneration

Requires Python with numpy, scipy, and Pillow:

```sh
python3 tools/hand-assets/generate_hands.py
python3 tools/hand-assets/validate_assets.py
```

`weapon_geometry_reference.py` is a verbatim copy of the existing weapon source generator, reused for its mesh primitive utilities. Previews load the actual weapon GLBs rather than rebuilding the guns. Set `LAST_JACKPOT_WEAPONS=/path/to/public/models` to use another location for the exact gun GLBs.

## Repository layout

Runtime assets are in `public/models/`; the generators and validators are in `tools/hand-assets/`. Run generators from the repository root; output goes to ignored `outputs/hand-assets/`. Copy reviewed GLBs into `public/models/` and their updated manifests into this documentation directory. Repository validators check the delivered public models and write the report here. The original generation contact sheets and reports document the supplied geometry, not a browser screenshot.
