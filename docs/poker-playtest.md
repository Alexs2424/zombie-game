# Card tables and flush reward — validation

September 27, 2026. Local branch `codex/roulette-rewards`, preserving the preceding roulette work.

## Delivered behavior

Two independent, persistent five-card hands in the High Roller Club. E opens a paused card menu; select one card and confirm its free replacement. Each table permits one replacement per actual round. Five cards of the same suit complete the challenge. The first completed table grants and equips The Dead Man’s Hand revolver in slot 5; the other table refills it once. Neither completed table pays repeatedly. New runs clear both hands and the weapon unlock. Room-unlock behavior is unchanged.

The first-pass defaults are one free swap per table per round and a revolver reward. Hands use finite 52-card decks, with only prior discards recycled when the draw pile empties. There is no matching-rank requirement, guaranteed next card, or chip charge.

## Assets

- Replaced both block-based tables with instances of an original Blender-authored poker table: 45,330 triangles, ten material batches, approximately 2.95 MB. The existing 3.8 × 2.4 metre collision footprints are preserved. Source, previews, and independent geometry validation are under `docs/poker-assets/` and `tools/poker-assets/`.
- Added dynamically printed cards which match each table's current hand, including face-down backs before the initial deal. Textures update only when the associated card changes.
- Added a 10,226-triangle revolver with an open six-bore cylinder, gold inlay, walnut grip, and compatible fitted hands. Sources and validation are under `docs/revolver-assets/` and `tools/revolver-assets/`. The grip contact geometry matches the existing pistol, so its hand GLB is reused exactly.
- The revolver has six rounds, 48 reserve, 110 base damage and a 2.6-second reload. Double Down retains six chambers and adds 35% damage and a 25% faster reload. Existing Quick Pour, roulette ammo, and damage rewards also apply.

## Verification

- `npm test`: 80 passing checks. Twenty card/revolver checks cover all suit patterns, legal flush rank combinations, deck uniqueness through repeated recycling, phase/proximity/room guards, invalid actions, independent per-round limits, hand persistence, pause freezing, both reward orders, repeat prevention, resets, upgrades, reloads and damage. Two added audio tests verify card cues remain audible on the UI bus while the world is paused, with cleanup/disposal.
- `npm run typecheck` and `npm run build` pass. Build output retains the existing Vinext dynamic-import and route-classification notices. Source/test scoped ESLint and `git diff --check` pass.
- Chrome: inspected both tables, the open menu, a selected card, the used-swap state, a completed flush, and the first-person revolver. Rails, cupholders, chips, felt and live cards are visible without placement conflicts.
- A regular card selection changed only the chosen card and left chips unchanged. Closing and reopening retained the hand and used-swap restriction; starting the next round re-enabled selection without a redeal.
- A controlled four-heart hand completed through the actual selection/confirmation UI, granted the revolver, and displayed matching live cards on the felt. Either table could provide the first reward. Completing the other restored depleted reserves; reopening a completed table did not refill them.
- The revolver fired and reloaded from 5/48 to 6/47. The final browser console contained no errors or warnings. The extra QA tab was closed afterward.

Browser checks used visible development controls, including repeatable hands, and did not constitute an ordinary mouse-captured survival run. Long-run balance and subjective sound quality remain hands-on playtest work.
