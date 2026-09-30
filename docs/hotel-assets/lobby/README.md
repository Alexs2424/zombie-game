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
