# Frame pacing and scenery loading

Worktree: `frame-pacing-investigation`; branch: `codex/frame-pacing-investigation`.
Base: `95184c8` on `main` (this repository has no `master` branch).

The goal is efficient scenery construction, loading, and rendering while keeping the existing map and full model detail. Randomized rooms are outside this change.

## Changes

- **Door navigation:** retain the static navigation graph; update only nodes and edges around changed doors. Changed static walls/fixtures still trigger a complete rebuild. Existing cache entries remain immutable across simulations.
- **Shadow submission:** partition static material batches by the spotlights they intersect. Keep a static caster out of a shadow map only when its padded world bounds are entirely outside that light's actual shadow frustum. Moving dice, roulette components, bartender, and enemies retain their dynamic caster lists. The spotlight transforms are fixed; moving one in future requires rebuilding its cached frustum and static membership.
- **Hotel lighting:** track mesh additions/removals and zombie room membership. Refresh light inclusion only on changes, with an independent array per light. This removes repeated whole-scene light rescans while preserving the existing room boundary and update cadence.
- **Shared loading:** parse each shared hand GLB once, then clone independent weapon rigs. Dispose the shared container once.
- **Betting chips:** bake a reusable chip mesh with four material groups, preserving all 4,092 vertices and 3,512 triangles. Create and reuse table copies as needed instead of allocating all 96 full hierarchies at startup. Preserve the existing eight-chip visual cap.
- **Diagnostics:** sample the frame percentile every 30 frames. Previously the rolling history's length stayed at 180, causing a sort on every frame.

No GLB assets, polygon detail, texture sizes, render resolution, shadow resolution, ambient occlusion, or bloom settings are reduced.

## Results

Raw captures: [baseline](performance/baseline.json) and [optimized](performance/after.json).

| View | Draw calls before → after | Mean render CPU before → after | Render CPU p95 before → after |
| --- | ---: | ---: | ---: |
| Casino | 2,591 → 1,546 (40% fewer) | 14.76 → 13.37 ms | 16.60 → 14.80 ms |
| Hotel | 2,067 → 970 (53% fewer) | 9.07 → 7.12 ms | 9.70 → 7.70 ms |
| Supply | 2,031 → 954 (53% fewer) | 8.49 → 6.47 ms | 9.90 → 7.20 ms |
| Casino + 14 zombies | 2,625 → 1,560 (41% fewer) | 14.43 → 14.01 ms | 16.00 → 16.10 ms |

Casino mean update cadence improved from 17.16 to 16.66 ms (approximately 58 to 60 updates/second); its browser rAF p99 fell from 33.4 to 16.8 ms. The crowded scene improved more modestly: 17.47 to 17.00 ms, and it still had 33.4 ms rAF intervals. Crowded rendering remains close to the frame budget; these changes do not establish a locked 60 FPS on all hardware or eliminate every hitch.

| First uncached unlock | Before | After |
| --- | ---: | ---: |
| Bar | 565.6 ms | 1.8 ms |
| Cashier | 559.3 ms | 1.9 ms |
| Hotel | 558.6 ms | 2.7 ms |
| Supply | 558.3 ms | 3.7 ms |

The initial scene has 2,651 mesh objects versus 4,224 (37% fewer), with the same 505 textures and 27 lights. Scene vertex totals include unused duplicates: their reduction reflects deferred chip copies and shared resources, not simplified visible models. The chip regression verifies every position, normal, UV, triangle, and material against the original GLB.

Visual checks cover casino, hotel, supply, and both craps-table views. Comparable central image regions differed by less than 0.1 mean RGB channel units out of 255, with fewer than 0.05% of pixels differing by over 10 channel units; these are screenshot sanity checks, not proof for every camera or animation. Browser checks also cover both betting banks, independent tables, all six targets, reset/reuse, and 144 shared hand-mesh copies with independent transforms. No page errors occurred. See the [scenery check results](performance/scenery-checks.json).

Regression coverage includes all 1,024 door combinations, full navigation-graph comparisons, stairs/upper floor, moved static geometry, cross-simulation cache isolation, dynamic hotel-light membership, and shadow-frustum boundary cases.

Validation completed: **244 tests passed**, `npm run typecheck`, `npm run lint`, and `npm run build`. The build reports vinext dependency import/chunk warnings but completes successfully. Source assets under `public/models/` are unchanged.

## Measurement method

`tools/performance/profile-game.mjs` drives the development playtest controls in headless Chrome. It records four fixed views (casino, hotel, supply, and casino with 14 zombies), with a 2.5-second warm-up and an eight-second sample each. The viewport is 1600 × 1000 at device scale 2; the game's unchanged pixel-ratio cap produces a 2400 × 1500 render target. The existing 60 FPS gameplay cap remains enabled.

Measurements use Chrome 154 / WebGL 2 / ANGLE Metal on the Apple M3 Max. `render` is CPU time spent inside `scene.render()`, including draw submission, **not a GPU timer**. `interval` measures time between renderer updates; `raf` is the independent browser animation timestamp interval. Draws are per-update differences in Babylon's cumulative draw counter and include shadow/postprocessing passes. Short local samples are evidence of reduced work, not a hardware-independent FPS guarantee.

Startup time includes development-server module loading, asset parsing, shader readiness, and seeded simulation construction. Resource transfer totals reflect this browser session's caching behavior. Neither is a controlled cold production loading benchmark.

Door timings measure synchronous `refreshMap()` after each cumulative unlock. The VIP combination is already warmed by the crowd scenario; it is a cache hit in both captures. The other sampled combinations were not previously visited. Initial navigation construction still costs approximately one second in the separate Node probe; this change targets door-opening pauses during play.

## Reproduce

Use Node 22.13 or newer, install the repository dependencies, and start an isolated development server:

```sh
npm run dev -- --host 127.0.0.1 --port 5188
```

The browser tools use an externally available Playwright installation. Set `PERF_PLAYWRIGHT_MODULE` to its module path if it is not resolvable as `playwright`; set `PERF_BROWSER_EXECUTABLE` to a compatible Chrome executable if needed.

```sh
PERF_OUTPUT=outputs/performance/browser.json node tools/performance/profile-game.mjs
PERF_OUTPUT=outputs/performance/visuals node tools/performance/check-scenery.mjs
```

`PERF_URL` overrides the default `http://127.0.0.1:5188/?playtest=1`; `PERF_SAMPLE_MS` changes profile duration. Keep the browser, resolution, views, and sampling settings identical for comparisons. Run profiling separately from builds and test suites. Screenshots and raw working captures are ignored under `outputs/`.

## Next investigations

1. Precompute the initial static navigation graph at build time, keyed to collider geometry, to remove its startup CPU pause without changing collision detail.
2. Prefetch room assets before a door unlock, and stage construction in bounded batches. Preserve sightlines through open doors, cashier glass, stairs, and the balcony; visibility based only on the player's current room would be incorrect.
3. Cache immutable zombie geometry per variant, retaining independent transforms, wounds, materials, and limb visibility. This targets wave-spawn work while preserving the authored geometry.
4. Consider presentation interpolation separately if movement still feels uneven after rendering improvements. Simulation currently advances at a fixed 60 Hz; increasing the FPS cap alone does not smooth those positions.

Procedural construction helps when repeated scenery shares geometry/materials and construction is scheduled sensibly. Generating the same thousands of independent meshes again at runtime does not itself reduce rendering cost. See Babylon's [scene optimization guidance](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene) and [instance documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances).
