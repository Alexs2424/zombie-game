# Grand Hotel fidelity stack

This directory records the approved [lobby roadmap](../lobby-design.md) as it is implemented. Original models use editable named Blender parts, metre scale, embedded textures, and material-batched GLBs. No external assets are downloaded.

## Stairs and balcony — implemented

`hotel-grand-stairs.blend` / `.glb` replace the old box guards and column assembly with curved walnut handrails, closed forest-green guards, applied brass uprights and oval relief, turned newels, curved stone spandrels, layered balcony fascia, and fluted columns with leaf capitals. The existing walking surfaces, rail collision, wayfinding, and doors stay in place. The closed panels intentionally match the existing solid guards.

The runtime keeps loading guards and column details available until the GLB loads; failed loads retain that fallback. Existing hotel lights include the imported meshes. Disposing the hotel disposes the asset container.

Build from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/hotel-lobby/build_stairs.py
node --experimental-strip-types tools/hotel-lobby/validate.mjs hotel-grand-stairs
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 2 --python tools/hotel-lobby/audit_sources.py -- hotel-grand-stairs
```

`layout.json` snapshots `HOTEL.stairs`, upper rail rectangles, and the lobby polygon from `world.ts`; regenerate it with `node --experimental-strip-types tools/hotel-lobby/export_layout.mjs` when the shared layout changes. The geometry validator tests the actual converted GLB for finite geometry, valid UVs/indices, embedded images, bounds, stair body clearance, and solid visible guards on both stairs. Manifests and validation reports contain measured counts.

Verification: TypeScript, focused ESLint, 20 hotel/navigation/light tests, Blender source audit, and Babylon GLB validation pass. Chrome entrance, stair-detail, and balcony views were inspected. Images remain in ignored `outputs/hotel-stack/`. Sustained performance is checked at the completed stack rather than inferred from a Blender render.

## Chandelier and ceiling — implemented

`hotel-grand-ceiling.blend` / `.glb` add one signature chandelier and two smaller matching fixtures with swept brass arms, socketed opal lamps, faceted pear drops, crystal festoons, stepped crowns, and turned suspension. Plaster ceiling roses and stepped coffer outlines share the wall palette; clipped perimeter cells follow the octagonal room. Four matching low salon bowls replace the simple discs. The original ceiling slab stays in place.

Rebuild with `build_ceiling.py`; pass `hotel-grand-ceiling` to the GLB validator and source auditor. Old fixtures/rose remain as loading fallbacks and are hidden only after successful import. TypeScript, focused lint, Blender source/GLB audits, and Chrome entrance, chandelier-upward, and dining-ceiling reviews pass. No extra runtime lights are introduced in this layer.

## Marble floor — implemented

`hotel-grand-floor.blend` / `.glb` add individually fitted, beveled marble slabs, thin joints, embedded original mineral-color and polish maps, an inset green perimeter border, and a flush stone compass. The visible finish is 1–25 mm above the unchanged simulation floor and remains below furniture contact-shadow planes. Previous compass overlays are hidden after successful loading.

Rebuild with `build_floor.py`. The validator checks top-facing floor samples and a maximum finish height below 27 mm, in addition to the common GLB checks. TypeScript, targeted lint, Blender source audit, actual GLB validation, and Chrome entrance/close-floor review pass. This layer changes surface detail; reflection and light tuning follow in the lighting PR.

## Lighting and finish response — implemented

`hotel-finish-lighting.ts` adds hotel-only plaster bounce, cooler window fill, a 1024 px static architectural shadow map, and a 128 px box-projected static room capture for floor materials. Warm fixtures retain their existing positions. The final integration consolidates overlapping rear fill into one source and retains the original eight-light material budget, including both window fills and plaster bounce. The casino's global exposure is unchanged.

Static captures refresh after model replacement and purchase-gate state changes, not every frame. Moving concealed gallery panels and the supply lid are omitted to avoid frozen movable-object shadows; the probe is an architectural approximation, not a live mirror of characters. Disposal clears material references and destroys both render targets. Chrome verified zero shadow-map or reflection-face renders during idle after loading. A final gate-close/open audit counted exactly two shadow updates and twelve cube faces, followed by zero idle updates; reproduce with `review_captures.json` using the same browser driver. The three light-membership tests pass. TypeScript and focused lint pass; entrance, reception, close floor, and wall relief views were inspected. The wall frame bevels visibly project at close range.

## Seating, textiles, and close details — implemented

`build_seating.py` replaces the sofa, armchair, and booth GLBs with rounded, individually filled cushions, sewn piping, covered buttons/channel seams, walnut supports, manufactured edges, and brass feet. Actual converted bounds remain inside existing fixture envelopes. Current editable sources are `assets/source/hotel-sofa.blend`, `hotel-armchair.blend`, and `hotel-booth.blend`; the old furniture sources are historical. The legacy all-assets generator skips these three models.

`build_details.py` authors `hotel-grand-details.blend` / `.glb`: gathered velvet curtains with lining, tiebacks and tassels; fitted window pelmets; carpet wrapping both tread and riser with brass rods; rugs for the existing seating groups and reception; carved bronze/opal sconces; and layered service-door casings, raised fields, kickplates and pulls. Furniture placement and collision footprints remain unchanged. Replaced curtains, runners, rug and sconce geometry stay available as loading fallbacks.

The close review caught unsupported-looking seat/back gaps and coplanar runner risers; walnut supports and a small cloth offset resolved them. Source audit, Babylon GLB geometry and furniture-envelope checks pass. Original packed texture maps remain self-contained. Rebuild using the matching Python script and audit using the asset names without `.glb`.

## Complete-stack review

Run `node tools/weapon-1970s/shoot.mjs outputs/hotel-stack/final @tools/hotel-lobby/review.json 'http://127.0.0.1:5191/?playtest=1'` against the isolated dev server. This checks close and wide game views, ray-measured wall projection, asset presence, hidden loading runners, a real movement loop, and a short enemy-chase frame sample. The full image set stays in ignored output folders; selected [entrance](previews/entrance.png), [stairs](previews/stairs.png), [wall relief](previews/wall-grazing.png), and [upholstery](previews/sofa.png) captures are committed for review. Compact results are recorded alongside this document.

All 292 automated tests pass after rebasing onto `73e44aa` from main and the production build succeeds. The build retains the framework's chunk-size and route-classification notices. Blender audits cover all seven current sources. In-game wall rays measure approximately 5.8 cm lower-panel molding projection and 3.3 cm plaster molding projection beyond the structural wall face.

The final real movement loop completed in 44.7 seconds, reached the 4 m balcony, descended both stair routes across the tour, and returned to the casino. The gallery remained locked as expected. A 12-second, three-enemy chase sample at 1600×900 in headless Chrome/Metal averaged 18.15 ms per frame (about 55 FPS), with a 19.6 ms 95th percentile. This is a local short sample, not a sustained 60-FPS or cross-device claim. See [runtime review](runtime-review.json).

## Lighting depth — second approved stack, layer 1

The user requested a two-PR extension above #34: lighting depth, then manufactured surfaces and restrained use wear. The approved palette and recently maintained hotel remain current.

The lighting layer uses asymmetric cool window light with an original soft mullion projection, more localized warm reception/dining pools, and reduced uniform hemispheric fill. It retains eight hotel sources and the shared AO/bloom/ACES pipeline; casino exposure is unchanged. The existing architectural shadow map and reflection capture remain static.

`bake_lighting.py` uses Cycles CPU (48 samples, five bounces) to bake floor diffuse irradiance from the real stair/column geometry and shared room/mezzanine shell. Its 1024px linear PNG is normalized to a bounded 0.52–1.0 light multiplier, preserving floor color and readable shadows. It is deliberately an art-directed static modulation, not additive emissive light or a full-room physically calibrated bake. It excludes furniture, doors, quest objects, and actors. Runtime world-space UV2 covers X -23…15 and Z 15…51; live texture UVs remain intact. The existing live floor lighting remains available if the bake fails to load. All map references and textures are released on disposal.

Rebuild with `/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --threads 4 --python tools/hotel-lobby/bake_lighting.py`. The editable lighting scene is `assets/source/hotel-lighting-bake.blend`, with packed source/output images. `lighting-bake.json` and `lighting-source-audit.json` record measured output. `review_depth.json` drives wide, close, reception, and balcony views using the existing browser driver.

Validation: TypeScript, focused ESLint, 36 hotel/light/gameplay tests, and Blender source audit pass. Chrome confirms all seven floor material meshes have loaded light maps and UV2; idle captures remain zero, and gate close/open produces two shadow updates and twelve reflection faces before returning to zero. No collision or gameplay layout changes. Performance is measured again on the completed two-layer extension.

## Manufactured surfaces and use wear — second approved stack, layer 2

The material layer follows lighting PR #36, which follows #34. Six GLBs and editable Blender sources are updated: stairs, floor, details, sofa, armchair, and booth. Original deterministic color, roughness, and tangent-normal maps replace the single-color-map walnut and velvet. Straight wood pieces align grain with their construction axis; swept handrail UVs follow arc length around both stairs and the balcony. Upholstery uses a 16 cm repeating fine weave with restrained normal strength. Source generation purges unused images between furniture builds.

Door pulls, escutcheons, and kickplates use a separate handled-brass finish: brighter handled centers, subtle darker edge/recess tarnish, and varied roughness. Ceiling brass and decorative beads retain their existing finish. Marble polish ranges from 0.298 to 0.447 roughness, with 95 low-contrast scuff marks weighted toward entrance, reception, central circulation, and stair approaches. These are finish variations rather than debris or ruin damage. The room-space polish UVs match the lighting UV2 exactly; the validator checks actual exported coordinates after Babylon conversion.

Rebuild using `build_stairs.py`, `build_floor.py`, `build_details.py`, and `build_seating.py`, then run the matching asset validator and source auditor. The existing collision footprints, stair clearances, wall relief, and furniture layout are retained. The largest changed GLB is 12.2 MB with 330,640 triangles; all six remain within the existing per-asset limits. Only the detail asset adds a material batch (eight to nine) for handled brass.

The lighting failure audit found that Babylon can report failed nonblocking textures as ready. Explicit failure tracking now preserves live lighting when either new map is missing; this correction is included in PR #36. Two isolated lighting construction/disposal cycles leave zero owned textures and lights. Reproduce with `review_lighting_lifecycle.json`; for the missing-texture check use `CAPTURE_BLOCK_URLS='["*hotel-floor-lighting.png","*hotel-window-light.png"]'` with the browser driver and `review_lighting_failure.json`.

Final verification: 36 focused hotel/gameplay/light tests, TypeScript, focused ESLint, production build, six updated GLB audits, and seven model-source audits pass. The in-game review checks ten mapped surface materials, all three marble material maps, loaded window projection, close hardware/upholstery views, and the real movement loop (44.75 seconds). The final 12-second three-enemy sample averages 19.54 ms/frame (about 51 FPS), p95 21.5 ms, compared with 18.15 ms/about 55 FPS in the earlier recorded sample. These are separate short local samples; this pass does not claim sustained 60 FPS. Exact data and failure/disposal results are in [finish runtime review](finish-runtime-review.json).

Review the committed [entrance](previews/finish-entrance.png), [handrails](previews/finish-stairs.png), [upholstery](previews/finish-upholstery-close.png), and [handled brass](previews/finish-hardware-close.png). Run `review_finish.json` through the existing browser driver for the full image set and walking/chase checks.
