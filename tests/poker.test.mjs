import test from "node:test";
import assert from "node:assert/strict";
import {
  CARD_SUITS,
  POKER_RULES,
  POKER_TABLES,
  cardDeck,
  cardName,
  cardRank,
  dealPoker,
  exchangePokerCard,
  freshPokerState,
  isFlush,
  bestPokerSuit,
  suitSymbol,
} from "../lib/game/poker.ts";
import {
  Simulation,
  WEAPONS,
  WEAPON_ORDER,
  PRICES,
  PURCHASES,
  RULES,
  BAR_ANCHOR,
  ROULETTE_RULES,
  hasSight,
} from "../lib/game/simulation.ts";

const idle = { forward: 0, strafe: 0, sprint: false, fire: false };
const key = (card) => `${card.suit}/${card.rank}`;
const allCards = cardDeck().map(key).sort();
const tableIds = POKER_TABLES.map((table) => table.id);
const card = (rank, suit = "spades") => ({ rank, suit });
const nonFlush = [card(1), card(2), card(3), card(4), card(5, "hearts")];

function random(seed = 1) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function conserved(state, context = "") {
  assert.equal(state.hand.length, 5, context);
  const cards = [...state.hand, ...state.drawPile, ...state.discard];
  assert.equal(cards.length, 52, context);
  assert.equal(new Set(cards.map(key)).size, 52, context);
  assert.deepEqual(cards.map(key).sort(), allCards, context);
}

function advance(s, seconds, input = idle) {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++)
    s.step(Math.min(0.05, seconds - i * 0.05), input);
}

function approach(s, id = "poker-a") {
  const table = POKER_TABLES.find((table) => table.id === id);
  s.player = { x: table.x, z: table.approachZ };
}

function game(id = "poker-a") {
  const s = new Simulation();
  s.start();
  s.round = 3;
  s.intermission = 1e6;
  s.lounge = s.vip = true;
  s.refreshMap();
  s.points = 0; // Both the deal and the chosen exchange must be free.
  approach(s, id);
  return s;
}

function prepareHand(s, id = "poker-a", next = card(9, "clubs")) {
  const state = s.pokerTables[id];
  state.hand = structuredClone(nonFlush);
  const held = new Set(state.hand.map(key));
  state.drawPile = cardDeck().filter((c) => !held.has(key(c)) && key(c) !== key(next));
  state.drawPile.push({ ...next });
  state.discard = [];
  conserved(state);
  return state;
}

function leave(s) {
  s.closePoker();
  s.resume();
  assert.equal(s.phase, "playing");
}

function unlock(s, id = "poker-a") {
  prepareHand(s, id, card(8));
  approach(s, id);
  assert.equal(s.purchase(id), true);
  assert.equal(s.swapPoker(4), true);
  assert.equal(s.pokerTables[id].completed, true);
}

function mapState(s) {
  return structuredClone({
    lounge: s.lounge, vip: s.vip, tables: s.tables, shortcut: s.shortcut,
    rects: s.rects, walkRects: s.walkRects,
  });
}

test("the challenge exposes two table anchors, five cards and one free swap", () => {
  assert.deepEqual(POKER_RULES, { handSize: 5, swapsPerRound: 1 });
  assert.deepEqual(POKER_TABLES.map(({ id, x, z, approachZ }) => ({ id, x, z, approachZ })), [
    { id: "poker-a", x: 22, z: -3, approachZ: -4.7 },
    { id: "poker-b", x: 22, z: 5, approachZ: 3.3 },
  ]);
  for (const table of POKER_TABLES) {
    const purchase = PURCHASES.find((p) => p.id === table.id);
    assert.deepEqual({ x: purchase.x, z: purchase.z }, { x: table.x, z: table.approachZ });
    assert.equal(game(table.id).purchaseInfo(table.id).price, 0);
  }
});

