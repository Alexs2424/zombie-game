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

`layout.json` snapshots `HOTEL.stairs`, upper rail rectangles, and the lobby polygon from `world.ts`; regenerate it when the shared layout changes. The geometry validator tests the actual converted GLB for finite geometry, valid UVs/indices, embedded images, bounds, stair body clearance, and solid visible guards on both stairs. Manifests and validation reports contain measured counts.

Verification: TypeScript, focused ESLint, 20 hotel/navigation/light tests, Blender source audit, and Babylon GLB validation pass. Chrome entrance, stair-detail, and balcony views were inspected. Images remain in ignored `outputs/hotel-stack/`. Sustained performance is checked at the completed stack rather than inferred from a Blender render.

## Chandelier and ceiling — implemented

`hotel-grand-ceiling.blend` / `.glb` add one signature chandelier and two smaller matching fixtures with swept brass arms, socketed opal lamps, faceted pear drops, crystal festoons, stepped crowns, and turned suspension. Plaster ceiling roses and stepped coffer outlines share the wall palette; clipped perimeter cells follow the octagonal room. Four matching low salon bowls replace the simple discs. The original ceiling slab stays in place.

Rebuild with `build_ceiling.py`; pass `hotel-grand-ceiling` to the GLB validator and source auditor. Old fixtures/rose remain as loading fallbacks and are hidden only after successful import. TypeScript, focused lint, Blender source/GLB audits, and Chrome entrance, chandelier-upward, and dining-ceiling reviews pass. No extra runtime lights are introduced in this layer.

## Marble floor — implemented

`hotel-grand-floor.blend` / `.glb` add individually fitted, beveled marble slabs, thin joints, embedded original mineral-color and polish maps, an inset green perimeter border, and a flush stone compass. The visible finish is 1–25 mm above the unchanged simulation floor and remains below furniture contact-shadow planes. Previous compass overlays are hidden after successful loading.

Rebuild with `build_floor.py`. The validator checks top-facing floor samples and a maximum finish height below 27 mm, in addition to the common GLB checks. TypeScript, targeted lint, Blender source audit, actual GLB validation, and Chrome entrance/close-floor review pass. This layer changes surface detail; reflection and light tuning follow in the lighting PR.

## Lighting and finish response — implemented

`hotel-finish-lighting.ts` adds hotel-only plaster bounce, cooler window fill, a 1024 px static architectural shadow map, and a 128 px box-projected static room capture for floor materials. Warm fixtures retain their existing positions. Hotel materials support ten simultaneous lights so the local sources do not displace one another. The casino's global exposure is unchanged.

Static captures refresh after model replacement, not every frame. Moving concealed gallery panels and the supply lid are omitted to avoid frozen movable-object shadows; the probe is an architectural approximation, not a live mirror of characters. Disposal clears material references and destroys both render targets. Chrome verified zero shadow-map or reflection-face renders during a two-second idle sample after loading. The three light-membership tests pass. TypeScript and focused lint pass; entrance, reception, close floor, and wall relief views were inspected. The wall frame bevels visibly project at close range.
