import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, RULES, WEAPONS, WEAPON_ORDER, collides, moveActor, hasSight, dist } from '../lib/game/simulation.ts';
import { HOTEL_MYSTERY_ANCHORS, HOTEL_MYSTERY_GATES, freshHotelMystery, getHotelMysteryDocument } from '../lib/game/hotel-mystery.ts';

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
function quiet(unlocked = true) {
  const s = new Simulation(); s.start(); s.intermission = 1e6;
  s.hotel = unlocked; s.refreshMap(); return s;
}
function at(s, id) { s.player = { ...HOTEL_MYSTERY_ANCHORS[id], surfaceId: 'ground' }; }
function inspect(s, id, document) {
  at(s, id);
  assert.equal(s.nearestPurchase()?.id, id);
  assert.equal(s.purchase(id), true);
  assert.equal(s.hotelDocument, document);
  assert.equal(s.phase, 'paused');
  assert.equal(s.closeHotelDocument(), true);
  assert.equal(s.phase, 'playing');
}
function openGallery(s) {
  inspect(s, 'hotelLedger', 'ledger');
  inspect(s, 'hotelSuitcase', 'suitcase');
  at(s, 'hotelPanel'); assert.equal(s.purchase('hotelPanel'), true);
}
function tick(s, seconds) { for (let i = 0; i < Math.ceil(seconds / .05); i++) s.step(.05, idle); }

test('the ledger, suitcase, panel and register progress freely without changing the Tommy challenge', () => {
  const s = quiet(); const points = s.points;
  assert.deepEqual(s.hotelMystery, freshHotelMystery());
  openGallery(s);
  assert.deepEqual(s.hotelMystery, { ledgerFound: true, suitcaseFound: true, keyFound: true, passageOpen: true, registerFound: false, cacheClaimed: false });
  inspect(s, 'hotelRegister', 'register');
  at(s, 'hotelCache'); s.inventory.pistol.reserve = 0; s.grenades = 0;
  assert.equal(s.purchase('hotelCache'), true);
  assert.equal(s.hotelMystery.registerFound, true);
  assert.equal(s.hotelMystery.cacheClaimed, true);
  assert.equal(s.points, points);
  assert.equal(s.inventory.tommy.owned, false);
  assert.equal(s.hotelChallenge.phase, 'idle');
});

test('examining the suitcase first remembers it without revealing the lining or softlocking the key', () => {
  const s = quiet();
  inspect(s, 'hotelSuitcase', 'suitcase');
  assert.equal(s.hotelMystery.suitcaseFound, true);
  assert.equal(s.hotelMystery.keyFound, false);
  assert.doesNotMatch(getHotelMysteryDocument('suitcase', s.hotelMystery).body.join(' '), /still using my room|brass key/);
  at(s, 'hotelPanel'); assert.equal(s.purchase('hotelPanel'), false);
  inspect(s, 'hotelLedger', 'ledger');
  assert.equal(s.hotelMystery.keyFound, false);
  assert.match(getHotelMysteryDocument('suitcase', s.hotelMystery).lead, /Return/);
  inspect(s, 'hotelSuitcase', 'suitcase');
  assert.equal(s.hotelMystery.keyFound, true);
  assert.match(getHotelMysteryDocument('suitcase', s.hotelMystery).body.join(' '), /They’re still using my room/);
  const keyEvents = s.events.filter(e => e.type === 'purchase').length;
  inspect(s, 'hotelSuitcase', 'suitcase');
  assert.equal(s.events.filter(e => e.type === 'purchase').length, keyEvents);
  at(s, 'hotelPanel'); assert.equal(s.purchase('hotelPanel'), true);
});

test('the sealed gallery and final supplies require their actual preceding discoveries', () => {
  const s = quiet();
  for (const id of ['hotelPanel', 'hotelRegister', 'hotelCache']) {
    at(s, id); assert.equal(s.purchase(id), false, id);
  }
  assert.deepEqual(s.hotelMystery, freshHotelMystery());
  openGallery(s);
  at(s, 'hotelCache'); assert.equal(s.purchase('hotelCache'), false);
  assert.equal(s.hotelMystery.cacheClaimed, false);
});

