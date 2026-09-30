import test from "node:test";
import assert from "node:assert/strict";
import { CoopSimulation } from "../lib/coop/simulation.ts";
import { idleInput } from "../lib/coop/protocol.ts";
import { PURCHASES, PRICES, BAR_ANCHOR, RULES, dist } from "../lib/game/simulation.ts";

const enemy = (id, x, z, health = 80) => ({ id, x, y: 0, z, health, maxHealth: health,
  speed: 1.7, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 });
function room(count = 2) {
  const game = new CoopSimulation();
  for (let i = 0; i < count; i++) assert.equal(game.addPlayer(String(i), `Player ${i}`), true);
  game.start();
  const sims = [...game.players.values()].map(p => p.sim);
  sims[0].intermission = 1e6;
  sims.forEach((sim, index) => { sim.player = { x: -12, y: 0, z: -7 + index * 3 }; sim.random = () => 0.5; });
  return { game, sims };
}
const step = (game, seconds = 0.05, inputs = new Map()) => {
  for (let left = seconds; left > 1e-8; left -= 0.05) game.step(Math.min(left, 0.05), inputs);
};

test("four simultaneous inputs advance one shared world and each actor once", () => {
  const { game, sims } = room(4);
  assert.equal(game.addPlayer("extra", "Fifth"), false);
  sims[0].enemies = [enemy(1, -12, -1)];
  sims.forEach(sim => { sim.yaw = 0; sim.reloadRemaining = 1; });
  const before = sims.map(sim => ({ ...sim.player }));
  const inputs = new Map(sims.map((_, i) => [String(i), { ...idleInput(), strafe: 1 }]));
  game.step(.05, inputs);
  assert.equal(game.tick, 1);
  assert.equal(sims[0].time, .05);
  assert.equal(sims[0].enemies[0].age, .05);
  assert.equal(sims[0].intermission, 1e6 - .05);
  sims.forEach((sim, i) => {
    assert.equal(sim.enemies, sims[0].enemies);
    assert.equal(sim.reloadRemaining, .95);
    assert.ok(sim.player.x > before[i].x);
  });
});

test("health, reloads, inventory and earned chips belong to each actor", () => {
  const { game, sims: [a, b] } = room();
  a.hurt(20);
  a.inventory.pistol.mag = 5;
  assert.equal(game.action("0", { kind: "reload" }).ok, true);
  a.damageEnemy(enemy(1, -12, -5), 100, false);
  assert.equal(a.health, 80);
  assert.equal(b.health, 100);
  assert.equal(b.inventory.pistol.mag, 12);
  assert.equal(b.reloadRemaining, 0);
  assert.equal(b.points, 400);
  assert.ok(a.points > b.points);
  assert.notEqual(a.inventory, b.inventory);
});

test("simultaneous lethal swings award only one kill and one victim payout", () => {
  const { game, sims: [a, b] } = room();
  a.player = { x: -12, z: -7 }; b.player = { x: -11.9, z: -7 };
  a.yaw = b.yaw = 0;
  a.enemies = [enemy(1, -12, -5.8)];
  assert.equal(game.action("0", { kind: "knife" }).ok, true);
  assert.equal(game.action("1", { kind: "knife" }).ok, true);
  step(game, .25);
  assert.equal(a.kills + b.kills, 1);
  assert.equal(a.points + b.points, 858);
  assert.equal(a.enemies.length, 0);
  assert.equal(game.snapshot("0").events.filter(event => event.type === "kill").length, 1);
});

test("shared doors charge the first buyer once and rebuild every actor's map", () => {
  const { game, sims: [a, b] } = room();
  const door = PURCHASES.find(p => p.id === "lounge");
  a.player = { ...door }; b.player = { ...door };
  a.points = b.points = 5000;
  assert.equal(game.action("0", { kind: "purchase", purchase: "lounge" }).ok, true);
  assert.equal(game.action("1", { kind: "purchase", purchase: "lounge" }).ok, false);
  assert.equal(a.points, 5000 - PRICES.lounge);
  assert.equal(b.points, 5000);
  assert.equal(b.doorsOpen.lounge, true);
  assert.equal(a.rects, b.rects);
  assert.equal(b.rects.some(rect => rect.id === "lounge"), false);
});

