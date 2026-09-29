import test from "node:test";
import assert from "node:assert/strict";
import { zombieHitVolumes, zombiePose, LIMBS } from "../lib/game/zombie-pose.ts";
import {
  Simulation,
  RULES,
  PRICES,
  PURCHASES,
  SPAWNS,
  SPAWN_RECORDS,
  ALL_SPAWNS,
  DOORS,
  collides,
  moveActor,
  dist,
  waveStats,
  hasSight,
  WEAPONS,
  PERKS,
  BAR_ANCHOR,
} from "../lib/game/simulation.ts";
import { CRAPS_TABLES, ROULETTE_TABLES, CASINO_ANCHORS } from "../lib/game/casino-layout.ts";
import { POKER_TABLES } from "../lib/game/poker.ts";
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

test("knife winds up, kills one close target, pays once and consumes no ammo", () => {
  const s=quiet();s.player={x:-12,z:-7};s.yaw=0;s.pitch=0;s.random=()=>0;
  s.enemies=[enemy(-12,-5.8),{...enemy(-12,-5.5),id:2}];
  assert.equal(s.knife(),true);assert.equal(s.knife(),false);assert.equal(s.fire(),false);
  tick(s,.1);assert.equal(s.kills,0);
  tick(s,.15);assert.equal(s.kills,1);assert.equal(s.points,455);
  assert.equal(s.inventory.pistol.mag,12);tick(s,.5);assert.equal(s.kills,1);
});
test("knife misses distant, behind-player, and covered enemies; pause freezes windup", () => {
  for(const [player,target,yaw] of [
    [{x:-12,z:-7},{x:-12,z:-4},0],
    [{x:-12,z:-7},{x:-12,z:-8},0],
    [{x:-32.5,z:-2},{x:-33.5,z:-2},-Math.PI/2],
  ]) {
    const s=quiet();s.player=player;s.yaw=yaw;s.enemies=[enemy(target.x,target.z)];
    s.knife();s.pause();tick(s,1);assert.equal(s.knifeRemaining,.55);
    s.resume();tick(s,.3);assert.equal(s.enemies[0].health,80);
  }
});
test("grenades have limited inventory, pause-safe fuses, and capped round replenishment", () => {
  const s=quiet();s.player={x:-12,z:-7};s.yaw=0;
  assert.equal(s.throwGrenade(),true);assert.equal(s.grenades,1);
  assert.equal(s.throwGrenade(),false);assert.equal(s.knife(),false);
  s.pause();tick(s,3);assert.equal(s.projectiles[0].fuse,2.2);
  assert.equal(s.throwGrenade(),false);s.resume();tick(s,.7);
  assert.equal(s.throwGrenade(),true);assert.equal(s.grenades,0);
  tick(s,.7);assert.equal(s.throwGrenade(),false);
  s.beginRound();assert.equal(s.grenades,0);
  s.beginRound();assert.equal(s.grenades,2);s.beginRound();s.beginRound();assert.equal(s.grenades,4);
  assert.equal(new Simulation().grenades,2);
});
test("grenade blast kills groups once, applies falloff, and can hurt the player", () => {
  const s=quiet();s.player={x:-12,z:-7};s.random=()=>0;
  s.enemies=[enemy(-12,-6,80),{...enemy(-12,-5.5,500),id:2}];
  s.projectiles=[{id:1,x:-12,y:.1,z:-6,vx:0,vy:0,vz:0,fuse:.01}];
  s.step(.05,idle);
  assert.equal(s.kills,1);assert.equal(s.points,460);
  assert.ok(s.enemies[0].health>280&&s.enemies[0].health<320);
  assert.ok(s.health<100);assert.equal(s.projectiles.length,0);
  assert.equal(s.events.filter(e=>e.type==='explosion').length,1);
  tick(s,.7);assert.equal(s.kills,1);assert.equal(s.explosions.length,0);
});
test("closed doors block blast damage and bounce thrown grenades", () => {
  const s=quiet();s.player={x:-32,z:-2};s.yaw=-Math.PI/2;
  s.enemies=[enemy(-33.6,-2)];
  s.projectiles=[{id:1,x:-32.4,y:.2,z:-2,vx:0,vy:0,vz:0,fuse:.01}];
  s.step(.05,idle);assert.equal(s.enemies[0].health,80);
  s.throwGrenade();tick(s,.25);
  assert.ok(s.projectiles[0].x>-33);assert.ok(s.projectiles[0].vx>0);
});
test("a thrown grenade follows its full flight and kills a nearby group", () => {
  const s=quiet();s.player={x:-12,z:-7};s.yaw=0;s.pitch=0;
  s.enemies=[{...enemy(-12,3),speed:0},{...enemy(-11.4,3.2),id:2,speed:0}];
  s.throwGrenade();tick(s,2.3);
  assert.equal(s.kills,2);assert.equal(s.projectiles.length,0);
  assert.equal(s.events.filter(e=>e.type==='explosion').length,1);
});