test("a deck contains exactly every rank and suit once and owns its card objects", () => {
  const a = cardDeck(), b = cardDeck();
  assert.equal(a.length, 52);
  assert.equal(new Set(a.map(key)).size, 52);
  for (const suit of CARD_SUITS)
    assert.deepEqual(a.filter((c) => c.suit === suit).map((c) => c.rank).sort((x, y) => x - y),
      Array.from({ length: 13 }, (_, i) => i + 1));
  a[0].rank = 99;
  assert.equal(b[0].rank, 1);
  const state = freshPokerState(), other = freshPokerState();
  state.hand.push(card(1));
  assert.deepEqual(other, { hand: [], drawPile: [], discard: [], lastSwapRound: -1, swaps: 0, completed: false });
  assert.notEqual(state.drawPile, other.drawPile);
  assert.notEqual(state.discard, other.discard);
});

test("card labels cover all 52 cards, including face ranks and suit symbols", () => {
  const labels = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const names = ["Ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King"];
  for (const suit of CARD_SUITS)
    for (let rank = 1; rank <= 13; rank++) {
      assert.equal(cardRank(rank), labels[rank - 1]);
      assert.equal(cardName(card(rank, suit)), `${names[rank - 1]} of ${suit}`);
    }
  assert.deepEqual(CARD_SUITS.map(suitSymbol), ["♠", "♥", "♦", "♣"]);
});

test("all 1,024 five-card suit patterns win exactly when every suit matches", () => {
  for (let pattern = 0; pattern < 4 ** 5; pattern++) {
    const hand = Array.from({ length: 5 }, (_, i) => card(i + 1, CARD_SUITS[(pattern >> (i * 2)) & 3]));
    const expectedCount = Math.max(...CARD_SUITS.map((suit) => hand.filter((c) => c.suit === suit).length));
    assert.equal(isFlush(hand), expectedCount === 5, `pattern ${pattern}`);
    assert.equal(bestPokerSuit(hand).count, expectedCount, `pattern ${pattern}`);
  }
  for (const suit of CARD_SUITS) {
    // Every possible five-rank combination is a flush; a straight is not required.
    for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 10; b++)
      for (let c = b + 1; c <= 11; c++) for (let d = c + 1; d <= 12; d++)
        for (let e = d + 1; e <= 13; e++)
          assert.equal(isFlush([a, b, c, d, e].map((rank) => card(rank, suit))), true);
  }
  assert.equal(isFlush([card(1), card(1, "hearts"), card(1, "clubs"), card(1, "diamonds"), card(13)]), false);
  for (const length of [0, 1, 4, 6])
    assert.equal(isFlush(Array.from({ length }, (_, i) => card(i + 1))), false);
});

test("deals conserve all cards, draw only once, and permit a legitimate initial flush", () => {
  for (let seed = 0; seed < 64; seed++) {
    const state = freshPokerState();
    let draws = 0;
    const rng = random(seed);
    dealPoker(state, () => { draws++; return rng(); });
    conserved(state, `seed ${seed}`);
    assert.equal(state.drawPile.length, 47);
    assert.equal(state.discard.length, 0);
    assert.equal(draws, 51);
    const before = structuredClone(state);
    dealPoker(state, () => { throw Error("A saved hand must not be redealt"); });
    assert.deepEqual(state, before);
  }
  const state = freshPokerState();
  dealPoker(state, () => 1 - Number.EPSILON); // Legal Fisher–Yates identity shuffle.
  assert.deepEqual(state.hand, [9, 10, 11, 12, 13].map((rank) => card(rank, "clubs")));
  assert.equal(isFlush(state.hand), true);
});