test("bar menus keep the world and damage active while perks remain personal", () => {
  const { game, sims: [a, b] } = room();
  a.doorsOpen.lounge = true; a.refreshMap();
  a.player = { ...BAR_ANCHOR }; a.points = 5000;
  assert.equal(game.action("0", { kind: "purchase", purchase: "bartender" }).ok, true);
  assert.equal(a.shopOpen, true);
  assert.equal(a.phase, "playing");
  step(game, .1);
  assert.equal(a.time, .1);
  a.hurt(20);
  assert.equal(a.health, 80);
  assert.equal(game.action("0", { kind: "bar", item: "reserve" }).ok, true);
  assert.equal(a.maxHealth, 150);
  assert.equal(b.maxHealth, 100);
  a.inventory.shotgun.owned = true;
  assert.equal(game.action("0", { kind: "switch", weapon: "shotgun" }).ok, true);
  assert.equal(game.action("0", { kind: "bar", item: "weaponUpgrade" }).ok, true);
  assert.equal(a.upgrades.shotgun, true);
  assert.equal(a.upgrades.pistol, false);
  assert.equal(game.action("0", { kind: "close-menu" }).ok, true);
  assert.equal(a.shopOpen, false);
});

test("unsupported casino and hotel systems explicitly reject without charging", () => {
  const { game, sims: [a] } = room();
  for (const purchase of ["roulette", "craps", "poker-a", "hotelBell", "hotelLedger", "painting", "mystery"]) {
    const result = game.action("0", { kind: "purchase", purchase });
    assert.equal(result.ok, false);
    assert.match(result.reason, /not enabled/);
  }
  assert.equal(a.points, 400);
});

test("projectiles have unique IDs, tick once, credit owners and cause only self damage", () => {
  const { game, sims: [a, b] } = room();
  a.player = { x: -12, y: 0, z: -7 }; b.player = { ...a.player };
  assert.equal(game.action("0", { kind: "grenade" }).ok, true);
  assert.equal(game.action("1", { kind: "grenade" }).ok, true);
  assert.equal(new Set(a.projectiles.map(g => g.id)).size, 2);
  assert.deepEqual(a.projectiles.map(g => g.ownerId), ["0", "1"]);
  const second = a.projectiles[1];
  Object.assign(second, { x: -12, y: .1, z: -6, vx: 0, vy: 0, vz: 0, fuse: .01 });
  a.enemies = [enemy(1, -12, -6)];
  game.step(.05, new Map());
  assert.equal(a.projectiles.length, 1);
  assert.ok(Math.abs(a.projectiles[0].fuse - 2.15) < 1e-9);
  assert.equal(a.kills, 0);
  assert.equal(a.points, 400);
  assert.equal(a.health, 100);
  assert.equal(b.kills, 1);
  assert.ok(b.health < 100);
  const kill = game.snapshot("0").events.find(event => event.type === "kill");
  assert.equal(kill.actorId, "1");
});

test("flare fire persists after owner death and never damages teammates", () => {
  const { game, sims: [a, b] } = room();
  a.player = b.player = { x: -12, y: 0, z: -7 };
  a.hurt(100);
  a.fires = [{ ownerId: "0", id: 1, x: -12, y: .1, z: -7, remaining: 2, tick: 0, damage: 400 }];
  a.enemies = [enemy(1, -12, -6)];
  game.step(.05, new Map());
  assert.equal(a.kills, 1);
  assert.equal(b.health, 100);
  assert.equal(a.fires[0].remaining, 1.95);
  assert.equal(game.phase, "playing");
});

test("zombies choose different living players and lock their attack victim through windup", () => {
  const { game, sims: [a, b] } = room();
  a.player = { x: -12, z: -7 }; b.player = { x: -12, z: -3 };
  a.enemies = [enemy(1, -12, -6.2), enemy(2, -12, -3.8)];
  game.step(.01, new Map());
  assert.deepEqual(a.enemies.map(e => e.targetId), ["0", "1"]);
  assert.ok(a.enemies.every(e => e.attack > 0));
  b.player = { x: -12, z: -6.15 };
  step(game, RULES.attackWindup + .05);
  assert.equal(a.health, 80);
  assert.equal(b.health, 100);
});

test("dead connected players respawn on the next round with personal equipment; disconnected players wait", () => {
  const { game, sims: [a, b, c] } = room(3);
  a.points = 1234; a.inventory.shotgun.owned = true;
  a.inventory.pistol.mag = a.inventory.pistol.reserve = 0;
  a.hurt(100); c.hurt(100); game.setConnected("2", false);
  assert.equal(game.action("0", { kind: "grenade" }).ok, false);
  b.round = 1; b.intermission = .02;
  game.step(.05, new Map());
  assert.equal(game.phase, "playing");
  assert.equal(a.phase, "playing");
  assert.equal(a.health, 100);
  assert.equal(a.points, 1234);
  assert.equal(a.inventory.shotgun.owned, true);
  assert.equal(a.inventory.pistol.mag, a.capacity("pistol"));
  assert.equal(a.inventory.pistol.reserve, 24);
  assert.equal(a.invulnerable, 2);
  assert.equal(c.phase, "dead");
});