test('mystery interactions reject locked hotel, distance, wrong floor, occlusion and pause', () => {
  for (const id of Object.keys(HOTEL_MYSTERY_ANCHORS)) {
    const s = quiet(false); at(s, id);
    assert.equal(s.purchase(id), false, `locked ${id}`);
    assert.notEqual(s.nearestPurchase()?.id, id);
    s.hotel = true; s.refreshMap();
    s.player.x += 3; assert.equal(s.purchase(id), false, `distant ${id}`);
    at(s, id); s.player.y = 1.5;
    assert.equal(s.purchase(id), false, `wrong floor ${id}`);
    assert.notEqual(s.nearestPurchase()?.id, id);
    at(s, id); s.player.z -= 1.4;
    s.rects = [...s.rects, { id: 'test-occluder', x: s.player.x, z: s.player.z + .7, w: 3, d: .2, h: 3 }];
    assert.equal(s.purchase(id), false, `occluded ${id}`);
    assert.notEqual(s.nearestPurchase()?.id, id);
    at(s, id); s.pause(); assert.equal(s.purchase(id), false, `paused ${id}`);
    assert.deepEqual(s.hotelMystery, freshHotelMystery());
  }
});

test('reading freezes combat, reloads, projectiles and clocks until the document closes', () => {
  const s = quiet(); at(s, 'hotelLedger');
  s.inventory.pistol.mag = 2; s.reload();
  s.projectiles = [{ id: 1, x: -10, y: .5, z: 22, vx: 1, vy: 1, vz: 1, fuse: .2 }];
  s.enemies = [{ id: 1, x: -9, y: 0, z: 23, surfaceId: 'ground', health: 80, maxHealth: 80, speed: 2, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 }];
  assert.equal(s.purchase('hotelLedger'), true);
  const snapshot = JSON.stringify([s.time, s.intermission, s.reloadRemaining, s.health, s.hotelAge, s.enemies, s.projectiles]);
  s.resume(); assert.equal(s.phase, 'paused');
  tick(s, 3);
  assert.equal(JSON.stringify([s.time, s.intermission, s.reloadRemaining, s.health, s.hotelAge, s.enemies, s.projectiles]), snapshot);
  assert.equal(s.fire(), false);
  assert.equal(s.throwGrenade(), false);
  assert.equal(s.closeHotelDocument(), true);
  tick(s, .1); assert.ok(s.time > 0);
});

test('the pause journal only reopens discovered clues and cannot advance or reward the mystery', () => {
  const s = quiet();
  assert.equal(s.readHotelDocument('ledger'), false);
  s.pause();
  for (const id of ['ledger', 'suitcase', 'register']) assert.equal(s.readHotelDocument(id), false);
  assert.equal(s.closeHotelDocument(), false); assert.equal(s.phase, 'paused');
  s.resume(); inspect(s, 'hotelLedger', 'ledger');
  s.pause();
  assert.equal(s.readHotelDocument('ledger'), true);
  assert.equal(s.readHotelDocument('suitcase'), false);
  assert.equal(s.hotelDocument, 'ledger');
  assert.equal(s.hotelMystery.keyFound, false);
  s.closeHotelDocument();
  s.pause(); s.shopOpen = true; assert.equal(s.readHotelDocument('ledger'), false);
  s.shopOpen = false; s.pokerOpen = 'poker-a'; assert.equal(s.readHotelDocument('ledger'), false);
  s.pokerOpen = null; s.phase = 'dead'; assert.equal(s.readHotelDocument('ledger'), false);
});