test("every card exchange preserves 52 unique identities through repeated full deck recycling", () => {
  for (let seed = 0; seed < 12; seed++) {
    const rng = random(seed), state = freshPokerState();
    dealPoker(state, rng);
    const firstCycle = new Set(state.hand.map(key));
    for (let turn = 0; turn < 47 * 6; turn++) {
      const index = turn % 5, before = state.hand.slice();
      const oldDiscard = state.discard.map(key);
      const recycled = state.drawPile.length === 0;
      assert.equal(exchangePokerCard(state, index, rng), true);
      for (let i = 0; i < 5; i++)
        if (i !== index) assert.deepEqual(state.hand[i], before[i]);
      assert.notEqual(key(state.hand[index]), key(before[index]));
      assert.equal(key(state.discard.at(-1)), key(before[index]));
      if (recycled) {
        assert.ok(oldDiscard.includes(key(state.hand[index])));
        assert.equal(state.drawPile.length, 46);
        assert.equal(state.discard.length, 1);
      }
      if (turn < 47) firstCycle.add(key(state.hand[index]));
      conserved(state, `seed ${seed}, swap ${turn}`);
      assert.equal(state.swaps, turn + 1);
    }
    assert.equal(firstCycle.size, 52, `first full deck, seed ${seed}`);
  }
});

test("invalid indices and an empty replacement supply do not mutate or consume randomness", () => {
  const state = freshPokerState();
  dealPoker(state, random());
  state.discard = state.drawPile.splice(0); // Also exercise rejection at a recycle boundary.
  for (const index of [-1, 5, 999, 0.5, NaN, Infinity, -Infinity, undefined, null, "1"]) {
    const before = structuredClone(state);
    assert.equal(exchangePokerCard(state, index, () => { throw Error("Invalid input must not shuffle"); }), false);
    assert.deepEqual(state, before);
  }
  const empty = freshPokerState();
  empty.hand = structuredClone(nonFlush);
  const before = structuredClone(empty);
  assert.equal(exchangePokerCard(empty, 2, () => { throw Error("Nothing to shuffle"); }), false);
  assert.deepEqual(empty, before);
});

test("opening either table pauses immediately, persists its hand and never charges or opens gates", () => {
  const s = game(), map = mapState(s);
  s.random = random(4);
  const hands = {};
  for (const id of tableIds) {
    approach(s, id);
    assert.equal(s.purchase(id), true);
    assert.equal(s.phase, "paused");
    assert.equal(s.pokerOpen, id);
    assert.equal(s.shopOpen, false);
    assert.equal(s.points, 0);
    hands[id] = structuredClone(s.pokerTables[id]);
    assert.equal(hands[id].completed, false);
    s.resume();
    assert.equal(s.phase, "paused");
    s.closePoker();
    assert.equal(s.phase, "paused"); // The runtime explicitly resumes after dismissing the dialog.
    s.resume();
  }
  for (const id of tableIds) {
    approach(s, id);
    s.random = () => { throw Error("Opening saved cards must not deal again"); };
    assert.equal(s.openPoker(id), true);
    assert.deepEqual(s.pokerTables[id], hands[id]);
    leave(s);
  }
  assert.deepEqual(mapState(s), map);
  assert.notDeepEqual(hands["poker-a"].hand, hands["poker-b"].hand);
});

test("opening rejects locked, distant, obstructed, inactive and invalid table requests without dealing", () => {
  const blocked = {
    locked: (s) => { s.vip = false; s.refreshMap(); },
    distant: (s) => { s.player.x += 2.21; },
    obstructed: (s) => {
      const anchor = { ...s.player };
      s.player.x -= 1;
      s.rects.push({ id: "poker-test-screen", x: anchor.x - 0.5, z: anchor.z, w: 0.1, d: 1, h: 3 });
      assert.equal(hasSight(s.player, anchor, s.rects), false);
    },
    ready: (s) => { s.phase = "ready"; },
    paused: (s) => { s.pause(); },
    dead: (s) => { s.hurt(100); },
  };
  for (const id of tableIds) for (const [name, block] of Object.entries(blocked)) {
    const s = game(id);
    block(s);
    const before = structuredClone(s.pokerTables), inventory = structuredClone(s.inventory), map = mapState(s);
    s.random = () => { throw Error("Rejected opening must not deal"); };
    assert.equal(s.openPoker(id), false, `${id}/${name}`);
    assert.equal(s.purchase(id), false, `${id}/${name}`);
    assert.equal(s.pokerOpen, null);
    assert.deepEqual(s.pokerTables, before);
    assert.deepEqual(s.inventory, inventory);
    assert.deepEqual(mapState(s), map);
    assert.equal(s.points, 0);
  }
  assert.equal(game().openPoker("missing-table"), false);
});

