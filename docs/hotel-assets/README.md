# Grand Hotel original assets

The runtime-authored architectural wall pass is documented in [Lobby wall upgrade](lobby-walls.md), including art direction, source, and visual verification.

Thirteen self-contained GLBs were authored for this project in Blender: eleven furniture types, the drum-fed Tommy reward weapon, and its fitted hands. The furniture and weapon use original geometry and seeded procedural walnut, velvet-weave, and green-marble textures. Hands adapt this project's existing original `hands-rifle.glb`; no external art was downloaded.

Furniture uses metres, a floor-centred origin, and its authored collision footprint. Load at unit scale and apply the fixture's existing yaw. Faces point toward Babylon local **-Z**. The long booth is the exception: back at local **-X**, open side **+X**, so its opposite-wall instance uses yaw PI. The exporter compensates for Babylon's default glTF X reflection on this asymmetric model.

| GLB | Material batches | Detail |
| --- | ---: | --- |
| hotel-reception | 6 | Bevelled walnut cabinet, green marble, brass flutes, leather Deco panels, GRAND HOTEL lettering, room-key cubbies, register and service bell |
| hotel-jukebox | 7 | Arched walnut cabinet, illuminated horseshoe bands, brass speaker grille, pearl buttons, song cards and coin slot |
| hotel-dining-table | 8 | Two turned pedestals, six padded chairs, stitched cushions, linen runner, gold-rim plates, cutlery, stemware and floral centrepiece |
| hotel-sofa / hotel-armchair | 4 each | Rolled arms, individual velvet cushions, sewn piping, button tufts, walnut arm veneers and brass feet |
| hotel-booth | 4 | Long channeled banquette, individual seat cushions, walnut end caps and brass footrail |
| hotel-luggage-cart | 5 | Arched brass trolley, casters, three strapped vintage cases and handles |
| hotel-host-stand | 5 | Marble-topped walnut podium, GH emblem and reservation folio; no bell, since the runtime owns the challenge bell |
| hotel-service-counter | 5 | Cabinet panels, brass pulls, marble top and stacked service plates |
| hotel-planter | 5 | Fluted stone pot, brass rim, soil, tapered trunks and individually modelled fronds |
| hotel-coffee-table | 5 | Marble top, brass edging, tapered legs, walnut lower shelf and periodicals |
| tommy | 11 | Walnut stock and pistol grip, vertical foregrip, finned barrel, open muzzle, drum magazine, winding hub, bolt, trigger, sights, screws and selector |
| hands-tommy | 16 | Original right-hand rifle grip; support palm rotated around vertical foregrip with a smooth forearm transition |

All meshes carry UV coordinates. Static parts are evaluated and merged by material; the editable `.blend` files retain the named construction parts. The furniture GLBs stay inside their fixture envelopes. Exact measured vertex/triangle counts and bounds are in `asset-manifest.json`; dimensions there use raw glTF coordinates.

## Tommy mounting

Match the existing weapon loader: origin at receiver, **+Y up**, **+Z muzzle**, unit scale, no baked rotation. Muzzle tip is **(0, 0.025, 0.48)**. The stock ends at Z=-0.53. Exact `Magazine` and `Bolt` transform nodes own all corresponding material batches. Animate those parent nodes; decorative meshes move with them. Exact `RightHand` and `LeftHand` wrist transforms remain available in the hand GLB. The right grip matches the existing rifle profile and hand contact position. The vertical support grip is centred near (0, -0.085, 0.226).

`validation-report.json` records a successful load of every actual GLB through Babylon's `LoadAssetContainerAsync` and a left-handed `NullEngine`. It verifies finite vertices, triangle indices, UVs, fixture dimensions, animation/wrist node names, and positive-Z muzzle orientation after the real loader conversion. PNG previews are small, eight-sample, two-thread CPU renders of exported geometry; final appearance depends on the game's lighting.

## Rebuild

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/hotel-assets/generate_hotel_blender.py
node tools/hotel-assets/validate_assets.mjs
```

Use `-- --only reception,jukebox` to rebuild selected assets; use `hands` for the fitted hands. `preview_assets.py` makes the four documentation previews without modifying public model files. Blender requires normal host access on this machine because its background startup crashes inside the filesystem sandbox. No GPU rendering is used.