test("hit payouts include both random endpoints, headshots, and one lethal bonus", () => {
  for (const [random, hit] of [[0,5],[.999999,10]]) {
    const s = quiet(); s.random=()=>random;
    const e=enemy(-12,-3,500);
    s.damageEnemy(e,10,false);
    assert.equal(s.points,400+hit);
    s.damageEnemy(e,10,true);
    assert.equal(s.points,500+2*hit);
    assert.equal(s.headshots,1);
    s.damageEnemy(e,1000,false);
    assert.equal(s.points,550+3*hit);
    assert.equal(s.kills,1);
    s.damageEnemy(e,1000,true);
    assert.equal(s.points,550+3*hit);
    assert.equal(s.headshots,1);
    assert.equal(s.earned,s.points-400);
  }
});

test("limb wounds accumulate, severed limbs never regrow or accept damage, and pauses preserve wounds", () => {
  const s=quiet(), e=enemy(-12,-3,1000); s.enemies=[e];
  for (const limb of LIMBS) {
    s.damageEnemy(e,16,false,limb);
    assert.ok(!e.missing[limb]);
    s.damageEnemy(e,16,false,limb);
    assert.equal(e.missing[limb],true);
    assert.equal(e.wounds[limb],2);
    const points=s.points, health=e.health;
    s.damageEnemy(e,100,false,limb);
    assert.equal(s.points,points); assert.equal(e.health,health);
    assert.ok(!zombieHitVolumes(e).some(v=>v.region===limb));
  }
  s.pause();const state=JSON.stringify(e);tick(s,2);assert.equal(JSON.stringify(e),state);
  s.resume();tick(s,2);
  assert.deepEqual(e.missing,{leftArm:true,rightArm:true,leftLeg:true,rightLeg:true});
});

test("aimed bullets sever a visible leg and pass through its missing hit volume", () => {
  const s=quiet();s.player={x:-12,z:-5};s.random=()=>.5;
  const e=enemy(-12,-3,200);e.age=0;e.id=0;s.enemies=[e];
  // Aim at the left shin, below all body and arm volumes.
  s.yaw=Math.atan2(-.11,2);s.pitch=Math.atan2(1.65-.27,Math.hypot(.11,2));
  s.fire();assert.equal(e.missing.leftLeg,true);
  const health=e.health,points=s.points;
  // A severed leg is absent even before the next simulation step.
  assert.ok(!zombieHitVolumes(e).some(v=>v.region==='leftLeg'));
  s.damageEnemy(e,34,false,'leftLeg');assert.equal(e.health,health);assert.equal(s.points,points);
});

test("all three attacks wind up and follow through differently; severed legs lower head volumes", () => {
  const e=enemy(0,0);e.attack=RULES.attackWindup*.3;
  const poses=[0,1,2].map(attackStyle=>zombiePose({...e,attackStyle}));
  assert.equal(new Set(poses.map(p=>JSON.stringify(p.arms))).size,3);
  const recover=zombiePose({...e,attack:0,cooldown:1});assert.ok(recover.attacking);
  e.missing={leftLeg:true,rightLeg:true};
  assert.ok(zombieHitVolumes(e).find(v=>v.region==='head').center[1]<1.1);
});

