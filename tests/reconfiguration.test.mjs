import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, PURCHASES, SPAWN_RECORDS, ALL_SPAWNS, RULES, WEAPONS, collides, moveActor, hasSight } from '../lib/game/simulation.ts';
import { CASINO_ROOMS, CASINO_ANCHORS, CRAPS_TABLES, ROULETTE_TABLES, SLOT_ISLANDS } from '../lib/game/casino-layout.ts';
import { POKER_TABLES } from '../lib/game/poker.ts';
import { HOTEL } from '../lib/game/world.ts';
const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const tick = (s, seconds) => { for (let t = 0; t < seconds; t += .05)
    s.step(.05, idle); };
function game() { const s = new Simulation(); s.start(); s.points = 100000; s.round = 3; s.intermission = 0; s.waveRemaining = 1; s.spawnTimer = 1e6; return s; }
function approach(s, id) { const p = PURCHASES.find(p => p.id === id); assert.ok(p, id); s.player = { x: p.x, y: p.y ?? 0, z: p.z }; return p; }
function buy(s, id) { approach(s, id); return s.purchase(id); }
const tableGames = ['craps', 'craps-b', 'roulette', 'roulette-b', 'poker-a'];
test('approved grand casino dimensions, games and starting position retain exact hotel footprint', () => {
    const room = CASINO_ROOMS.casino, s = game();
    assert.equal(room.maxX - room.minX, 60);
    assert.equal(room.maxZ - room.minZ, 32);
    assert.equal(SLOT_ISLANDS.length, 8);
    assert.equal(CRAPS_TABLES.length, 2);
    assert.equal(ROULETTE_TABLES.length, 2);
    assert.equal(POKER_TABLES.filter(t => t.x > room.minX && t.x < room.maxX && t.z > room.minZ && t.z < room.maxZ).length, 1);
    assert.equal(collides(s.player, RULES.playerRadius, s.rects), false);
    assert.equal(s.player.x, CASINO_ANCHORS.spawn.x);
    assert.equal(s.player.z, CASINO_ANCHORS.spawn.z);
    const xs = HOTEL.lobbyPolygon.map(p => p.x), zs = HOTEL.lobbyPolygon.map(p => p.z);
    assert.equal(Math.max(...xs) - Math.min(...xs), 38);
    assert.equal(Math.max(...zs) - Math.min(...zs), 36);
    for (const id of tableGames)
        assert.equal(s.purchaseInfo(id).reason, '', id);
    assert.ok(s.purchaseInfo('poker-b').reason);
    assert.ok(s.purchaseInfo('rifle').reason);
    assert.ok(Object.values(s.doorsOpen).every(v => !v));
    assert.equal(s.hotel, false);
});
test('all game and weapon approaches clear solid fixtures and reach active casino spawns', () => {
    const s = game();
    for (const id of ['lounge', 'shortcut', 'vip', 'vipExit', 'cashier', 'hotel', 'supply'])
        assert.equal(buy(s, id), true, id);
    for (const id of [...tableGames, 'poker-b', 'shotgun', 'smg', 'rifle', 'pistolAmmo', 'upgrade', 'bartender']) {
        const p = approach(s, id);
        assert.equal(collides(p, RULES.playerRadius, s.rects), false, id);
        s.navigation.update(p);
        for (const { position, room } of SPAWN_RECORDS)
            if (room === 'casino')
                assert.ok(s.navigation.distance[s.navigation.index(position)] >= 0, `${id} from ${JSON.stringify(position)}`);
    }
});
test('each bought door alone activates its room and preserves the unpaid second entrance', () => {
    for (const pair of [['lounge', 'shortcut'], ['vip', 'vipExit']])
        for (const first of pair) {
            const s = game(), other = pair.find(id => id !== first);
            assert.equal(buy(s, first), true);
            const points = s.points;
            assert.equal(s.doorsOpen[first], true);
            assert.equal(s.doorsOpen[other], false);
            assert.ok(s.rects.some(r => r.id === other));
            assert.ok(!s.rects.some(r => r.id === first));
            assert.equal(s[pair[0]], true);
            assert.equal(buy(s, first), false);
            assert.equal(s.points, points);
            tick(s, 3.1);
            const age = s[pair[0] + 'Age'];
            assert.ok(age > 3);
            assert.equal(buy(s, other), true);
            assert.equal(s[pair[0] + 'Age'], age, 'Second door must not reset existing room spawn grace');
        }
});
test('only starting casino spawns activate initially and every added room has its own grace', () => {
    const s = game();
    for (const [i, r] of SPAWN_RECORDS.entries())
        assert.equal(s.spawnEnabled(i), r.room === 'casino', r.room);
    for (const [door, room] of [['shortcut', 'lounge'], ['vipExit', 'vip'], ['cashier', 'cashier'], ['hotel', 'hotel'], ['supply', 'supply']]) {
        assert.equal(buy(s, door), true, door);
        const indices = SPAWN_RECORDS.flatMap((r, i) => r.room === room ? [i] : []);
        assert.ok(indices.length);
        for (const i of indices)
            assert.equal(s.spawnEnabled(i), false, room);
        tick(s, 3.1);
        for (const i of indices)
            assert.equal(s.spawnEnabled(i), true, room);
    }
    assert.equal(s.spawnEnabled(-1), false);
    assert.equal(s.spawnEnabled(ALL_SPAWNS.length), false);
});
test('supply rifle requires hotel and supply purchases while the hotel mystery remains independent', () => {
    const s = game();
    assert.equal(buy(s, 'supply'), false);
    assert.equal(buy(s, 'rifle'), false);
    assert.equal(buy(s, 'hotel'), true);
    assert.equal(buy(s, 'rifle'), false);
    assert.equal(buy(s, 'supply'), true);
    assert.equal(buy(s, 'rifle'), true);
    assert.equal(s.inventory.rifle.owned, true);
    assert.equal(s.hotelMystery.passageOpen, false);
    assert.equal(s.hotelMystery.cacheClaimed, false);
    assert.ok(s.rects.some(r => r.id.startsWith('hotel-gallery') || r.id.startsWith('hotel-mystery')));
});
test('cashier hall is purchased but glass and unavailable rear floor remain sealed', () => {
    const s = game();
    const before = { x: 25, z: -16 }, inside = { x: 30, z: -16 };
    assert.equal(hasSight(before, inside, s.rects), false);
    assert.equal(buy(s, 'cashier'), true);
    assert.equal(hasSight(before, inside, s.rects), true);
    const p = { ...inside };
    moveActor(p, 0, 12, .32, s.rects);
    assert.ok(p.z < -12.5);
    assert.equal(collides(p, .32, s.rects), false);
    assert.equal(collides({ x: 35, z: -7 }, .32, s.rects), true);
    assert.equal(hasSight({ x: 35, z: -14 }, { x: 35, z: -8 }, s.rects, 1.65), true, 'Intact glass permits viewing the cash');
    assert.ok(!PURCHASES.some(p => /trap|stair/i.test(p.id)));
});
test('two craps tables independently charge and resolve one wager each during the same round', () => {
    const s = game();
    s.points = 1000;
    s.random = () => .7;
    assert.equal(buy(s, 'craps'), true);
    assert.equal(buy(s, 'craps-b'), true);
    assert.equal(s.points, 500);
    assert.notEqual(s.diceTables.craps, s.diceTables['craps-b']);
    assert.equal(s.dice, s.diceTables.craps);
    for (const id of ['craps', 'craps-b'])
        assert.equal(buy(s, id), false);
    tick(s, 1.7);
    assert.equal(s.points, 1500);
    assert.equal(s.earned, 1000);
    assert.equal(s.events.filter(e => e.type === 'diceWin').length, 2);
    for (const id of ['craps', 'craps-b']) {
        assert.equal(s.lastWagerRounds[id], 3);
        assert.equal(s.diceTables[id].resolved, true);
        assert.equal(buy(s, id), false);
    }
    tick(s, 7);
    assert.equal(s.points, 1500);
    s.beginRound();
    for (const id of ['craps', 'craps-b'])
        assert.equal(buy(s, id), true);
});
test('double seven shares a single 20-percent curse and boundary-crossing wagers keep per-table limits', () => {
    const s = game();
    let draws = 0;
    s.random = () => draws++ % 2 ? .51 : .34;
    for (const id of ['craps', 'craps-b'])
        assert.equal(buy(s, id), true);
    tick(s, 1.7);
    assert.equal(s.slowRound, 3);
    s.player = { x: -3, z: -9 };
    s.yaw = 0;
    s.step(.05, { ...idle, forward: 1 });
    assert.ok(Math.abs(s.player.z + 9 - RULES.walk * .8 * .05) < 1e-8);
    s.beginRound();
    assert.equal(s.slowed, false);
    for (const id of ['craps', 'craps-b'])
        assert.equal(buy(s, id), true);
    s.waveRemaining = 0;
    s.enemies = [];
    tick(s, 1.7);
    assert.equal(s.slowRound, 5);
    for (const id of ['craps', 'craps-b'])
        assert.equal(s.lastWagerRounds[id], 5);
    s.intermission = 0;
    s.beginRound();
    assert.equal(s.slowed, true);
    for (const id of ['craps', 'craps-b'])
        assert.equal(buy(s, id), false);
});
test('both roulette wheels spin concurrently and independently award results at their own tables', () => {
    const s = game();
    s.points = 1000;
    s.inventory.pistol.mag = 0;
    s.inventory.pistol.reserve = 0;
    s.random = () => 4.5 / 37;
    assert.equal(buy(s, 'roulette'), true);
    tick(s, 1);
    s.random = () => 1.5 / 37;
    assert.equal(buy(s, 'roulette-b'), true);
    assert.equal(s.points, 600);
    assert.equal(buy(s, 'roulette-b'), false);
    assert.notEqual(s.rouletteTables.roulette, s.rouletteTables['roulette-b']);
    tick(s, 5.1);
    assert.equal(s.rouletteTables.roulette.reward, 'ammo');
    assert.equal(s.rouletteTables['roulette-b'].resolved, false);
    assert.equal(s.inventory.pistol.reserve, WEAPONS.pistol.reserve);
    tick(s, 1);
    assert.equal(s.rouletteTables['roulette-b'].reward, 'miss');
    assert.equal(s.points, 600);
    for (const { id, x, z } of ROULETTE_TABLES) {
        const event = s.events.find(e => e.type === (id === 'roulette' ? 'rouletteWin' : 'rouletteMiss'));
        assert.deepEqual({ x: event.position.x, z: event.position.z }, { x, z });
    }
    assert.equal(buy(s, 'roulette-b'), true);
    assert.equal(s.points, 400);
});
test('pause and death freeze every table; a new run clears all table states', () => {
    for (const mode of ['pause', 'death']) {
        const s = game();
        for (const id of ['craps', 'craps-b', 'roulette', 'roulette-b'])
            assert.equal(buy(s, id), true);
        tick(s, .5);
        if (mode === 'pause')
            s.pause();
        else
            s.hurt(100);
        const snapshot = structuredClone({ dice: s.diceTables, roulette: s.rouletteTables, wagers: s.lastWagerRounds, points: s.points });
        tick(s, 10);
        assert.deepEqual({ dice: s.diceTables, roulette: s.rouletteTables, wagers: s.lastWagerRounds, points: s.points }, snapshot);
    }
    const fresh = new Simulation();
    assert.deepEqual(fresh.diceTables, { craps: null, 'craps-b': null });
    assert.deepEqual(fresh.rouletteTables, { roulette: null, 'roulette-b': null });
    assert.deepEqual(fresh.lastWagerRounds, { craps: -1, 'craps-b': -1 });
});
