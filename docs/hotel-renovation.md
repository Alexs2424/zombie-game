# Grand Hotel — reception and the missing guest

This pass follows the agreed direction: a tasteful side reception, recently deserted luxury, and an optional missing-guest investigation. The existing hotel purchase and restaurant/Tommy challenge remain the main progression.

## Reception and architecture

Reception occupies the southwest bay. A 7.6 m walnut and ivory counter faces into the lobby, with an 8.2 m key cabinet behind it. Both ends connect to the staff aisle. The counter has marble, lamps, a guest ledger, bell, correspondence, an off-hook telephone and an open stationery drawer. The backdrop contains an ornate clock, mail slots, numbered keys and an empty hook for room 214.

Five original Blender assets replace or expand the furnishing set: reception, reception backdrop, guest suitcase, luggage shelf and porter cabinet. Editable sources, previews, dimensions, provenance and rebuild instructions are in [reception assets](hotel-assets/reception-assets.md). The new walnut texture is also used by the gallery paneling.

The hotel adds a polished marble floor, compass inlay, reception rug, fitted stair runners, gilded oval railing relief, carved balcony columns, a ceiling rose, tall curtained window bays, sconces, framed reflective panels and plaster ornament above reception. Repeated detail is merged by material. The room retains its open central approach and the existing continuous stair guards.

## Investigation

1. Inspect the reception ledger with **E**. Elias Varga, room 214, is recorded as checked out, but his luggage remains.
2. Inspect his tagged brown suitcase beside the desk. The ledger directs attention to its lining, which contains a service key and a warning.
3. Use the key at the west panel beneath the restaurant. Both ends of the rear service gallery open for the remainder of the run.
4. Read the collection register in the gallery to uncover the connection between the stored cases and departed guests.
5. Collect the security supply case beside the register. It adds up to two base magazines of reserve ammunition for each owned weapon and two grenades, within existing caps. A full inventory leaves the cache available for later.

Documents pause the solo game and are retained in the pause-menu journal during the run. Inspecting the suitcase before the ledger is safe; its initial text points back to reception, and revisiting after the ledger reveals the lining. New runs reset the clues, key, panels and reward. The cache is available once per run and does not grant the Tommy gun.

The gallery uses the existing ground floor beneath the restaurant. Its shared wall and gate geometry controls collision, bullets and zombie navigation. Opening the panels rebuilds navigation, allowing pursuing zombies to use the same shortcut. The normal rear spawn was moved outside the locked gallery to preserve reachable wave spawns.

## Implementation

- `hotel-mystery.ts`: clue text, interaction anchors, panel colliders and initial state.
- `simulation.ts`: examination, retained discoveries, pause state, gate opening and bounded rewards.
- `runtime.ts` / `app/page.tsx`: interaction prompts, document reader, journal, input handling and development controls.
- `hotel-fixtures.ts` / `hotel-renovation-layout.ts`: furniture and solid geometry shared with `world.ts`.
- `hotel-renovation-scene.ts` / `hotel-scene.ts`: material, lighting and architectural detail; live panel and cache appearance.

## Verification

- 184 automated tests pass, including early/out-of-order examination, clue re-reading, pause and fresh-run reset, one-time/full-inventory rewards, closed/open passage collision, enemy pursuit, both stairs and original hotel progression.
- TypeScript, targeted ESLint and the production build pass. The framework retains its existing chunking and route-classification notices.
- All 17 hotel/weapon GLBs load through the actual Babylon loader with finite vertices, UVs, valid indices and validated bounds. The five new/replacement assets also have a dedicated validation report.
- The local browser verifies the ledger, suitcase key, real panel opening, walking through the doorway, final register, supply collection and pointer-lock return from documents. The full guided route completed through both stairs and the restaurant, returning to the casino with the gallery locked. The browser reported no console errors or warnings. Preview controls are development-only and can be collapsed.
- Gameplay retains its 60 FPS cap. The completed walking pass showed 60 FPS and 17.7 ms p95. This brief sample is not a sustained combat benchmark; a hands-on playtest is still useful for atmosphere and difficulty.

For the local preview, open `/?playtest=1`. **Reception ledger** starts beside the counter. Follow the clue chain using the viewpoint buttons and **Interact E**, or walk normally. **Unlock gallery (QA)** is explicitly a testing shortcut. **Walk hotel loop** uses the real movement simulation with the gallery locked.
