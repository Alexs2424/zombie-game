# Proposed four-player co-op rules

Planning only: these defaults describe a future implementation; no multiplayer behavior is implemented by this document. Scope is one private room with at most four admitted player identities, personal equipment and chips, and shared map progression. Offline solo retains its existing rules and pause behavior.

The baseline is commit `2160dc2`, particularly [simulation.ts](../../lib/game/simulation.ts), [world.ts](../../lib/game/world.ts), [runtime.ts](../../lib/game/runtime.ts), [renderer.ts](../../lib/game/renderer.ts), [poker.ts](../../lib/game/poker.ts), and [hotel-gameplay.ts](../../lib/game/hotel-gameplay.ts). The hotel mystery currently exists only in the separate, uncommitted `hotel-lobby-prototype` work. Its integration is optional and must be reviewed before adopting the mystery rules below.

## Ownership and authority

| State | Owner and rule |
| --- | --- |
| Room | Server: room/run IDs, creator role, four identity slots, connection status, reconnect credentials, lobby readiness and lifecycle deadlines. |
| World | Server: phase, round, time, RNG, enemies, projectiles, doors, navigation, shared casino animations/hands, hotel challenge, mystery progression and jukebox. |
| Player | Server: position/aim, health, chips, weapons/ammunition, perks/upgrades, cooldowns, damage modifiers, statistics, wager eligibility, reward receipts and alive/spectating status. |
| Local presentation | Browser: camera prediction, interpolation, graphics/audio settings, pointer capture, open dialogs, journal page, spectator target and transient HUD effects. |

Every action carries a sequence, run ID and relevant entity/revision. The server derives actor identity from the authenticated connection; a supplied player ID never authorizes actions on another record. It validates alive status, distance, sight, funds, cooldown and eligibility when accepting the action. Duplicate commands return the existing outcome. Clients never submit damage, purchases, random results or rewards as facts. Resolve simultaneous actions in a documented server order; one winner receives an atomic charge/state change, and unsuccessful contenders pay nothing. Feedback identifies the actor and intended recipient so another player's shot does not animate the local gun or hit marker.

## Lobby and run lifecycle

The creator can start with one to four players, remove guests before a run, and request a rematch from results. Starting requires every connected lobby player to be ready. Creator is an administrative role, never simulation authority. No active-run kicking, forced restart or host-controlled pause in the first version. If the creator explicitly leaves, or their disconnect grace expires, transfer the role to the earliest-admitted connected player; defer transfer if nobody is connected. Returning to the lobby releases absent identities, allows guest removal and resets readiness. A rematch refreshes run-scoped credentials and invalidates the previous run's commands and claims.

Starting resets the world and personal run state. Every player starts with the current solo loadout: 100 health, 400 chips, pistol with 12 magazine/84 reserve, two grenades and no purchased perks. Ready/lobby players spawn together at validated casino start positions.

Late arrivals may occupy only unused identity slots. They spectate until the next regular wave begins, then receive the starter loadout plus already-unlocked team reward weapons. Their first spawn has two grenades without an additional round grant. A mid-intermission arrival waits for that upcoming wave. A hotel ambush never counts as a respawn boundary. No player can spend, fire, trigger challenges or collect supplies while spectating.

At zero health, stop movement/actions, clear held input, close action dialogs and enter teammate spectating. There is no downed/revive system initially. After surviving teammates clear the wave, connected dead players return at the next wave's start, with maximum health, retained chips, equipment, upgrades and remaining ammunition. Every scheduled first spawn or respawn requires a currently connected, eligible identity; disconnected reserved records never resurrect or block a wipe. Ensure a usable pistol: refill its magazine and raise reserve to at least 24. Other weapons receive no death refill. Apply the normal next-round grenade grant once, capped at four. Spawn at a collision-free casino start marker; give 1.5 seconds of protection, canceled by firing or interacting.

Within each tick, resolve accepted actions, projectiles and damage, then deaths, then team defeat, then challenge/wave completion and respawns. If no living bodies remain, end the run immediately; a simultaneous last-zombie kill cannot rescue a wipe. Pending late arrivals and spectators do not count as living. Results freeze gameplay and discard unresolved wagers without refunds; a rematch creates a fresh run ID.

## Disconnects and menus

Disconnect immediately clears held input. For 30 seconds, a disconnected player's body remains stationary, vulnerable and eligible for enemy targeting while another client is connected. Their timers, regeneration and already-accepted actions follow normal simulation. Reconnecting attaches to that exact record, never a fresh loadout. After grace expires, retire a surviving body to dead/spectating without rewards; its inventory, chips, receipts and slot remain reserved until the run ends. Expired-grace reconnects cannot resume an old living body and wait for the next permitted respawn.

When every client is absent, freeze gameplay immediately: no movement, healing, cooldowns, casino timers or wave advancement. Connection deadlines use wall time and continue. Grace expiration still retires bodies and evaluates defeat even while gameplay is frozen. A returning client resumes a still-live run only after overdue disconnect deadlines are applied. Destroy an entirely unattended room after 120 seconds; after destruction, old reconnect credentials cannot restore it. This distinction prevents an individual disconnect from granting invulnerability or a reset.

Escape, tab blur, shop, poker and document dialogs release controls locally without pausing multiplayer or granting protection. Display “The game continues while this menu is open.” Server checks proximity on each purchase/swap; movement, death or lost access closes action dialogs. Read-only discovered documents remain available to spectators. A second connection using the same reconnect identity replaces its prior connection, never creates another body. Intentionally leaving has the same retained-slot rule as disconnecting during a run.

## Combat, economy and shared purchases

No teammate collision or friendly fire. Bullets and knives pass through teammate bodies; grenades ignore teammates but retain damage to their thrower. Each projectile preserves owner ID after death/disconnect, so damage and payouts still have an unambiguous recipient.

