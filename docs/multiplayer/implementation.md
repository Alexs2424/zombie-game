# Private co-op: current implementation

Status: **local first playable; Internet playtest pending**, recorded 2026-09-28. This file describes code on `codex/four-player-coop`, initially based on `d7b9c5a` from main. The other documents in this directory are the earlier, broader design proposal. They are not a list of completed features or passed release gates.

The branch adds a separate `/coop` route and one authoritative, in-memory game server for up to four players. Solo remains at `/`; its menu links to **PRIVATE CO-OP · PLAYTEST**. This is a local implementation, not a completed hosted multiplayer release.

## What is playable

- Create a room, share its eight-character code, and join with a temporary display name. One server supports one active room. Only its organizer can start or restart the run.
- Shared zombies, wave progression, projectiles, opened doors, and survival combat. Players have individual health, chips, inventories, reloads, grenades, perks, and weapon upgrades.
- Wall weapons/ammo, bartender purchases, upgrade station, the supported casino-area doors, hotel entrance, and stick/axe pickups. The server validates proximity, ownership, funds, and existing gameplay restrictions.
- Simple colored teammate bodies and nameplates, party health display, first-person controls, positional combat audio, and local sound/sensitivity settings.
- Death or late entry puts a player into spectating until the next wave, provided the team survives. Spectating follows a living connected teammate. Respawns retain personal equipment/chips, restore health and basic pistol ammunition, and grant a short protection window. A team wipe takes precedence over respawn.
- No teammate collision or friendly fire. Self-inflicted explosive damage remains possible.
- Escape, lost browser focus, and the bartender menu release that player's controls. **Combat continues and the player remains vulnerable.** Each player must click Enter/Resume to capture the mouse; the host starting the game cannot do this on their behalf.

Casino games, betting, poker, the mystery cabinet, hotel clues/secrets, and the hotel challenge/reward sequence are disabled in co-op. Attempting these interactions returns an explanation without charging chips. Their existing scenery and some interaction prompts remain visible. The supported hotel entrance opens shared traversal; it does not enable the hotel side systems. There are no accounts, voice/chat, public matchmaking, persistent progression, or campaign saves.

Wave counts and the enemy cap still use the solo tuning; party-size balancing remains follow-up work. Zombies select the nearest living player and retain that victim through an attack windup; more advanced target selection by reachable path distance is not implemented.

## Run locally

Use Node 24, the runtime used for this implementation's checks. `package.json` declares Node `>=22.13.0`; the server/test scripts use Node's `--experimental-strip-types`. Keep the TypeScript source available to that runtime.

From the worktree root, install dependencies once if needed:

```sh
npm ci
```

In one terminal, start the game server:

```sh
npm run coop:server
```

It listens on `127.0.0.1:2567` by default. In another terminal, start the browser frontend:

```sh
npm run dev -- --port 3012
```

