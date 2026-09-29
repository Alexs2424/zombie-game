import test from "node:test";
import assert from "node:assert/strict";
import { SERVICE_RECTS, SERVICE_VIEWS } from "../lib/game/service-layout.ts";
import { Simulation, RULES, ALL_SPAWNS, PURCHASES, collides, dist, moveActor, hasSight, wallDistance } from "../lib/game/simulation.ts";
import { SERVICE_OFFSET, CASINO_ANCHORS } from "../lib/game/casino-layout.ts";
const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const at = (x, z) => ({ x: x + SERVICE_OFFSET.x, z: z + SERVICE_OFFSET.z });
const enemy = (p) => ({ ...p, id: 1, health: 80, maxHealth: 80, speed: 1.7, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0 });
function corridor(open = true) {
    const s = new Simulation();
    s.start();
    s.intermission = 1e6;
    s.points = 100000;
    s.invulnerable = 100;
    if (open)
        for (const id of ['hotel', 'supply']) {
            const p = PURCHASES.find(p => p.id === id);
            s.player = { ...p };
            assert.equal(s.purchase(id), true);
        }
    s.hotelAge = s.supplyAge = 5;
    s.refreshMap();
    return s;
}
function walk(s, points) {
    const p = { ...points[0] };
    assert.equal(collides(p, RULES.playerRadius, s.rects), false);
    for (const target of points.slice(1)) {
        moveActor(p, target.x - p.x, target.z - p.z, RULES.playerRadius, s.rects);
        assert.ok(dist(p, target) < 1e-8, JSON.stringify({ p, target }));
    }
}
test("relocated truck and every storage fixture stop actors without trapping them", () => {
    const s = corridor();
    for (const rect of SERVICE_RECTS) {
        const from = { x: rect.x, z: rect.z + (rect.z < 43 ? 1 : -1) * (rect.d / 2 + .6) };
        for (const radius of [RULES.playerRadius, RULES.enemyRadius]) {
            const p = { ...from };
            assert.equal(collides(p, radius, s.rects), false, rect.id);
            moveActor(p, rect.x - p.x, rect.z - p.z, radius, s.rects);
            assert.ok(dist(p, rect) > rect.d / 2, rect.id);
            assert.equal(collides(p, radius, s.rects), false, rect.id);
            moveActor(p, from.x - p.x, from.z - p.z, radius, s.rects);
            assert.ok(dist(p, from) < 1e-8, rect.id);
        }
    }
});
test("supply entrance, truck aisle, rifle, and inspection cameras remain accessible", () => {
    const s = corridor();
    walk(s, [{ x: -22, z: 40 }, { x: -23.7, z: 40 }, { x: -23.7, z: 38.7 }, { x: -28.3, z: 38.7 }, { x: -28.3, z: 43.6 }, { x: -35, z: 43.6 }, { x: -35.6, z: 43.6 }, { x: -35.6, z: 47.5 }, CASINO_ANCHORS.rifle]);
    for (const [name, [x, z]] of Object.entries(SERVICE_VIEWS))
        assert.equal(collides({ x, z }, RULES.playerRadius, s.rects), false, name);
});
test("all enabled spawns reach truck and storage approaches through the hotel", () => {
    const s = corridor();
    for (const target of [at(5.1, 8.6), at(11.7, 4), at(14.5, 8.6), at(6.5, 9.9), at(13.9, 9.6), CASINO_ANCHORS.rifle]) {
        assert.equal(collides(target, .32, s.rects), false, JSON.stringify(target));
        s.navigation.update(target);
        for (const [i, from] of ALL_SPAWNS.entries())
            if (s.spawnEnabled(i))
                assert.ok(s.navigation.distance[s.navigation.index(from)] >= 0, JSON.stringify({ target, from }));
    }
});
test("locked supply entrance isolates the storage room until its own purchase", () => {
    const s = corridor(false);
    s.hotel = true;
    s.refreshMap();
    const p = { x: -22, z: 40 };
    moveActor(p, -5, 0, .32, s.rects);
    assert.ok(p.x > -23);
    s.navigation.update({ x: -22, z: 40 });
    assert.equal(s.navigation.distance[s.navigation.index(at(11.7, 8.6))], -1);
    s.player = { ...PURCHASES.find(p => p.id === 'supply') };
    assert.equal(s.purchase('supply'), true);
    walk(s, [{ x: -22, z: 40 }, { x: -23.7, z: 40 }, { x: -23.7, z: 38.7 }, { x: -28.3, z: 38.7 }]);
});
test("zombies pursue around relocated truck and loaded pallet without relocation", () => {
    for (const [a, b] of [[[5, 3.7], [8, 8.6]], [[14.5, 3.8], [14.5, 8.6]], [[15.3, 9.65], [11.7, 10.95]], [[17, 5], [11.7, 4]]]) {
        const from = at(...a), target = at(...b), s = corridor();
        s.player = { ...target };
        s.refreshMap();
        const e = enemy(from);
        s.enemies = [e];
        assert.equal(collides(e, .3, s.rects), false, JSON.stringify(from));
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
test("truck and cartons block bullets while aisle and low-pallet sight stay clear", () => {
    for (const [a, b, covered] of [[[8, 3.7], [8, 8.6], true], [[14.5, 3.8], [14.5, 8.6], true], [[11.7, 4], [11.7, 8.6], false]]) {
        const from = at(...a), target = at(...b), s = corridor();
        s.player = { ...from };
        s.yaw = 0;
        s.pitch = 0;
        const e = enemy(target);
        s.enemies = [e];
        assert.equal(hasSight(from, target, s.rects, 1.65), !covered);
        assert.equal(s.fire(), true);
        assert.equal(e.health < 80, !covered);
    }
    const s = corridor();
    assert.ok(wallDistance({ ...at(13.9, 9), y: 1 }, { x: 0, y: 0, z: 1 }, s.rects) < 2);
    assert.ok(wallDistance({ ...at(13.9, 9), y: 1.65 }, { x: 0, y: 0, z: 1 }, s.rects) > 2.5);
});
test("relocated truck blocks grenade blast and bounces a thrown grenade", () => {
    const s = corridor();
    s.player = at(8, 3.7);
    s.yaw = 0;
    s.pitch = 0;
    const e = enemy(at(8, 7.5));
    e.speed = 0;
    s.enemies = [e];
    s.projectiles = [{ id: 1, ...at(8, 4.1), y: .2, vx: 0, vy: 0, vz: 0, fuse: .01 }];
    s.step(.05, idle);
    assert.equal(e.health, 80);
    assert.equal(s.throwGrenade(), true);
    for (let n = 0; n < 5; n++)
        s.step(.05, idle);
    assert.ok(s.projectiles[0].z < 39.375);
    assert.ok(s.projectiles[0].vz < 0);
});