Keep existing weapon stats, reload behavior, regeneration, perks and upgrades initially. Credit each accepted enemy damage event using the existing solo payout formula to its attacker, and the final damaging attack receives the kill statistic. Do not introduce pooled chips, assist bonuses or duplicated team kill rewards. Hotel ambush enemies remain worth zero chips. Personal hit/headshot statistics and notifications derive from authoritative events.

Weapons, refills, upgrades and bar perks charge and benefit only the buyer. Door purchases open the lounge, shortcut, VIP, tables or hotel for everybody; the first accepted buyer pays the full current price. Preserve prerequisites, staff-side restriction and spawn grace periods. Repeated or simultaneous requests cannot charge twice. Broadcast the payer and newly opened area. Inventory grants do not automatically switch another player's weapon; use a personal unlock notification.

## Casino interactions

**Dice:** one unresolved roll occupies the shared table. Each player retains one paid wager per eligible round using the existing `wagerRound` convention. Charge once and record owner/outcome at acceptance. Only the owner receives the existing 500-chip win or round-specific slow curse. A disconnected/dead owner's result still settles against their retained record. Rejoining cannot clear wager eligibility. All players see the same roll.

**Roulette:** one unresolved spin occupies the shared wheel; results remain visible until the next accepted spin. Charge the owner once. Preserve existing number/reward probabilities and amounts. Capture the owner's selected weapon at acceptance for a single-weapon ammo reward; switching during the spin cannot redirect it. Maximum-ammo and jackpot rewards affect only that owner's owned weapons; a jackpot starts its personal damage-boost timer at resolution. Death/disconnect neither refunds nor rerolls. Timers continue during individual absence and stop only when the whole room freezes. A later spin cannot overwrite an unsettled reward.

**Poker:** each physical table has one shared persistent hand/deck/discard pile and one team swap per round, preserving the finite-deck challenge. Multiple players may inspect it. Swaps include the expected table revision; accept one eligible swap and reject stale requests without consuming another round. Opening a hand never redeals it. First flush completion unlocks the revolver for the team and grants it once to each admitted player. Completing the second table grants one revolver refill per admitted player. Record receipts before notifying; dead/disconnected records receive rewards normally. Later first-time spawns receive the unlocked revolver once, without replaying past refill events. Nobody must stay in a dialog to receive the reward.

## Hotel and optional mystery

The hotel door and jukebox are shared. Any eligible player can toggle the jukebox; serialize toggles and rate-limit each player to one accepted toggle per second. Volume remains local.

The bell requires every living player to be connected and inside the upstairs restaurant. Spectators are excluded. Ringing captures the participating identities; there is no extra ready-vote interface. A living participant leaving the restaurant fails the attempt. Death alone does not fail it while another participant remains alive inside; disconnect follows the vulnerable-body/grace rules. Regular spawning/intermission pauses for the challenge, while existing zombies keep attacking. Success requires the timer, finite spawn budget and ambush enemies all to finish; team defeat takes precedence. Failure requires clearing surviving ambush enemies before retrying. Success permanently unlocks the Tommy gun for this run and grants it once per player; later arrivals inherit the unlock. Refills remain personal purchases at the crate.

If the uncommitted mystery is integrated, clues, key and gallery gates become team progression. Preserve the ledger-before-suitcase-key requirement, lobby-floor interaction checks, and register prerequisite for supplies. Reading is local and never repeats discovery rewards. Change the current single cache claim into one claim per player per run: each eligible visitor receives the existing reserve-ammunition increase and up to two grenades, capped at four. A completely full inventory leaves that player's claim available until it can provide a benefit. Store claim receipts across death/disconnect. Show personal “collected” status; late arrivals may claim after reaching the unlocked cache. This intentional co-op adaptation avoids one teammate consuming the team's only supply opportunity.

## Enemies, fairness and remote characters

Target living bodies using reachable path distance on the layered map. Reevaluate every 0.3 seconds, immediately on target death, and otherwise switch only when a new target is at least 25% closer. Preserve the attack's original target through windup; do not redirect a pending hit to a passerby. Keep up to four player-target navigation fields, sharing static geometry and staggering updates. Never let proximity across a floor slab substitute for a reachable target or valid attack.

Initial balance proposal: at regular-wave start, freeze participant count `N` to that wave's living roster after scheduled entrants/respawns. Multiply wave count by `1 + 0.65*(N-1)`, rounded up; retain enemy health/speed and set concurrent cap to `14 + 4*(N-1)` (maximum 26). Divide spawn cadence by `sqrt(N)`, with a 0.25-second minimum. For hotel attempts use the captured participant count: budget `ceil(12*(1+0.5*(N-1)))`, cap `6+2*(N-1)`, existing 35-second duration. These are tuning hypotheses requiring two- and four-player playtests; disconnect never shrinks an already-created budget.

Normal spawn/unstuck candidates must be valid, reachable and at least eight/ten metres respectively from every living body. If no candidate qualifies, defer without consuming the spawn budget. Before release, test four players spread across all entrances: provide additional occluded spawn markers if this can indefinitely block progress. Do not silently relax minimum distance into a player's view.

Remote avatars need four recognizable colors, names, carried weapon, aim, walking/running, fire/reload/knife/throw and death poses, spatial gun/footstep audio, and teammate status HUD. Interpolate remote movement including floor height; display authoritative shared wounds, doors and casino results. Use simple coherent survivor models initially; first-person arms remain local.

These defaults are sufficient to implement without more product decisions. Future user choices are elective scope changes: revives, shared chips, friendly fire, active-run replacements, richer avatars, or changed difficulty. Review balance, casino throughput and the stricter team hotel entry requirement after actual co-op playtests.
