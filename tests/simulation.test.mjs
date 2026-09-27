import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  RULES,
  PRICES,
  PURCHASES,
  SPAWNS,
  collides,
  moveActor,
  dist,
  waveStats,
} from "../lib/game/simulation.ts";
const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const tick = (s, seconds) => {
  for (let t = 0; t < seconds; t += 0.05) s.step(0.05, idle);
};
function quiet() {
  const s = new Simulation();
  s.start();
  s.intermission = 1e6;
  return s;
}
function enemy(x, z, health = 80) {
  return {
    id: 1,
    x,
    z,
    health,
    maxHealth: health,
    speed: 1.7,
    yaw: 0,
    attack: 0,
    cooldown: 0,
    stuck: 0,
    flash: 0,
    age: 0,
  };
}
function buy(s, id) {
  const p = PURCHASES.find((p) => p.id === id);
  s.player = { x: p.x, z: p.z };
  return s.purchase(id);
}

test("unaffordable purchases preserve all inventory and currency", () => {
  const s = quiet();
  s.points = 10;
  const before = JSON.stringify(s.inventory);
  assert.equal(buy(s, "shotgun"), false);
  assert.equal(s.points, 10);
  assert.equal(JSON.stringify(s.inventory), before);
});
test("doors charge exactly once and shortcut requires lounge access", () => {
  const s = quiet();
  s.points = 10000;
  assert.equal(buy(s, "shortcut"), false);
  assert.equal(s.points, 10000);
  assert.equal(buy(s, "lounge"), true);
  assert.equal(buy(s, "lounge"), false);
  assert.equal(s.points, 10000 - PRICES.lounge);
  assert.equal(buy(s, "shortcut"), true);
  assert.equal(buy(s, "shortcut"), false);
  assert.equal(s.points, 10000 - PRICES.lounge - PRICES.shortcut);
});
test("full reserve refuses payment; valid refill never grants extra magazine ammunition", () => {
  const s = quiet();
  s.points = 1000;
  assert.equal(buy(s, "pistolAmmo"), false);
  s.inventory.pistol.reserve = 0;
  s.inventory.pistol.mag = 2;
  assert.equal(buy(s, "pistolAmmo"), true);
  assert.equal(s.points, 850);
  assert.deepEqual(s.inventory.pistol, { owned: true, mag: 2, reserve: 84 });
});
test("upgrade requires shotgun, charges once, and cannot exceed magazine capacity", () => {
  const s = quiet();
  s.points = 10000;
  assert.equal(buy(s, "upgrade"), false);
  assert.equal(buy(s, "shotgun"), true);
  assert.equal(buy(s, "upgrade"), true);
  assert.equal(s.capacity("shotgun"), 9);
  assert.equal(s.inventory.shotgun.mag, 9);
  assert.equal(buy(s, "upgrade"), false);
  assert.equal(s.points, 7200);
});
test("reload conserves ammunition and pauses without advancing", () => {
  const s = quiet();
  s.inventory.pistol.mag = 2;
  s.inventory.pistol.reserve = 5;
  assert.equal(s.reload(), true);
  s.pause();
  tick(s, 3);
  assert.equal(s.reloadRemaining, 1.5);
  assert.equal(s.inventory.pistol.mag, 2);
  s.resume();
  tick(s, 1.6);
  assert.equal(s.inventory.pistol.mag, 7);
  assert.equal(s.inventory.pistol.reserve, 0);
});
test("switching cancels reload without duplicating rounds", () => {
  const s = quiet();
  s.points = 1000;
  buy(s, "shotgun");
  s.switchWeapon("pistol");
  s.inventory.pistol.mag = 0;
  s.reload();
  s.switchWeapon("shotgun");
  tick(s, 2);
  assert.equal(s.inventory.pistol.mag, 0);
  assert.equal(s.inventory.pistol.reserve, 84);
});
test("shotgun pellet deaths pay one reward and dead enemies cannot attack", () => {
  const s = quiet();
  s.player = { x: -12, z: -5 };
  s.yaw = 0;
  s.pitch = 0.01;
  s.inventory.shotgun = { owned: true, mag: 6, reserve: 30 };
  s.weapon = "shotgun";
  s.enemies = [enemy(-12, -3, 20)];
  s.enemies[0].attack = 0.01;
  const points = s.points;
  assert.equal(s.fire(), true);
  assert.equal(s.kills, 1);
  assert.equal(s.points, points + 100);
  tick(s, 0.05);
  assert.equal(s.health, 100);
  assert.equal(s.enemies.length, 0);
});
test("solid cover stops bullets and nearest living target receives the hit", () => {
  const s = quiet();
  s.player = { x: -7, z: -5 };
  s.yaw = 0;
  s.pitch = 0;
  s.enemies = [enemy(-7, 5)];
  s.fire();
  assert.equal(s.enemies[0].health, 80);
  s.player = { x: -12, z: -5 };
  s.enemies = [enemy(-12, 0), { ...enemy(-12, 4), id: 2 }];
  s.fireCooldown = 0;
  s.fire();
  assert.ok(s.enemies[0].health < 80);
  assert.equal(s.enemies[1].health, 80);
});
test("attack rechecks cover at contact and health has global grace between attackers", () => {
  const s = quiet();
  s.player = { x: 3.5, z: -4 };
  const e = enemy(4.5, -4);
  e.attack = 0.01;
  s.enemies = [e];
  tick(s, 0.05);
  assert.equal(s.health, 100);
  s.enemies = [enemy(3.2, -4), { ...enemy(3.1, -4), id: 2 }];
  s.enemies.forEach((e) => (e.attack = 0.01));
  tick(s, 0.05);
  assert.equal(s.health, 80);
  s.hurt(20);
  assert.equal(s.health, 80);
});
test("healing begins only after the no-damage delay", () => {
  const s = quiet();
  s.hurt(40);
  tick(s, 5);
  assert.equal(s.health, 60);
  tick(s, 1);
  assert.ok(s.health > 60 && s.health < 80);
});
test("closed doors and wall edges resist oversized movement deltas", () => {
  const s = quiet();
  const p = { x: 2, z: -4 };
  moveActor(p, 8, 0, 0.32, s.rects);
  assert.ok(p.x < 4);
  const q = { x: -12, z: -8 };
  moveActor(q, -100, -100, 0.32, s.rects);
  assert.equal(collides(q, 0.32, s.rects), false);
  s.lounge = true;
  s.refreshMap();
  const r = { x: 2, z: -4 };
  moveActor(r, 8, 0, 0.32, s.rects);
  assert.ok(r.x > 9);
});
test("every enabled spawn has a navigation route in all legal gate states", () => {
  for (const [lounge, shortcut] of [
    [false, false],
    [true, false],
    [true, true],
  ]) {
    const s = quiet();
    s.lounge = lounge;
    s.shortcut = shortcut;
    s.refreshMap();
    for (const target of [
      { x: -12, z: -5 },
      { x: -5, z: -4 },
      { x: 0, z: 0 },
      ...(lounge
        ? [
            { x: 12, z: -5 },
            { x: 11, z: 8 },
          ]
        : []),
    ]) {
      s.navigation.update(target);
      for (const p of SPAWNS.slice(0, lounge ? 4 : 3))
        assert.ok(
          s.navigation.distance[s.navigation.index(p)] >= 0,
          JSON.stringify({ target, p, lounge, shortcut }),
        );
    }
  }
});
test("radius-aware steering recovers the known slot-island corner case", () => {
  const s = quiet();
  s.player = { x: -5, z: -4 };
  s.enemies = [enemy(-14.7, 6)];
  s.health = 1e6;
  tick(s, 30);
  assert.ok(dist(s.enemies[0], s.player) < 1.3, JSON.stringify(s.enemies[0]));
});
test("behind-bar spawn stays inactive while lounge is shut and respects its opening delay", () => {
  const s = quiet();
  s.round = 1;
  s.waveRemaining = 10;
  s.player = { x: -9, z: -8 };
  for (let i = 0; i < 20; i++) {
    s.enemies = [];
    s.spawn();
    assert.ok(s.enemies.every((e) => e.x < 4));
  }
  s.lounge = true;
  s.loungeAge = 0;
  s.refreshMap();
  s.player = { x: -15, z: -10 };
  for (let i = 0; i < 20; i++) {
    s.enemies = [];
    s.spawn();
    assert.ok(s.enemies.every((e) => e.x < 4));
  }
});
test("round budgets resolve exactly, active cap holds, and five waves earn 6300 points", () => {
  const s = new Simulation();
  s.start();
  for (let i = 0; i < 20000 && s.round < 6; i++) {
    for (const e of s.enemies) s.damageEnemy(e, 10000, false);
    s.step(0.05, idle);
    assert.ok(s.enemies.length <= RULES.cap);
  }
  assert.equal(s.round, 6);
  assert.equal(s.kills, 63);
  assert.equal(s.earned, 6300);
  assert.equal(s.points, 6700);
});
test("new runs reset doors, timers, health, rewards, reload, and inventory across three cycles", () => {
  for (let i = 0; i < 3; i++) {
    let s = quiet();
    s.points = 10000;
    buy(s, "shotgun");
    buy(s, "upgrade");
    buy(s, "lounge");
    buy(s, "shortcut");
    s.reloadRemaining = 2;
    s.hurt(100);
    assert.equal(s.phase, "dead");
    s = new Simulation();
    assert.equal(s.phase, "ready");
    assert.equal(s.health, 100);
    assert.equal(s.points, 400);
    assert.equal(s.round, 0);
    assert.equal(s.enemies.length, 0);
    assert.equal(s.lounge, false);
    assert.equal(s.shortcut, false);
    assert.equal(s.upgraded, false);
    assert.equal(s.inventory.shotgun.owned, false);
    assert.equal(s.reloadRemaining, 0);
  }
});
test("five-round economy leaves an ammunition allowance after all progression buys", () => {
  const income =
    400 + [1, 2, 3, 4, 5].reduce((a, r) => a + waveStats(r).count * 100, 0);
  assert.equal(income - Object.values(PRICES).reduce((a, b) => a + b, 0), 1800);
});