test("missing legs reduce actual pursuit speed and attacks cycle styles", () => {
  const distances=[];
  for (const missing of [{},{leftLeg:true},{leftLeg:true,rightLeg:true}]) {
    const s=quiet();s.player={x:-12,z:-5};const e=enemy(-12,-2);e.missing=missing;s.enemies=[e];
    s.step(.05,idle);distances.push(-2-e.z);
  }
  assert.ok(Math.abs(distances[1]/distances[0]-.48)<1e-8);
  assert.ok(Math.abs(distances[2]/distances[0]-.23)<1e-8);
  const s=quiet();s.player={x:-12,z:-5};const e=enemy(-12,-4.2);s.enemies=[e];s.invulnerable=100;
  const styles=[];
  for(let i=0;i<3;i++) { e.attack=0;e.cooldown=0;s.step(.05,idle);styles.push(e.attackStyle); }
  assert.equal(new Set(styles).size,3);
});

test("unaffordable purchases preserve all inventory and currency", () => {
  const s = quiet();
  s.points = 10;
  const before = JSON.stringify(s.inventory);
  assert.equal(buy(s, "shotgun"), false);
  assert.equal(s.points, 10);
  assert.equal(JSON.stringify(s.inventory), before);
});
test("bar entrances charge independently, accept either first, and never charge twice", () => {
  for (const order of [["lounge", "shortcut"], ["shortcut", "lounge"]]) {
    const s = quiet(); s.points = 10000;
    assert.equal(buy(s, order[0]), true);
    assert.equal(s.lounge, true);
    assert.equal(s.doorsOpen[order[1]], false);
    assert.equal(buy(s, order[0]), false);
    assert.equal(s.points, 10000 - PRICES[order[0]]);
    assert.equal(buy(s, order[1]), true);
    assert.equal(buy(s, order[1]), false);
    assert.equal(s.points, 10000 - PRICES.lounge - PRICES.shortcut);
  }
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
  assert.ok(s.points >= points + 105 && s.points <= points + 110);
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
  s.player = { x: -32.5, z: -2 };
  const e = enemy(-33.5, -2);
  e.attack = 0.01;
  s.enemies = [e];
  tick(s, 0.05);
  assert.equal(s.health, 100);
  s.enemies = [enemy(-32.2, -2), { ...enemy(-32.1, -2), id: 2 }];
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
  const p = { x: -31, z: -2 };
  moveActor(p, -8, 0, 0.32, s.rects);
  assert.ok(p.x > -33);
  const q = { x: -12, z: -8 };
  moveActor(q, -100, -100, 0.32, s.rects);
  assert.equal(collides(q, 0.32, s.rects), false);
  s.points = 10000; buy(s, "lounge");
  const r = { x: -31, z: -2 };
  moveActor(r, -5, 0, 0.32, s.rects);
  assert.ok(r.x < -35.9);
});
test("every enabled spawn has a navigation route in all legal gate states", () => {
  for (const doors of [[], ["lounge"], ["shortcut"], ["vip"], ["vipExit"], ["lounge", "shortcut", "vip", "vipExit", "cashier", "hotel", "supply"]]) {
    const s = quiet(); s.points = 100000;
    for (const id of doors) assert.equal(buy(s, id), true, id);
    s.loungeAge = s.vipAge = s.hotelAge = s.supplyAge = s.cashierAge = 5;
    for (const target of [CASINO_ANCHORS.spawn,
      ...CRAPS_TABLES.map(t => ({ x:t.x, z:t.approachZ })),
      ...(s.vip ? [CASINO_ANCHORS.upgrade] : []),
      ...(s.lounge ? [BAR_ANCHOR] : []),
      ...(s.supply ? [CASINO_ANCHORS.rifle] : []),
    ]) {
      assert.equal(collides(target, .32, s.rects), false, JSON.stringify(target));
      s.navigation.update(target);
      for (const [i, p] of ALL_SPAWNS.entries()) if (s.spawnEnabled(i))
        assert.ok(s.navigation.distance[s.navigation.index(p)] >= 0, JSON.stringify({target,p,doors}));
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
    assert.ok(s.enemies.every((e) => e.x > -33));
  }
  s.doorsOpen.lounge = true;
  s.loungeAge = 0;
  s.refreshMap();
  s.player = { x: -15, z: -10 };
  for (let i = 0; i < 20; i++) {
    s.enemies = [];
    s.spawn();
    assert.ok(s.enemies.every((e) => e.x > -33));
  }
});
test("round budgets resolve exactly, active cap holds, and five waves pay body kills plus hits", () => {
  const s = new Simulation();
  s.start();
  for (let i = 0; i < 20000 && s.round < 6; i++) {
    for (const e of s.enemies) s.damageEnemy(e, 10000, false);
    s.step(0.05, idle);
    assert.ok(s.enemies.length <= RULES.cap);
  }
  assert.equal(s.round, 6);
  assert.equal(s.kills, 63);
  assert.ok(s.earned >= 63 * 55 && s.earned <= 63 * 60);
  assert.equal(s.points, 400 + s.earned);
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
test("five-round headshot route leaves an ammunition allowance after the original three unlocks", () => {
  const income =
    400 + [1, 2, 3, 4, 5].reduce((a, r) => a + waveStats(r).count * 105, 0);
  assert.equal(
    income -
      ["shotgun", "lounge", "shortcut", "vip", "upgrade"].reduce(
        (sum, id) => sum + PRICES[id],
        0,
      ),
    1415,
  );
});

test("VIP entrances require their own price, open independently and charge once", () => {
  for (const id of ["vip", "vipExit"]) {
    const s = quiet(); s.points = PRICES[id] - 1;
    assert.equal(buy(s, id), false);
    assert.equal(s.vip, false);
    const other = id === "vip" ? "vipExit" : "vip";
    for (const door of [DOORS[id], DOORS[other]])
      assert.equal(hasSight({x:door.x,z:-18}, {x:door.x,z:-22}, s.rects), false);
    s.points = 10000;
    assert.equal(buy(s, id), true);
    assert.equal(s.points, 10000 - PRICES[id]);
    assert.equal(buy(s, id), false);
    assert.equal(s.doorsOpen[other], false);
    assert.equal(hasSight({x:DOORS[id].x,z:-18}, {x:DOORS[id].x,z:-22}, s.rects), true);
    assert.equal(hasSight({x:DOORS[other].x,z:-18}, {x:DOORS[other].x,z:-22}, s.rects), false);
  }
});
test("VIP spawn obeys its own unlock delay and expanded world has solid boundaries", () => {
  const s = quiet(); const index = SPAWN_RECORDS.findIndex(p => p.room === "vip");
  assert.equal(s.spawnEnabled(index), false);
  s.points = 10000; buy(s, "vip");
  assert.equal(s.spawnEnabled(index), false);
  tick(s, 3.1); assert.equal(s.spawnEnabled(index), true);
  const p = { x:-25, z:-26 };
  assert.equal(collides(p, .32, s.rects), false);
  moveActor(p, -20, 0, .32, s.rects);
  assert.ok(p.x > -28 && p.x < -27);
});
test("zombies navigate through a purchased VIP entrance around the poker island", () => {
  const s = quiet(); s.points = 10000; buy(s, "vip");
  s.player = {...CASINO_ANCHORS.upgrade}; s.refreshMap();
  s.enemies = [enemy(-23, -18)]; s.health = 1e6;
  tick(s, 40);
  assert.ok(dist(s.enemies[0], s.player) < 1.3, JSON.stringify(s.enemies[0]));
});

test("low poker tables force pursuit around the table, rather than into it", () => {
  for (const table of POKER_TABLES) {
    const s = quiet(); s.points = 10000; buy(s, "vip");
    s.player = {x:table.x,z:table.z+3}; s.refreshMap();
    s.enemies = [enemy(table.x,table.z-3)]; tick(s, 18);
    assert.ok(dist(s.enemies[0], s.player) < 1.3, JSON.stringify(s.enemies[0]));
  }
});
test("stuck-enemy recovery cannot relocate into a locked or just-opened VIP room", () => {
  for (const vip of [false,true]) {
    const s=quiet(); s.points=10000; if(vip) buy(s,"vip");
    s.player={...CASINO_ANCHORS.spawn}; s.refreshMap();
    const stuck={...enemy(-17.3,5.5),stuck:8};
    s.enemies=[stuck,...SPAWN_RECORDS.filter(r=>r.room==='casino').map((r,i)=>({...enemy(r.position.x,r.position.z),id:i+2,speed:0}))];
    s.step(.05,idle); assert.ok(stuck.z>-20,JSON.stringify(stuck));
  }
});

function bar(s) {
  s.doorsOpen.lounge = true;
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
  buy(s, "hotel");
  buy(s, "supply");
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
  s.doorsOpen.lounge = true;
  s.refreshMap();
  s.player = { x: -38, z: -14.4 };
  assert.equal(s.canUseBar(), false); // Counter blocks the back approach.
  s.player = { x: -42, z: -11 };
  assert.equal(s.openBar(), false);
  s.player = { ...BAR_ANCHOR };
  assert.equal(s.purchaseBar("reserve"), false);
  assert.equal(s.openBar(), true);
  s.resume();
  assert.equal(s.phase, "paused");
  const before = s.points;
  s.player = { x: -44, z: -9 };
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
  for (const id of ["lounge", "vip", "hotel", "supply", "shotgun", "smg", "rifle"]) buy(s, id);
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

test("central casino games start open while cashier access is paid and spawn delayed", () => {
  const s=quiet(); s.points=10000;
  for (const id of ["craps","craps-b","roulette","roulette-b","poker-a"]) assert.equal(s.purchaseInfo(id).reason,"",id);
  assert.equal(PURCHASES.some(p=>p.id==='tables'),false);
  const i=SPAWN_RECORDS.findIndex(p=>p.room==='cashier');
  assert.equal(s.spawnEnabled(i),false);
  assert.equal(buy(s,"cashier"),true);assert.equal(buy(s,"cashier"),false);
  assert.equal(s.points,10000-PRICES.cashier); assert.equal(s.spawnEnabled(i),false);
  tick(s,3.1); assert.equal(s.spawnEnabled(i),true);
  const p={x:40,z:-16};moveActor(p,10,0,.32,s.rects);assert.ok(p.x>42&&p.x<43);
});

test("central game islands retain navigation routes and zombie pursuit", () => {
  const s=quiet();
  for(const table of [...CRAPS_TABLES,...ROULETTE_TABLES]) {
    const player={x:table.x,z:table.approachZ};
    assert.equal(collides(player,.32,s.rects),false);s.navigation.update(player);
    for(const [i,spawn] of SPAWNS.entries()) if(s.spawnEnabled(i))
      assert.ok(s.navigation.distance[s.navigation.index(spawn)]>=0,JSON.stringify({player,spawn}));
  }
  const table=CRAPS_TABLES[0];s.player={x:table.x,z:table.z+3};s.enemies=[enemy(table.x,table.z-3)];s.health=1e6;
  tick(s,20);assert.ok(dist(s.enemies[0],s.player)<1.3);
});

function wagering() {
  const s = quiet();
  s.round = 3;
  s.intermission = 0;
  s.waveRemaining = 2;
  s.spawnTimer = 100;
  s.doorsOpen.lounge = s.doorsOpen.vip = true;
  s.refreshMap();
  s.player = { x: CRAPS_TABLES[0].x, z: CRAPS_TABLES[0].approachZ };
  s.points = 1000;
  return s;
}

test("craps place bets charge once, lock during rolls, and pay profit while keeping the stake", () => {
  const s = wagering();
  s.holdingChips = true;
  s.player = { x: 31, z: -5 };
  assert.equal(s.purchase("craps"), false);
  s.player = { x: CRAPS_TABLES[0].x, z: CRAPS_TABLES[0].approachZ };
  s.pause();
  assert.equal(s.purchase("craps"), false);
  s.resume();
  s.points = 24;
  assert.equal(s.placeBet(10), false);
  assert.equal(s.points, 24);
  s.points = 1000;
  assert.equal(s.placeBet(10), true);
  s.random = () => 0.7; // two fives
  assert.equal(s.purchase("craps"), true);
  assert.equal(s.points, 975);
  assert.equal(s.purchase("craps"), false);
  assert.equal(s.placeBet(4), false);
  assert.equal(s.takeBets(), false);
  s.pause();
  tick(s, 3);
  assert.equal(s.dice.remaining, 1.6);
  s.resume();
  tick(s, 1.7);
  assert.deepEqual(s.dice.values, [5, 5]);
  assert.equal(s.points, 1020);
  assert.equal(s.bets[10],25);
  tick(s, 4);
  assert.equal(s.points, 1020);
  assert.equal(s.slowRound, 0);
  assert.equal(s.purchase("craps"), false);
  assert.equal(s.events.filter((e) => e.type === "diceWin").length, 1);
});

test("seven clears place bets and applies the shared single-round movement curse", () => {
  const s = wagering();
  s.holdingChips=true;s.placeBet(4);s.placeBet(6);
  let n = 0;
  s.random = () => (n++ % 2 ? 0.51 : 0.34); // three + four
  assert.equal(s.purchase("craps"), true);
  tick(s, 1.7);
  assert.equal(s.slowRound, 3);
  assert.equal(s.slowed, true);
  assert.equal(s.points, 945);
  assert.deepEqual(s.bets,{});
  for (const sprint of [false, true]) {
    s.player = { x: -3, z: 0 };
    s.yaw = 0;
    s.perks.nightShift = true;
    s.step(0.05, { ...idle, forward: 1, sprint });
    assert.ok(
      Math.abs(
        s.player.z - (sprint ? RULES.sprint * 1.15 : RULES.walk) * .8 * 0.05,
      ) < 1e-8,
    );
  }
  s.beginRound();
  assert.equal(s.slowRound, 0);
  assert.equal(s.slowed, false);
  assert.equal(s.purchaseInfo("craps").reason, "");
});

test("table stakes persist across round boundaries and fresh runs reset casino state", () => {
  for (const finishDuringRoll of [false, true]) {
    const s = wagering();
    s.intermission = finishDuringRoll ? 0 : 8;
    let n = 0;
    s.random = () => (n++ % 2 ? 0.51 : 0.51); // eight: no winning bet
    s.holdingChips=true;s.placeBet(4);
    s.purchase("craps");
    if (finishDuringRoll) {
      s.waveRemaining = 0;
      s.enemies = [];
    }
    tick(s, 1.7);
    assert.equal(s.bets[4],25);
    assert.equal(s.slowed, false);
    s.intermission = 0;
    s.beginRound();
    assert.equal(s.slowed, false);
    assert.equal(s.bets[4],25);
    s.enemies = [];
    s.waveRemaining = 0;
    s.step(0.05, idle);
    assert.equal(s.slowRound, 0);
    assert.equal(s.slowed, false);
    const fresh = new Simulation();
    assert.equal(fresh.tables, true);
    assert.equal(fresh.dice, null);
    assert.equal(fresh.slowRound, 0);
    assert.equal(fresh.lastWagerRound, -1);
    assert.deepEqual(fresh.bets,{});assert.equal(fresh.speakeasy,false);assert.equal(fresh.mystery,null);
  }
});
