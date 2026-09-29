import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  PRICES,
  PURCHASES,
  ROULETTE_RULES,
  WEAPONS,
  WEAPON_ORDER,
  BAR_ANCHOR,
  hasSight,
} from "../lib/game/simulation.ts";
import { isMelee } from "../lib/game/weapon-expansion.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const anchor = PURCHASES.find((p) => p.id === "roulette");
const resultEvents = new Set([
  "rouletteWin",
  "rouletteJackpot",
  "rouletteMiss",
]);

function advance(s, seconds) {
  const frames = Math.ceil(seconds / 0.05);
  for (let i = 0; i < frames; i++)
    s.step(Math.min(0.05, seconds - i * 0.05), idle);
}

function table() {
  const s = new Simulation();
  s.start();
  s.round = 3;
  s.intermission = 1e6; // Keep enemy spawns and round changes out of wagers.
  s.doorsOpen.lounge = s.doorsOpen.vip = true;
  s.refreshMap();
  s.player = { x: anchor.x, z: anchor.z };
  s.points = 10000;
  return s;
}

function spin(s, number) {
  s.random = () => (number + 0.5) / 37;
  assert.equal(s.purchase("roulette"), true);
  assert.equal(s.roulette.number, number);
}

function resolve(s) {
  // Floating-point subtraction can leave a sub-frame remainder at 6 seconds.
  for (let frame = 0; frame < 122 && !s.roulette.resolved; frame++)
    s.step(0.05, idle);
  assert.equal(s.roulette.resolved, true);
  return s.roulette;
}

function drain(s, owned = WEAPON_ORDER) {
  for (const id of WEAPON_ORDER)
    s.inventory[id] = { owned: owned.includes(id), mag: 0, reserve: 0 };
}

function frozenState(s) {
  return structuredClone({
    roulette: s.roulette,
    boost: s.damageBoostRemaining,
    inventory: s.inventory,
    points: s.points,
    earned: s.earned,
    reload: s.reloadRemaining,
    events: s.events,
  });
}

test("roulette exposes the agreed price, table anchor, and gameplay durations", () => {
  assert.equal(PRICES.roulette, 200);
  assert.deepEqual({ x: anchor.x, z: anchor.z }, { x: -26.3, z: 2.25 });
  assert.deepEqual(ROULETTE_RULES, {
    spinDuration: 6,
    resultDuration: 6,
    damageDuration: 30,
    damageMultiplier: 2,
  });
});

test("distant, obstructed, inactive and 199-chip attempts cannot start or charge", () => {
  const blocked = {
    distant: (s) => { s.player.x += 2.21; },
    obstructed: (s) => {
      s.player.z = 4.25;
      assert.equal(hasSight(s.player, anchor, s.rects), false);
    },
    ready: (s) => { s.phase = "ready"; },
    paused: (s) => { s.pause(); },
    dead: (s) => { s.hurt(100); },
    unaffordable: (s) => { s.points = 199; },
  };
  for (const [name, block] of Object.entries(blocked)) {
    const s = table();
    block(s);
    const inventory = structuredClone(s.inventory);
    const points = s.points;
    let draws = 0;
    s.random = () => { draws++; return 0; };
    assert.equal(s.purchase("roulette"), false, name);
    assert.equal(s.points, points, name);
    assert.deepEqual(s.inventory, inventory, name);
    assert.equal(s.roulette, null, name);
    assert.equal(s.damageBoostRemaining, 0, name);
    assert.equal(draws, 0, name);
  }
  for (const chips of [200, 201]) {
    const s = table();
    s.points = chips;
    spin(s, 1);
    assert.equal(s.points, chips - 200);
    resolve(s);
    assert.equal(s.points, chips - 200); // No miss charge or refund.
  }
});

test("all 37 pockets occupy equal random intervals, including both endpoints", () => {
  for (let number = 0; number <= 36; number++) {
    for (const fraction of [0.025, 0.5, 0.975]) {
      const s = table();
      s.random = () => (number + fraction) / 37;
      assert.equal(s.purchase("roulette"), true);
      assert.equal(s.roulette.number, number, `${number} at ${fraction}`);
    }
  }
  for (const [random, expected] of [[0, 0], [1 - Number.EPSILON, 36]]) {
    const s = table();
    s.random = () => random;
    assert.equal(s.purchase("roulette"), true);
    assert.equal(s.roulette.number, expected);
  }
});