test("all-dead teams wipe before wave transition or late spectator respawn", () => {
  const { game, sims: [a, b] } = room();
  assert.equal(game.addPlayer("late", "Late arrival"), true);
  assert.equal(game.players.get("late").sim.phase, "dead");
  a.intermission = .01;
  a.hurt(100); b.hurt(100);
  game.step(.05, new Map());
  assert.equal(game.phase, "ended");
  assert.equal(a.round, 0);
  assert.equal(game.players.get("late").sim.phase, "dead");
  game.start();
  assert.equal(game.phase, "playing");
  assert.equal(game.players.get("late").sim.health, 100);
});

test("spawning excludes every living player's proximity", () => {
  const { game, sims } = room(4);
  sims[0].round = 1; sims[0].intermission = 0; sims[0].waveRemaining = 4; sims[0].spawnTimer = 0;
  game.step(.01, new Map());
  assert.equal(sims[0].enemies.length, 1);
  for (const sim of sims) assert.ok(dist(sim.player, sims[0].enemies[0]) > 7.9);
});

test("snapshot events have stable unique IDs and contain presentation state without internals or aliases", () => {
  const { game, sims: [a] } = room();
  game.action("0", { kind: "grenade" });
  const first = game.snapshot("0"), again = game.snapshot("0");
  assert.deepEqual(first.events.map(e => e.eventId), again.events.map(e => e.eventId));
  assert.equal(new Set(first.events.map(e => e.eventId)).size, first.events.length);
  for (const internal of ["navigation", "rects", "walkRects", "seed", "nextGrenadeId", "nextId", "events", "random"]) assert.equal(internal in first.self, false);
  first.self.inventory.pistol.mag = 0;
  assert.equal(a.inventory.pistol.mag, 12);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.equal(first.players.length, 2);
});


test("an expired player can reconnect as a spectator and rejoin on the next wave", () => {
  const { game, sims: [a, b] } = room();
  game.expirePlayer("0");
  assert.equal(a.phase, "dead");
  game.setConnected("0", true);
  assert.equal(a.phase, "dead");
  b.intermission = .01;
  game.step(.05, new Map());
  assert.equal(a.phase, "playing");
  assert.equal(a.health, 100);
});

test("a final self-grenade wipes the team before an imminent respawn", () => {
  const { game, sims: [a, b] } = room();
  a.health = 1;
  b.hurt(100);
  a.intermission = .01;
  a.projectiles = [{ ownerId: "0", id: 1, x: a.player.x, y: .1, z: a.player.z,
    vx: 0, vy: 0, vz: 0, fuse: .01 }];
  game.step(.05, new Map());
  assert.equal(game.phase, "ended");
  assert.equal(b.phase, "dead");
  assert.equal(a.round, 0);
});


test("every actor sees shared corpse collapse on its original floor, aged once per world tick", () => {
  const { game, sims } = room(4);
  const upper = { ...enemy(90, -12, -5, 50), y: 4, missing: { leftArm: true } };
  const ground = enemy(91, -12, -4, 50);
  sims[0].enemies = [upper, ground];
  sims[0].damageEnemy(upper, 100, false);
  sims[1].damageEnemy(ground, 100, false);
  sims[2].damageEnemy(upper, 100, false);
  assert.equal(sims[0].corpses.length, 2, "a dead enemy never creates a second body");
  sims[0].shopOpen = true;
  game.step(.05, new Map());
  for (const sim of sims) {
    assert.equal(sim.corpses, sims[0].corpses);
    assert.deepEqual(sim.corpses.map(corpse => corpse.age), [.05, .05]);
    assert.equal(sim.enemies.length, 0);
  }
  const visible = game.snapshot("3").self.corpses;
  assert.equal(visible.length, 2);
  assert.equal(visible[0].enemy.y, 4);
  assert.equal(visible[0].enemy.missing.leftArm, true);
  assert.equal(visible[1].enemy.y, 0);
  step(game, 4.5);
  assert.equal(sims[0].corpses.length, 2, "bodies survive into their fade");
  step(game, 1.55);
  assert.equal(game.snapshot("1").self.corpses.length, 0, "expired bodies disappear for everyone");
});
