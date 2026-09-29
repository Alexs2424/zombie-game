import test from 'node:test';
import assert from 'node:assert/strict';
import { Navigation, HOTEL, stairPoint } from '../lib/game/world.ts';
import { STATIC_RECTS, DOORS } from '../lib/game/simulation.ts';
import { HOTEL_MYSTERY_GATES } from '../lib/game/hotel-mystery.ts';
import { SECRET_DOOR } from '../lib/game/casino.ts';

const doors = [...Object.values(DOORS), ...HOTEL_MYSTERY_GATES, SECRET_DOOR];
const ground = (x, z) => ({ x, z, y: 0, surfaceId: 'ground' });
const targets = [ground(-3, -16.5), ground(-30, 40),
  { x: -4, z: 40, y: 4, surfaceId: 'hotel-upper' }, stairPoint(HOTEL.stairs[0], .5)];
let referenceId = 0;
function freshReference(rects) {
  const reference = new Navigation();
  // Different IDs bypass the shared gate-state cache and the door optimization.
  // Geometry/collision is identical, so this exercises the full rebuild oracle.
  const prefix = `full-reference-${referenceId++}-`;
  reference.rebuild(rects.map(rect => ({ ...rect, id: prefix + rect.id })));
  return reference;
}
function assertGraph(actual, reference, label) {
  assert.deepEqual(actual.blocked, reference.blocked, `${label}: blocked nodes`);
  assert.deepEqual(Array.from({ length: actual.blocked.length }, (_, i) => actual.neighbors(i)),
    Array.from({ length: reference.blocked.length }, (_, i) => reference.neighbors(i)), `${label}: every directed edge`);
  for (const target of targets) {
    actual.update(target); reference.update(target);
    assert.deepEqual(actual.distance, reference.distance, `${label}: flow field at ${JSON.stringify(target)}`);
  }
}

test('incremental door changes match fresh complete graphs, including both hotel floors', () => {
  const nav = new Navigation();
  let rects = [...STATIC_RECTS, ...doors];
  nav.rebuild(rects);
  // Open different kinds of doorway in several batches, then close them in a
  // different order. Both independent paid entrances and gallery panels matter.
  for (const ids of [
    ['lounge'], ['vipExit', 'cashier'], ['hotel', 'supply'],
    ['hotel-secret-left'], ['hotel-secret-right', 'speakeasy'], ['shortcut', 'vip'],
  ]) {
    rects = rects.filter(rect => !ids.includes(rect.id));
    nav.rebuild(rects);
    assertGraph(nav, freshReference(rects), `open ${ids.join(', ')}`);
  }
  for (const ids of [['hotel', 'speakeasy'], ['hotel-secret-right', 'supply'], ['lounge', 'vipExit', 'shortcut']]) {
    rects = [...rects, ...doors.filter(door => ids.includes(door.id))];
    nav.rebuild(rects);
    assertGraph(nav, freshReference(rects), `close ${ids.join(', ')}`);
  }
});

test('all 1,024 door combinations preserve full-rebuild node and edge connectivity', () => {
  const open = freshReference(STATIC_RECTS);
  const baseEdges = Array.from({ length: open.blocked.length }, (_, i) => open.neighbors(i));
  const count = open.blocked.length + baseEdges.reduce((sum, edges) => sum + edges.length, 0);
  const flags = nav => {
    const values = new Uint8Array(count);
    values.set(nav.blocked);
    let offset = nav.blocked.length;
    for (let i = 0; i < baseEdges.length; i++) {
      const edges = nav.neighbors(i);
      let at = 0;
      for (const neighbor of baseEdges[i]) {
        const present = edges[at] === neighbor;
        values[offset++] = +!present;
        if (present) at++;
      }
      assert.equal(at, edges.length, 'No edge may appear beyond the static graph');
    }
    return values;
  };
  // Static geometry and each individual closed door are evaluated with the
  // full algorithm. A union of colliders blocks precisely the union of these
  // nodes/edges: no walking sample can pass a blocker by adding another one.
  const masks = new Uint16Array(count);
  const staticFlags = flags(open);
  for (let i = 0; i < count; i++) if (staticFlags[i]) masks[i] = 1 << 15;
  for (let d = 0; d < doors.length; d++) {
    const blocked = flags(freshReference([...STATIC_RECTS, doors[d]]));
    for (let i = 0; i < count; i++) if (blocked[i]) masks[i] |= 1 << d;
  }
  const nav = new Navigation(), expected = new Uint8Array(count);
  for (let state = 0; state < 1 << doors.length; state++) {
    // Gray-code order changes one door at a time, including closing doors and
    // states beyond the 32-entry cache. This forces continuing local rebuilds.
    const closed = state ^ (state >> 1);
    nav.rebuild([...STATIC_RECTS, ...doors.filter((_, i) => closed & (1 << i))]);
    for (let i = 0; i < count; i++) expected[i] = +(!!(masks[i] & (closed | (1 << 15))));
    assert.deepEqual(flags(nav), expected, `door mask ${closed}`);
  }
});

test('moved rotated doors and changed static geometry retain the full-rebuild result', () => {
  const nav = new Navigation();
  const moving = { ...DOORS.lounge };
  const rects = [...STATIC_RECTS.map(rect => ({ ...rect })), moving];
  nav.rebuild(rects);
  // Reuse the same array and object to exercise retained old bounds and spatial
  // cache invalidation, including a rotated blocker on the curved staircase.
  Object.assign(moving, { x: -18.8, z: 30, w: 2.4, d: .5, baseY: 1.2, h: 3.5, yaw: Math.PI / 3 });
  nav.rebuild(rects);
  assertGraph(nav, freshReference(rects), 'moved elevated rotated door');
  const wall = rects.find(rect => rect.id === 'craps-table');
  wall.x += 3; wall.yaw = .4;
  nav.rebuild(rects);
  assertGraph(nav, freshReference(rects), 'moved static table');
  rects.pop();
  nav.rebuild(rects);
  assertGraph(nav, freshReference(rects), 'door removed after static change');
});

test('cached graphs remain independent when another simulation changes doors', () => {
  const shared = [...STATIC_RECTS, ...doors];
  const first = new Navigation(), second = new Navigation();
  first.rebuild(shared); second.rebuild(shared);
  const blocked = second.blocked.slice();
  const edges = Array.from({ length: blocked.length }, (_, i) => [...second.neighbors(i)]);
  first.rebuild(STATIC_RECTS);
  assert.deepEqual(second.blocked, blocked);
  assert.deepEqual(Array.from({ length: blocked.length }, (_, i) => second.neighbors(i)), edges);
  first.rebuild(shared);
  assertGraph(first, second, 'restored cached door state');
});
