# Blender slot-machine integration check — September 27, 2026

The 12 main-room cabinets now use two original Blender exports, with six instances of each style. Both GLBs have eight material batches and 15,612 triangles. The editable, packed Blender source is saved under `assets/source/slot-machines.blend`.

## Verified

- Loaded both final GLBs in desktop Chrome using the real game at `/?playtest=1`.
- Inspected the main-floor overview, both sides of the first island, the second bank, and a close-up at the collision boundary. Headers, reel symbols, chip meters, deck labels, side crests, and controls render correctly; outward orientation and shadows are correct.
- Walked into the island boundary and around the end into the middle aisle using the development controls. These use the real simulation's movement and collisions.
- Browser warning/error log was empty after the final checks.
- Independently loaded both final GLBs through Babylon's NullEngine and instantiated all 12 placements. All 96 material meshes use hardware instances, inherit shadow reception, and remain inside their island's horizontal collision rectangle and 2.1 m cover height.
- Existing 36 simulation/audio checks pass; TypeScript checking and the production build pass.

Brief empty-room readings were about 117–121 FPS, with p95 frame time about 9–13 ms. These are short development checks, not a sustained combat or thermal benchmark. Automated mouse capture was not needed; the visible development controls were used.

The inspection caught and corrected reversed reel artwork, duplicate UV layers on circular labels, and cabinet geometry occluding the control deck and chip meter. Smaller hardware was simplified before delivery to reduce each cabinet from 28,096 to 15,612 triangles without removing the visible features.

The Chrome test tab was closed and the local development server stopped after the check. Slot machines are scenery in this version; they do not charge chips or run wagers.
