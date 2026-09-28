# LAST CALL lounge assets

Original Art Deco cocktail-lounge furniture, modeled in Blender for this game.

The set includes a rounded, gold-veined black marble bar with individually
reeded walnut fronts, brass foot rail and LC crest; a three-arch smoked-mirror
backbar with stepped cornice, cabinet fronts, 66 labeled jewel-tone bottles and
illuminated shelves; two channeled oxblood banquettes with marble pedestal
tables; a cocktail table; two upholstered pedestal stools; and a three-tier
brass chandelier with 96 individually faceted crystal pendants. Small opal
lamps, crystal coupes and a decanter complete the tabletop dressing.

## Files

- `../../assets/source/last-call-lounge.blend`: editable named component objects,
  packed original texture maps, preview stage and camera.
- `../../public/models/last-call-lounge.glb`: game furniture only; meshes are
  consolidated by material to reduce draw calls. No lights, camera or preview
  architecture are exported.
- `last-call-lounge-preview.png`: Blender furnishing-study render of the complete
  set. Its neutral stone floor, teal staging walls and studio lighting are
  preview-only; the game uses its own burgundy carpet and oxblood wall shell.
- `asset-report.json`: evaluated source geometry counts and assembly bounds in
  game coordinates, plus GLB size and material count.
- `runtime-validation.json`: independent Babylon loader and placement checks.
- `textures/`: the original mathematical marble, walnut and leather color maps.
  The maps are also embedded in the GLB and packed inside the Blender source.

## Rebuild

From the project root, with Blender installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/bar-assets/build_lounge.py
```

The build script saves editable source before merging objects for export, then
exports GLB and renders a preview. Blender on macOS needs normal access to the
Metal graphics service even when used in background mode.

## Coordinates and collision

All placements use game metres with Y up. Editable Blender coordinates are
`(gameX, -gameZ, gameY)`. Exported X is reflected and face winding is corrected
so Babylon's default left-handed glTF root places the assets at the intended
positive-X room coordinates. Preserve that default loader root transform.
Lettering is mirrored locally only in the game export to read correctly from
the approaching player's left-handed camera; editable Blender text is unchanged.

Collision uses the simple assembly footprints in `asset-report.json`, which
match the game simulation. Furniture contains small decorative protrusions
above the counter and tables: lamps, bottles and glassware are visual props.
The chandelier is entirely overhead. The central bartender interaction aisle,
staff route and both side-door approaches stay open.

All geometry and textures were authored for this project. No downloaded assets
or external dependencies are needed beyond Blender and its bundled Python.