test("spin charges immediately once, waits six seconds and rejects duplicate input", () => {
  const s = table();
  drain(s, ["pistol"]);
  let draws = 0;
  s.random = () => { draws++; return 4.5 / 37; };
  const before = s.points;
  assert.equal(s.purchase("roulette"), true);
  const id = s.roulette.id;
  assert.equal(s.points, before - 200);
  assert.equal(s.roulette.remaining, 6);
  assert.equal(s.roulette.reward, null);
  assert.equal(s.roulette.weapon, null);
  assert.equal(s.roulette.resultRemaining, 0);
  for (let i = 0; i < 10; i++) {
    s.purchaseInfo("roulette");
    assert.equal(s.purchase("roulette"), false);
  }
  advance(s, 5.95);
  assert.equal(s.roulette.id, id);
  assert.equal(s.roulette.resolved, false);
  assert.equal(s.inventory.pistol.mag, 0);
  assert.equal(s.events.filter((e) => resultEvents.has(e.type)).length, 0);
  resolve(s);
  assert.equal(s.roulette.resultRemaining, 6);
  assert.equal(s.points, before - 200);
  assert.equal(draws, 1);
  assert.equal(s.events.filter((e) => e.type === "rouletteSpin").length, 1);
});

test("every pocket awards exactly its stated reward once, without chip payouts", () => {
  for (let number = 0; number <= 36; number++) {
    const s = table();
    drain(s, ["pistol", "shotgun"]);
    s.weapon = "shotgun";
    s.upgrades.pistol = s.upgrades.shotgun = true;
    s.earned = 37;
    spin(s, number);
    const result = resolve(s);
    const reward = number === 0 ? "jackpot" : number === 7 ? "maxAmmo" :
      number === 4 || number === 24 ? "ammo" : "miss";
    assert.equal(result.reward, reward, `pocket ${number}`);
    assert.equal(result.weapon, reward === "ammo" ? "shotgun" : null);
    for (const id of WEAPON_ORDER) {
      const shouldFill = s.inventory[id].owned &&
        (reward === "jackpot" || reward === "maxAmmo" ||
          (reward === "ammo" && id === "shotgun"));
      assert.equal(s.inventory[id].mag, shouldFill ? s.capacity(id) : 0, `${number}/${id}`);
      assert.equal(s.inventory[id].reserve, shouldFill ? WEAPONS[id].reserve : 0);
    }
    assert.equal(s.damageBoostRemaining, number === 0 ? 30 : 0);
    assert.equal(s.points, 9800);
    assert.equal(s.earned, 37);
    const expectedEvent = reward === "jackpot" ? "rouletteJackpot" :
      reward === "miss" ? "rouletteMiss" : "rouletteWin";
    assert.deepEqual(s.events.filter((e) => resultEvents.has(e.type)).map((e) => e.type), [expectedEvent]);
    // Spending the awarded ammo must not cause a result to be applied again.
    drain(s, ["pistol", "shotgun"]);
    advance(s, 6.1);
    assert.ok(!s.roulette || s.roulette.resultRemaining === 0);
    assert.ok(WEAPON_ORDER.every((id) => s.inventory[id].mag === 0 && s.inventory[id].reserve === 0));
    assert.equal(s.points, 9800);
    assert.equal(s.events.filter((e) => resultEvents.has(e.type)).length, 1);
  }
});

test("4 and 24 refill each weapon at its upgraded capacity and leave other guns alone", () => {
  for (const number of [4, 24]) {
    for (const weapon of WEAPON_ORDER.filter((id) => !isMelee(id))) {
      for (const upgraded of [false, true]) {
        const s = table();
        drain(s);
        s.weapon = weapon;
        s.upgrades[weapon] = upgraded;
        spin(s, number);
        resolve(s);
        assert.equal(s.roulette.weapon, weapon);
        for (const id of WEAPON_ORDER) {
          assert.equal(s.inventory[id].mag, id === weapon ? s.capacity(id) : 0);
          assert.equal(s.inventory[id].reserve, id === weapon ? WEAPONS[id].reserve : 0);
        }
      }
    }
  }
});