test("one chosen card is exchanged per table per actual round and closing cannot reset the limit", () => {
  const s = game();
  for (const id of tableIds) {
    const state = prepareHand(s, id), original = structuredClone(state.hand);
    approach(s, id);
    assert.equal(s.openPoker(id), true);
    assert.equal(s.swapPoker(2), true);
    assert.deepEqual(state.hand[2], card(9, "clubs"));
    for (const i of [0, 1, 3, 4]) assert.deepEqual(state.hand[i], original[i]);
    assert.equal(state.lastSwapRound, 3);
    assert.equal(state.swaps, 1);
    assert.equal(s.pokerInfo(id).canSwap, false);
    const after = structuredClone(state);
    assert.equal(s.swapPoker(1), false);
    leave(s);
    assert.equal(s.openPoker(id), true);
    assert.equal(s.swapPoker(4), false);
    assert.deepEqual(state, after);
    leave(s);
  }
  assert.equal(s.points, 0);
  assert.equal(s.earned, 0);
  assert.equal(s.events.filter((e) => e.type === "cardSwap").length, 2);
});

test("the pre-wave deal counts as round one and intermission never grants an early extra exchange", () => {
  const s = game();
  s.round = 0;
  prepareHand(s);
  s.openPoker("poker-a");
  assert.equal(s.swapPoker(0), true);
  assert.equal(s.pokerTables["poker-a"].lastSwapRound, 1);
  leave(s);
  s.beginRound();
  s.openPoker("poker-a");
  assert.equal(s.round, 1);
  assert.equal(s.swapPoker(1), false);
  leave(s);
  s.intermission = 0;
  s.waveRemaining = 0;
  s.enemies = [];
  s.step(0.05, idle);
  assert.equal(s.intermission, RULES.intermission);
  s.openPoker("poker-a");
  assert.equal(s.pokerInfo("poker-a").canSwap, false);
  assert.equal(s.swapPoker(1), false);
  leave(s);
  advance(s, RULES.intermission + 0.1);
  assert.equal(s.round, 2);
  s.openPoker("poker-a");
  assert.equal(s.pokerInfo("poker-a").canSwap, true);
  assert.equal(s.swapPoker(1), true);
  assert.equal(s.pokerTables["poker-a"].lastSwapRound, 2);
});

test("invalid swap input preserves the free action, hand, chip balance and event stream", () => {
  for (const id of tableIds) {
    const s = game(id), state = prepareHand(s, id);
    s.openPoker(id);
    for (const index of [-1, 5, 0.1, NaN, Infinity, undefined, null, "0"]) {
      const before = structuredClone(state), events = structuredClone(s.events);
      assert.equal(s.swapPoker(index), false);
      assert.deepEqual(state, before);
      assert.deepEqual(s.events, events);
      assert.equal(s.pokerInfo(id).canSwap, true);
      assert.equal(s.points, 0);
    }
    assert.equal(s.swapPoker(0), true);
    assert.equal(state.swaps, 1);
  }
});

