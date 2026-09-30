import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createCoopServer, parseInput, parseAction } from "../server/coop-server.mjs";
import { COOP_VERSION, idleInput } from "../lib/coop/protocol.ts";

async function fixture(t, options = {}) {
  let clock = 0;
  const server = createCoopServer({ autoTick: false, now: () => clock, ...options });
  const address = await server.listen(0);
  const clients = [];
  t.after(async () => { for (const c of clients) c.ws.terminate(); await server.close(); });
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}`);
    const messages = [], waiters = [];
    ws.on("error", () => {});
    ws.on("message", raw => {
      const message = JSON.parse(raw.toString());
      const index = waiters.findIndex(w => w.predicate(message));
      if (index < 0) messages.push(message);
      else { const waiter = waiters.splice(index, 1)[0]; clearTimeout(waiter.timer); waiter.resolve(message); }
    });
    const client = { ws, send: message => ws.send(JSON.stringify(message)), next(predicate) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve, timer: null };
        waiter.timer = setTimeout(() => { const i = waiters.indexOf(waiter); if (i >= 0) waiters.splice(i, 1); reject(new Error("Timed out waiting for protocol message")); }, 3000);
        waiters.push(waiter);
      });
    } };
    clients.push(client);
    await once(ws, "open");
    return client;
  };
  const create = async (name = "Host", hostKey) => {
    const c = await connect(); c.send({ type: "create", version: COOP_VERSION, name, hostKey });
    return { c, welcome: await c.next(m => m.type === "welcome") };
  };
  return { server, connect, create, advance(ms) { clock += ms; server.expire(); },
    tick(n = 1) { for (let i = 0; i < n; i++) { clock += 1000 / 60; server.step(); } } };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 15));

test("wire validation rejects nonfinite/forged actions and accepts bounded control input", () => {
  assert.equal(parseInput({ ...idleInput(), seq: 1, yaw: NaN }), null);
  assert.equal(parseInput({ ...idleInput(), seq: 1, forward: 2 }), null);
  assert.equal(parseInput({ ...idleInput(), seq: 1, fire: 1 }), null);
  assert.equal(parseInput({ ...idleInput(), seq: 1, wallet: 99999 }).wallet, undefined);
  assert.equal(parseAction({ kind: "hurt", damage: 100 }), null);
  assert.equal(parseAction({ kind: "switch", weapon: "invented" }), null);
});

test("four real sockets share a room, a fifth is refused and only creator starts", async t => {
  const f = await fixture(t);
  const { c: host, welcome } = await f.create();
  const others = [];
  for (let i = 0; i < 3; i++) {
    const c = await f.connect(); c.send({ type: "join", version: COOP_VERSION, name: `Friend ${i}`, code: welcome.room.code });
    others.push({ c, welcome: await c.next(m => m.type === "welcome") });
  }
  const fifth = await f.connect();
  fifth.send({ type: "join", version: COOP_VERSION, name: "Fifth", code: welcome.room.code });
  assert.equal((await fifth.next(m => m.type === "error")).code, "ROOM_FULL");
  others[0].c.send({ type: "start" });
  assert.equal((await others[0].c.next(m => m.type === "error")).code, "HOST_ONLY");
  host.send({ type: "start" });
  const running = await host.next(m => m.type === "room" && m.room.phase === "playing");
  assert.equal(running.room.players.length, 4);
  const a = f.server.room.game.players.get(welcome.playerId).sim;
  const b = f.server.room.game.players.get(others[0].welcome.playerId).sim;
  const startA = { ...a.player }, startB = { ...b.player };
  host.send({ type: "input", epoch: running.room.epoch, input: { ...idleInput(a.yaw, a.pitch), seq: 1, forward: 1 }, playerId: others[0].welcome.playerId });
  await flush(); f.tick(10);
  assert.notDeepEqual(a.player, startA);
  assert.deepEqual(b.player, startB, "supplied actor IDs cannot control somebody else");
  const snapA = await host.next(m => m.type === "snapshot" && m.snapshot.tick >= 3);
  const snapB = await others[0].c.next(m => m.type === "snapshot" && m.snapshot.tick === snapA.snapshot.tick);
  assert.deepEqual(snapA.snapshot.self.enemies, snapB.snapshot.self.enemies);
  assert.equal(snapA.snapshot.self.time, snapB.snapshot.self.time);
  assert.equal(snapA.acknowledgedInput, 1);
});

test("discrete actions are deduplicated, input expires and previous-run commands are refused", async t => {
  const f = await fixture(t);
  const { c, welcome } = await f.create();
  c.send({ type: "start" });
  const { room } = await c.next(m => m.type === "room" && m.room.phase === "playing");
  const sim = f.server.room.game.players.get(welcome.playerId).sim;
  const request = { type: "action", epoch: room.epoch, id: 1, action: { kind: "grenade" } };
  // A periodic lobby input may already be in flight when the host starts.
  c.send({ type: "input", epoch: room.epoch - 1, input: { ...idleInput(), seq: 1, forward: 1 } });
  c.send(request);
  const result = await c.next(m => m.type === "action-result" || m.type === "error");
  assert.equal(result.type, "action-result", "stale continuous input is silently discarded");
  assert.equal(result.ok, true);
  assert.equal(sim.grenades, 1);
  c.send(request);
  assert.equal((await c.next(m => m.type === "action-result")).ok, true);
  assert.equal(sim.grenades, 1);
  c.send({ type: "action", epoch: room.epoch - 1, id: 2, action: { kind: "grenade" } });
  assert.equal((await c.next(m => m.type === "error")).code, "STALE_RUN");
  c.send({ type: "input", epoch: room.epoch, input: { ...idleInput(sim.yaw, sim.pitch), seq: 1, forward: 1 } });
  await flush(); f.tick();
  f.advance(300);
  const position = { ...sim.player };
  f.tick(5);
  assert.deepEqual(sim.player, position, "stale movement must stop on the server");
});

test("reconnection preserves personal state, rotates credentials and fences the old socket", async t => {
  const f = await fixture(t);
  const { c: first, welcome } = await f.create();
  const sim = f.server.room.game.players.get(welcome.playerId).sim;
  sim.points = 817; sim.inventory.pistol.reserve = 19;
  const replacement = await f.connect();
  replacement.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  const next = await replacement.next(m => m.type === "welcome");
  assert.equal(next.playerId, welcome.playerId);
  assert.notEqual(next.token, welcome.token);
  assert.equal(next.snapshot.self.points, 817);
  assert.equal(next.snapshot.self.inventory.pistol.reserve, 19);
  await flush();
  assert.equal(f.server.room.members.size, 1);
  assert.equal(f.server.room.game.players.get(welcome.playerId).connected, true);
  assert.notEqual(first.ws.readyState, WebSocket.OPEN);
  const stolenOld = await f.connect();
  stolenOld.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  assert.equal((await stolenOld.next(m => m.type === "error")).code, "INVALID_SESSION");
});

test("a quick trigger press and release between server ticks fires once", async t => {
  const f = await fixture(t);
  const { c, welcome } = await f.create();
  c.send({ type: "start" });
  const { room } = await c.next(m => m.type === "room" && m.room.phase === "playing");
  const sim = f.server.room.game.players.get(welcome.playerId).sim;
  const before = sim.inventory.pistol.mag;
  const input = { ...idleInput(sim.yaw, sim.pitch), seq: 1, fire: true };
  c.send({ type: "input", epoch: room.epoch, input });
  c.send({ type: "input", epoch: room.epoch, input: { ...input, seq: 2, fire: false } });
  await flush(); f.tick();
  assert.equal(sim.inventory.pistol.mag, before - 1);
  f.tick(30);
  assert.equal(sim.inventory.pistol.mag, before - 1, "released trigger must not continue firing");
});

test("empty room freezes, grace expiry prevents free lives and room expires completely", async t => {
  const f = await fixture(t);
  const { c, welcome } = await f.create();
  c.send({ type: "start" }); await c.next(m => m.type === "room" && m.room.phase === "playing");
  f.tick(10);
  const tick = f.server.room.game.tick;
  c.ws.terminate(); await flush();
  f.tick(15);
  assert.equal(f.server.room.game.tick, tick);
  f.advance(30_001);
  assert.equal(f.server.room.game.players.get(welcome.playerId).sim.health, 0);
  assert.equal(f.server.room.game.phase, "ended");
  f.advance(90_000);
  assert.equal(f.server.room, null);
  const fresh = await f.connect();
  fresh.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  assert.equal((await fresh.next(m => m.type === "error")).code, "ROOM_NOT_FOUND");
});

test("creation capability and version checks protect admission", async t => {
  const f = await fixture(t, { hostKey: "test-only-creation-key" });
  const c = await f.connect();
  c.send({ type: "create", version: "old", name: "Host" });
  assert.equal((await c.next(m => m.type === "error")).code, "VERSION_MISMATCH");
  c.send({ type: "create", version: COOP_VERSION, name: "Host", hostKey: "wrong" });
  assert.equal((await c.next(m => m.type === "error")).code, "HOST_KEY_REQUIRED");
  assert.equal(f.server.room, null);
  c.send({ type: "create", version: COOP_VERSION, name: "Host", hostKey: "test-only-creation-key" });
  const welcome = await c.next(m => m.type === "welcome");
  assert.equal(welcome.room.players.length, 1);
});

test("a returning nonhost receives organizer control after the whole party expired", async t => {
  const f = await fixture(t);
  const { c: host, welcome } = await f.create();
  const guest = await f.connect();
  guest.send({ type: "join", version: COOP_VERSION, name: "Guest", code: welcome.room.code });
  const guestWelcome = await guest.next(m => m.type === "welcome");
  host.send({ type: "start" }); await host.next(m => m.type === "room" && m.room.phase === "playing");
  host.ws.terminate(); guest.ws.terminate(); await flush();
  f.advance(30_001);
  const returning = await f.connect();
  returning.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: guestWelcome.token });
  const resumed = await returning.next(m => m.type === "welcome");
  assert.equal(resumed.room.hostId, guestWelcome.playerId);
  assert.equal(resumed.room.phase, "ended");
  returning.send({ type: "start" });
  const next = await returning.next(m => m.type === "room" && m.room.phase === "playing");
  assert.equal(next.room.players.length, 1);
  assert.equal(next.room.players[0].alive, true);
});

test("a lost resume welcome can recover with the prior token only after its socket detaches", async t => {
  const f = await fixture(t);
  const { c, welcome } = await f.create();
  c.ws.terminate(); await flush();
  const emptyToken = await f.connect();
  emptyToken.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: "" });
  assert.equal((await emptyToken.next(m => m.type === "error")).code, "INVALID_SESSION");
  const dropped = await f.connect();
  dropped.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  await dropped.next(m => m.type === "welcome"); // Simulate loss before browser persistence.
  f.advance(10_500); // The client's normal handshake timeout must fit the recovery path.
  dropped.ws.terminate(); await flush();
  const recovery = await f.connect();
  recovery.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  const resumed = await recovery.next(m => m.type === "welcome");
  assert.equal(resumed.playerId, welcome.playerId);
  assert.notEqual(resumed.token, welcome.token);
  const oldConcurrent = await f.connect();
  oldConcurrent.send({ type: "resume", version: COOP_VERSION, code: welcome.room.code, token: welcome.token });
  assert.equal((await oldConcurrent.next(m => m.type === "error")).code, "INVALID_SESSION");
});
