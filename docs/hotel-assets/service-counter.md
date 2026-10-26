# Grand Dining Room service counter

Original Blender furniture with bookmatched walnut panels, brass marquetry,
fluted pilasters, an ivory marble top, open porcelain niches, rear storage,
silver coffee urns, a covered salver, stemware, and folded linen. Geometry and
two packed procedural textures are authored locally, with no downloaded assets.

The floor-centered model retains the existing 6.4 × 1.3 × 1.45 m fixture and
faces the dining room through the standard hotel loader. It uses nine material
batches and 34,856 triangles. The editable `.blend` keeps the named individual
parts; the GLB uses material batches.

- Source: `hotel-service-counter.blend`
- Preview: `hotel-service-counter-preview.png`
- Runtime asset: `public/models/hotel-service-counter.glb`
- Generator: `tools/hotel-assets/generate_service_counter_blender.py`
- Audit: `tools/hotel-assets/validate_service_counter.mjs`

Run Blender in background mode with the generator, then run the audit with
Node 22.13 or later. `service-counter-validation.json` records actual Babylon
mesh bounds, triangle counts, embedded textures, and fixture fit.

This generator supersedes the service-counter recipe in the older bulk hotel
generator. Run it after a bulk rebuild to retain the polished counter.
