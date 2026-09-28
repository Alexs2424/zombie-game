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
  hasSight,
  WEAPONS,
  PERKS,
  BAR_ANCHOR,
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
test("workshop requires VIP, charges once, and upgrades the equipped weapon", () => {
  const s = quiet();
  s.points = 10000;
  assert.equal(buy(s, "upgrade"), false);
  assert.equal(buy(s, "shotgun"), true);
  assert.equal(buy(s, "upgrade"), false);
  assert.equal(buy(s, "lounge"), true);
  assert.equal(buy(s, "vip"), true);
  assert.equal(buy(s, "upgrade"), true);
  assert.equal(s.capacity("shotgun"), 9);
  assert.equal(s.inventory.shotgun.mag, 9);
  assert.equal(buy(s, "upgrade"), false);
  assert.equal(s.points, 5000);
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
  for (const [lounge, shortcut, vip] of [
    [false, false, false],
    [true, false, false],
    [true, true, false],
    [true, false, true],
    [true, true, true],
  ]) {
    const s = quiet();
    s.lounge = lounge;
    s.shortcut = shortcut;
    s.vip = vip;
    s.loungeAge = s.vipAge = 4;
    s.refreshMap();
    for (const target of [
      { x: -12, z: -5 },
      { x: -5, z: -4 },
      { x: 0, z: 0 },
      ...(vip
        ? [
            { x: 25, z: 9.5 },
            { x: 19, z: -3 },
            { x: 25, z: -3 },
            { x: 22, z: 0 },
            { x: 19, z: 5 },
            { x: 25, z: 5 },
          ]
        : []),
      ...(lounge
        ? [
            { x: 12, z: -5 },
            { x: 11, z: 8 },
          ]
        : []),
    ]) {
      s.navigation.update(target);
      for (const p of SPAWNS.filter((_, i) => s.spawnEnabled(i)))
        assert.ok(
          s.navigation.distance[s.navigation.index(p)] >= 0,
          JSON.stringify({ target, p, lounge, shortcut, vip }),
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
    buy(s, "lounge");
    buy(s, "vip");
    buy(s, "upgrade");
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
    assert.equal(s.vip, false);
    assert.equal(s.vipAge, 0);
    assert.equal(s.upgraded, false);
    assert.equal(s.inventory.shotgun.owned, false);
    assert.equal(s.reloadRemaining, 0);
  }
});
test("five-round shotgun route leaves an ammunition allowance after the original three unlocks", () => {
  const income =
    400 + [1, 2, 3, 4, 5].reduce((a, r) => a + waveStats(r).count * 100, 0);
  assert.equal(
    income -
      ["shotgun", "lounge", "shortcut", "vip", "upgrade"].reduce(
        (sum, id) => sum + PRICES[id],
        0,
      ),
    500,
  );
});

test("VIP purchase requires lounge and enough points, opens both gates, and charges once", () => {
  const s = quiet();
  s.points = 10000;
  assert.equal(buy(s, "vip"), false);
  buy(s, "lounge");
  const before = s.points;
  s.points = 1299;
  assert.equal(buy(s, "vip"), false);
  assert.equal(s.vip, false);
  s.points = before;
  for (const z of [-4.1, 8.6]) {
    const p = { x: 14, z };
    moveActor(p, 5, 0, 0.32, s.rects);
    assert.ok(p.x < 16);
    assert.equal(hasSight({ x: 14, z }, { x: 19, z }, s.rects), false);
  }
  assert.equal(buy(s, "vip"), true);
  assert.equal(s.points, before - PRICES.vip);
  assert.equal(buy(s, "vip"), false);
  assert.equal(s.points, before - PRICES.vip);
  for (const z of [-4.1, 8.6]) {
    const p = { x: 14, z };
    moveActor(p, 5, 0, 0.32, s.rects);
    assert.ok(p.x > 18.9);
    assert.equal(hasSight({ x: 14, z }, { x: 19, z }, s.rects), true);
  }
});
test("VIP spawn obeys its own unlock delay and expanded world has solid boundaries", () => {
  const s = quiet();
  s.lounge = true;
  s.loungeAge = 10;
  assert.equal(s.spawnEnabled(4), false);
  s.vip = true;
  s.vipAge = 0;
  s.refreshMap();
  assert.equal(s.spawnEnabled(4), false);
  tick(s, 3.1);
  assert.equal(s.spawnEnabled(4), true);
  const p = { x: 25, z: -8 };
  assert.equal(collides(p, 0.32, s.rects), false);
  moveActor(p, 20, 0, 0.32, s.rects);
  assert.ok(p.x < 28 && p.x > 27);
});
test("zombies navigate into VIP past both poker islands", () => {
  const s = quiet();
  s.lounge = s.vip = true;
  s.player = { x: 25, z: 9.5 };
  s.refreshMap();
  s.enemies = [enemy(14, -4.1)];
  s.health = 1e6;
  tick(s, 40);
  assert.ok(dist(s.enemies[0], s.player) < 1.3, JSON.stringify(s.enemies[0]));
});

test("low poker tables force pursuit around the table, rather than into it", () => {
  for (const [from, to] of [
    [-6, 0],
    [2, 8],
  ]) {
    const s = quiet();
    s.lounge = s.vip = true;
    s.player = { x: 22, z: to };
    s.refreshMap();
    s.enemies = [enemy(22, from)];
    tick(s, 18);
    assert.ok(dist(s.enemies[0], s.player) < 1.3, JSON.stringify(s.enemies[0]));
  }
});
test("stuck-enemy recovery cannot relocate into a locked or just-opened VIP room", () => {
  for (const vip of [false, true]) {
    const s = quiet();
    s.lounge = true;
    s.loungeAge = 10;
    s.vip = vip;
    s.vipAge = 0;
    s.player = { x: 10, z: -4 };
    s.refreshMap();
    const stuck = { ...enemy(-7, 0), stuck: 8 };
    s.enemies = [
      stuck,
      ...SPAWNS.slice(0, 4).map((p, i) => ({
        ...enemy(p.x, p.z),
        id: i + 2,
        speed: 0,
      })),
    ];
    s.step(0.05, idle);
    assert.ok(stuck.x < 16, JSON.stringify(stuck));
  }
});

function bar(s) {
  s.lounge = true;
  s.refreshMap();
  s.player = { ...BAR_ANCHOR };
  assert.equal(s.openBar(), true);
}

test("new weapons require their rooms, keep separate ammo, and refill reserve only", () => {
  const s = quiet();
  s.points = 20000;
  for (const id of ["smg", "rifle"]) assert.equal(buy(s, id), false);
  s.switchWeapon("rifle");
  assert.equal(s.weapon, "pistol");
  buy(s, "lounge");
  assert.equal(buy(s, "smg"), true);
  assert.equal(s.weapon, "smg");
  assert.deepEqual(s.inventory.smg, { owned: true, mag: 30, reserve: 180 });
  buy(s, "vip");
  assert.equal(buy(s, "rifle"), true);
  for (const id of ["smg", "rifle"]) {
    s.switchWeapon(id);
    const before = s.points;
    assert.equal(buy(s, id), false);
    s.inventory[id].mag = 2;
    s.inventory[id].reserve = 0;
    assert.equal(buy(s, id), true);
    assert.equal(s.points, before - WEAPONS[id].refill);
    assert.equal(s.inventory[id].mag, 2);
    assert.equal(s.inventory[id].reserve, WEAPONS[id].reserve);
  }
  assert.deepEqual(s.inventory.pistol, { owned: true, mag: 12, reserve: 84 });
});

test("bar requires an open lounge, range, sight, and an active shop session", () => {
  const s = quiet();
  s.points = 10000;
  s.player = { ...BAR_ANCHOR };
  assert.equal(s.openBar(), false);
  s.lounge = true;
  s.refreshMap();
  s.player = { x: 12, z: -9.4 };
  assert.equal(s.canUseBar(), false); // Counter blocks the back approach.
  s.player = { x: 8, z: -6 };
  assert.equal(s.openBar(), false);
  s.player = { ...BAR_ANCHOR };
  assert.equal(s.purchaseBar("reserve"), false);
  assert.equal(s.openBar(), true);
  s.resume();
  assert.equal(s.phase, "paused");
  const before = s.points;
  s.player = { x: 5, z: -4 };
  assert.equal(s.purchaseBar("reserve"), false);
  assert.equal(s.points, before);
  s.closeBar();
  s.resume();
  assert.equal(s.phase, "playing");
});

test("bartender pauses the entire simulation and House Reserve preserves missing health", () => {
  const s = quiet();
  s.points = 10000;
  s.health = 60;
  s.inventory.pistol.mag = 2;
  s.reload();
  s.roundCue = "start";
  s.roundCueRemaining = 3;
  bar(s);
  const snapshot = [
    s.time,
    s.intermission,
    s.reloadRemaining,
    s.health,
    s.roundCueRemaining,
  ];
  tick(s, 10);
  assert.deepEqual(
    [s.time, s.intermission, s.reloadRemaining, s.health, s.roundCueRemaining],
    snapshot,
  );
  assert.equal(s.purchaseBar("reserve"), true);
  assert.equal(s.maxHealth, 150);
  assert.equal(s.health, 110);
  const points = s.points;
  assert.equal(s.purchaseBar("reserve"), false);
  assert.equal(s.points, points);
  s.closeBar();
  s.resume();
  tick(s, 10);
  assert.equal(s.health, 150);
});

test("Quick Pour speeds a pending reload once without granting extra rounds", () => {
  const s = quiet();
  s.points = 10000;
  s.inventory.pistol.mag = 2;
  s.inventory.pistol.reserve = 5;
  s.reload();
  bar(s);
  assert.equal(s.purchaseBar("quickPour"), true);
  assert.ok(Math.abs(s.reloadRemaining - 1.05) < 1e-9);
  assert.equal(s.purchaseBar("quickPour"), false);
  s.closeBar();
  s.resume();
  tick(s, 1.1);
  assert.equal(s.inventory.pistol.mag, 7);
  assert.equal(s.inventory.pistol.reserve, 0);
  assert.equal(s.reloadDuration("rifle"), WEAPONS.rifle.reload * 0.7);
});

test("Night Shift affects sprint only and an unaffordable perk does not charge", () => {
  const s = quiet();
  s.points = 899;
  bar(s);
  assert.equal(s.purchaseBar("nightShift"), false);
  assert.equal(s.points, 899);
  s.points = 900;
  assert.equal(s.purchaseBar("nightShift"), true);
  assert.equal(s.points, 0);
  s.closeBar();
  s.resume();
  for (const sprint of [false, true]) {
    s.player = { x: -12, z: -5 };
    s.yaw = 0;
    s.step(0.05, { ...idle, forward: 1, sprint });
    assert.ok(
      Math.abs(
        s.player.z + 5 - (sprint ? RULES.sprint * 1.15 : RULES.walk) * 0.05,
      ) < 1e-8,
    );
  }
});

test("bar and workshop share per-weapon upgrades without replenishing reserve", () => {
  const s = quiet();
  s.points = 30000;
  for (const id of ["lounge", "vip", "shotgun", "smg", "rifle"]) buy(s, id);
  for (const id of ["pistol", "shotgun", "smg", "rifle"]) {
    s.switchWeapon(id);
    s.inventory[id].mag = 0;
    s.inventory[id].reserve = 3;
    s.reload();
    bar(s);
    assert.equal(s.purchaseBar("weaponUpgrade"), true);
    assert.equal(s.capacity(), Math.round(WEAPONS[id].magazine * 1.5));
    assert.equal(s.weaponDamage(), Math.round(WEAPONS[id].damage * 1.35));
    assert.equal(s.inventory[id].mag, s.capacity());
    assert.equal(s.inventory[id].reserve, 3);
    assert.equal(s.reloadRemaining, 0);
    const points = s.points;
    assert.equal(s.purchaseBar("weaponUpgrade"), false);
    s.closeBar();
    s.resume();
    assert.equal(buy(s, "upgrade"), false);
    assert.equal(s.points, points);
  }
  const fresh = new Simulation();
  assert.equal(fresh.shopOpen, false);
  for (const id of Object.keys(PERKS)) assert.equal(fresh.perks[id], false);
  for (const id of Object.keys(WEAPONS)) {
    assert.equal(fresh.upgrades[id], false);
    assert.equal(fresh.inventory[id].owned, id === "pistol");
  }
});

test("round start and clear emit once, respect wave budget, and freeze when paused", () => {
  const s = new Simulation();
  s.start();
  assert.equal(
    s.events.some((e) => e.type === "roundClear"),
    false,
  );
  tick(s, 4);
  assert.equal(s.round, 1);
  assert.equal(s.events.filter((e) => e.type === "round").length, 1);
  s.enemies = [];
  s.waveRemaining = 1;
  s.spawnTimer = 10;
  s.step(0.05, idle);
  assert.equal(
    s.events.some((e) => e.type === "roundClear"),
    false,
  );
  s.waveRemaining = 0;
  s.enemies = [enemy(-12, -3)];
  s.step(0.05, idle);
  assert.equal(
    s.events.some((e) => e.type === "roundClear"),
    false,
  );
  s.damageEnemy(s.enemies[0], 1000, false);
  s.step(0.05, idle);
  assert.equal(s.roundCue, "clear");
  assert.equal(s.intermission, RULES.intermission);
  assert.equal(s.events.filter((e) => e.type === "roundClear").length, 1);
  s.pause();
  tick(s, 5);
  assert.equal(s.intermission, RULES.intermission);
  assert.equal(s.roundCueRemaining, 3.8);
  s.resume();
  tick(s, 8.1);
  assert.equal(s.round, 2);
  assert.equal(s.roundCue, "start");
  assert.equal(s.events.filter((e) => e.type === "roundClear").length, 1);
  assert.equal(s.events.filter((e) => e.type === "round").length, 2);
});

test("table room requires VIP, opens both gates once, and adds a delayed spawn", () => {
  const s = quiet();
  s.points = 10000;
  assert.equal(buy(s, "tables"), false);
  buy(s, "lounge");
  buy(s, "vip");
  for (const z of [-4.1, 8.6])
    assert.equal(hasSight({ x: 26, z }, { x: 31, z }, s.rects), false);
  const before = s.points;
  assert.equal(buy(s, "tables"), true);
  assert.equal(s.points, before - PRICES.tables);
  assert.equal(buy(s, "tables"), false);
  assert.equal(s.spawnEnabled(5), false);
  for (const z of [-4.1, 8.6]) {
    const p = { x: 26, z };
    moveActor(p, 5, 0, 0.32, s.rects);
    assert.ok(p.x > 30.9);
  }
  tick(s, 3.1);
  assert.equal(s.spawnEnabled(5), true);
  const p = { x: 40, z: -8 };
  moveActor(p, 10, 0, 0.32, s.rects);
  assert.ok(p.x > 41 && p.x < 42);
});

test("new room navigation reaches all enabled entrances around both table islands", () => {
  const s = quiet();
  s.lounge = s.vip = s.tables = true;
  s.loungeAge = s.vipAge = s.tablesAge = 4;
  s.refreshMap();
  for (const player of [
    { x: 30, z: -8 },
    { x: 40, z: 9 },
    { x: 35, z: -5 },
    { x: 35, z: 7 },
    { x: 30, z: 2 },
  ]) {
    assert.equal(collides(player, 0.32, s.rects), false);
    s.navigation.update(player);
    for (const spawn of SPAWNS)
      assert.ok(
        s.navigation.distance[s.navigation.index(spawn)] >= 0,
        JSON.stringify({ player, spawn }),
      );
  }
  s.player = { x: 35, z: 0 };
  s.enemies = [enemy(35, -6)];
  s.health = 1e6;
  tick(s, 20);
  assert.ok(dist(s.enemies[0], s.player) < 1.3);
});

function wagering() {
  const s = quiet();
  s.round = 3;
  s.intermission = 0;
  s.waveRemaining = 2;
  s.spawnTimer = 100;
  s.lounge = s.vip = s.tables = true;
  s.refreshMap();
  s.player = { x: 35, z: -5 };
  s.points = 1000;
  return s;
}

test("craps charges once, blocks locked/distant/paused/unaffordable attempts, and pays once", () => {
  const s = wagering();
  s.tables = false;
  assert.equal(s.purchase("craps"), false);
  s.tables = true;
  s.player = { x: 31, z: -5 };
  assert.equal(s.purchase("craps"), false);
  s.player = { x: 35, z: -5 };
  s.pause();
  assert.equal(s.purchase("craps"), false);
  s.resume();
  s.points = 249;
  assert.equal(s.purchase("craps"), false);
  assert.equal(s.points, 249);
  s.points = 1000;
  s.random = () => 0.7; // two fives
  assert.equal(s.purchase("craps"), true);
  assert.equal(s.points, 750);
  assert.equal(s.purchase("craps"), false);
  s.pause();
  tick(s, 3);
  assert.equal(s.dice.remaining, 1.6);
  s.resume();
  tick(s, 1.7);
  assert.deepEqual(s.dice.values, [5, 5]);
  assert.equal(s.points, 1250);
  tick(s, 4);
  assert.equal(s.points, 1250);
  assert.equal(s.slowRound, 0);
  assert.equal(s.purchase("craps"), false);
  assert.equal(s.events.filter((e) => e.type === "diceWin").length, 1);
});

test("seven slows both movement modes for one round and preserves Night Shift multiplier", () => {
  const s = wagering();
  let n = 0;
  s.random = () => (n++ % 2 ? 0.51 : 0.34); // three + four
  assert.equal(s.purchase("craps"), true);
  tick(s, 1.7);
  assert.equal(s.slowRound, 3);
  assert.equal(s.slowed, true);
  assert.equal(s.points, 750);
  for (const sprint of [false, true]) {
    s.player = { x: 30, z: 0 };
    s.yaw = 0;
    s.perks.nightShift = true;
    s.step(0.05, { ...idle, forward: 1, sprint });
    assert.ok(
      Math.abs(
        s.player.z - (sprint ? RULES.sprint * 1.15 : RULES.walk) * 0.8 * 0.05,
      ) < 1e-8,
    );
  }
  s.beginRound();
  assert.equal(s.slowRound, 0);
  assert.equal(s.slowed, false);
  assert.equal(s.purchaseInfo("craps").reason, "");
});

test("intermission and boundary-crossing wagers target the next round, then clear", () => {
  for (const finishDuringRoll of [false, true]) {
    const s = wagering();
    s.intermission = finishDuringRoll ? 0 : 8;
    let n = 0;
    s.random = () => (n++ % 2 ? 0.51 : 0.34);
    s.purchase("craps");
    if (finishDuringRoll) {
      s.waveRemaining = 0;
      s.enemies = [];
    }
    tick(s, 1.7);
    assert.equal(s.slowRound, 4);
    assert.equal(s.dice.round, 4);
    assert.equal(s.slowed, false);
    s.intermission = 0;
    s.beginRound();
    assert.equal(s.slowed, true);
    assert.equal(s.purchase("craps"), false);
    s.enemies = [];
    s.waveRemaining = 0;
    s.step(0.05, idle);
    assert.equal(s.slowRound, 0);
    assert.equal(s.slowed, false);
    const fresh = new Simulation();
    assert.equal(fresh.tables, false);
    assert.equal(fresh.dice, null);
    assert.equal(fresh.slowRound, 0);
    assert.equal(fresh.lastWagerRound, -1);
  }
});