test("4 and 24 choose the weapon equipped when the ball lands", () => {
  for (const number of [4, 24]) {
    const s = table();
    drain(s);
    spin(s, number);
    advance(s, 4);
    s.switchWeapon("rifle");
    resolve(s);
    assert.equal(s.roulette.weapon, "rifle");
    assert.equal(s.inventory.pistol.mag, 0);
    assert.equal(s.inventory.pistol.reserve, 0);
    assert.equal(s.inventory.rifle.mag, WEAPONS.rifle.magazine);
    assert.equal(s.inventory.rifle.reserve, WEAPONS.rifle.reserve);
  }
});

test("7 and 0 refill only owned weapons across every legal ownership combination", () => {
  for (const number of [0, 7]) {
    // Every combination of the five base guns, plus the full expanded arsenal.
    const masks = [...Array(16).keys()].map((m) => m * 2 + 1).concat((1 << WEAPON_ORDER.length) - 1);
    for (const mask of masks) {
      const s = table();
      const owned = WEAPON_ORDER.filter((_, i) => mask & (1 << i));
      drain(s, owned);
      for (const id of WEAPON_ORDER) s.upgrades[id] = true;
      spin(s, number);
      resolve(s);
      for (const id of WEAPON_ORDER) {
        assert.equal(s.inventory[id].owned, owned.includes(id));
        if (isMelee(id)) continue; // Melee durability is never refilled by the wheel.
        assert.equal(s.inventory[id].mag, owned.includes(id) ? s.capacity(id) : 0);
        assert.equal(s.inventory[id].reserve, owned.includes(id) ? WEAPONS[id].reserve : 0);
      }
    }
  }
});

test("ammo rewards cancel an overlapping reload without subtracting or duplicating ammo", () => {
  for (const number of [0, 4, 7, 24]) {
    const s = table();
    drain(s, ["pistol"]);
    s.upgrades.pistol = true;
    s.inventory.pistol.reserve = 3;
    spin(s, number);
    advance(s, 5.5);
    assert.equal(s.reload(), true);
    resolve(s);
    assert.equal(s.reloadRemaining, 0);
    assert.equal(s.inventory.pistol.mag, 18);
    assert.equal(s.inventory.pistol.reserve, 84);
    advance(s, 3);
    assert.deepEqual(s.inventory.pistol, { owned: true, mag: 18, reserve: 84 });
  }
  const miss = table();
  miss.inventory.pistol.mag = 0;
  miss.inventory.pistol.reserve = 3;
  spin(miss, 1);
  advance(miss, 5.5);
  assert.equal(miss.reload(), true);
  resolve(miss);
  assert.ok(miss.reloadRemaining > 0);
  advance(miss, 2);
  assert.deepEqual(miss.inventory.pistol, { owned: true, mag: 3, reserve: 0 });
});

test("pause, the bartender, and death freeze both rolling and resolved jackpot state", () => {
  for (const mode of ["pause", "shop", "death"]) {
    for (const resolved of [false, true]) {
      const s = table();
      drain(s, ["pistol"]);
      spin(s, 0);
      if (resolved) resolve(s);
      else advance(s, 1.25);
      if (mode === "shop") {
        s.player = { ...BAR_ANCHOR };
        assert.equal(s.openBar(), true);
      } else if (mode === "death") s.hurt(100);
      else s.pause();
      const snapshot = frozenState(s);
      advance(s, 45);
      assert.deepEqual(frozenState(s), snapshot, `${mode}/${resolved}`);
      assert.equal(s.purchase("roulette"), false);
      if (mode !== "death") {
        if (mode === "shop") s.closeBar();
        s.resume();
        assert.equal(s.phase, "playing");
        if (resolved) {
          s.step(0.05, idle);
          assert.ok(s.damageBoostRemaining < snapshot.boost);
          assert.ok(s.roulette.resultRemaining < snapshot.roulette.resultRemaining);
        } else resolve(s);
      } else assert.equal(s.phase, "dead");
    }
  }
});