test("swap rechecks the active dialog, phase, VIP access, range and line of sight", () => {
  const blocked = {
    noDialog: (s) => { s.closePoker(); },
    shop: (s) => { s.shopOpen = true; },
    locked: (s) => { s.vip = false; },
    distant: (s) => { s.player.x += 2.21; },
    obstructed: (s) => {
      const anchor = { ...s.player };
      s.player.x -= 1;
      s.rects.push({ id: "poker-test-screen", x: anchor.x - 0.5, z: anchor.z, w: 0.1, d: 1, h: 3 });
    },
    playing: (s) => { s.phase = "playing"; },
    ready: (s) => { s.phase = "ready"; },
    dead: (s) => { s.phase = "dead"; },
  };
  for (const [name, block] of Object.entries(blocked)) {
    const s = game();
    prepareHand(s);
    s.openPoker("poker-a");
    block(s);
    const before = structuredClone(s.pokerTables), events = structuredClone(s.events);
    assert.equal(s.swapPoker(0), false, name);
    assert.deepEqual(s.pokerTables, before, name);
    assert.deepEqual(s.events, events, name);
  }
});

test("an open hand freezes enemies, movement, health and every in-flight game timer", () => {
  const s = game();
  prepareHand(s);
  s.health = 60;
  s.inventory.pistol.mag = 2;
  s.reload();
  s.fireCooldown = 0.3;
  s.damageBoostRemaining = 14;
  s.roundCue = "start";
  s.roundCueRemaining = 3;
  s.roulette = { id: 1, number: 7, remaining: 2, resolved: false, resultRemaining: 0, reward: null, weapon: null };
  s.dice = { values: [2, 3], round: 3, remaining: 1, resultRemaining: 0, resolved: false };
  s.enemies = [{ id: 1, x: 22, z: -6, health: 80, maxHealth: 80, speed: 1.7, yaw: 0, attack: 0.2, cooldown: 0, stuck: 0, flash: 0, age: 1 }];
  s.openPoker("poker-a");
  const snapshot = () => structuredClone({
    time: s.time, player: s.player, enemies: s.enemies, inventory: s.inventory,
    health: s.health, round: s.round, intermission: s.intermission, spawn: s.spawnTimer,
    reload: s.reloadRemaining, cooldown: s.fireCooldown, boost: s.damageBoostRemaining,
    cue: s.roundCueRemaining, damageAgo: s.damageAgo, invulnerable: s.invulnerable,
    roulette: s.roulette, dice: s.dice, poker: s.pokerTables, events: s.events,
    message: s.messageRemaining, loungeAge: s.loungeAge, vipAge: s.vipAge,
  });
  const before = snapshot();
  advance(s, 20, { forward: 1, strafe: 1, sprint: true, fire: true });
  assert.deepEqual(snapshot(), before);
  assert.equal(s.fire(), false);
  assert.equal(s.reload(), false);
  leave(s);
  s.step(0.05, idle);
  assert.ok(s.time > before.time);
  assert.ok(s.reloadRemaining < before.reload);
  assert.ok(s.roulette.remaining < before.roulette.remaining);
});

test("a legitimate initial flush unlocks and equips the revolver without spending the swap", () => {
  for (const id of tableIds) {
    const s = game(id), map = mapState(s);
    s.inventory.pistol.mag = 1;
    s.reload();
    s.random = () => 1 - Number.EPSILON;
    assert.equal(s.openPoker(id), true);
    const state = s.pokerTables[id];
    conserved(state);
    assert.equal(isFlush(state.hand), true);
    assert.equal(state.completed, true);
    assert.equal(state.swaps, 0);
    assert.equal(state.lastSwapRound, -1);
    assert.equal(s.flushRewardUnlocked, true);
    assert.equal(s.weapon, "revolver");
    assert.deepEqual(s.inventory.revolver, { owned: true, mag: 6, reserve: 48 });
    assert.equal(s.reloadRemaining, 0);
    assert.equal(s.pokerInfo(id).canSwap, false);
    assert.equal(s.events.filter((e) => e.type === "cardSwap").length, 0);
    assert.equal(s.events.filter((e) => e.type === "pokerFlush").length, 1);
    assert.equal(s.points, 0);
    assert.equal(s.earned, 0);
    assert.deepEqual(mapState(s), map);
  }
});

