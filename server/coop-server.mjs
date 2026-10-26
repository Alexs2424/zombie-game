import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { CoopSimulation } from "../lib/coop/simulation.ts";
import { COOP_VERSION, MAX_PLAYERS, SIMULATION_HZ, SNAPSHOT_HZ, idleInput } from "../lib/coop/protocol.ts";
import { WEAPON_ORDER, PURCHASES, PERKS } from "../lib/game/simulation.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const secret = () => randomBytes(32).toString("base64url");
const equalSecret = (a, b) => typeof a === "string" && typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const isSequence = value => Number.isSafeInteger(value) && value > 0;
const loopback = value => value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
const nameOf = value => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 20) : "";
const purchaseIds = new Set(PURCHASES.map(p => p.id));
const weaponIds = new Set(WEAPON_ORDER);
const barIds = new Set([...Object.keys(PERKS), "weaponUpgrade"]);

export function parseInput(value) {
  if (!isObject(value) || !isSequence(value.seq)) return null;
  if (![value.forward, value.strafe, value.yaw, value.pitch].every(Number.isFinite)) return null;
  if (Math.abs(value.forward) > 1 || Math.abs(value.strafe) > 1 || Math.abs(value.yaw) > 1e6 || Math.abs(value.pitch) > 1.3) return null;
  if (![value.sprint, value.fire, value.aim].every(v => typeof v === "boolean")) return null;
  return { seq: value.seq, forward: value.forward, strafe: value.strafe, yaw: value.yaw,
    pitch: value.pitch, sprint: value.sprint, fire: value.fire, aim: value.aim };
}

export function parseAction(value) {
  if (!isObject(value)) return null;
  switch (value.kind) {
    case "reload": case "knife": case "grenade": case "interact": case "close-menu":
      return { kind: value.kind };
    case "switch": return weaponIds.has(value.weapon) ? { kind: "switch", weapon: value.weapon } : null;
    case "purchase": return purchaseIds.has(value.purchase) ? { kind: "purchase", purchase: value.purchase } : null;
    case "bar": return barIds.has(value.item) && (value.weapon === undefined || weaponIds.has(value.weapon))
      ? { kind: "bar", item: value.item, weapon: value.weapon } : null;
    default: return null;
  }
}

