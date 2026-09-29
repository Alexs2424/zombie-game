# Four-player co-op validation plan

Planning only, against commit `2160dc2`. This document defines future acceptance criteria; it does not report a multiplayer implementation or passing multiplayer tests. Read alongside [the implementation plan](README.md), [networking and hosting](network-and-hosting.md), and [gameplay rules](gameplay-rules.md).

## Existing evidence and regression boundary

`package.json` requires Node >=22.13.0. Its existing `npm test` command uses Node's test runner and TypeScript stripping. Source inspection finds 12 `tests/*.test.mjs` files and 169 top-level test declarations; this is an inventory, not a fresh passing-test count. Historical README/playtest totals describe earlier revisions. No suite was rerun for this planning change.

Existing coverage includes solo movement, navigation, shots and wounds, ammo conservation, exact-once kills/purchases, pause-safe grenades, casino rewards, hotel challenges, audio scheduling, asset contracts, and layout. Preserve those expectations through the solo adapter, particularly solo pause, shop and poker behavior. Extend these tests with meaningful multi-actor invariants rather than duplicating each implementation detail.

`runtime.ts` currently advances simulation at 60 Hz inside the render loop and clears shared events after consuming them. Blur, hidden tabs, and pointer-lock loss pause it; `renderer.ts` disables background rendering. Co-op verification must prove independent server scheduling, per-client event delivery, and neutral local input when focus is lost. Four browser tabs on one computer cannot establish four-player responsiveness or rendering performance.

## Acceptance gates

| Gate | Required evidence before proceeding |
|---|---|
| A — solo-safe extraction | Existing tests/typecheck/lint/build pass. Deterministic one-player scenarios retain state transitions, currency, ammo, and rewards through the new simulation boundary. Ordinary solo play works with the multiplayer service offline. |
| B — authority and rooms | Four real protocol clients join one code; a fifth is refused. Invalid/expired codes, incompatible versions, unauthorized reconnects, duplicate identities, and concurrent room creation have specified results. Host departure leaves server authority intact. |
| C — playable combat | Four clients share enemies, doors and waves; independent inventory, no teammate damage/collision, self-grenade damage, spectating and next-wave spawning pass. Human play verifies immediate local feedback and understandable corrections. |
| D — complete interactions | Casino/hotel races below pass; local menus never freeze the room. Each existing accessible interaction has an explicit co-op outcome and observed feedback. |
| E — release candidate | Production build completes the transport soak and four-machine playtest, reconnect/version/deployment checks, and provisional budgets below. Record evidence and unresolved defects before release. |

Each gate records commit, protocol/content versions, server instance size, client hardware/browser, seed, player count, configured enemy cap, and observed result. A source-only test cannot satisfy a transport or human-play gate.

## Behavioral and race matrix

Drive deterministic authoritative tests with explicit server ticks, seeded randomness, and ordered command delivery. Exercise both orderings of simultaneous requests; no requirement depends on a browser winning by luck.

| Area | Cases and assertions |
|---|---|
| Combat/economy | Two lethal hits in one tick yield one death and one kill bonus; legal hit rewards belong to their actors. Repeat with shotgun pellets, knife, grenade and disconnected owner. Ammo, health and currency never become negative through accepted actions. Teammates neither block movement nor take friendly fire; the thrower retains self-damage. |
| Shared doors | Two affordable buyers request a locked door together: one debit, one unlock, one navigation rebuild outcome; loser retains chips. Repeat with insufficient funds, wrong floor, bad distance, locked prerequisite, stale revision, and retransmission. |
| Casino rewards | Competing dice/roulette requests create one unresolved operation and one accepted owner; settlement and debit happen once across death/reconnect. Verify owner-only rewards, captured roulette weapon, persistent results, personal wager limit, and no reconnect reroll. |
| Poker/hotel | Concurrent swaps against one table revision produce one accepted mutation. Shared unlocks grant exactly one appropriate receipt per admitted player, including late-spawn catch-up; duplicate snapshots never refill weapons. Bell admission requires all living bodies connected and upstairs; participant exit fails, individual death alone does not, and team wipe takes precedence. No hotel ambush chip farming. |
| Navigation/waves | Players on different floors and behind different doors remain valid independent targets. Dead/spectating players are excluded; disconnect bodies remain vulnerable during grace. Test target changes, blocked spawns, final kill plus disconnect/death, and one wave transition. Four players spread across entrances must not prevent spawning indefinitely. |
| Lifecycle | Death preserves the specified inventory/receipt state and spawns once next wave. Late join occupies only an unused seat and waits for the next wave. Restart clears match state and makes old commands/events harmless. |

