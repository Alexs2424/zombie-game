# Four-player co-op: network and hosting plan

Planning only, based on commit `2160dc2`. Documentation checked 2026-09-28. Every rate, timeout, limit, and performance budget below is a proposed starting value to validate, not a measured result.

## Recommended shape

Keep the existing Sites frontend and add **one persistent Node.js process running one private Colyseus room**, with at most four admitted player identities. Browsers download assets from the existing host and connect to the game service over HTTPS/WSS. No accounts, matchmaking, database, Redis, host migration, or multi-process scaling in this release.

The server owns movement, collisions, health, enemies, weapons, damage, rewards, purchases, randomness, doors, waves, and challenge progression. Browsers own input capture, camera, rendering, audio, HUD, and a predicted copy of local movement. Server state always wins. The organizer controls lobby actions but has no authority over simulation results.

[Colyseus state synchronization](https://docs.colyseus.io/state) supplies full initial state and property-level patches; messages carry requests and transient effects. Its [Node deployment guidance](https://docs.colyseus.io/deployment) covers compiled TypeScript, TLS proxies, health checks, and graceful shutdown. These remove useful plumbing, but the game's multiplayer rules still need implementation.

## Boundaries in this repository

[`simulation.ts`](../../lib/game/simulation.ts) already excludes browser APIs and uses a seeded generator. It still has one `player`, inventory, phase, and event list. [`runtime.ts`](../../lib/game/runtime.ts) currently owns a simulation, advances it at `1/60`, mutates it from input handlers, and drains events into audio/graphics. [`renderer.ts`](../../lib/game/renderer.ts) consumes that simulation directly. These are the main seams, not an already network-ready architecture.

Proposed ownership:

| Module | Responsibility |
| --- | --- |
| Shared game core | `WorldState`, `PlayerState`, world geometry, pure movement step, rules and command types; no Babylon/browser/server-framework imports. |
| Server room | Authoritative simulation, identity/room lifecycle, validation, state projection and event emission. |
| Client session | Transport, prediction, snapshot history, reconnect and command acknowledgements. |
| Render adapter | Read-only render frame containing local camera state plus interpolated teammates/enemies; no server simulation mutation. |

Keep a local-session adapter so existing solo play remains available. Do not serialize class methods, navigation caches, geometry, or graphics objects. Clients share versioned map data and receive authoritative dynamic state. Keep gameplay RNG server-owned; cosmetic randomness uses a separate stream.

## First spike and timing contract

Start with a **60 Hz fixed simulation and 20 Hz state patches**, matching the current movement step while reducing replication frequency. Browser rendering remains independent. Record tick cost, patch size, correction frequency and perceived response with four clients before committing to these rates.

Current official [Colyseus netcode documentation](https://docs.colyseus.io/netcode) describes fixed input, prediction and rewind APIs in 0.18+. P0 must verify compatible released server/SDK/schema package versions, pin them, and prove a small movement/reconnect example against those exact versions. Choose its prediction facilities if the spike fits this simulation. Otherwise retain Colyseus rooms/state and implement one thin, tested movement prediction adapter; do not maintain competing sequence/ack systems.

Each predicted fixed step has one input frame and one monotonic sequence. Its accepted sequence is acknowledged with authoritative state. Use framework sequence/ack metadata where supported; the fallback explicitly carries `inputSeq` and `lastProcessedInputSeq`. The server bounds queues and consumed movement time so flooding inputs cannot accelerate a player. Clamp accumulated catch-up work; sustained overload produces telemetry and degraded-service handling, never arbitrarily large physics steps. The [fixed-timestep contract](https://docs.colyseus.io/netcode/server-input) must be tested with idle inputs and reconnection, not inferred from a render loop.

## Wire contract

All client requests are schema validated. Resolve the actor from the authenticated connection, never a caller-supplied player ID.

| Direction | Logical payload |
| --- | --- |
| Join | Code, display name, `protocolVersion`, `simulationVersion`, `mapVersion`; optional private participant credential for returning identities. |
| Welcome | Stable `playerId`, `roomId`, `matchEpoch`, `connectionGeneration`, versions, rates, server tick and full state. |
| Movement input | Sequence metadata, forward/strafe, sprint, yaw/pitch, held-fire state; finite/clamped values only. |
| Discrete command | Epoch, connection generation, monotonic `commandId`, command kind and bounded arguments: reload, switch, knife, grenade, interact, buy, card swap, ready/start. |
| State | Tick, world phase, player/enemy/projectile maps, shared progression, authoritative personal inventory/economy and input acknowledgements. |
| Command result | Command ID, accepted/rejected and reason; resulting state remains canonical. |
| Effect event | Epoch, monotonic `eventId`, server tick, actor/target IDs, position, effect type, optional originating action ID. |

Apply discrete actions on the server tick with their referenced aim/input context where relevant. Validate that context belongs to this session; never apply a delayed grenade using a newly changed aim. Stable entity IDs last for the match; a new match changes epoch before IDs can repeat.

## Responsiveness, hits and effects

Predict only local movement using the shared collision/movement function and fixed timestep. On acknowledgement, restore authoritative movement state and replay only unacknowledged inputs. Smooth small visual corrections; snap on respawn/teleport or invalid penetration. Include surface/height, movement modifiers and door state in prediction dependencies. A newly opened door can legitimately cause a correction.

Interpolate teammates and enemies between snapshots, initially about **100 ms behind estimated server time**. Bound extrapolation and freeze stale remote poses instead of letting them run through walls. Time alignment comes from transport/server timing, not trusting the browser clock. React HUD updates can remain slower than motion rendering.

Show local muzzle flash/recoil immediately. Only the server consumes ammo, applies hits and grants rewards. It checks life state, equipped weapon, cadence, reload status, grenade stock, authoritative muzzle position, aim bounds, geometry and target hit volumes. A client never sends an accepted damage amount, hit target, wallet balance, or casino outcome. Friendly-fire rules come from the gameplay plan.

Start the combat spike with server-current hit tests. Test moving zombies at realistic latency before retaining that policy. If needed, add bounded hitscan rewind, initially capped at **200 ms**, using observed server/client timing and recorded hit volumes plus relevant world geometry. Never accept arbitrary client timestamps or rewind rewards, purchases, AI or grenade simulation. This is a scope gate, not an assumed framework checkbox.

Deduplicate effects by `(matchEpoch, eventId)` and correlate predicted effects with `(playerId, actionId)`. Prediction replay must not replay sound, recoil, rewards or particles. Transient events have bounded history; reconnect gets current state without replaying old gunshots. Put lasting facts and timed outcomes in state so a missed event cannot lose a kill reward or casino result.

## Admission and room lifecycle

The operator configures a private creation capability on the server and privately gives the organizer access. It is never embedded in the public bundle, normal URLs, or logs. Creating the only room is atomic; an active room returns `ROOM_BUSY`. No admin dashboard is required.

Generate a cryptographically random eight-character, unambiguous join code; normalize input and check it server-side. The code grants admission, not control of another player's identity. Do not expose room listings. Four admitted identities include disconnected reservations and spectators; framework socket capacity alone is insufficient. Late arrivals can occupy unused identity slots as spectators; no replacing a departed identity during that run.

Lifecycle: `lobby → playing/intermission → results → lobby/rematch`, with `closing` reachable on expiry or shutdown. Only the organizer starts/restarts; on explicit departure or grace expiry, transfer organizer privilege to the earliest-admitted connected participant, deferring transfer while nobody is connected. On return to the lobby, release absent identities and allow the organizer to remove guests before the next run. Reset readiness, increment match epoch, and refresh run-scoped participant credentials for admitted players at rematch. Old commands and credentials cannot enter that new run. Local menus and focus loss release controls without pausing teammates.

Individual disconnection immediately stops movement/fire; the body stays vulnerable while others play. Preserve inventory and earned rewards. Reserve active-player recovery for **30 seconds**, after which that player becomes dead/spectating. Returning with the same identity after this grace restores spectator status, not a fresh life. Apply the gameplay plan's between-round respawn rules.

If all clients disappear, freeze simulation immediately. Continue wall-clock grace/expiry accounting and dispose after **120 seconds** absent. On return, expire overdue player grace periods before evaluating team defeat, respawn, or advancing a wave. Resume without retroactive movement, damage, healing, or timer catch-up. A returning spectator does not resurrect another identity whose grace expired. Room disposal invalidates all codes and credentials.

## Reconnect identity and stale input

Use a server-issued opaque participant credential, scoped to this room/run, to identify returnees after the short transport reservation expires. Store it in browser session storage and rotate on successful identity reattachment. A valid reattachment atomically fences and replaces the prior connection; never allow two active connections controlling the same identity. Keep the credential separate from the public display name and join code. It is a bearer capability: possession grants reattachment, so avoid leakage rather than claiming it can distinguish a thief from its owner.

Within grace, use Colyseus's reserved-seat reconnection. The official [reconnection lifecycle](https://docs.colyseus.io/room/reconnection) provides a full state after reconnect and rotates its transport token; update the stored token. After grace, authenticate the participant credential through a fresh spectator connection. This application identity survives longer than the transport seat.

Every reattachment changes `connectionGeneration`; every rematch changes `matchEpoch`. Clear prediction/input buffers, apply full state and start a fresh input stream. Disable offline action buffering. Reject previous-generation/epoch messages, old sequences and impossible future sequences. Neutralize held movement/fire after **250 ms** without fresh input; never replay an offline burst on return.

Discrete command IDs have a monotonic high-water mark and a bounded result cache, initially 256 per identity/generation. Repeated retained IDs return their prior result; older evicted IDs are rejected without execution. Clear across generations only after fencing the old connection. An uncertain purchase is resolved from refreshed inventory/economy, not automatically resent under a new ID. Server validation and atomic apply prevent simultaneous door purchases charging twice.

## Hosting and release operation

[`vite.config.ts`](../../vite.config.ts) uses Sites/Vinext with Cloudflare Workers. Adding an ordinary Worker timer does not establish one shared, continuously running room. Keep frontend deployment independent and deploy compiled server JavaScript to one always-running Node service/container near the players. Start with one instance, automatic process restart, TLS termination, WebSocket upgrades, health/readiness endpoints and structured logs without credentials.

A managed Node web service is an option: [Render documents WebSocket support](https://render.com/docs/websocket), keepalives, and connection loss during instance replacement. This is a capability example, not a selected vendor or cost commitment. Disable scale-to-zero and multiple replicas; measure CPU/memory/bandwidth before choosing a paid size. No GPU is needed server-side.

Default routing uses the existing HTTPS frontend and a separate HTTPS/WSS game origin. Configure frontend `connect-src`, HTTP CORS, and an explicit WebSocket Origin allowlist; CORS alone does not authorize WebSockets. Alternatively a controlled reverse proxy can serve the frontend and proxy game HTTP/WebSocket paths under one origin. That requires verified proxy/hosting support, not an assumed Sites route.

Reject incompatible protocol/simulation/map versions before reserving a seat and show a reload message. Publish compatible assets before enabling a server version; pin both builds in release records. Block new rooms during planned maintenance, wait for the current run when practical, then notify and close gracefully within the host's shutdown window. Rolling replicas do not preserve an in-memory room.

**Process restart loses the run.** Reconnect is recovery from a broken connection to the surviving process, not crash recovery. Explain `RUN_ENDED` on a lost room and offer a new lobby. Persistent checkpoints and server failover are separate future projects.

The alternative is a Cloudflare Durable Object per room with custom transport/simulation integration. [Cloudflare's WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) documents coordinated connections, hibernation resetting in-memory state and timers preventing hibernation. That requires a separate lifecycle/cost spike and is not a drop-in Node Colyseus deployment.

## Bounds and acceptance gates

Validate finite numbers, enums, name length, message sizes and command rates; redact capabilities/codes from analytics. Proposed initial bounds: 4 KiB application messages, 120 input/messages per second per connection with limited bursts, separate tighter economic-action limits, and rate-limited code attempts. Measure normal traffic before enforcing disconnect thresholds. Bound input/history/event buffers and disconnect persistently slow consumers rather than growing memory. Remove production debug mutations and reject spectator actions.

Before implementation leaves prototype status, prove: the core imports in Node without browser dependencies; four browsers agree on shared state; fifth identities fail; jitter/reconnect never duplicates actions; stale packets cannot move/spend/fire; casino transactions remain atomic; actual deployed WSS works across browsers/networks; version mismatch is legible; all-absent expiry and process restart behave as documented. Instrument simulation cost, event-loop delay, bytes/second, correction distance, RTT/jitter, rejected commands and reconnect outcomes. Detailed scenarios and proposed performance thresholds belong in the validation plan.
