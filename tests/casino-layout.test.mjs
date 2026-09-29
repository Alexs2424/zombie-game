import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASINO_ROOMS, CASINO_WALLS, CASINO_FIXTURES, CASINO_DOORS, CASINO_ANCHORS,
  CASINO_SPAWNS, CRAPS_TABLES, ROULETTE_TABLES,
} from '../lib/game/casino-layout.ts';
import { LOUNGE_RECTS } from '../lib/game/lounge-layout.ts';
import { SERVICE_RECTS } from '../lib/game/service-layout.ts';
import { POKER_TABLES } from '../lib/game/poker.ts';
import { HOTEL, HOTEL_RECTS, Navigation, collides, moveActor, hasSight, raycastWorld } from '../lib/game/world.ts';
import { HOTEL_GATE } from '../lib/game/hotel-gameplay.ts';

const solids = [...CASINO_WALLS, ...CASINO_FIXTURES, ...HOTEL_RECTS, ...LOUNGE_RECTS, ...SERVICE_RECTS];
const ground = (x, z) => ({ x, z, y: 0, surfaceId: 'ground' });

test('grand casino is 60 by 32 metres and the hotel footprint remains exact', () => {
  const casino = CASINO_ROOMS.casino;
  assert.equal(casino.maxX - casino.minX, 60);
  assert.equal(casino.maxZ - casino.minZ, 32);
  assert.deepEqual(HOTEL.lobbyPolygon.map(p => [p.x, p.z]),
    [[-15, 15], [7, 15], [15, 23], [15, 43], [7, 51], [-15, 51], [-23, 43], [-23, 23]]);
  assert.equal(collides(CASINO_ANCHORS.spawn, 0.32, solids), false);
});

test('every annex gate blocks the actor while closed and connects its rooms when open', () => {
  for (const [id, door] of Object.entries(CASINO_DOORS)) {
    const vertical = door.w < door.d;
    const start = ground(door.x + (vertical ? 1.3 : 0), door.z + (vertical ? 0 : 1.3));
    const target = ground(door.x - (vertical ? 1.2 : 0), door.z - (vertical ? 0 : 1.2));
    const closed = { ...start };
    moveActor(closed, target.x - start.x, target.z - start.z, 0.32, [...solids, door]);
    assert.ok(Math.hypot(closed.x - target.x, closed.z - target.z) > 0.8, `${id} remains shut`);
    const open = { ...start };
    moveActor(open, target.x - start.x, target.z - start.z, 0.32, solids);
    assert.ok(Math.hypot(open.x - target.x, open.z - target.z) < 0.001, `${id} opening can be crossed`);
  }
});

test('cashier glass allows sight, stops projectiles and keeps its rear area inaccessible', () => {
  const visitor = ground(35, -15), cash = ground(35, -9);
  assert.equal(hasSight(visitor, cash, solids, 1.65), true);
  const hit = raycastWorld({ ...visitor, y: 1.65 }, { x: 0, y: 0, z: 1 }, solids, 6);
  assert.ok(hit && hit.distance > 2.8 && hit.distance < 3.1, 'the intact glass stops the shot');
  moveActor(visitor, 0, 6, 0.32, solids);
  assert.ok(visitor.z < -12.9, 'the counter stops the player in the public room');
  assert.equal(collides(cash, 0.32, solids), true, 'staff room has no traversable player surface');
});

test('the hotel and supply doors gate the supply route independently', () => {
  const nav = new Navigation();
  nav.rebuild([...solids, HOTEL_GATE, CASINO_DOORS.supply]);
  nav.update(CASINO_ANCHORS.spawn);
  assert.equal(nav.distance[nav.index(CASINO_ANCHORS.rifle)], -1);
  nav.rebuild([...solids, CASINO_DOORS.supply]);
  nav.update(CASINO_ANCHORS.spawn);
  assert.equal(nav.distance[nav.index(CASINO_ANCHORS.rifle)], -1);
  nav.rebuild(solids);
  nav.update(CASINO_ANCHORS.spawn);
  assert.ok(nav.distance[nav.index(CASINO_ANCHORS.rifle)] > 0);
});

test('navigation reaches every relocated interaction and spawn without placing them in solids', () => {
  const nav = new Navigation();
  nav.rebuild(solids);
  nav.update(CASINO_ANCHORS.spawn);
  const approaches = [...CRAPS_TABLES, ...ROULETTE_TABLES, ...POKER_TABLES].map(t => ({ x: t.x, z: t.approachZ }));
  const points = [...Object.values(CASINO_ANCHORS), ...approaches, ...Object.values(CASINO_SPAWNS).flat()];
  for (const point of points) {
    assert.equal(collides(point, 0.32, solids), false, `clear footing at ${JSON.stringify(point)}`);
    assert.ok(nav.distance[nav.index(point)] >= 0, `reachable point ${JSON.stringify(point)}`);
  }
});