test('both gallery panels physically block passage and open together with rebuilt navigation', () => {
  const s = quiet();
  for (const gate of HOTEL_MYSTERY_GATES) {
    assert.ok(s.rects.some(r => r.id === gate.id));
    const p = { x: gate.x, y: 0, z: 44.9, surfaceId: 'ground' };
    moveActor(p, 0, 2.5, RULES.playerRadius, s.rects); assert.ok(p.z < 46);
    assert.equal(hasSight({ x: gate.x, z: 45 }, { x: gate.x, z: 47 }, s.rects), false);
  }
  s.navigation.update(HOTEL_MYSTERY_ANCHORS.hotelLedger);
  assert.equal(s.navigation.distance[s.navigation.index(HOTEL_MYSTERY_ANCHORS.hotelRegister)], -1);
  const oldRects = s.rects;
  openGallery(s);
  assert.notEqual(s.rects, oldRects);
  for (const gate of HOTEL_MYSTERY_GATES) {
    assert.equal(s.rects.some(r => r.id === gate.id), false);
    const p = { x: gate.x, y: 0, z: 44.9, surfaceId: 'ground' };
    moveActor(p, 0, 2.5, RULES.playerRadius, s.rects); assert.ok(p.z > 47);
    assert.equal(hasSight({ x: gate.x, z: 45 }, { x: gate.x, z: 47 }, s.rects), true);
  }
  for (const p of Object.values(HOTEL_MYSTERY_ANCHORS)) {
    assert.equal(collides(p, RULES.playerRadius, s.rects), false, JSON.stringify(p));
    assert.ok(s.navigation.distance[s.navigation.index(p)] >= 0, JSON.stringify(p));
  }
  at(s, 'hotelPanel'); assert.equal(s.purchase('hotelPanel'), false);
});

test('zombies can pursue through the unlocked gallery and its opposite exit', () => {
  const s = quiet(); openGallery(s);
  s.player = { x: 4, y: 0, z: 44.7, surfaceId: 'ground' };
  s.health = 1e6;
  s.enemies = [{ id: 1, x: -12, y: 0, z: 47.6, surfaceId: 'ground', health: 80, maxHealth: 80, speed: 2, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 }];
  tick(s, 25);
  assert.ok(dist(s.player, s.enemies[0]) < 1.3, JSON.stringify(s.enemies[0]));
  assert.ok(s.enemies[0].z < 46);
});

test('the cache grants bounded reserve and grenades once without unlocking weapons or filling magazines', () => {
  const s = quiet(); openGallery(s); inspect(s, 'hotelRegister', 'register');
  s.inventory.pistol.mag = 2; s.inventory.pistol.reserve = 80;
  s.inventory.shotgun = { owned: true, mag: 1, reserve: 0 };
  s.inventory.smg = { owned: true, mag: 3, reserve: 0 };
  s.grenades = 3; at(s, 'hotelCache');
  assert.equal(s.purchase('hotelCache'), true);
  assert.deepEqual(s.inventory.pistol, { owned: true, mag: 2, reserve: WEAPONS.pistol.reserve });
  assert.deepEqual(s.inventory.shotgun, { owned: true, mag: 1, reserve: 12 });
  assert.deepEqual(s.inventory.smg, { owned: true, mag: 3, reserve: 60 });
  assert.deepEqual(s.inventory.tommy, { owned: false, mag: 0, reserve: 0 });
  assert.equal(s.grenades, 4);
  const reward = JSON.stringify([s.inventory, s.grenades, s.points]);
  assert.equal(s.purchase('hotelCache'), false);
  assert.equal(JSON.stringify([s.inventory, s.grenades, s.points]), reward);
  assert.notEqual(s.nearestPurchase()?.id, 'hotelCache');
  for (const w of WEAPON_ORDER) assert.ok(s.inventory[w].reserve <= WEAPONS[w].reserve);
});

test('a full inventory preserves the cache until its supplies can be used', () => {
  const s = quiet(); openGallery(s); inspect(s, 'hotelRegister', 'register');
  s.grenades = 4; at(s, 'hotelCache');
  assert.equal(s.purchase('hotelCache'), false);
  assert.equal(s.hotelMystery.cacheClaimed, false);
  s.inventory.pistol.reserve -= 1;
  assert.equal(s.purchase('hotelCache'), true);
  assert.equal(s.inventory.pistol.reserve, WEAPONS.pistol.reserve);
});

test('mystery discoveries last across waves but every new run starts sealed and undiscovered', () => {
  const s = quiet(); openGallery(s); inspect(s, 'hotelRegister', 'register');
  const state = { ...s.hotelMystery };
  s.beginRound(); assert.deepEqual(s.hotelMystery, state);
  for (let i = 0; i < 2; i++) {
    const fresh = new Simulation();
    assert.deepEqual(fresh.hotelMystery, freshHotelMystery());
    assert.equal(fresh.hotelDocument, null);
    for (const gate of HOTEL_MYSTERY_GATES) assert.ok(fresh.rects.some(r => r.id === gate.id));
  }
});