test("either table can unlock first; the other refills once while completed tables never repay", () => {
  for (const order of [tableIds, [...tableIds].reverse()]) {
    const s = game(order[0]), map = mapState(s);
    unlock(s, order[0]);
    assert.equal(s.pokerTables[order[1]].completed, false);
    assert.equal(s.flushRewardUnlocked, true);
    leave(s);
    s.inventory.revolver.mag = 1;
    s.inventory.revolver.reserve = 2;
    s.upgrades.revolver = true;
    s.switchWeapon("pistol");
    unlock(s, order[1]);
    assert.equal(s.weapon, "revolver");
    assert.deepEqual(s.inventory.revolver, { owned: true, mag: 6, reserve: WEAPONS.revolver.reserve });
    assert.equal(s.upgrades.revolver, true);
    leave(s);
    s.inventory.revolver.mag = 0;
    s.inventory.revolver.reserve = 0;
    s.switchWeapon("pistol");
    for (const id of order) {
      approach(s, id);
      s.beginRound();
      assert.equal(s.openPoker(id), true);
      assert.equal(s.pokerInfo(id).canSwap, false);
      assert.equal(s.swapPoker(0), false);
      assert.deepEqual(s.inventory.revolver, { owned: true, mag: 0, reserve: 0 });
      assert.equal(s.weapon, "pistol");
      leave(s);
    }
    assert.equal(s.events.filter((e) => e.type === "pokerFlush").length, 2);
    assert.equal(s.events.filter((e) => e.type === "cardSwap").length, 2);
    assert.equal(s.points, 0);
    assert.equal(s.earned, 0);
    assert.deepEqual(mapState(s), map);
  }
});

test("a new run resets both decks, completion, swap rounds, revolver ownership and upgrades", () => {
  const old = game();
  unlock(old);
  leave(old);
  old.upgrades.revolver = true;
  prepareHand(old, "poker-b");
  approach(old, "poker-b");
  old.openPoker("poker-b");
  old.swapPoker(1);
  const fresh = new Simulation();
  assert.equal(fresh.pokerOpen, null);
  assert.equal(fresh.flushRewardUnlocked, false);
  for (const id of tableIds) {
    assert.deepEqual(fresh.pokerTables[id], freshPokerState());
    assert.notEqual(fresh.pokerTables[id], old.pokerTables[id]);
  }
  assert.notEqual(fresh.pokerTables["poker-a"].hand, fresh.pokerTables["poker-b"].hand);
  assert.deepEqual(fresh.inventory.revolver, { owned: false, mag: 0, reserve: 0 });
  assert.equal(fresh.upgrades.revolver, false);
  assert.equal(fresh.weapon, "pistol");
  assert.equal(fresh.vip, false);
  assert.equal(fresh.phase, "ready");
});

test("the reward gun reloads only missing chambers and cannot be selected before unlocking", () => {
  const s = game();
  assert.equal(WEAPON_ORDER.filter((w) => w === "revolver").length, 1);
  s.switchWeapon("revolver");
  assert.equal(s.weapon, "pistol");
  unlock(s);
  leave(s);
  s.inventory.revolver.mag = 2;
  s.inventory.revolver.reserve = 8;
  assert.equal(s.reload(), true);
  assert.equal(s.reloadRemaining, WEAPONS.revolver.reload);
  assert.equal(s.reload(), false);
  advance(s, WEAPONS.revolver.reload + 0.05);
  assert.deepEqual(s.inventory.revolver, { owned: true, mag: 6, reserve: 4 });
  assert.equal(s.reload(), false);
  s.inventory.revolver.mag = 1;
  s.inventory.revolver.reserve = 2;
  s.reload();
  advance(s, WEAPONS.revolver.reload + 0.05);
  assert.deepEqual(s.inventory.revolver, { owned: true, mag: 3, reserve: 0 });
  assert.equal(s.reload(), false);
});