Open [the local co-op page](http://127.0.0.1:3012/coop). Choose Create a room, enter a name, create it, then use its code in other tabs or browsers connected to the same server. Click Start as organizer, then Enter in each player's focused tab. Two tabs on one machine are useful for connection checks; multiple people/machines are needed to assess simultaneous controls and game feel.

The default browser endpoint uses the page's hostname and port `2567`, with `ws:` for HTTP pages and `wss:` for HTTPS pages. Advanced connection settings can override it. An HTTPS frontend rejects an insecure `ws:` endpoint. A local server bound only to `127.0.0.1` is not reachable by friends on another machine.

Health is available at [the local server health endpoint](http://127.0.0.1:2567/health); other ordinary HTTP paths return 404. Health reports protocol version, whether a room exists, and connected-player count, without credentials or the room code.

## Two computers on the same network

One computer runs both processes; your friend only needs a browser. Repository access is useful for development, but is not required to join a running game. Both computers must reach the same game server through the same trusted LAN, a configured private VPN, or a hosted server.

In the examples below, replace `192.168.1.50` with the host computer's LAN address and replace the host-key placeholder with your own private value. Run these from the repository root on that computer, after installing dependencies.

Terminal 1 — game server:

```sh
COOP_HOST=0.0.0.0 \
PORT=2567 \
COOP_HOST_KEY='replace-with-a-private-host-key' \
COOP_ALLOWED_ORIGINS='http://192.168.1.50:3012,http://localhost:3012,http://127.0.0.1:3012' \
npm run coop:server
```

Terminal 2 — frontend:

```sh
NEXT_PUBLIC_COOP_SERVER_URL='ws://192.168.1.50:2567' \
npm run dev -- --host 0.0.0.0 --port 3012
```

Both players open `http://192.168.1.50:3012/coop`. The organizer chooses Create a room and enters the private host key under Advanced connection, then shares the room code. The friend chooses Join a room and enters that code. After the organizer starts the run, each player clicks Enter in their own browser. The host computer must stay awake with both processes running; its firewall must permit the two ports on that private network.

If your friend prefers to run a frontend from their own checkout, they should use the same implementation revision and point Advanced connection at `ws://192.168.1.50:2567`, or set that value through `NEXT_PUBLIC_COOP_SERVER_URL` when starting their frontend. Their browser's exact frontend origin must appear in the host server's `COOP_ALLOWED_ORIGINS`. The example already includes `http://localhost:3012` and `http://127.0.0.1:3012`; add another origin if they use a different hostname or port, then restart the server between runs. They do not start a second game server to join this room.

These HTTP/WS commands are for private-network playtesting. For friends on separate networks, use a configured private VPN or the HTTPS/WSS hosting setup below. Sharing the repository or a room code alone does not make a local server reachable over the internet.

## Configuration

These are the current environment variables, not planned options. Server variables must be supplied to the server process or hosting environment; the standalone server does not load a dotenv file itself.

| Variable | Consumer | Default and purpose |
| --- | --- | --- |
| `COOP_HOST` | Server | `127.0.0.1`; use `0.0.0.0` when the platform needs a publicly reachable bind address. |
| `PORT` | Server | `2567`; bind port, including the platform-provided port where applicable. |
| `COOP_HOST_KEY` | Server | Empty locally. Private capability required to create a room when configured; players joining with a code do not need it. |
| `COOP_ALLOWED_ORIGINS` | Server | Empty locally. Comma-separated exact frontend origins, including scheme and non-default port, with no path or trailing slash. |
| `NEXT_PUBLIC_COOP_SERVER_URL` | Frontend | Optional default endpoint, for example `wss://game.example.com`. Supply when starting/building the frontend; this value is public. |

Binding a non-loopback server through the CLI requires both a host key and an origin allowlist. The default origin policy only admits loopback connections from local browser origins, plus local protocol-test clients. For a public reverse proxy, configure the key and actual allowed frontend origins even if Node itself binds loopback.

The UI accepts a host key under Advanced connection when creating a room. It is not written into browser session storage. Configure the key as a server secret and give it only to the organizer. The ordinary endpoint contains no credentials. A room code admits a new player; it does not reclaim someone else's identity.

For automated tests, `createCoopServer(options)` also accepts `now`, `autoTick`, `graceMs`, `emptyMs`, `hostKey`, `allowedOrigins`, and `onError`. Those injected clock/lifecycle controls are not public HTTP endpoints or CLI environment options. Importing the module does not start a listener.

## Actual architecture and deviations from the plan

The transport is **plain JSON over the `ws` package, version 8.21.0**, not Colyseus. There was no measured framework comparison or completed Colyseus compatibility spike. This implementation makes a narrow first playable possible, but takes ownership of room lifecycle, snapshots, validation, and reconnection itself. The older plan's Colyseus APIs and binary delta synchronization are not present.

| File | Current responsibility |
| --- | --- |
| [`server/coop-server.mjs`](../../server/coop-server.mjs) | HTTP health, WebSocket admission, room/identity management, input freshness, authoritative timer, limits, and snapshots. |
| [`lib/coop/protocol.ts`](../../lib/coop/protocol.ts) | Message shapes, `last-jackpot-coop-1` compatibility identifier, four-player cap, 60/20 Hz constants. |
| [`lib/coop/simulation.ts`](../../lib/coop/simulation.ts) | One world with per-player `Simulation` actors, explicit shared fields, supported commands, respawn/wipe policy, and presentation snapshots. |
| [`lib/game/simulation.ts`](../../lib/game/simulation.ts) | Shared combat rules split into player/world steps; multiplayer target selection and projectile ownership; solo still uses the same rules. |
| [`lib/coop/client.ts`](../../lib/coop/client.ts) | WebSocket client, session storage, bounded retries, and command transmission. |
| [`lib/coop/runtime.ts`](../../lib/coop/runtime.ts) | Input, limited prediction, server-state projection into the existing renderer, local UI/audio, and spectating. |
| [`lib/coop/remote-players.ts`](../../lib/coop/remote-players.ts) | Simple avatars and interpolation. |
| [`app/coop/page.tsx`](../../app/coop/page.tsx) | Connection/lobby flow, explicit pointer capture, HUD, menus, reconnect and results UI. |

The server advances fixed **1/60-second steps** and sends **20 full, per-player presentation snapshots per second**, not deltas. Its timer bounds catch-up work; those rates are configuration choices, not proven capacity claims. Browser input is sent during a run at approximately 30 Hz and on control changes. The server applies the latest valid input on its ticks, retains a quick trigger press until one tick consumes it, and neutralizes input older than 250 ms.

The client predicts local movement for at most 150 ms since the latest snapshot, then corrects from authoritative positions with visual smoothing. It does **not** replay unacknowledged inputs, provide full reconciliation, or implement the earlier deterministic input-per-tick contract. `acknowledgedInput` reports input consumed by the server; it is not a complete prediction-history protocol. Remote actors and enemies interpolate over roughly one 50 ms snapshot interval. There is no measured adaptive jitter buffer or hitscan rewind.

Shots, damage, rewards, muzzle feedback, and combat effects follow server-confirmed events. The client deduplicates event IDs; the server retains a bounded recent-event window. Immediate client-predicted firing effects from the original plan are not implemented. Real latency may therefore make shooting feel delayed; that is an explicit playtest and follow-up priority.

## Disconnects, room lifetime, and limits

Session credentials are scoped to the room and stored in `sessionStorage`. They support reconnect/reload in that browser session, rotate on attachment, and are distinct from the public room code. A brief prior-token fallback covers a dropped reconnect welcome only when no live socket owns the seat. Attaching a valid replacement fences the old socket. The client makes bounded automatic reconnect attempts and never queues uncertain purchases for replay.

A disconnected player stops moving/firing and remains vulnerable while teammates continue. After 30 seconds that player becomes dead/spectating; their identity remains reserved for the run. If everyone disconnects, simulation freezes immediately while wall-clock expiry continues. An empty room expires after 120 seconds. Returning after active-player grace preserves identity/equipment but grants no free life. Explicit Leave forfeits the active body immediately and removes the browser's saved credential.

Organizer control passes to the earliest-admitted connected participant after the former organizer explicitly leaves or their grace expires. A rematch removes disconnected identities, keeps connected participants, changes the run epoch, and resets the world. New admissions during a run fill unused slots as spectators; there is no mid-run replacement of reserved identities. New admissions into an ended run are rejected until its organizer restarts.

Current bounds include 4 KiB incoming messages, 16 open transport connections, a 120-message/second token bucket with a 240-message burst, six discrete actions/second with a 12-action burst, 24 admission attempts per minute per observed socket IP, and slow-consumer termination above 512 KB of queued server output. Discrete action IDs use a high-water mark and 64-result cache. Run epochs reject old-run inputs/actions, and socket ownership rejects detached senders. These are private-playtest safeguards, not a completed security/load audit. Behind a proxy, socket-IP throttling may aggregate users through the proxy address.

## Hosting requirements and recovery

The frontend may stay on its current Sites host. The game server needs a separate persistent Node process/container with WebSocket support, TLS termination for public WSS, an origin allowlist, health monitoring, and process supervision. Keep exactly one server instance; no Redis, external room registry, shared persistence, or replica routing exists. The existing Cloudflare Worker frontend is not the game-loop host. The server requires no graphics/GPU runtime.

Public deployment still needs provider selection, correct secure endpoint configuration, proxy upgrade/timeouts, and actual browser/network verification. Use an always-running service rather than scale-to-zero. Include `server/`, the imported `lib/` TypeScript sources, and production dependencies: `npm run coop:server` executes source through Node's type stripping, rather than a separately compiled server bundle. The frontend build remains its existing build/deployment process.

**Restarting or replacing the server loses the run.** There are no checkpoints, crash recovery, or host migration. SIGTERM/SIGINT closes the server and notifies connected clients; it does not drain a run to completion. Schedule updates between runs. Version validation uses one shared protocol string; there are no separate content/map hashes or backward-compatible mixed-version releases. Change the identifier for incompatible protocol/gameplay releases and deploy matching frontend/server revisions together.

## Verification and next gates

Recorded implementation-session evidence:

- The full suite passed **273 tests** after the shared simulation changes. A subsequent **nine-test server run** passed after host transfer, reconnect timeout, stale-run input, and quick-trigger fixes; these counts overlap and are not additive. The five client tests passed after the final browser-control changes.
- Full lint and type checking passed, with focused lint after the final server/metadata edits. The production build passed for `/` and `/coop` after the browser-control and route metadata changes.
- Two browser tabs created/joined one room, started together, displayed the shared roster and run, and reached the same game-over state while menus remained open.
- Focused Chrome successfully captured the mouse, rendered first-person gameplay, restarted a run, and confirmed a quick click reduced ammunition from 12 to 11. A grenade command also reduced the personal grenade count. Background/preview clicks correctly showed the mouse-capture error; testing pointer capture requires a focused browser and an actual click.

These are local smoke checks. A complete four-human combat run, bartender return-to-game flow, and Internet latency testing have not been verified in browsers.

Useful commands:

```sh
npm run typecheck
npm run lint
npm run test:coop
npm test
npm run build
```

The co-op tests cover authoritative state ownership, shared purchases, combat credit, AI targets, respawn/wipe ordering, real WebSocket admission, four-player capacity, replay/stale-input protection, expiry, token rotation, and client reconnect behavior. They do not demonstrate four-human combat quality or hosted performance.

Before wider use: finish four-player browser combat across machines, actual latency/jitter testing, long-run CPU/memory/bandwidth measurements, hosted WSS/restart checks, menu/focus/pointer-lock checks, and solo regression review. The older [validation plan](validation-plan.md) remains a useful target list, not completed evidence. Full reconciliation, responsive predicted weapon effects, bandwidth reduction, and the disabled side systems remain further implementation work.

## Integrating ongoing main changes

Keep this feature on `codex/four-player-coop` until its slice is reviewable. Group work into small focused commits for simulation hooks/tests, server/protocol, browser/UI, and operational documentation. Before integration, rebase onto the desired main revision and resolve changes deliberately. This work touches the shared simulation, menu entry, and package lock, so it is **not guaranteed conflict-free** while main develops.

Reconcile shared gameplay rules first: retain new solo behavior while preserving the single-world/per-player boundaries, projectile ownership, target selection, and menu semantics. Recheck the explicit shared/presentation field lists when main adds state. After resolving conflicts, rerun affected co-op and solo tests, typecheck/lint/build as appropriate, and repeat a browser smoke test. Keep experimental multiplayer changes out of unrelated solo/art commits; use the dedicated route to review and test both experiences independently.
