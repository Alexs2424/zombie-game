# Service corridor validation

The corridor is now a loading area with an original Blender delivery truck,
cartons/pallets, shelving, a loaded pallet jack, a utility cabinet and detailed
wall/ceiling equipment. Inward-facing painted utility walls, concrete joints,
floor markings and scoped work lighting distinguish it from the casino rooms.

## Gameplay

Seven new regression tests exercise the real simulation:

- Each new solid assembly stops both player and enemy movement, and actors can
  back away without becoming trapped.
- The cross-room escape aisle, lounge passage and three camera positions are
  walkable. The original casino/lounge escape loop still connects.
- The navigation flow field reaches every enabled spawn and each available
  entrance, with shortcut/VIP gates tested both open and closed.
- Zombies pursue around the truck and loaded pallet without using stuck-enemy
  relocation.
- Truck/carton cover blocks fired bullets; open-lane fire reaches its target.
  The low pallet permits shots above it.
- The truck blocks a grenade blast and bounces a thrown grenade.

The entire suite passes **138 tests**. The parked truck and storage are static
scenery with solid rectangular gameplay footprints. Details such as mirrors,
wheel arches, shelf voids, carton gaps and pipework do not add separate collision
surfaces. Existing gate prices, purchases, progression and spawn positions are
unchanged.

## Geometry and browser review

The independent `tools/service-assets/validate_runtime.mjs` audit uses Babylon's
normal left-handed GLB loader with its conversion roots intact. It checks world
bounds, finite vertex/normal data, embedded textures, consolidated mesh budgets,
geometry in every footprint, rays through the escape lanes at three heights,
and rays against the truck and storage cover. See `runtime-validation.json`
for exact counts and SHA-256 hashes of the checked exports.

The delivered truck is **80,214 triangles / 14 meshes / 4.93 MiB** and the prop
set is **67,672 triangles / 13 meshes / 4.42 MiB**. Each includes three embedded
texture maps. Floor-paint ray validation confirms that the markings sit above
the concrete and expansion joints. A single 1024-pixel shadow map is limited
to corridor assets and zombies currently inside the corridor.

The game was inspected in desktop Chrome using the dedicated development
preview and its actual **Seed run** / service-view controls. Missing models were
also exercised during asset production: visible fallback cover allowed the
game to start while individual Blender exports were unavailable.

- Inspected truck front/side branding, cargo rear hardware, cartons and labels,
  shelving/totes, loaded pallet jack, utility panels, ceiling pipes and fixtures.
- Confirmed the final floor markings are visible and the modeled text reads
  correctly in the game's left-handed camera.
- Purchased the staff shortcut for 1,200 chips and walked through its open
  aisle into the casino with the real simulation controls.
- Inspected the 14-zombie crowd scenario with the corridor route available.
- No new browser warnings/errors occurred after the final asset reload.

TypeScript, ESLint and the production build pass. The build includes both GLBs
and retains the existing Vinext JSON-import/dynamic-import/route-classification
notices. Both editable Blender sources were regenerated and their renders
inspected.

The Blender renders in this directory are asset studies using preview-only
staging. They are not screenshots of the game. These checks are targeted visual
and gameplay checks, not a sustained frame-rate benchmark or full survival run.