test("revolver upgrades retain six chambers, improve reload and damage, and share both upgrade shops", () => {
  for (const station of ["bar", "workshop"]) {
    const s = game();
    unlock(s);
    leave(s);
    s.points = 10000;
    s.inventory.revolver.mag = 0;
    s.inventory.revolver.reserve = 3;
    s.reload();
    if (station === "bar") {
      s.player = { ...BAR_ANCHOR };
      assert.equal(s.openBar(), true);
      assert.equal(s.purchaseBar("weaponUpgrade"), true);
    } else {
      const p = PURCHASES.find((p) => p.id === "upgrade");
      s.player = { x: p.x, z: p.z };
      assert.equal(s.purchase("upgrade"), true);
    }
    assert.equal(s.points, 10000 - PRICES.upgrade);
    assert.equal(s.capacity("revolver"), 6);
    assert.equal(s.weaponName(), WEAPONS.revolver.upgradedName);
    assert.equal(s.weaponDamage(), Math.round(WEAPONS.revolver.damage * 1.35));
    assert.equal(s.reloadDuration(), WEAPONS.revolver.reload * 0.75);
    assert.deepEqual(s.inventory.revolver, { owned: true, mag: 6, reserve: 3 });
    assert.equal(s.reloadRemaining, 0);
    if (station === "bar") {
      assert.equal(s.purchaseBar("weaponUpgrade"), false);
      s.closeBar(); s.resume();
    } else assert.equal(s.purchase("upgrade"), false);
    s.perks.quickPour = true;
    assert.ok(Math.abs(s.reloadDuration() - WEAPONS.revolver.reload * 0.75 * 0.7) < 1e-10);
    s.inventory.revolver.mag = 0;
    s.inventory.revolver.reserve = 8;
    assert.equal(s.reload(), true);
    advance(s, s.reloadDuration() + 0.05);
    assert.deepEqual(s.inventory.revolver, { owned: true, mag: 6, reserve: 2 });
    for (const weapon of WEAPON_ORDER.filter((w) => w !== "revolver")) {
      s.upgrades[weapon] = true;
      assert.equal(s.capacity(weapon), Math.round(WEAPONS[weapon].magazine * 1.5));
      assert.equal(s.reloadDuration(weapon), WEAPONS[weapon].reload * 0.7);
    }
  }
});

test("revolver shots consume one chamber and apply base, upgraded, boosted and headshot damage", () => {
  for (const upgraded of [false, true]) for (const boosted of [false, true])
    for (const headshot of [false, true]) {
      const s = game();
      unlock(s);
      leave(s);
      s.upgrades.revolver = upgraded;
      s.damageBoostRemaining = boosted ? 10 : 0;
      s.player = { x: -12, z: -5 };
      s.yaw = 0;
      s.pitch = headshot ? 0 : Math.atan2(1.65 - 1.0, 4);
      s.random = () => 0.5; // Center the test shot, independent of weapon spread.
      s.fireCooldown = 0;
      const enemy = { id: 1, x: -12, z: -1, health: 2000, maxHealth: 2000, speed: 0, yaw: 0, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 1 };
      s.enemies = [enemy];
      const expected = Math.round(WEAPONS.revolver.damage * (upgraded ? 1.35 : 1)) *
        (boosted ? ROULETTE_RULES.damageMultiplier : 1) * (headshot ? 2 : 1);
      assert.equal(s.fire(), true);
      assert.equal(enemy.health, 2000 - expected, JSON.stringify({ upgraded, boosted, headshot }));
      assert.equal(s.inventory.revolver.mag, 5);
      assert.equal(s.inventory.revolver.reserve, WEAPONS.revolver.reserve);
      assert.equal(s.fireCooldown, WEAPONS.revolver.interval);
      assert.equal(s.events.filter((e) => e.type === "shot" && e.weapon === "revolver").length, 1);
      assert.equal(s.fire(), false);
      assert.equal(s.inventory.revolver.mag, 5);
    }
});
