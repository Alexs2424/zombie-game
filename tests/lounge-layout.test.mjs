import test from "node:test";
import assert from "node:assert/strict";
import { BAR_ANCHOR, PURCHASES, ALL_SPAWNS, SPAWN_RECORDS, Simulation, collides, dist, moveActor } from "../lib/game/simulation.ts";
import { LOUNGE_OFFSET } from "../lib/game/casino-layout.ts";
const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const at = (x, z) => ({ x: x + LOUNGE_OFFSET.x, z: z + LOUNGE_OFFSET.z });
function buy(s, id) { s.player = { ...PURCHASES.find(p => p.id === id) }; return s.purchase(id); }
function lounge(doors = ['lounge']) { const s = new Simulation(); s.start(); s.intermission = 1e6; s.points = 100000; for (const id of doors)
    assert.equal(buy(s, id), true); s.loungeAge = 5; s.refreshMap(); return s; }
function walk(s, points) { const p = { ...points[0] }; assert.equal(collides(p, .32, s.rects), false); for (const target of points.slice(1)) {
    moveActor(p, target.x - p.x, target.z - p.z, .32, s.rects);
    assert.ok(dist(p, target) < 1e-8, JSON.stringify({ p, target }));
} s.player = p; }
test('both separately purchased bar entrances form a walkable furnished loop', () => {
    const s = lounge(['lounge', 'shortcut']);
    walk(s, [{ x: -31, z: -2 }, { x: -37.2, z: -2 }, { x: -37.2, z: -9.1 }, { x: -34.1, z: -9.1 }, { x: -34.1, z: -14 }, { x: -31, z: -14 }, { x: -31, z: -2 }]);
});
test('bartender and SMG remain approachable from the north bar entrance', () => {
    const s = lounge(), entry = { x: -34, z: -2 };
    walk(s, [entry, { x: -37.2, z: -2 }, { x: -37.2, z: -9.1 }, { x: -38, z: -9.1 }, BAR_ANCHOR]);
    assert.equal(s.openBar(), true);
    s.closeBar();
    s.resume();
    const smg = PURCHASES.find(p => p.id === 'smg');
    walk(s, [entry, { x: -44, z: -2 }, { x: -44, z: smg.z }, smg]);
    assert.equal(s.purchase('smg'), true);
});
test('translated booths, tables, stools and counter retain solid footprints', () => {
    const s = lounge();
    for (const [a, b] of [[[7, -4.8], [7, -10.5]], [[10.3, -2], [10.3, 2]], [[13.8, -2.8], [13.8, .5]], [[10, -6], [10, -7.35]], [[14.1, -6], [14.1, -7.35]], [[12, -7.3], [12, -10.3]], [[12, -10.3], [12, -11.6]]]) {
        const from = at(...a), to = at(...b), p = { ...from };
        assert.equal(collides(p, .32, s.rects), false);
        moveActor(p, to.x - p.x, to.z - p.z, .32, s.rects);
        assert.ok(dist(p, to) > .5, JSON.stringify({ from, to, p }));
        assert.equal(collides(p, .32, s.rects), false);
    }
});
test('closed bar doors isolate lounge activities and block both entrance lanes', () => {
    const s = new Simulation();
    for (const z of [-2, -14]) {
        const p = { x: -31, z };
        moveActor(p, -5, 0, .32, s.rects);
        assert.ok(p.x > -33);
    }
    s.navigation.update({ x: -31, z: -2 });
    for (const p of [BAR_ANCHOR, PURCHASES.find(p => p.id === 'smg')])
        assert.equal(s.navigation.distance[s.navigation.index(p)], -1);
    s.player = { ...BAR_ANCHOR };
    assert.equal(s.openBar(), false);
    for (const [i, p] of SPAWN_RECORDS.entries())
        if (p.room === 'lounge')
            assert.equal(s.spawnEnabled(i), false);
});
test('either bar entrance connects every enabled spawn to bartender and SMG', () => {
    for (const doors of [['lounge'], ['shortcut'], ['lounge', 'shortcut']]) {
        const s = lounge(doors);
        for (const target of [BAR_ANCHOR, PURCHASES.find(p => p.id === 'smg'), { x: -35, z: -2 }, { x: -34.1, z: -14 }]) {
            assert.equal(collides(target, .32, s.rects), false);
            s.navigation.update(target);
            for (const [i, spawn] of ALL_SPAWNS.entries())
                if (s.spawnEnabled(i))
                    assert.ok(s.navigation.distance[s.navigation.index(spawn)] >= 0, JSON.stringify({ target, spawn, doors }));
        }
    }
});
test('zombies route around translated bar, booth and cocktail table without relocation', () => {
    for (const [from, target] of [[{ x: -43.5, z: 2.5 }, BAR_ANCHOR], [at(10.3, -2), at(10.3, 2)], [at(13.8, -3), at(13.8, 1)]]) {
        const s = lounge();
        s.player = { ...target };
        s.invulnerable = 100;
        s.refreshMap();
        const e = { ...from, id: 1, health: 80, maxHealth: 80, speed: 1.7, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 };
        s.enemies = [e];
        let reached = false;
        for (let t = 0; t < 40; t += .05) {
            const previous = { ...e };
            s.step(.05, idle);
            assert.ok(dist(previous, e) <= e.speed * .05 + 1e-8, 'Zombie relocated');
            assert.equal(collides(e, .3, s.rects), false);
            if (dist(e, target) < 1.3) {
                reached = true;
                break;
            }
        }
        assert.ok(reached, JSON.stringify({ from, target, e }));
    }
});
