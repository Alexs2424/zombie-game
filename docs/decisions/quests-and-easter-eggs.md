# Quests, Easter eggs, and shared mechanics

Status: working design, with existing features explicitly separated below. Repository baseline inspected on 2026-09-28 at commit `372b81a`; recheck implementation when changing this plan.

## Existing map and systems

The source-derived [map](../maps/last-jackpot-map.png) and `lib/game/casino-layout.ts` show:

- A 60 × 32 m central casino, 48 slot cabinets, two craps tables, two roulette tables, and one flush table.
- Last Call Lounge west, High Roller south with the second flush table, cashier public hall east, and Velvet Hour speakeasy farther east.
- The cashier's secure rear area is inaccessible behind collision-blocking glass. Its safe is scenery. Reserved future stairs/trapdoor space is not a playable lower level.
- Grand Hotel north, two curved stairs, upstairs restaurant, concealed rear luggage gallery, and a supply room accessed from the hotel.
- Marlowe's shop, table rewards, the portrait/keypad speakeasy puzzle, Mystery Box, and the restaurant's Last Service challenge already exist.
- The hotel investigation already supports ledger → suitcase lining/key → west panel → collection register → supply cache, with discoveries retained in a run journal.
- Room 214 exists in clue text. There is no implemented guest room 214 or guest-room corridor.

These are separate from the proposed main story quest. The current simulation is solo; documents, shopping, and poker use pause behavior that must change for online co-op.

## Main quest route

1. **Lounge: the previous four.** Add the old group photograph and invitations. Marlowe provides an understated reaction. This introduces “Don't open the cage.”
2. **Hotel: Varga's disappearance.** Reuse the existing reception/suitcase/gallery investigation. Extend its meaning through dialogue and additional evidence rather than replacing its current reward or requiring a second key hunt.
3. **Supply room: restore surveillance.** Add a power interaction and evidence connected to Leon's old work order. The hardware and footage are new content. Use a short discoverable loop/recording rather than a mandatory cinematic.
4. **High Roller: the rigged hand.** Deduce a fixed hand from records and marked cards. Implement a dedicated quest interaction so this does not overwrite the normal flush challenge, consume its limited swaps, or depend on lucky draws.
5. **Velvet Hour: the agreement.** Use the existing speakeasy as the private meeting place from the old bargain. Add the agreement and evidence connecting Voss to collection. Do not add a redundant missing room solely to reproduce the original pitch. The normal portrait/keypad route remains available.
6. **Cashier cage: expose the transfer.** Reveal the four-signature scheme and the risk of opening the secure area. A new, explicit quest-controlled opening is required; the present glass barrier does not already allow entry. Exact opening mechanism and optional lower-level expansion remain open.
7. **Across the map: prepare the counter-wager.** Surveillance, power, a dealer's table, and the cashier mechanism provide different jobs. The exact puzzle follows the final contract rules. Use flexible roles and persistent completed substeps, not mandatory simultaneous character-specific buttons.
8. **Central casino: the Collector.** Transform the familiar room through lighting, sound, and encounter state. Prepared mechanisms expose the Collector to damage. Preserve readable movement lanes; its moveset and arena geometry require a dedicated design pass.
9. **Resolution.** Reopen the exits and reveal the next property's deed through a prop and voiced exchange while players retain control. Post-completion survival/results behavior remains open.

This route supersedes the original pitch's additional missing-room assumption. The ordering is a narrative design, not yet a final dependency graph: allow early evidence discovery and preserve it until relevant.

## Smaller Easter eggs

| Secret | Current design | Implementation status |
| --- | --- | --- |
| Marlowe's usual | Discover a recipe and order it to hear a candid memory of Voss. | New content; shop already exists. |
| The fifth reflection | A brief extra figure appears in a selected reflective panel; a portrait later identifies it. | New content; identity and economical rendering technique are open. |
| Employee of the month | Staff photos show the same workers across impossible periods. | New props and optional reactions. |
| An encore | Restore lounge equipment for an original song and a supernatural trace of the performer. | New content; prefer audio/light effects first, full ghost performance later if useful. |
| A room that remembers | Personal effects reveal what the crew concealed. | Deferred guest-room concept. Do not claim room 214 is built or place the same secret in another space without updating this decision. |

Side secrets can reward curiosity with dialogue, atmosphere, or useful supplies. Not every secret grants a weapon or belongs to the critical path. Specify reward limits before implementing any mechanical reward.

## Co-op mechanics decisions

- One authoritative session owns quest progress, doors, enemy outcomes, and reward grants.
- Discoveries and keys required for progression are team state. Do not strand progress in a disconnected player's inventory.
- Personal document/menu use does not pause the online session. Shared journal entries let teammates catch up.
- Deduction, not random gambling success, gates the main quest.
- No essential puzzle requires a particular selected character. Missing speakers get an appropriate alternative or journal delivery.
- Completed steps survive player disconnects within the active session. Save/resume across terminated sessions is not yet selected.
- Main-quest rewards must be safe against duplicate interactions and repeated grants. Existing side-game rewards remain separate.
- Party-size scaling, player death/revive rules, late-join policy, and session hosting infrastructure require separate implementation decisions.

## First implementation milestone

Build a small, shared investigation: Voss's welcome → Marlowe's counterpoint → Varga's ledger and suitcase → gallery opening → voiced register reveal. Validate it first with two players, including subtitles, shared discoveries, and a reconnect. Two players are an initial integration test, not a reduction of the four-player target.

Follow with four-player validation before treating the co-op foundation as complete. Final character facial polish, Collector production, additional rooms, and the full main quest are later milestones.

## Implemented reward inventory rules — 2026-09-29

The player carries at most two firearms; melee tools remain separate. Existing
poker and Last Service rewards still grant their named guns, replacing the held
firearm (or the last held firearm when using a melee tool) if both slots are full.
The Mystery Box instead reveals a 20-second offer: F accepts, X declines, walking
away lets it expire. Reveal/decline/expiry never grant ammo or replace a gun.
The user's explicit direction establishes two guns and optional Mystery Box
pickup. The latest user direction establishes a 20-second offer, an opening case,
visible weapon and music/sounds; replacement behavior remains a working choice.

**Working design, implemented 2026-09-30:** The Velvet Case replaces the gambling
slot cabinet with a walnut, brass and burgundy velvet presentation case on legs,
matching a 1970s private casino lounge. Each 400-chip opening guarantees one
random firearm offer; the previous 50% empty result is superseded. The gun rises
while a short original chime melody plays, waits above the tray, then lowers and
the lid shuts if declined or abandoned. This prop establishes no new character,
quest or backstory. Native Blender source, sound provenance and timing are
recorded in [The Velvet Case](../velvet-case.md).
See [combat balance](../combat-balance.md) for current mechanics and tuning.