/** One process owns one in-memory room. Importing this module never starts a listener. */
export function createCoopServer(options = {}) {
  const now = options.now ?? (() => performance.now());
  const graceMs = options.graceMs ?? 30_000;
  const emptyMs = options.emptyMs ?? 120_000;
  const hostKey = options.hostKey ?? "";
  const origins = new Set(options.allowedOrigins ?? []);
  let room = null;
  let closing = false;
  const connections = new Set();
  const ipAttempts = new Map();
  const http = createServer((req, res) => {
    if (req.url !== "/health") { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(closing ? 503 : 200).end(JSON.stringify({
      ok: !closing, version: COOP_VERSION, roomActive: Boolean(room),
      connectedPlayers: room ? [...room.members.values()].filter(m => m.socket).length : 0,
    }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const originAllowed = req => {
    const origin = req.headers.origin;
    if (origins.size) return typeof origin === "string" && origins.has(origin);
    if (!loopback(req.socket.remoteAddress)) return false;
    if (!origin) return true; // Local protocol tests and local command-line clients.
    try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname); }
    catch { return false; }
  };
  http.on("upgrade", (req, socket, head) => {
    if (closing || connections.size >= 16 || !originAllowed(req)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  });

  function send(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 512_000) { ws.terminate(); return; }
    ws.send(JSON.stringify(message));
  }
  const fail = (ws, errorCode, message) => send(ws, { type: "error", code: errorCode, message });
  function view() {
    return { code: room.code, hostId: room.hostId, epoch: room.epoch, phase: room.game.phase,
      players: room.game.snapshot(room.members.keys().next().value).players };
  }
  function broadcastRoom() {
    if (!room) return;
    const message = { type: "room", room: view() };
    for (const m of room.members.values()) if (m.socket) send(m.socket, message);
  }
  function transferHost() {
    if (!room) return false;
    const host = room.members.get(room.hostId);
    if (host?.socket || (host && host.disconnectedAt !== null && now() - host.disconnectedAt < graceMs)) return false;
    const next = [...room.members.values()].find(m => m.socket);
    if (next && room.hostId !== next.id) { room.hostId = next.id; return true; }
    return false;
  }
  function attach(conn, member, usedToken = "") {
    const old = member.socket;
    // A dropped welcome must not strand the browser with a just-rotated credential.
    // The prior credential is accepted briefly only when no live connection owns the seat.
    member.previousToken = usedToken;
    member.previousTokenUntil = 0;
    member.token = secret();
    member.socket = conn.ws;
    member.disconnectedAt = null;
    member.expired = false;
    const sim = room.game.players.get(member.id)?.sim;
    member.input = idleInput(sim?.yaw ?? 0, sim?.pitch ?? 0);
    member.pendingFire = false;
    member.lastInputAt = -Infinity;
    member.lastSequence = 0;
    member.acknowledgedInput = 0;
    conn.member = member;
    conn.attachedRoom = room;
    room.emptySince = null;
    room.game.setConnected(member.id, true);
    transferHost();
    if (old && old !== conn.ws) old.close(4001, "Session moved to another connection");
    send(conn.ws, { type: "welcome", playerId: member.id, token: member.token,
      room: view(), snapshot: room.game.snapshot(member.id) });
    broadcastRoom();
  }
  function admit(conn, name) {
    if (room.members.size >= MAX_PLAYERS) return fail(conn.ws, "ROOM_FULL", "This game already has four player slots, including reconnecting players.");
    if (room.game.phase === "ended") return fail(conn.ws, "RUN_ENDED", "This run has ended. Ask the creator to start a new lobby.");
    const id = randomUUID();
    if (!room.game.addPlayer(id, name)) return fail(conn.ws, "ROOM_FULL", "This game is full.");
    const member = { id, name, token: "", socket: null, disconnectedAt: null, expired: false,
      input: idleInput(), lastInputAt: -Infinity, lastSequence: 0, acknowledgedInput: 0 };
    room.members.set(id, member);
    if (!room.hostId) room.hostId = id;
    attach(conn, member);
  }
  function detach(conn, explicit = false) {
    const m = conn.member;
    if (!room || conn.attachedRoom !== room || !m || m.socket !== conn.ws) return;
    m.socket = null;
    if (explicit) m.previousToken = "";
    m.previousTokenUntil = explicit ? 0 : now() + 10_000;
    m.disconnectedAt = explicit ? now() - graceMs : now();
    m.input = idleInput(room.game.players.get(m.id)?.sim.yaw, room.game.players.get(m.id)?.sim.pitch);
    m.pendingFire = false;
    room.game.setConnected(m.id, false);
    if (explicit) { room.game.expirePlayer(m.id); m.expired = true; }
    if (![...room.members.values()].some(p => p.socket)) room.emptySince = now();
    transferHost();
    broadcastRoom();
  }
  function allowAdmission(conn) {
    const at = now();
    let entry = ipAttempts.get(conn.ip);
    if (!entry || at - entry.at > 60_000) entry = { at, count: 0 };
    entry.count++;
    ipAttempts.set(conn.ip, entry);
    return entry.count <= 24;
  }
  function onMessage(conn, raw) {
    const at = now();
    conn.tokens = Math.min(240, conn.tokens + Math.max(0, at - conn.tokenTime) * .12);
    conn.tokenTime = at;
    if (--conn.tokens < 0) { conn.ws.close(4008, "Message rate exceeded"); return; }
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return fail(conn.ws, "BAD_MESSAGE", "Invalid message."); }
    if (!isObject(msg) || typeof msg.type !== "string") return fail(conn.ws, "BAD_MESSAGE", "Invalid message.");
    if (["create", "join", "resume"].includes(msg.type)) {
      if (conn.member) return fail(conn.ws, "ALREADY_JOINED", "Leave the current game first.");
      if (!allowAdmission(conn)) { conn.ws.close(4008, "Too many join attempts"); return; }
      if (msg.version !== COOP_VERSION) return fail(conn.ws, "VERSION_MISMATCH", "The game and server versions differ. Refresh the game.");
      expire();
      if (msg.type === "create") {
        if (hostKey && !equalSecret(msg.hostKey, hostKey)) return fail(conn.ws, "HOST_KEY_REQUIRED", "Enter the private host key to create a game.");
        if (room) return fail(conn.ws, "ROOM_BUSY", "A game already exists on this server. Join it with its code.");
        const name = nameOf(msg.name);
        if (!name) return fail(conn.ws, "NAME_REQUIRED", "Enter a player name.");
        room = { code: code(), hostId: "", epoch: 0, game: new CoopSimulation(), members: new Map(), emptySince: null };
        return admit(conn, name);
      }
      if (!room || typeof msg.code !== "string" || msg.code.trim().toUpperCase() !== room.code)
        return fail(conn.ws, "ROOM_NOT_FOUND", "That game code is not active. Check the code or create a new game.");
      if (msg.type === "resume") {
        const member = [...room.members.values()].find(m => equalSecret(msg.token, m.token) ||
          (!m.socket && m.previousToken && now() <= m.previousTokenUntil && equalSecret(msg.token, m.previousToken)));
        if (!member) return fail(conn.ws, "INVALID_SESSION", "That saved session has expired. Join a new game with its code.");
        return attach(conn, member, msg.token);
      }
      const name = nameOf(msg.name);
      if (!name) return fail(conn.ws, "NAME_REQUIRED", "Enter a player name.");
      return admit(conn, name);
    }
    const m = conn.member;
    if (!room || conn.attachedRoom !== room || !m || m.socket !== conn.ws)
      return fail(conn.ws, "NOT_JOINED", "Join a game first.");
    if (msg.type === "leave") { detach(conn, true); conn.ws.close(1000, "Left game"); return; }
    if (msg.type === "start") {
      if (room.hostId !== m.id) return fail(conn.ws, "HOST_ONLY", "Only the game creator can start a round.");
      if (room.game.phase === "playing") return fail(conn.ws, "ALREADY_PLAYING", "The game is already running.");
      // A rematch starts a fresh roster and fences commands sent for the previous run.
      for (const [id, player] of room.members) if (!player.socket) { room.members.delete(id); room.game.players.delete(id); }
      room.epoch++;
      room.game.start();
      for (const player of room.members.values()) {
        player.input = idleInput(room.game.players.get(player.id)?.sim.yaw, room.game.players.get(player.id)?.sim.pitch);
        player.pendingFire = false;
        player.lastInputAt = -Infinity;
      }
      broadcastRoom();
      broadcastSnapshots();
      return;
    }
    if (msg.epoch !== room.epoch) {
      // Continuous controls can cross a start/rematch broadcast in flight. Discard
      // them without surfacing an error; discrete actions still need a rejection.
      if (msg.type === "input") return;
      return fail(conn.ws, "STALE_RUN", "This action belongs to a previous run.");
    }
    if (msg.type === "input") {
      const input = parseInput(msg.input);
      if (!input) return fail(conn.ws, "BAD_INPUT", "Invalid player input.");
      if (input.seq <= m.lastSequence) return;
      // Preserve a quick trigger tap even when press and release both arrive
      // between simulation ticks. The simulation still owns ammo and cooldowns.
      if (input.fire && !m.input.fire) m.pendingFire = true;
      m.lastSequence = input.seq; m.input = input; m.lastInputAt = at;
      return;
    }
    if (msg.type === "action") {
      if (!isSequence(msg.id)) return fail(conn.ws, "BAD_ACTION", "Invalid action identifier.");
      if (conn.results.has(msg.id)) return send(conn.ws, conn.results.get(msg.id));
      if (msg.id <= conn.lastAction) return send(conn.ws, { type: "action-result", id: msg.id, ok: false, reason: "This action has already been processed." });
      conn.lastAction = msg.id;
      conn.actionTokens = Math.min(12, conn.actionTokens + Math.max(0, at - conn.actionTime) * .006);
      conn.actionTime = at;
      const action = parseAction(msg.action);
      const result = !action ? { ok: false, reason: "Unknown action." }
        : --conn.actionTokens < 0 ? { ok: false, reason: "Too many actions. Try again shortly." }
        : room.game.action(m.id, action);
      const response = { type: "action-result", id: msg.id, ...result };
      conn.results.set(msg.id, response);
      if (conn.results.size > 64) conn.results.delete(conn.results.keys().next().value);
      send(conn.ws, response);
      return;
    }
    fail(conn.ws, "BAD_MESSAGE", "Unknown message type.");
  }

  wss.on("connection", (ws, req) => {
    const at = now();
    const conn = { ws, ip: req.socket.remoteAddress, member: null, attachedRoom: null, createdAt: at,
      tokens: 240, tokenTime: at, actionTokens: 12, actionTime: at, lastAction: 0, results: new Map(), pongAt: at };
    connections.add(conn);
    ws.on("pong", () => { conn.pongAt = now(); });
    ws.on("message", raw => {
      try { onMessage(conn, raw); }
      catch (error) { options.onError?.(error); fail(ws, "SERVER_ERROR", "The server could not process this action."); }
    });
    ws.on("error", () => {});
    ws.on("close", () => { connections.delete(conn); detach(conn); });
  });

  function expire() {
    const at = now();
    for (const [ip, entry] of ipAttempts) if (at - entry.at > 60_000) ipAttempts.delete(ip);
    if (!room) return;
    let changed = false;
    for (const m of room.members.values()) {
      if (!m.socket && !m.expired && m.disconnectedAt !== null && at - m.disconnectedAt >= graceMs) {
        room.game.expirePlayer(m.id); m.expired = true; changed = true;
      }
    }
    changed = transferHost() || changed;
    if (room.emptySince !== null && at - room.emptySince >= emptyMs) { room = null; return; }
    if (changed) broadcastRoom();
  }
  function broadcastSnapshots() {
    if (!room) return;
    for (const m of room.members.values()) if (m.socket) send(m.socket, {
      type: "snapshot", snapshot: room.game.snapshot(m.id), acknowledgedInput: m.acknowledgedInput,
    });
  }
  let steps = 0;
  function step() {
    expire();
    if (!room || ![...room.members.values()].some(m => m.socket)) return;
    const before = room.game.phase;
    const inputs = new Map();
    for (const m of room.members.values()) {
      const s = room.game.players.get(m.id)?.sim;
      const fresh = m.socket && now() - m.lastInputAt <= 250;
      inputs.set(m.id, fresh ? { ...m.input, fire: m.input.fire || m.pendingFire } : idleInput(s?.yaw, s?.pitch));
      m.pendingFire = false;
      if (fresh) m.acknowledgedInput = m.input.seq;
    }
    room.game.step(1 / SIMULATION_HZ, inputs);
    if (before !== room.game.phase) broadcastRoom();
    if (++steps % (SIMULATION_HZ / SNAPSHOT_HZ) === 0) broadcastSnapshots();
  }
  let lastTime = now();
  let debt = 0;
  let lastPing = now();
  function pump() {
    const at = now();
    debt += Math.min(100, Math.max(0, at - lastTime)); lastTime = at;
    let catches = 0;
    while (debt >= 1000 / SIMULATION_HZ && catches++ < 6) { step(); debt -= 1000 / SIMULATION_HZ; }
    if (at - lastPing >= 5_000) {
      lastPing = at;
      for (const conn of connections) {
        if ((!conn.member && at - conn.createdAt > 15_000) || at - conn.pongAt > 15_000) conn.ws.terminate();
        else conn.ws.ping();
      }
    }
  }
  const timer = options.autoTick === false ? null : setInterval(pump, 8);
  timer?.unref();
  return {
    http, wss, step, expire, get room() { return room; },
    async listen(port = 2567, host = "127.0.0.1") {
      await new Promise((resolve, reject) => { http.once("error", reject); http.listen(port, host, resolve); });
      return http.address();
    },
    async close() {
      closing = true;
      if (timer) clearInterval(timer);
      for (const conn of connections) { fail(conn.ws, "SERVER_CLOSED", "The game server has stopped. This run has ended."); conn.ws.terminate(); }
      await new Promise(resolve => wss.close(resolve));
      if (http.listening) await new Promise(resolve => http.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.COOP_HOST ?? "127.0.0.1";
  const hostKey = process.env.COOP_HOST_KEY ?? "";
  const allowedOrigins = (process.env.COOP_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!["127.0.0.1", "localhost", "::1"].includes(host) && (!hostKey || !allowedOrigins.length)) {
    throw new Error("A non-local server requires COOP_HOST_KEY and COOP_ALLOWED_ORIGINS.");
  }
  const server = createCoopServer({ hostKey, allowedOrigins, onError: error => console.error(error) });
  const address = await server.listen(Number(process.env.PORT ?? 2567), host);
  console.log(`Last Jackpot co-op server: ${host}:${address.port} (${COOP_VERSION})`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
}