Include every final gameplay decision in an assertion, including optional hotel mystery rewards if that feature ships. Tests should name the rule, not freeze accidental current behavior.

## Trust, reconnect and protocol checks

Exercise malformed/oversized payloads, NaN/infinite values, invalid enums, impossible movement, forged player IDs, claimed hits/currency, excessive fire rate, flood/burst input, and out-of-range purchases. Server-derived position, damage and balances remain authoritative; one misbehaving client cannot grow unbounded queues or stall others. Production must expose no development actions that grant chips, immunity, teleports or forced rewards.

Verify sequence acknowledgements, duplicate discrete commands, old connection generations, old match epochs, and event correlation. A duplicate retained command returns its recorded result without mutation; an evicted command below the high-water mark cannot execute again. Reconciliation replay must not resend purchases or replay sound, muzzle flashes, payouts or hit markers. Sequence gaps cannot permanently block valid future input; stale held movement/fire becomes neutral after the proposed 250 ms timeout. No offline action burst is accepted after reconnect.

Use boundary times around 30-second grace and 120-second empty-room expiry. During grace retain identity, position, damageability, inventory and reward receipts. After grace return as spectator, preserving the reserved identity slot for the run. An invalid/missing reconnect credential cannot reclaim another player; a valid replacement connection retires its predecessor without another body. All clients absent freezes simulation immediately while wall-clock grace/expiry continue. Grace expiration still retires bodies and evaluates defeat while frozen; apply overdue deadlines before resuming. No missed simulation time, healing or cooldown progress is replayed. Empty-room expiry and server restart show a clear ended-game state, not invented recovery.

Protocol/content incompatibility must fail before admission with a refresh message. Test new client/old server and old client/new server, including reconnect during deployment. Confirm shared level/collision versions; a visually correct but different map is not compatible. TLS WebSocket connection, allowed origin handling, room expiry, and join-rate limits require checks against the deployed endpoint.

## Transport and human play

Run four headless protocol clients over actual WebSockets for authority/load tests. An in-memory harness can reorder, duplicate or delay application commands to test defensive logic, but it does not model TCP behavior. WebSockets preserve message order on each connection; packet loss causes retransmission and stalled later messages. Use a network proxy or OS/network impairment for real bandwidth limits, RTT, jitter, stalls and reconnects. Label synthetic fault injection separately.

Minimum soak: 30 minutes after asset loading, across ordinary waves, maximum configured enemies, casino interactions and hotel ambush. Include baseline traffic; 100–150 ms RTT with jitter up to 50 ms; a 1–2 second delivery stall; restricted bandwidth; reconnect inside/outside grace; and simultaneous absence. Inject packet loss at the transport layer when available. Log authoritative ticks, accepted/rejected actions, queue depth, snapshot bytes, corrections and client acknowledgements without join credentials. Compare canonical replicated state at matching ticks after resynchronization, not wall-clock screenshots.

Then play on four actual machines with foreground browsers and real mouse capture, with at least two network paths to the hosted server. Check aiming, melee, grenade timing, teammate appearance, floors/doors, directional audio, menus under attack, spectating and round transitions. Deliberately background one client: the other three continue; returning clears stale input and recovers current state. Include a human listening/feel pass; headless success cannot demonstrate either. Existing development playtest controls supplement, but do not replace, ordinary input.

## Provisional ship budgets and commands

These are starting acceptance targets, not measurements or performance promises. Validate 60 Hz server simulation and 20 Hz snapshots before committing to them. On the declared server at maximum supported load, target tick work p95 <8 ms/p99 <16.7 ms, no growing tick debt, bounded input/event/history buffers, and no sustained post-warmup memory growth. Start with <100 KB/s downstream per player excluding assets. On the reference M3 Max, target median frame interval <=20 ms and p95 <=33.3 ms; separately identify the slowest supported client. Baseline prediction corrections should be p95 <0.25 world units, excluding explicit spawn/teleport transitions. Record results under impairment separately; persistent disagreement, duplicated rewards, crashes and unrecoverable room state block shipping regardless of averages.

Existing checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Future scripts for network integration, transport impairment and soak are proposed work, not commands available today. Release requires their reproducible instructions plus the four-machine evidence, a documented instance size, graceful service-offline behavior, and a rollback to the retained solo experience.