test("repeated spins in one round charge 200 each, even during the prior result display", () => {
  const s = table();
  s.lastWagerRound = 999; // The craps per-round limit does not apply to roulette.
  let previousId = 0;
  for (const [i, number] of [4, 24, 7, 0, 1].entries()) {
    spin(s, number);
    assert.ok(s.roulette.id > previousId);
    previousId = s.roulette.id;
    assert.equal(s.points, 10000 - 200 * (i + 1));
    resolve(s);
    assert.equal(s.roulette.resultRemaining, 6);
    assert.equal(s.round, 3);
    assert.equal(s.points, 10000 - 200 * (i + 1));
  }
  assert.equal(s.earned, 0);
  assert.equal(s.events.filter((e) => e.type === "rouletteSpin").length, 5);
  assert.equal(s.events.filter((e) => resultEvents.has(e.type)).length, 5);
});

test("jackpot doubles rounded upgraded damage for 30 gameplay seconds, then expires", () => {
  const s = table();
  spin(s, 0);
  resolve(s);
  for (const upgraded of [false, true]) {
    for (const id of WEAPON_ORDER) {
      s.upgrades[id] = upgraded;
      assert.equal(s.weaponDamage(id), 2 * Math.round(WEAPONS[id].damage * (upgraded ? 1.35 : 1)));
    }
  }
  advance(s, 29.9);
  assert.ok(s.damageBoostRemaining > 0 && s.damageBoostRemaining < 0.11);
  assert.equal(s.weaponDamage("pistol"), 92);
  advance(s, 0.2);
  assert.equal(s.damageBoostRemaining, 0);
  assert.equal(s.weaponDamage("pistol"), 46);
});

test("another zero refreshes the timer to 30 and cannot stack the damage multiplier", () => {
  const s = table();
  s.upgrades.pistol = true;
  spin(s, 0);
  resolve(s);
  advance(s, 5);
  assert.ok(s.damageBoostRemaining < 26);
  spin(s, 0);
  resolve(s);
  assert.equal(s.damageBoostRemaining, 30);
  assert.equal(s.weaponDamage(), 92);
  assert.equal(s.points, 9600);
  // An ordinary ammo win must not replace, extend, or remove an existing boost.
  spin(s, 7);
  resolve(s);
  assert.ok(s.damageBoostRemaining > 23.8 && s.damageBoostRemaining < 24.1);
  assert.equal(s.weaponDamage(), 92);
});

test("the jackpot multiplier reaches actual body-shot damage", () => {
  const s = table();
  s.upgrades.pistol = true;
  s.player = { x: -12, z: -5 };
  s.yaw = 0;
  s.random = () => 0.5;
  const target = {
    id: 100, x: -12, z: -1, health: 1000, maxHealth: 1000,
    speed: 0, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0,
  };
  s.enemies = [target];
  for (const [boost, damage] of [[0, 46], [30, 92]]) {
    s.pitch = 0.12;
    s.fireCooldown = 0;
    s.damageBoostRemaining = boost;
    const before = target.health;
    assert.equal(s.fire(), true);
    assert.equal(before - target.health, damage);
    assert.equal(s.events.findLast((e) => e.type === "hit").headshot, false);
  }
});

test("new runs discard pending spins, displayed results and jackpot timers", () => {
  for (const resolved of [false, true]) {
    let s = table();
    spin(s, 0);
    if (resolved) resolve(s);
    s.hurt(100);
    s = new Simulation();
    assert.equal(s.roulette, null);
    assert.equal(s.damageBoostRemaining, 0);
    assert.equal(s.phase, "ready");
    assert.equal(s.points, 400);
    assert.equal(s.reloadRemaining, 0);
    assert.equal(s.weaponDamage(), WEAPONS.pistol.damage);
    assert.deepEqual(s.events, []);
    assert.ok(WEAPON_ORDER.every((id) => s.inventory[id].owned === (id === "pistol")));
  }
});
