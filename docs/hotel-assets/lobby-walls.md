# Lobby wall upgrade

## Direction and status

**Established request (2026-09-29):** create a separate worktree and branch for hotel-lobby model improvements, starting with the walls.

**Approved first-pass art direction:** refine the existing Belle Époque hotel language: warm ivory plaster, forest-green painted paneling, dark stone skirting, and restrained champagne brass. Keep the recently deserted, formerly operating luxury hotel described in [story and plot](../decisions/story-and-plot.md). The user reviewed the first pass, called it “much better,” and approved committing it. This confirms the current wall treatment; additional reference images can guide later revisions.

**Implemented on `codex/hotel-lobby-walls`:** the ten perimeter-wall sections now use real raised molding profiles with mitred, clipped corners; double plaster frames at ground and upper levels; recessed green wainscot panels; narrow brass beads; a layered dado, picture rail, and ceiling cornice. Seeded plaster color and normal textures use metre-based UVs. Existing window bays, artwork, service-door casings, reception backdrop, and cartouches retain reserved space. Furniture, stairs, floor, quests, and collision geometry are unchanged.

## Source and rendering

`lib/game/hotel-wall-scene.ts` constructs the wall geometry directly in Babylon from the existing `HOTEL_RECTS`. These architectural meshes are procedural source assets, not new Blender/GLB exports. `hotel-scene.ts` replaces its old perimeter boxes and trim with this builder and includes the result in hotel light membership and disposal.

The finished wall assembly contains six merged material meshes, 15,032 vertices, and 15,900 triangles. The maximum ornament projection from the structural wall face is 18 cm at the ceiling cornice. No new lights or shadow maps are allocated. Two 256 × 256 textures supply subtle, deterministic plaster variation. Material and geometry ownership stays with the wall builder.

## Verification

- TypeScript and ESLint pass for the changed code.
- All 20 focused hotel layout/navigation and light-membership tests pass.
- In-game Chrome screenshots inspected at the lobby approach, a close oblique wall, the mezzanine, reception, and an east service door. Paneling clears the service-door leaf and retained window and artwork faces.
- The initial browser geometry audit reports six finite wall meshes included in the existing hotel point lights. The later lighting pass adds hotel-only fill; see the [current fidelity record](lobby/README.md). Constructing and disposing a second wall assembly restores the scene's original mesh, material, texture, and geometry counts.
- No Blender audit is needed because this pass changes runtime geometry only. No sustained combat performance benchmark was run.

Reproduce the visual review against an isolated development server:

```sh
npm run dev -- --host 127.0.0.1 --port 5191
node tools/weapon-1970s/shoot.mjs outputs/hotel-walls @tools/hotel-assets/review_walls.json 'http://127.0.0.1:5191/?playtest=1'
```

The existing screenshot driver requires local Google Chrome. Screenshots and `audit.log` from this pass live in ignored `outputs/hotel-walls/` in the worktree.
