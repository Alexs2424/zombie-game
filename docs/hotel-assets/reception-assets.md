# Grand hotel reception assets

Original Blender geometry and seeded procedural textures for the recently deserted grand hotel. The visual language is dark quarter-sawn walnut, ivory lacquer and marble, satin brass, carved acanthus, fine gilt fillets and pleated silk. All textures and geometry are original, with no downloaded assets.

| Runtime GLB | Editable Blender source | Fixture envelope W × D × H |
| --- | --- | --- |
| `public/models/hotel-reception.glb` | `reception-reception.blend` | 7.6 × 1.65 × 1.9 m |
| `public/models/hotel-reception-backdrop.glb` | `reception-reception-backdrop.blend` | 8.2 × 0.65 × 3.5 m |
| `public/models/hotel-guest-suitcase.glb` | `reception-guest-suitcase.blend` | 1.25 × 0.85 × 0.9 m |
| `public/models/hotel-luggage-shelf.glb` | `reception-luggage-shelf.blend` | 3.8 × 0.7 × 2.5 m |
| `public/models/hotel-porter-cabinet.glb` | `reception-porter-cabinet.blend` | 1.8 × 0.65 × 1.15 m |

Sources live in this directory. Each has editable named construction parts, packed texture images, and hidden material-batched export geometry. Visible source construction is intentionally preserved independently from the optimized export. Previews share the source basename followed by `-preview.png`.

The furniture faces **local -Z** after glTF export/Babylon import, stands at Y = 0, and uses metres. It follows the existing hotel asset import orientation; a yaw of π presents the desk and backdrop toward world +Z. Maximum envelopes are validated against evaluated geometry, including lettering and bevels.

Reception includes the open guest register with room 214 / E. Varga checked out, pen, writing pad, service bell, envelope and porter correspondence, two pleated lamps, an off-hook Bakelite telephone, staff drawers and a slightly open stationery drawer. The backdrop has 36 numbered hooks, with 214 empty, waiting letters in pigeonholes, clock, hotel lettering and lower storage. The guest suitcase sits slightly ajar on a folding stand with a visible lining and interior document pocket. Stored luggage is numbered 207, 209, 211, 215, 218, 223, 226, 231 and 234. The porter cabinet has paperwork, a pen tray and an integrated umbrella receiver.

Generate everything, including CPU-rendered previews:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/hotel-assets/generate_reception_blender.py
```

Generate just one asset by appending `-- --only guest-suitcase`, or omit preview renders with `-- --no-preview`. The generator updates only `reception-asset-manifest.json`, preserving the main hotel manifest and unrelated assets.

Validate actual runtime GLBs through the Babylon glTF loader:

```sh
node tools/hotel-assets/validate_reception_assets.mjs
```

The report is `reception-validation-report.json`. Checks cover embedded textures, UVs, finite geometry, valid triangle indices, floor origins, fixture envelopes and material batching. Blender preview renders were inspected for the counter, backdrop, suitcase, storage shelf and porter cabinet. The new models use 9–13 material batches each; small engraved lettering uses low-resolution curves without expensive bevels.
