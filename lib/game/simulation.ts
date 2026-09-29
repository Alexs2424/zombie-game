import { RANGE_RECTS } from './test-range-layout.ts';
/** Pure gameplay state. Rendering, audio, input, and wall-clock time live outside this module. */
import {
  POKER_TABLES,
  freshPokerState,
  dealPoker,
  exchangePokerCard,
  isFlush,
  type PokerTableId,
} from "./poker.ts";
export { POKER_RULES } from "./poker.ts";
import { ATTACK_WINDUP, zombieHitVolumes, type HitRegion, type Limb } from "./zombie-pose.ts";
import { HOTEL_RULES, HOTEL_GATE, HOTEL_ANCHORS, HOTEL_SPAWNS, freshHotelChallenge } from "./hotel-gameplay.ts";
export { HOTEL_RULES, HOTEL_ANCHORS, HOTEL_SPAWNS } from "./hotel-gameplay.ts";
import {
  HOTEL_MYSTERY_ANCHORS, HOTEL_MYSTERY_GATES, freshHotelMystery,
  isHotelMysteryInteraction, type HotelDocumentId, type HotelMysteryInteractionId,
} from "./hotel-mystery.ts";
import {
  HOTEL_RECTS, hotelRoomName, collides, moveActor, wallDistance,
  hasSight, canWalkDirect, Navigation, raycastWorld,
  type WorldPosition, type WorldRect,
} from "./world.ts";
export { collides, moveActor, wallDistance, hasSight, Navigation } from "./world.ts";
import { LOUNGE_RECTS } from "./lounge-layout.ts";
import { BET_TARGETS, KEYPAD_TARGETS, PLACE_NUMBERS, SECRET_CODE, SECRET_DOOR, SECRET_ROOM, SECRET_RECTS, CASINO_SECRET_ANCHORS, RELIC_NAMES, placeAmount, placeProfit, type PlaceNumber } from "./casino.ts";
import { AXE_CABINET, EXTRA_WEAPONS, MYSTERY_POOL, bloomPerShot, meleeContactTime, meleeDuration, isMelee, isShellLoading, maxBloom, penetration, recoilPitch, weaponSpeed, type ExtraWeaponId } from "./weapon-expansion.ts";
import { SERVICE_RECTS } from "./service-layout.ts";
import {
  CASINO_BOUNDS, CASINO_WALLS, CASINO_FIXTURES, CASINO_DOORS, CASINO_ANCHORS,
  CASINO_SPAWNS, CRAPS_TABLES, ROULETTE_TABLES, casinoRoomName,
} from "./casino-layout.ts";
export type CrapsTableId = "craps" | "craps-b";
export type RouletteTableId = "roulette" | "roulette-b";
export type CasinoDoorId = keyof typeof CASINO_DOORS;
export type DiceRoll = {
  values: [number, number]; round: number; remaining: number;
  resultRemaining: number; resolved: boolean; quickWager?: boolean;
};
export type V2 = { x: number; z: number };
export type V3 = V2 & { y: number };
export type Rect = WorldRect;
export type WeaponId = "pistol" | "shotgun" | "smg" | "rifle" | "revolver" | ExtraWeaponId;
export const WEAPON_ORDER: WeaponId[] = [
  "pistol",
  "shotgun",
  "smg",
  "rifle",
  "revolver",
  "tommy",
  ...(Object.keys(EXTRA_WEAPONS) as ExtraWeaponId[]).filter(id => id !== "tommy"),
];
// The Velvet Fortune cabinet awards the ten 1970s firearms from docs/weapon-spec-1970s.md.
export const MYSTERY_WEAPONS: WeaponId[] = [...MYSTERY_POOL];
export type PerkId = "reserve" | "quickPour" | "nightShift";
export type BarItemId = PerkId | "weaponUpgrade";
export const PERKS: Record<
  PerkId,
  { name: string; price: number; detail: string }
> = {
  reserve: { name: "House Reserve", price: 1500, detail: "+50 maximum health" },
  quickPour: { name: "Quick Pour", price: 1000, detail: "Reload 30% faster" },
  nightShift: { name: "Night Shift", price: 900, detail: "Sprint 15% faster" },
};
export const BAR_ANCHOR = CASINO_ANCHORS.bartender;
export type Phase = "ready" | "playing" | "paused" | "dead";
export type PurchaseId =
  | "pistolAmmo"
  | "shotgun"
  | "smg"
  | "rifle"
  | "bartender"
  | "lounge"
  | "shortcut"
  | "vip"
  | "upgrade"
  | "tables"
  | CasinoDoorId
  | CrapsTableId
  | RouletteTableId
  | "painting"
  | "mystery"
  | "stick"
  | "axe"
  | "hotel"
  | "hotelBell"
  | "tommyAmmo"
  | "jukebox"
  | HotelMysteryInteractionId
  | PokerTableId;
export type GameEvent = {
  type:
    | "shot"
    | "melee"
    | "stickBreak"
    | "knife"
    | "grenadeThrow"
    | "explosion"
    | "hit"
    | "kill"
    | "hurt"
    | "purchase"
    | "deny"
    | "reload"
    | "reloadDone"
    | "dry"
    | "pickup"
    | "meleeHit"
    | "round"
    | "roundClear"
    | "mysterySpin"
    | "diceRoll"
    | "diceWin"
    | "diceCurse"
    | "rouletteSpin"
    | "rouletteWin"
    | "rouletteJackpot"
    | "rouletteMiss"
    | "cardSwap"
    | "pokerFlush"
    | "zombieAttack"
    | "hotelBell"
    | "hotelComplete"
    | "hotelFail"
    | "jukebox"
    | "death";
  weapon?: WeaponId;
  /** Double or Nothing's both-barrel blast. */
  alternate?: boolean;
  /** Snake Eyes: 0 = right pistol, 1 = left pistol. Melee: zombies struck. */
  side?: number;
  count?: number;
  headshot?: boolean;
  enemyId?: number;
  position?: WorldPosition;
  text?: string;
};
export type Enemy = WorldPosition & {
  id: number;
  health: number;
  maxHealth: number;
  speed: number;
  yaw: number;
  attack: number;
  cooldown: number;
  stuck: number;
  flash: number;
  age: number;
  attackStyle?: number;
  missing?: Partial<Record<Limb, boolean>>;
  limbDamage?: Partial<Record<Limb, number>>;
  wounds?: Partial<Record<HitRegion, number>>;
  hotelAmbush?: boolean;
  /** Co-op attacks retain their selected victim through the windup. */
  targetId?: string;
};
export type Grenade = V3 & { ownerId?: string; id: number; vx: number; vy: number; vz: number; fuse: number; kind?: "grenade" | "flare"; damage?: number };
export const RULES = {
  playerRadius: 0.32,
  enemyRadius: 0.3,
  health: 100,
  walk: 4.8,
  sprint: 6.8,
  regenDelay: 5.5,
  regenRate: 18,
  hurtGrace: 0.7,
  attackDamage: 20,
  attackRange: 1.05,
  attackWindup: ATTACK_WINDUP,
  cap: 14,
  headshotReward: 100,
  killReward: 50,
  startingPoints: 400,
  intermission: 8,
};
export const WEAPONS = {
  ...EXTRA_WEAPONS,
  pistol: {
    name: "HOUSE SPECIAL",
    upgradedName: "LOADED DICE",
    price: 0,
    label: "Pistol",
    magazine: 12,
    reserve: 84,
    damage: 34,
    pellets: 1,
    interval: 0.22,
    reload: 1.5,
    spread: 0.004,
    refill: 150,
  },
  shotgun: {
    name: "ROOM SERVICE",
    upgradedName: "HOUSE SWEEPER",
    price: 800,
    label: "Shotgun",
    magazine: 6,
    reserve: 30,
    damage: 14,
    pellets: 8,
    interval: 0.8,
    reload: 2.5,
    spread: 0.07,
    refill: 300,
  },
  smg: {
    name: "DEALER’S CHOICE",
    upgradedName: "FULL HOUSE",
    label: "SMG",
    price: 1100,
    magazine: 30,
    reserve: 180,
    damage: 24,
    pellets: 1,
    interval: 0.085,
    reload: 1.9,
    spread: 0.013,
    refill: 400,
  },
  rifle: {
    name: "PIT BOSS",
    upgradedName: "ROYAL FLUSH",
    label: "Rifle",
    price: 1600,
    magazine: 24,
    reserve: 120,
    damage: 48,
    pellets: 1,
    interval: 0.18,
    reload: 2.4,
    spread: 0.007,
    refill: 500,
  },
  revolver: {
    name: "THE DEAD MAN’S HAND",
    upgradedName: "ACE OF SPADES",
    label: "Revolver",
    price: 0,
    magazine: 6,
    reserve: 48,
    damage: 110,
    pellets: 1,
    interval: 0.5,
    reload: 2.6,
    spread: 0.003,
    refill: 400,
  },
};
export const PRICES = {
  shotgun: 800,
  smg: 1100,
  rifle: 1600,
  lounge: 900,
  shortcut: 600,
  vip: 1300,
  vipExit: 800,
  supply: 1200,
  cashier: 600,
  upgrade: 2000,
  tables: 1500,
  craps: 250,
  roulette: 200,
  painting: 0,
  mystery: 400,
  hotel: HOTEL_RULES.price,
};
export const ROULETTE_RULES = {
  spinDuration: 6,
  resultDuration: 6,
  damageDuration: 30,
  damageMultiplier: 2,
} as const;
export type RouletteSpin = {
  id: number;
  number: number;
  remaining: number;
  resolved: boolean;
  resultRemaining: number;
  reward: "ammo" | "maxAmmo" | "jackpot" | "miss" | null;
  weapon: WeaponId | null;
};
export const BOUNDS = { ...CASINO_BOUNDS, maxX: SECRET_ROOM.maxX };
export function roomName(p: WorldPosition) {
  if (p.x >= 90 && p.x <= 118) return "Mechanics test range";
  if (p.x >= SECRET_ROOM.minX && p.x <= SECRET_ROOM.maxX && p.z >= SECRET_ROOM.minZ && p.z <= SECRET_ROOM.maxZ) return SECRET_ROOM.name;
  return casinoRoomName(p) ?? hotelRoomName(p) ?? "Casino Floor";
}
export const STATIC_RECTS: Rect[] = [
  ...HOTEL_RECTS, ...CASINO_WALLS.filter(r => r.id !== "cashier-wall-east"), ...SECRET_RECTS, ...CASINO_FIXTURES,
  ...LOUNGE_RECTS, ...SERVICE_RECTS,
];
export const DOORS = { hotel: HOTEL_GATE, ...CASINO_DOORS } satisfies Record<string, Rect>;
const DOOR_DETAILS: Record<CasinoDoorId, {name: string; detail: string}> = {
  lounge: { name: "Last Call Lounge", detail: "Open the north bar entrance" },
  shortcut: { name: "Lounge south entrance", detail: "Purchase this entrance to complete the bar loop" },
  vip: { name: "High Roller Club", detail: "Open the west High Roller entrance" },
  vipExit: { name: "High Roller east entrance", detail: "Purchase this entrance to complete the High Roller loop" },
  supply: { name: "Supply room", detail: "Truck, storage and the Pit Boss rifle" },
  cashier: { name: "Cashier", detail: "Open the cashier hall · secure back area remains closed" },
};
export const PURCHASES: {
  id: PurchaseId;
  x: number;
  z: number;
  y?: number;
  name: string;
  detail: string;
}[] = [
  { id: "hotel", ...HOTEL_ANCHORS.hotel, name: "Grand Hotel", detail: "Unlock the lobby and upstairs restaurant" },
  { id: "hotelBell", ...HOTEL_ANCHORS.hotelBell, name: "Last service · ring the bell", detail: "Stay in the restaurant for 35s and clear the ambush · unlock Tommy gun" },
  { id: "tommyAmmo", ...HOTEL_ANCHORS.tommyAmmo, name: "Chicago Typewriter ammunition", detail: "Refill Tommy gun reserve" },
  { id: "jukebox", ...HOTEL_ANCHORS.jukebox, name: "Grand Hotel jukebox", detail: "Toggle the music · free" },
  { id: "hotelLedger", ...HOTEL_MYSTERY_ANCHORS.hotelLedger, name: "Guest ledger", detail: "Inspect the unfinished departure entry" },
  { id: "hotelSuitcase", ...HOTEL_MYSTERY_ANCHORS.hotelSuitcase, name: "Varga’s suitcase", detail: "Inspect the luggage left at reception" },
  { id: "hotelPanel", ...HOTEL_MYSTERY_ANCHORS.hotelPanel, name: "Concealed service panel", detail: "A small brass keyhole in the woodwork" },
  { id: "hotelRegister", ...HOTEL_MYSTERY_ANCHORS.hotelRegister, name: "Collection register", detail: "Read the book beside the abandoned luggage" },
  { id: "hotelCache", ...HOTEL_MYSTERY_ANCHORS.hotelCache, name: "Service supplies", detail: "Two magazines per owned weapon · two grenades" },
  ...POKER_TABLES.map((table) => ({
    id: table.id,
    x: table.x,
    z: table.approachZ,
    name: table.name,
    detail:
      "Make a flush · five cards of one suit · one free swap per table each round",
  })),
  { id: "pistolAmmo", ...CASINO_ANCHORS.pistolAmmo, name: "Pistol ammunition", detail: "Refill reserve" },
  { id: "shotgun", ...CASINO_ANCHORS.shotgun, name: "Room Service", detail: "Pump shotgun" },
  { id: "smg", ...CASINO_ANCHORS.smg, name: "Dealer’s Choice", detail: "Fast-firing SMG" },
  { id: "rifle", ...CASINO_ANCHORS.rifle, name: "Pit Boss", detail: "Heavy automatic rifle" },
  { id: "bartender", ...BAR_ANCHOR, name: "Marlowe · bartender", detail: "Cocktail perks & weapon upgrades" },
  ...(Object.entries(CASINO_DOORS) as [CasinoDoorId, Rect][]).map(([id, door]) => ({
    id,
    // Accessible from the casino (or hotel for supply), just in front of the gate.
    x: door.x + (id === "lounge" || id === "shortcut" || id === "supply" ? 0.9 : id === "cashier" ? -0.9 : 0),
    z: door.z + (id === "vip" || id === "vipExit" ? 0.9 : 0),
    ...DOOR_DETAILS[id],
  })),
  ...CRAPS_TABLES.map(table => ({
    id: table.id, x: table.x, z: table.approachZ,
    name: `Seven’s Curse · ${table.id === "craps" ? "Table I" : "Table II"}`,
    detail: "250 chips · 7 slows you 20% this round · other rolls pay 500 chips · once per table per round",
  })),
  ...ROULETTE_TABLES.map(table => ({
    id: table.id, x: table.x, z: table.approachZ,
    name: `Lucky Four roulette · ${table.id === "roulette" ? "Table I" : "Table II"}`,
    detail: "4 / 24: equipped ammo · 7: all ammo · 0: all ammo + 30s double damage · 200 chips every spin",
  })),
  { id: "upgrade", ...CASINO_ANCHORS.upgrade, name: "Double Down workshop", detail: "Upgrade your equipped weapon" },
  { id:"stick", ...CASINO_SECRET_ANCHORS.stick, name:"Stickman · craps rake · 3 SWEEPS", detail:"E: take · sweeping melee · breaks after 3 successful hits" },
  { id:"axe", x:AXE_CABINET.x, z:AXE_CABINET.z-.9, name:"Fire Exit · fire axe", detail:"E: take · heavy melee · never breaks" },
  { id:"painting", ...CASINO_SECRET_ANCHORS.painting, name:"The crooked portrait", detail:"A draft slips through the frame. E: slide painting" },
  { id:"mystery", ...CASINO_SECRET_ANCHORS.mystery, name:"The Velvet Fortune", detail:"400 chips · 50% special weapon · 50% nothing" },
];
export type SpawnRoom = keyof typeof CASINO_SPAWNS | "hotel";
export const SPAWN_RECORDS: {room: SpawnRoom; position: WorldPosition}[] = [
  ...Object.entries(CASINO_SPAWNS).flatMap(([room, positions]) => positions.map(position => ({ room: room as SpawnRoom, position }))),
  ...HOTEL_SPAWNS.map(position => ({ room: "hotel" as const, position })),
];
export const SPAWNS: WorldPosition[] = SPAWN_RECORDS.filter(s => s.room !== "hotel").map(s => s.position);
export const ALL_SPAWNS: WorldPosition[] = SPAWN_RECORDS.map(s => s.position);
export const dist = (a: WorldPosition, b: WorldPosition) =>
  Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0), a.z - b.z);
export function rayBox(o: V3, d: V3, min: V3, max: V3): number {
  let near = 0,
    far = Infinity;
  for (const axis of ["x", "y", "z"] as const) {
    if (Math.abs(d[axis]) < 1e-8) {
      if (o[axis] < min[axis] || o[axis] > max[axis]) return Infinity;
    } else {
      let a = (min[axis] - o[axis]) / d[axis],
        b = (max[axis] - o[axis]) / d[axis];
      if (a > b) [a, b] = [b, a];
      near = Math.max(near, a);
      far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return far >= 0 ? near : Infinity;
}
function raySphere(o: V3, d: V3, c: V3, r: number) {
  const x = o.x - c.x,
    y = o.y - c.y,
    z = o.z - c.z,
    b = x * d.x + y * d.y + z * d.z,
    k = x * x + y * y + z * z - r * r,
    v = b * b - k;
  return v < 0
    ? Infinity
    : -b - Math.sqrt(v) > 0
      ? -b - Math.sqrt(v)
      : Infinity;
}
export function waveStats(round: number) {
  return {
    count: [6, 9, 12, 16, 20][round - 1] ?? 20 + (round - 5) * 4,
    health: Math.min(300, 70 + round * 10),
    speed: Math.min(3.4, 1.5 + round * 0.2),
    cadence: Math.max(0.5, 1.65 - round * 0.15),
  };
}

export class Simulation {
  /** Empty in solo; assigned by the authoritative co-op room. */
  actorId = "";
  phase: Phase = "ready";
  player: WorldPosition = { ...CASINO_ANCHORS.spawn, y: 0, surfaceId: "ground" };
  yaw = 0.16;
  pitch = 0;
  health = 100;
  points = 400;
  round = 0;
  kills = 0;
  headshots = 0;
  earned = 0;
  time = 0;
  waveRemaining = 0;
  intermission = 1;
  spawnTimer = 0;
  lounge = false;
  shortcut = false;
  vip = false;
  // Legacy table-room state is retained for integrations; casino games are always open.
  tables = true;
  speakeasy = false;
  speakeasyAge = 0;
  paintingOpen = false;
  codeProgress = 0;
  codeFlash = 0;
  holdingChips = false;
  aimHeld = false;
  get aiming() {
    return this.aimHeld && this.phase === "playing" && !this.holdingChips &&
      !isMelee(this.weapon) && this.reloadRemaining <= 0 && this.knifeRemaining <= 0 && this.grenadeCooldown <= 0;
  }
  betBanksByTable: Record<CrapsTableId, Partial<Record<PlaceNumber, number>>> = { craps: {}, "craps-b": {} };
  betsByTable: Record<CrapsTableId, Partial<Record<PlaceNumber, number>>> = { craps: {}, "craps-b": {} };
  crapsResults: Record<CrapsTableId, string> = { craps: "", "craps-b": "" };
  get betBanks() { return this.betBanksByTable.craps; }
  set betBanks(value: Partial<Record<PlaceNumber, number>>) { this.betBanksByTable.craps = value; }
  get bets() { return this.betsByTable.craps; }
  set bets(value: Partial<Record<PlaceNumber, number>>) { this.betsByTable.craps = value; }
  get crapsResult() { return this.crapsResults.craps; }
  set crapsResult(value: string) { this.crapsResults.craps = value; }
  chipValue = 25;
  relics: Partial<Record<WeaponId, boolean>> = {};
  mystery: { remaining: number; reward: WeaponId | null; resolved: boolean; message: string } | null = null;
  tablesAge = 0;
  supply = false;
  cashier = false;
  supplyAge = 0;
  cashierAge = 0;
  doorsOpen: Record<CasinoDoorId, boolean> = {
    lounge: false, shortcut: false, vip: false, vipExit: false, supply: false, cashier: false,
  };
  hotel = false;
  hotelAge = 0;
  hotelChallenge = freshHotelChallenge();
  hotelMystery = freshHotelMystery();
  hotelDocument: HotelDocumentId | null = null;
  jukeboxOn = false;
  get hotelChallengeAlive() {
    return this.enemies.filter(e => e.hotelAmbush && e.health > 0).length;
  }
  lastWagerRounds: Record<CrapsTableId, number> = { craps: -1, "craps-b": -1 };
  slowRound = 0;
  diceTables: Record<CrapsTableId, DiceRoll | null> = { craps: null, "craps-b": null };
  rouletteTables: Record<RouletteTableId, RouletteSpin | null> = { roulette: null, "roulette-b": null };
  get dice() { return this.diceTables.craps; }
  set dice(value: DiceRoll | null) { this.diceTables.craps = value; }
  get roulette() { return this.rouletteTables.roulette; }
  set roulette(value: RouletteSpin | null) { this.rouletteTables.roulette = value; }
  get lastWagerRound() { return this.lastWagerRounds.craps; }
  set lastWagerRound(value: number) { this.lastWagerRounds.craps = value; }
  damageBoostRemaining = 0;
  pokerTables = { "poker-a": freshPokerState(), "poker-b": freshPokerState() };
  pokerOpen: PokerTableId | null = null;
  flushRewardUnlocked = false;
  private rouletteSpinId = 0;
  get slowed() {
    return (
      this.slowRound === this.round && this.round > 0 && this.intermission <= 0
    );
  }
  get wagerRound() {
    return Math.max(1, this.round + (this.intermission > 0 ? 1 : 0));
  }
  upgrades = Object.fromEntries(WEAPON_ORDER.map(id => [id, false])) as Record<WeaponId, boolean>;
  stickTaken = false;
  axeTaken = false;
  /** Consecutive-fire spread growth in radians; decays when the trigger rests. */
  bloom = 0;
  /** The firearm to return to when the craps rake breaks. */
  lastFirearm: WeaponId = "pistol";
  meleeRemaining = 0;
  private meleeWeapon: WeaponId | null = null;
  fires: (V3 & {ownerId?:string; id:number; remaining:number; tick:number; damage:number})[] = [];
  perks: Record<PerkId, boolean> = {
    reserve: false,
    quickPour: false,
    nightShift: false,
  };
  shopOpen = false;
  roundCue: "start" | "clear" | null = null;
  roundCueRemaining = 0;
  get upgraded() {
    return this.upgrades.shotgun;
  }
  get maxHealth() {
    return this.perks.reserve ? 150 : RULES.health;
  }
  loungeAge = 0;
  vipAge = 0;
  weapon: WeaponId = "pistol";
  inventory = Object.fromEntries(WEAPON_ORDER.map(id => [id, {
    owned: id === "pistol", mag: id === "pistol" ? 12 : 0, reserve: id === "pistol" ? 84 : 0,
  }])) as Record<WeaponId, {owned:boolean; mag:number; reserve:number}>;
  enemies: Enemy[] = [];
  corpses: { enemy: Enemy; age: number }[] = [];
  grenades = 2;
  projectiles: Grenade[] = [];
  explosions: (V3 & { id: number; remaining: number })[] = [];
  knifeRemaining = 0;
  knifeCooldown = 0;
  grenadeCooldown = 0;
  /** Shared allocator in co-op so projectile IDs stay unique across players. */
  nextGrenadeId = 1;
  events: GameEvent[] = [];
  rects: Rect[] = [];
  walkRects: Rect[] = [];
  navigation = new Navigation();
  reloadRemaining = 0;
  fireCooldown = 0;
  damageAgo = 100;
  invulnerable = 0;
  navTimer = 0;
  nextId = 1;
  moving = false;
  sprinting = false;
  lastMessage = "";
  messageRemaining = 0;
  private seed = 527;
  private priorPhase: Phase = "playing";
  readonly testRange: boolean;
  constructor(testRange = false) {
    this.testRange = testRange;
    this.refreshMap();
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  refreshMap() {
    this.lounge = this.doorsOpen.lounge || this.doorsOpen.shortcut;
    this.shortcut = this.doorsOpen.shortcut;
    this.vip = this.doorsOpen.vip || this.doorsOpen.vipExit;
    this.supply = this.doorsOpen.supply;
    this.cashier = this.doorsOpen.cashier;
    this.rects = this.testRange ? RANGE_RECTS : [
      ...STATIC_RECTS,
      ...(!this.hotel ? [DOORS.hotel] : []),
      ...(!this.hotelMystery.passageOpen ? HOTEL_MYSTERY_GATES : []),
      ...(Object.keys(CASINO_DOORS) as CasinoDoorId[]).filter(id => !this.doorsOpen[id]).map(id => DOORS[id]),
      ...(!this.speakeasy ? [SECRET_DOOR] : []),
    ];
    this.walkRects = this.rects.map((r) => ({
      ...r,
      w: r.w + 0.64,
      d: r.d + 0.64,
    }));
    this.navigation.rebuild(this.rects);
    this.navigation.update(this.player);
  }
  start() {
    this.phase = "playing";
  }
  pause() {
    if (this.phase === "playing") {
      this.priorPhase = this.phase;
      this.phase = "paused";
      this.moving = false;
      this.sprinting = false;
    }
  }
  resume() {
    if (this.phase === "paused" && !this.shopOpen && !this.pokerOpen && !this.hotelDocument)
      this.phase = this.priorPhase;
  }
  /** Journal entries can be revisited from pause, without repeating rewards. */
  readHotelDocument(id: HotelDocumentId) {
    if (this.phase !== "paused" || this.shopOpen || this.pokerOpen) return false;
    const discovered = id === "ledger" ? this.hotelMystery.ledgerFound
      : id === "suitcase" ? this.hotelMystery.suitcaseFound
        : id === "register" && this.hotelMystery.registerFound;
    if (!discovered) return false;
    this.hotelDocument = id;
    return true;
  }
  closeHotelDocument() {
    if (!this.hotelDocument) return false;
    this.hotelDocument = null;
    this.resume();
    return true;
  }
  private inspectHotelDocument(id: HotelDocumentId) {
    this.pause();
    this.hotelDocument = id;
    return true;
  }
  capacity(w: WeaponId = this.weapon) {
    if (w === "revolver") return WEAPONS.revolver.magazine;
    if (isMelee(w)) return WEAPONS[w].magazine;
    return Math.round(WEAPONS[w].magazine * (this.upgrades[w] ? 1.5 : 1));
  }
  weaponName(w = this.weapon) {
    if (this.relics[w]) return w in RELIC_NAMES ? RELIC_NAMES[w as keyof typeof RELIC_NAMES] : WEAPONS[w].upgradedName;
    return this.upgrades[w] ? WEAPONS[w].upgradedName : WEAPONS[w].name;
  }
  reloadDuration(w = this.weapon) {
    return (
      WEAPONS[w].reload *
      (this.perks.quickPour ? 0.7 : 1) *
      (w === "revolver" && this.upgrades.revolver ? 0.75 : 1)
    );
  }
  weaponDamage(w = this.weapon) {
    const damage = Math.round(
      WEAPONS[w].damage * (this.relics[w] ? 2 : this.upgrades[w] ? 1.35 : 1),
    );
    return (
      damage *
      (this.damageBoostRemaining > 0 ? ROULETTE_RULES.damageMultiplier : 1)
    );
  }
  canUseBar() {
    return (
      this.lounge &&
      dist(this.player, BAR_ANCHOR) <= 2.2 &&
      hasSight(this.player, BAR_ANCHOR, this.rects)
    );
  }
  canUsePoker(id: PokerTableId) {
    const table = POKER_TABLES.find((table) => table.id === id);
    if (!table || (id === "poker-b" && !this.vip)) return false;
    const anchor = { x: table.x, z: table.approachZ };
    return (
      dist(this.player, anchor) <= 2.2 &&
      hasSight(this.player, anchor, this.rects)
    );
  }
  openPoker(id: PokerTableId) {
    if (this.phase !== "playing" || !this.canUsePoker(id)) return false;
    dealPoker(this.pokerTables[id], () => this.random());
    this.finishPoker(id);
    this.pause();
    this.pokerOpen = id;
    return true;
  }
  closePoker() {
    this.pokerOpen = null;
  }
  pokerInfo(id: PokerTableId) {
    const table = this.pokerTables[id];
    const reason = id === "poker-b" && !this.vip
      ? "Open the High Roller Club first"
      : table.completed
        ? "Flush completed"
        : table.lastSwapRound >= Math.max(1, this.round)
          ? "Swap used · return next round"
          : "";
    return { canSwap: !reason, reason };
  }
  swapPoker(index: number) {
    const id = this.pokerOpen;
    if (
      this.phase !== "paused" ||
      this.shopOpen ||
      !id ||
      !this.canUsePoker(id) ||
      !this.pokerInfo(id).canSwap
    )
      return false;
    const state = this.pokerTables[id];
    if (!exchangePokerCard(state, index, () => this.random())) return false;
    state.lastSwapRound = Math.max(1, this.round);
    this.events.push({ type: "cardSwap" });
    if (!this.finishPoker(id))
      this.notify("Card exchanged. Your hand stays here. Return next round.");
    return true;
  }
  private finishPoker(id: PokerTableId) {
    const state = this.pokerTables[id];
    if (state.completed || !isFlush(state.hand)) return false;
    state.completed = true;
    const first = !this.flushRewardUnlocked;
    this.flushRewardUnlocked = true;
    this.inventory.revolver = {
      owned: true,
      mag: this.capacity("revolver"),
      reserve: WEAPONS.revolver.reserve,
    };
    this.weapon = "revolver";
    this.reloadRemaining = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.2);
    this.notify(
      first
        ? "FLUSH · THE DEAD MAN’S HAND unlocked · weapon 5"
        : "FLUSH · THE DEAD MAN’S HAND refilled",
    );
    this.events.push({ type: "pokerFlush", weapon: "revolver" });
    return true;
  }
  openBar() {
    if (this.phase !== "playing" || !this.canUseBar()) return false;
    this.pause();
    this.shopOpen = true;
    return true;
  }
  closeBar() {
    this.shopOpen = false;
  }
  barInfo(id: BarItemId) {
    const price = id === "weaponUpgrade" ? PRICES.upgrade : PERKS[id].price;
    let reason =
      id === "weaponUpgrade"
        ? isMelee(this.weapon) ? "Melee weapons cannot be upgraded" : this.upgrades[this.weapon]
          ? "Already upgraded"
          : ""
        : this.perks[id]
          ? "Already purchased"
          : "";
    if (!reason && this.points < price) reason = "Not enough chips";
    return { price, reason };
  }
  private applyUpgrade() {
    this.upgrades[this.weapon] = true;
    this.inventory[this.weapon].mag = this.capacity();
    this.reloadRemaining = 0;
  }
  purchaseBar(id: BarItemId) {
    if (this.phase !== "paused" || !this.shopOpen || !this.canUseBar())
      return false;
    const { price, reason } = this.barInfo(id);
    if (reason) {
      this.notify(reason);
      this.events.push({ type: "deny" });
      return false;
    }
    this.points -= price;
    if (id === "weaponUpgrade") this.applyUpgrade();
    else {
      this.perks[id] = true;
      if (id === "reserve")
        this.health = Math.min(this.maxHealth, this.health + 50);
      if (id === "quickPour") this.reloadRemaining *= 0.7;
    }
    this.notify(
      id === "weaponUpgrade"
        ? `${this.weaponName()} ready`
        : `${PERKS[id].name} · on the house rules`,
    );
    this.events.push({ type: "purchase" });
    return true;
  }
  notify(text: string) {
    this.lastMessage = text;
    this.messageRemaining = 2.6;
  }
  switchWeapon(w: WeaponId) {
    if (this.phase === "playing") this.stowChips();
    if (
      this.phase !== "playing" ||
      this.meleeRemaining > 0 ||
      !this.inventory[w]?.owned ||
      w === this.weapon
    )
      return;
    if (!isMelee(this.weapon)) this.lastFirearm = this.weapon;
    this.weapon = w;
    this.aimHeld = false;
    this.bloom = 0;
    this.holdingChips = false;
    this.reloadRemaining = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.2);
  }
  cycleWeapon(direction: number) {
    const owned = WEAPON_ORDER.filter(id => this.inventory[id].owned);
    this.switchWeapon(owned[(owned.indexOf(this.weapon) + direction + owned.length) % owned.length]);
  }
  reload() {
    if (isMelee(this.weapon)) return false;
    const w = this.inventory[this.weapon];
    if (
      this.phase !== "playing" ||
      this.knifeRemaining > 0 || this.grenadeCooldown > 0 ||
      this.reloadRemaining > 0 ||
      w.mag >= this.capacity() ||
      w.reserve <= 0
    )
      return false;
    this.reloadRemaining = this.reloadDuration();
    this.events.push({ type: "reload", weapon: this.weapon });
    return true;
  }
  nearestPurchase() {
    let best: (typeof PURCHASES)[number] | undefined;
    let min = 2.15;
    for (const p of PURCHASES) {
      if (
        (p.id in this.doorsOpen && this.doorsOpen[p.id as CasinoDoorId]) ||
        (p.id === "stick" && this.stickTaken) ||
        (p.id === "axe" && this.axeTaken) ||
        (p.id === "hotel" && this.hotel) ||
        (p.id === "hotelBell" && this.hotelChallenge.phase === "complete") ||
        (p.id === "tommyAmmo" && !this.inventory.tommy.owned) ||
        (isHotelMysteryInteraction(p.id) && (!this.hotel || Math.abs(this.player.y ?? 0) > 0.35 || this.player.surfaceId?.startsWith("hotel-stair"))) ||
        (p.id === "hotelPanel" && this.hotelMystery.passageOpen) ||
        (p.id === "hotelCache" && this.hotelMystery.cacheClaimed)
      )
        continue;
      const d = dist(this.player, p);
      if (d < min && hasSight(this.player, p, this.rects)) {
        best = p.id === "hotelSuitcase" && this.hotelMystery.ledgerFound && !this.hotelMystery.keyFound
          ? { ...p, detail: "Examine the loose suitcase lining" }
          : p.id === "hotelPanel" && this.hotelMystery.keyFound
            ? { ...p, name: "Unlock service gallery", detail: "Use the brass key · opens both ends of the passage" }
            : p;
        min = d;
      }
    }
    return best;
  }
  purchaseInfo(id: PurchaseId) {
    let price = 0;
    let reason = "";
    if (isHotelMysteryInteraction(id)) {
      if (!this.hotel) reason = "Open the Grand Hotel first";
      else if (Math.abs(this.player.y ?? 0) > 0.35 || this.player.surfaceId?.startsWith("hotel-stair")) reason = "Investigate from the lobby floor";
      else if (id === "hotelPanel") {
        if (this.hotelMystery.passageOpen) reason = "Service gallery already open";
        else if (!this.hotelMystery.keyFound) reason = "Find the service key · start at reception";
      } else if (id === "hotelRegister" && !this.hotelMystery.passageOpen) reason = "Unlock the service gallery first";
      else if (id === "hotelCache") {
        if (!this.hotelMystery.registerFound) reason = "Examine the collection register first";
        else if (this.hotelMystery.cacheClaimed) reason = "Supplies already collected";
        else if (this.grenades >= 4 && WEAPON_ORDER.every(w => !this.inventory[w].owned || this.inventory[w].reserve >= WEAPONS[w].reserve)) reason = "Supplies full · return when needed";
      }
      return { price, reason };
    }
    if (id === "stick" && this.stickTaken) reason = "Rake already taken";
    if (id === "axe") {
      if (!this.supply) reason = "Open the supply room first";
      else if (this.axeTaken) reason = "Axe already taken";
    }
    if (id === "hotel") {
      price = HOTEL_RULES.price;
      if (this.hotel) reason = "Already open";
    }
    if (id === "hotelBell") {
      if (!this.hotel) reason = "Open the Grand Hotel first";
      else if (this.hotelChallenge.phase === "active") reason = "Ambush active · stay in the restaurant";
      else if (this.hotelChallenge.phase === "complete") reason = "Tommy gun already unlocked";
      else if (this.hotelChallengeAlive) reason = "Clear the remaining ambush zombies, then ring again";
      else if (!this.inRestaurant()) reason = "Ring the bell from the upstairs restaurant";
    }
    if (id === "tommyAmmo") {
      price = HOTEL_RULES.ammoPrice;
      if (!this.hotel) reason = "Open the Grand Hotel first";
      else if (!this.inventory.tommy.owned) reason = "Complete the service-bell ambush first";
      else if (this.inventory.tommy.reserve >= WEAPONS.tommy.reserve) reason = "Reserve full";
    }
    if (id === "jukebox" && !this.hotel) reason = "Open the Grand Hotel first";
    if (id === "pistolAmmo") {
      price = 150;
      if (this.inventory.pistol.reserve >= WEAPONS.pistol.reserve)
        reason = "Reserve full";
    }
    if (id === "shotgun" || id === "smg" || id === "rifle") {
      const cfg = WEAPONS[id],
        inv = this.inventory[id];
      price = inv.owned ? cfg.refill : cfg.price;
      if (id === "smg" && !this.lounge) reason = "Open the lounge first";
      else if (id === "rifle" && !this.supply)
        reason = "Open the supply room first";
      else if (inv.owned && inv.reserve >= cfg.reserve) reason = "Reserve full";
    }
    if (id === "bartender")
      return { price: 0, reason: this.lounge ? "" : "Open the lounge first" };
    if (id === "poker-a" || id === "poker-b")
      return {
        price: 0,
        reason: id === "poker-a" || this.vip ? "" : "Open the High Roller Club first",
      };
    if (id in this.doorsOpen) {
      const doorId = id as CasinoDoorId;
      price = PRICES[doorId];
      if (this.doorsOpen[doorId]) reason = "Already open";
      else if (doorId === "supply" && !this.hotel) reason = "Open the Grand Hotel first";
    }
    if (id === "upgrade") {
      price = PRICES.upgrade;
      if (!this.vip) reason = "Open the High Roller Club first";
      else if (isMelee(this.weapon)) reason = "Melee weapons cannot be upgraded";
      else if (this.upgrades[this.weapon]) reason = "Already upgraded";
    }
    if (id === "tables") reason = "Casino games are available from the start";
    if (id === "craps" || id === "craps-b") {
      price = Object.values(this.betsByTable[id]).some(stake => stake > 0) ? 0 : PRICES.craps;
      const dice = this.diceTables[id];
      if (dice && !dice.resolved) reason = "Dice are rolling";
      else if (this.lastWagerRounds[id] >= this.wagerRound)
        reason = "One wager per table per round · come back next round";
    }
    if (id === "painting" && (!this.cashier || this.paintingOpen)) reason = this.paintingOpen ? "Follow the four cards. Shoot suit, then number." : "Open the cashier first";
    if (id === "mystery") {
      price = PRICES.mystery;
      if (!this.speakeasy) reason = "Find the hidden room";
      else if (this.mystery && !this.mystery.resolved) reason = "Reels are spinning";
    }
    if (id === "roulette" || id === "roulette-b") {
      price = PRICES.roulette;
      const spin = this.rouletteTables[id];
      if (spin && !spin.resolved) reason = "Wheel is spinning";
    }
    if (!reason && this.points < price) reason = "Not enough chips";
    return { price, reason };
  }
  purchase(id: PurchaseId) {
    if (this.phase !== "playing") return false;
    if (id === "bartender") return this.openBar();
    if (id === "poker-a" || id === "poker-b") return this.openPoker(id);
    const p = PURCHASES.find((p) => p.id === id);
    if (!p || dist(this.player, p) > 2.2 || !hasSight(this.player, p, this.rects))
      return false;
    const { price, reason } = this.purchaseInfo(id);
    if (reason) {
      this.notify(reason);
      this.events.push({ type: "deny" });
      return false;
    }
    this.points -= price;
    if (id === "hotelLedger") {
      this.hotelMystery.ledgerFound = true;
      return this.inspectHotelDocument("ledger");
    }
    if (id === "hotelSuitcase") {
      this.hotelMystery.suitcaseFound = true;
      if (this.hotelMystery.ledgerFound && !this.hotelMystery.keyFound) {
        this.hotelMystery.keyFound = true;
        this.notify("Service key found · west panel beneath the restaurant");
        this.events.push({ type: "purchase", position: HOTEL_MYSTERY_ANCHORS.hotelSuitcase });
      }
      return this.inspectHotelDocument("suitcase");
    }
    if (id === "hotelPanel") {
      this.hotelMystery.passageOpen = true;
      this.refreshMap();
      this.notify("Service gallery unlocked · both ends are now open");
      this.events.push({ type: "purchase", position: HOTEL_MYSTERY_ANCHORS.hotelPanel });
      return true;
    }
    if (id === "hotelRegister") {
      this.hotelMystery.registerFound = true;
      return this.inspectHotelDocument("register");
    }
    if (id === "hotelCache") {
      for (const w of WEAPON_ORDER) if (this.inventory[w].owned)
        this.inventory[w].reserve = Math.min(WEAPONS[w].reserve, this.inventory[w].reserve + WEAPONS[w].magazine * 2);
      this.grenades = Math.min(4, this.grenades + 2);
      this.hotelMystery.cacheClaimed = true;
      this.notify("Service supplies collected · ammunition and grenades secured");
      this.events.push({ type: "purchase", position: HOTEL_MYSTERY_ANCHORS.hotelCache });
      return true;
    }
    if (id === "hotelBell") {
      this.hotelChallenge = {
        phase: "active", remaining: HOTEL_RULES.ambushDuration,
        pending: HOTEL_RULES.ambushCount, attempt: this.hotelChallenge.attempt + 1,
        spawnTimer: 0.7,
      };
      this.notify("LAST SERVICE · stay upstairs for 35 seconds, then clear the ambush");
      this.events.push({ type: "hotelBell", position: HOTEL_ANCHORS.hotelBell });
      return true;
    }
    if (id === "jukebox") {
      this.jukeboxOn = !this.jukeboxOn;
      this.notify(this.jukeboxOn ? "Jukebox playing" : "Jukebox switched off");
      this.events.push({ type: "jukebox", position: HOTEL_ANCHORS.jukebox });
      return true;
    }
    if (id === "hotel") {
      this.hotel = true;
      this.hotelAge = 0;
      this.refreshMap();
      this.notify("Grand Hotel opened · lobby and restaurant unlocked");
      this.events.push({ type: "purchase" });
      return true;
    }
    if (id === "tommyAmmo") {
      this.inventory.tommy.reserve = WEAPONS.tommy.reserve;
      this.notify("Tommy gun reserve refilled");
      this.events.push({ type: "purchase", weapon: "tommy" });
      return true;
    }
    if (id === "roulette" || id === "roulette-b") {
      this.rouletteTables[id] = {
        id: ++this.rouletteSpinId,
        number: Math.floor(this.random() * 37),
        remaining: ROULETTE_RULES.spinDuration,
        resolved: false,
        resultRemaining: 0,
        reward: null,
        weapon: null,
      };
      this.events.push({ type: "rouletteSpin", position: ROULETTE_TABLES.find(t => t.id === id) });
      this.notify("200 chips on the wheel. Keep moving.");
      return true;
    }
    if (id === "stick") {
      this.stickTaken = true; this.inventory.stick = {owned:true,mag:3,reserve:0};
      this.meleeRemaining=0; this.meleeWeapon=null; this.switchWeapon("stick");
      this.notify("STICKMAN · 3 SWEEPS · misses are free");
      this.events.push({type:"pickup",weapon:"stick"});return true;
    }
    if (id === "axe") {
      this.axeTaken = true; this.inventory.axe = {owned:true,mag:1,reserve:0};
      this.meleeRemaining=0; this.meleeWeapon=null; this.switchWeapon("axe");
      this.notify("FIRE EXIT · heavy chop · never breaks");
      this.events.push({type:"pickup",weapon:"axe"});return true;
    }
    if (id === "painting") {
      this.paintingOpen = true;
      this.notify("Four fixed cards. Left to right: suit, then number. Shoot the buttons.");
      return true;
    }
    if (id === "mystery") {
      const wins = this.random() < .5;
      this.mystery = {remaining:2.8,reward:wins ? MYSTERY_WEAPONS[Math.min(MYSTERY_WEAPONS.length-1,Math.floor(this.random()*MYSTERY_WEAPONS.length))] : null,resolved:false,message:"The Velvet Fortune is spinning…"};
      this.events.push({type:"mysterySpin",position:CASINO_SECRET_ANCHORS.mysteryCabinet});
      return true;
    }
    if (id === "craps" || id === "craps-b") {
      this.lastWagerRounds[id] = this.wagerRound;
      this.crapsResults[id] = "Rolling… bets are locked";
      this.diceTables[id] = {
        quickWager: !Object.values(this.betsByTable[id]).some(stake => stake > 0),
        values: [
          1 + Math.floor(this.random() * 6),
          1 + Math.floor(this.random() * 6),
        ],
        round: this.wagerRound,
        remaining: 1.6,
        resultRemaining: 0,
        resolved: false,
      };
      this.events.push({ type: "diceRoll", position: CRAPS_TABLES.find(t => t.id === id) });
      this.notify("The dice are rolling… keep moving.");
      return true;
    }
    if (id in this.doorsOpen) {
      const doorId = id as CasinoDoorId;
      this.doorsOpen[doorId] = true;
      if (doorId === "lounge" || doorId === "shortcut") {
        if (!this.lounge) this.loungeAge = 0;
        this.lounge = true;
        this.shortcut = this.doorsOpen.shortcut;
      } else if (doorId === "vip" || doorId === "vipExit") {
        if (!this.vip) this.vipAge = 0;
        this.vip = true;
      } else if (doorId === "supply") { this.supply = true; this.supplyAge = 0; }
      else if (doorId === "cashier") { this.cashier = true; this.cashierAge = 0; }
      this.refreshMap();
      this.notify(`${DOOR_DETAILS[doorId].name} opened`);
      this.events.push({ type: "purchase", position: p });
      return true;
    }
    if (id === "pistolAmmo")
      this.inventory.pistol.reserve = WEAPONS.pistol.reserve;
    if (id === "shotgun" || id === "smg" || id === "rifle") {
      const cfg = WEAPONS[id];
      if (!this.inventory[id].owned) {
        this.inventory[id] = {
          owned: true,
          mag: this.capacity(id),
          reserve: cfg.reserve,
        };
        this.weapon = id;
        this.reloadRemaining = 0;
      } else this.inventory[id].reserve = cfg.reserve;
    }
    if (id === "upgrade") this.applyUpgrade();
    this.notify(
      id === "shotgun" || id === "smg" || id === "rifle"
        ? `${WEAPONS[id].label} ready`
        : id === "upgrade"
          ? `${this.weaponName()} · upgraded`
          : id === "pistolAmmo"
            ? "Pistol reserve refilled"
            : "Purchase complete",
    );
    this.events.push({ type: "purchase" });
    return true;
  }
  private resolveRoulette(id: RouletteTableId) {
    const spin = this.rouletteTables[id];
    const position = ROULETTE_TABLES.find(t => t.id === id);
    if (!spin || spin.resolved) return;
    spin.resolved = true;
    spin.resultRemaining = ROULETTE_RULES.resultDuration;
    spin.reward =
      spin.number === 0
        ? "jackpot"
        : spin.number === 7
          ? "maxAmmo"
          : spin.number === 4 || spin.number === 24
            ? "ammo"
            : "miss";
    if (spin.reward === "miss") {
      // The entire wager was charged at spin start. Never charge again here.
      this.events.push({ type: "rouletteMiss", position });
      return;
    }
    const weapons = spin.reward === "ammo" ? [this.weapon] : WEAPON_ORDER;
    for (const weapon of weapons) {
      const inventory = this.inventory[weapon];
      if (!inventory.owned || isMelee(weapon)) continue;
      inventory.mag = this.capacity(weapon);
      inventory.reserve = WEAPONS[weapon].reserve;
    }
    spin.weapon = spin.reward === "ammo" ? this.weapon : null;
    this.reloadRemaining = 0;
    if (spin.reward === "jackpot")
      this.damageBoostRemaining = ROULETTE_RULES.damageDuration;
    this.events.push({
      type: spin.reward === "jackpot" ? "rouletteJackpot" : "rouletteWin",
      position,
    });
  }
  nearCrapsTable(): CrapsTableId | null {
    return CRAPS_TABLES.find(table => dist(this.player, { x: table.x, z: table.approachZ }) < 3 &&
      hasSight(this.player, { x: table.x, z: table.approachZ }, this.rects))?.id ?? null;
  }
  canBet(id = this.nearCrapsTable()) {
    return this.phase === "playing" && !!id && this.nearCrapsTable() === id &&
      (!this.diceTables[id] || this.diceTables[id]!.resolved);
  }
  toggleChips() {
    if (this.phase !== "playing") return;
    this.holdingChips = !this.holdingChips;
    this.reloadRemaining = 0;
    this.aimHeld = false;
  }
  stowChips() {
    this.holdingChips = false;
  }
  placeBet(number: PlaceNumber, id = this.nearCrapsTable()) {
    if (!id || !this.holdingChips || !this.canBet(id) || !PLACE_NUMBERS.includes(number)) return false;
    if (this.lastWagerRounds[id] >= this.wagerRound) { this.notify("One wager per table per round · come back next round"); return false; }
    const amount = placeAmount(number,this.chipValue);
    if (this.points < amount) {this.notify(`Need ${amount} chips for this bet`); return false;}
    this.points -= amount;
    this.betsByTable[id][number] = (this.betsByTable[id][number] ?? 0)+amount;
    this.notify(`${amount} on ${number} · bet stays after wins · E to roll`);
    return true;
  }
  placeAimedBet() {
    const target = this.aimedBetTarget();
    if (!target || !this.placeBet(target.number, target.tableId)) return false;
    this.betBanksByTable[target.tableId][target.number] = target.bank;
    return true;
  }
  aimedBetTarget() {
    if (!this.holdingChips || !this.canBet()) return undefined;
    const dy = -Math.sin(this.pitch);
    if (dy >= -.01) return undefined;
    const t = (BET_TARGETS[0].y-1.65)/dy;
    const x=this.player.x+Math.sin(this.yaw)*Math.cos(this.pitch)*t;
    const z=this.player.z+Math.cos(this.yaw)*Math.cos(this.pitch)*t;
    return BET_TARGETS.find(b=>b.tableId === this.nearCrapsTable() && Math.abs(b.x-x)<b.halfWidth && Math.abs(b.z-z)<b.halfDepth);
  }
  takeBets(id = this.nearCrapsTable()) {
    if (!id || !this.canBet(id)) return false;
    const amount=Object.values(this.betsByTable[id]).reduce((a,b)=>a+b,0);
    this.points+=amount;this.betsByTable[id]={};this.betBanksByTable[id]={};this.notify(`${amount} chips returned`);return true;
  }
  enterSecretKey(key: string) {
    if (this.phase !== "playing" || !this.paintingOpen || this.speakeasy || dist(this.player,CASINO_SECRET_ANCHORS.keypad)>5) return false;
    if (key === SECRET_CODE[this.codeProgress]) {
      this.codeProgress++;
      this.codeFlash=.2;
      if (this.codeProgress === SECRET_CODE.length) {
        this.speakeasy=true;this.speakeasyAge=0;this.refreshMap();this.notify("THE VELVET HOUR · the house has a secret");this.events.push({type:"purchase"});
      } else this.notify(`Lock ${this.codeProgress} / 8 · accepted`);
      return true;
    }
    this.codeProgress=0;this.codeFlash=-.4;this.notify(key === "reset" ? "Lock reset" : "Wrong sequence · start again from the leftmost card");this.events.push({type:"deny"});return false;
  }
  damageEnemy(e: Enemy, damage: number, headshot: boolean, region: HitRegion = headshot ? "head" : "body") {
    if (e.health <= 0 || !Number.isFinite(damage) || damage <= 0) return;
    if (region !== "head" && region !== "body" && e.missing?.[region]) return;
    e.wounds ??= {};
    e.wounds[region] = (e.wounds[region] ?? 0) + 1;
    if (region !== "head" && region !== "body") {
      e.limbDamage ??= {};
      e.missing ??= {};
      e.limbDamage[region] = (e.limbDamage[region] ?? 0) + damage;
      if (e.limbDamage[region]! >= 32) e.missing[region] = true;
    }
    e.health -= damage;
    e.flash = 0.12;
    // The free, retryable ambush pays its weapon reward rather than farmable chips.
    const payout = e.hotelAmbush ? 0 : 5 + Math.floor(this.random() * 6) + (headshot ? RULES.headshotReward : e.health <= 0 ? RULES.killReward : 0);
    this.points += payout;
    this.earned += payout;
    if (headshot) this.headshots++;
    if (payout) this.notify(`+${payout} CHIPS · ${headshot ? "HEADSHOT" : e.health <= 0 ? "KILL" : "HIT"}`);
    this.events.push({ type: "hit", headshot, position: { x: e.x, y: e.y, z: e.z } });
    if (e.health <= 0) {
      this.kills++;
      this.corpses.push({ enemy: { ...e, flash: 0 }, age: 0 });
      // Heavy firefights retire older bodies sooner, always through the fade.
      for (const corpse of this.corpses.slice(0, -24)) corpse.age = Math.max(4.5, corpse.age);
      this.events.push({
        type: "kill",
        headshot,
        position: { x: e.x, y: e.y, z: e.z },
      });
    }
  }
  knife() {
    if (this.phase !== "playing" || this.meleeRemaining > 0 || this.knifeCooldown > 0 || this.grenadeCooldown > 0) return false;
    this.reloadRemaining = 0;
    this.holdingChips = false;
    this.knifeRemaining = 0.55;
    this.knifeCooldown = 0.75;
    this.events.push({ type: "knife" });
    return true;
  }
  private knifeContact() {
    const direction = { x: Math.sin(this.yaw) * Math.cos(this.pitch), y: -Math.sin(this.pitch), z: Math.cos(this.yaw) * Math.cos(this.pitch) };
    let target: Enemy | undefined, nearest = 1.65;
    for (const e of this.enemies) {
      if (e.health <= 0 || !hasSight(this.player, e, this.rects, 1)) continue;
      for (const v of zombieHitVolumes(e)) {
        const [x,y,z] = v.center;
        const dx=e.x+x*Math.cos(e.yaw)+z*Math.sin(e.yaw)-this.player.x;
        const dz=e.z-x*Math.sin(e.yaw)+z*Math.cos(e.yaw)-this.player.z;
        const dy=(e.y ?? 0)+y-((this.player.y ?? 0)+1.4), distance=Math.hypot(dx,dy,dz);
        if (distance < nearest && (dx*direction.x+dy*direction.y+dz*direction.z)/distance > .65) {
          target=e; nearest=distance;
        }
      }
    }
    if (target) this.damageEnemy(target, 100, false);
  }
  throwGrenade() {
    if (this.phase !== "playing" || this.meleeRemaining > 0 || this.grenades <= 0 || this.grenadeCooldown > 0 || this.knifeCooldown > 0) return false;
    this.grenades--; this.grenadeCooldown=.65;
    this.holdingChips = false;
    this.reloadRemaining=0;
    this.projectiles.push({ ownerId:this.actorId || undefined, id:this.nextGrenadeId++, ...this.player, y:(this.player.y ?? 0)+1.5,
      vx:Math.sin(this.yaw)*Math.cos(this.pitch)*8, vz:Math.cos(this.yaw)*Math.cos(this.pitch)*8,
      vy:2.5-Math.sin(this.pitch)*8, fuse:2.2 });
    this.events.push({type:"grenadeThrow"});
    return true;
  }
  private stepGrenades(dt: number, actors: readonly Simulation[] = [this]) {
    this.explosions.forEach(e => e.remaining -= dt);
    this.explosions = this.explosions.filter(e => e.remaining > 0);
    for (const g of this.projectiles) {
      const owner = actors.find(actor => actor.actorId === (g.ownerId ?? ""));
      g.fuse -= dt;
      // Sweep each short flight segment against walls, stair treads and floor slabs.
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        g.vy -= 9.8 * step;
        const speed = Math.hypot(g.vx, g.vy, g.vz);
        if (speed < 1e-6) continue;
        const direction = { x: g.vx / speed, y: g.vy / speed, z: g.vz / speed };
        const length = speed * step;
        const hit = raycastWorld(g, direction, this.rects);
        const contact = !!hit && hit.distance <= length + 0.09;
        const travel = contact ? Math.max(0, hit.distance - 0.09) : length;
        g.x += direction.x * travel;
        g.y += direction.y * travel;
        g.z += direction.z * travel;
        if (g.kind && (contact || this.enemies.some(e => e.health > 0 && Math.hypot(e.x-g.x,e.z-g.z) < .45 && Math.abs(g.y-(e.y ?? 0)-1) < 1))) { g.fuse=0; break; }
        if (contact) {
          const n = hit.normal;
          const impact = g.vx * n.x + g.vy * n.y + g.vz * n.z;
          if (impact < 0) {
            g.vx -= 1.4 * impact * n.x;
            g.vy -= 1.4 * impact * n.y;
            g.vz -= 1.4 * impact * n.z;
          }
          if (n.y > 0.7) {
            g.vx *= 0.65;
            g.vz *= 0.65;
            if (Math.abs(g.vy) < 0.25) g.vy = 0;
          }
        }
      }
      if (g.fuse > 0) continue;
      if (g.kind === "flare") {
        this.fires.push({ownerId:g.ownerId,id:g.id,x:g.x,y:g.y,z:g.z,remaining:4,tick:0,damage:g.damage ?? 100});
        owner?.events.push({type:"explosion",weapon:"flare",position:g});continue;
      }
      this.explosions.push({ id: g.id, x: g.x, y: g.y, z: g.z, remaining: 0.5 });
      owner?.events.push({ type: "explosion", position: { x: g.x, z: g.z }, weapon:g.kind === "grenade" ? "launcher" : undefined });
      const exposed = (p: WorldPosition) => {
        const origin = { x: g.x, y: g.y + 0.02, z: g.z };
        const delta = { x: p.x - origin.x, y: (p.y ?? 0) + 0.8 - origin.y, z: p.z - origin.z };
        const length = Math.hypot(delta.x, delta.y, delta.z);
        return length < 0.001 || wallDistance(origin, {
          x: delta.x / length, y: delta.y / length, z: delta.z / length,
        }, this.rects) > length - 0.05;
      };
      for (const e of this.enemies) {
        const distance = dist(g, e);
        if (e.health > 0 && distance < 4.5 && exposed(e))
          owner?.damageEnemy(e, (g.damage ?? 220) * (1 - distance / 5.5), false);
      }
      if (owner) {
        const distance = dist(g, owner.player);
        if (distance < 4.5 && exposed(owner.player)) owner.hurt(90 * (1 - distance / 4.5));
      }
    }
    this.projectiles=this.projectiles.filter(g=>g.fuse>0);
    for (const fire of this.fires) {
      const owner = actors.find(actor => actor.actorId === (fire.ownerId ?? ""));
      fire.remaining-=dt;fire.tick-=dt;
      if (fire.tick>0) continue;
      fire.tick=.5;
      for (const e of this.enemies) if(e.health>0 && dist(fire,e)<2.5 && hasSight(fire,e,this.rects,.5)) owner?.damageEnemy(e,fire.damage*.25,false);
      if(owner && dist(fire,owner.player)<2.5 && hasSight(fire,owner.player,this.rects,.5)) owner.hurt(12);
    }
    this.fires=this.fires.filter(f=>f.remaining>0);
  }
  private meleeContact() {
    const id = this.meleeWeapon;
    if (!id) return;
    let hits = 0;
    // Stickman sweeps a 2.8 m, 100-degree fan; Fire Exit chops a narrow 1.9 m wedge at the nearest zombie.
    const reach = id === "stick" ? 2.8 : 1.9, cone = id === "stick" ? Math.cos(50 * Math.PI / 180) : Math.cos(22 * Math.PI / 180);
    const inReach = this.enemies.filter(e => {
      const dx=e.x-this.player.x, dz=e.z-this.player.z, distance=Math.hypot(dx,dz);
      return e.health>0 && distance<=reach &&
        (dx*Math.sin(this.yaw)+dz*Math.cos(this.yaw))/Math.max(.001,distance)>=cone &&
        hasSight(this.player,e,this.rects,1);
    }).sort((a,b)=>dist(a,this.player)-dist(b,this.player));
    for (const e of id === "axe" ? inReach.slice(0,1) : inReach) {
      this.damageEnemy(e,this.weaponDamage(id),false); hits++;
    }
    if (hits) this.events.push({type:"meleeHit",weapon:id,count:hits});
    if (hits && id === "stick") {
      this.inventory.stick.mag--;
      if (!this.inventory.stick.mag) {
        this.events.push({type:"stickBreak",weapon:"stick"});this.notify("The craps rake splinters after its third hit!");
      }
    }
  }
  fire(alternate = false) {
    if (
      this.meleeRemaining > 0 ||
      this.holdingChips ||
      this.phase !== "playing" ||
      (this.reloadRemaining > 0 && !isShellLoading(this.weapon)) ||
      this.knifeRemaining > 0 || this.grenadeCooldown > 0 ||
      this.fireCooldown > 0
    )
      return false;
    const w = this.inventory[this.weapon],
      cfg = WEAPONS[this.weapon];
    if (w.mag <= 0) {
      if (!this.reload() && w.reserve <= 0 && !isMelee(this.weapon)) {
        this.fireCooldown = 0.3;
        this.events.push({ type: "dry", weapon: this.weapon });
      }
      return false;
    }
    this.reloadRemaining = 0;
    if (isMelee(this.weapon)) {
      this.meleeRemaining=meleeDuration(this.weapon);this.meleeWeapon=this.weapon;this.fireCooldown=cfg.interval;
      this.events.push({type:"melee",weapon:this.weapon});return true;
    }
    const shells = alternate && this.weapon === "doublebarrel" ? Math.min(2,w.mag) : 1;
    const side = this.weapon === "dual" ? w.mag % 2 : undefined;
    w.mag -= shells;
    this.fireCooldown = cfg.interval;
    this.events.push({ type: "shot", weapon: this.weapon, alternate: shells > 1, side });
    const spread = cfg.spread * (this.aiming && cfg.pellets === 1 ? .35 : 1) + this.bloom;
    this.bloom = Math.min(maxBloom(this.weapon), this.bloom + bloomPerShot(this.weapon));
    if (this.weapon === "launcher" || this.weapon === "flare") {
      this.projectiles.push({ownerId:this.actorId || undefined,id:this.nextGrenadeId++,...this.player,y:(this.player.y ?? 0)+1.5,
        vx:Math.sin(this.yaw)*Math.cos(this.pitch)*17,vz:Math.cos(this.yaw)*Math.cos(this.pitch)*17,
        vy:1-Math.sin(this.pitch)*17,fuse:this.weapon === "flare" ? 1.2 : 1.6,
        kind:this.weapon === "flare" ? "flare" : "grenade",damage:this.weaponDamage()});
      return true;
    }
    for (let i = 0; i < cfg.pellets * shells; i++) {
      const yaw = this.yaw + (this.random() - 0.5) * spread * 2,
        pitch = this.pitch + (this.random() - 0.5) * spread * 2;
      const d: V3 = {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch),
      };
      const o = { ...this.player, y: (this.player.y ?? 0) + 1.65 };
      let nearest = wallDistance(o, d, this.rects),
        target: Enemy | undefined;
      const contacts: {enemy:Enemy; distance:number; region:HitRegion}[] = [];
      for (const e of this.enemies) {
        if (e.health <= 0) continue;
        let contact: typeof contacts[number] | undefined;
        for (const volume of zombieHitVolumes(e)) {
          const [x, y, z] = volume.center;
          const n = raySphere(o, d, { x: e.x + x * Math.cos(e.yaw) + z * Math.sin(e.yaw), y: (e.y ?? 0) + y,
            z: e.z - x * Math.sin(e.yaw) + z * Math.cos(e.yaw) }, volume.radius);
          if (n < wallDistance(o,d,this.rects) && (!contact || n < contact.distance)) contact={enemy:e,distance:n,region:volume.region};
          if (n < nearest) {
            nearest = n;
            target = e;
          }
        }
        if (contact) contacts.push(contact);
      }
      if (i === 0 && this.paintingOpen && !this.speakeasy) {
        let key: string | undefined;
        for (const button of KEYPAD_TARGETS) {
          const n=rayBox(o,d,{x:button.x-.07,y:button.y-.12,z:button.z-.12},{x:button.x+.07,y:button.y+.12,z:button.z+.12});
          if(n<nearest) {nearest=n;key=button.key;}
        }
        if(key) {this.enterSecretKey(key);return true;}
      }
      if (target) {
        const maxTargets=penetration(this.weapon);
        const hits=contacts.sort((a,b)=>a.distance-b.distance).slice(0,maxTargets);
        for (const [index, hit] of hits.entries()) {
          const falloff=cfg.pellets>1 ? Math.max(.4,1-Math.max(0,hit.distance-8)*.06) : 1;
          this.damageEnemy(hit.enemy,this.weaponDamage()*falloff*Math.pow(.75,index)*(hit.region === "head" ? 2 : 1),hit.region === "head",hit.region);
          if (this.weapon === "lmg") hit.enemy.cooldown=Math.max(hit.enemy.cooldown,.4);
        }
      }
    }
    this.pitch = Math.max(-1.3, this.pitch - recoilPitch(this.weapon) * shells);
    this.yaw += this.weapon === "machinepistol" || this.weapon === "tommy" ? (this.random() - 0.5) * 0.006 : 0;
    return true;
  }
  hurt(amount: number) {
    if (this.phase !== "playing" || this.invulnerable > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.damageAgo = 0;
    this.invulnerable = RULES.hurtGrace;
    this.events.push({ type: "hurt" });
    if (this.health === 0) {
      this.phase = "dead";
      this.moving = false;
      this.failHotelChallenge("Last service failed · start a new run to try again");
      this.events.push({ type: "death" });
    }
  }
  private inRestaurant() {
    return (this.player.y ?? 0) >= 3.9 &&
      (this.player.surfaceId === "hotel-upper" || !this.player.surfaceId) &&
      hotelRoomName(this.player) === "Grand Hotel Restaurant";
  }
  private failHotelChallenge(message: string) {
    if (this.hotelChallenge.phase !== "active") return;
    this.hotelChallenge.phase = "failed";
    this.hotelChallenge.pending = 0;
    this.hotelChallenge.remaining = 0;
    this.notify(message);
    this.events.push({ type: "hotelFail", text: message });
  }
  private stepHotelChallenge(dt: number) {
    const challenge = this.hotelChallenge;
    if (challenge.phase !== "active") return;
    if (!this.inRestaurant()) {
      this.failHotelChallenge("Left the restaurant · clear any ambush survivors, then ring the bell to retry");
      return;
    }
    challenge.remaining = Math.max(0, challenge.remaining - dt);
    challenge.spawnTimer -= dt;
    if (challenge.pending > 0 && challenge.spawnTimer <= 0 &&
        this.hotelAge > HOTEL_RULES.spawnGrace &&
        this.enemies.length < RULES.cap && this.hotelChallengeAlive < HOTEL_RULES.ambushCap) {
      challenge.spawnTimer = this.spawn(true) ? HOTEL_RULES.ambushCadence : 0.4;
    }
    if (challenge.remaining === 0 && challenge.pending === 0 && this.hotelChallengeAlive === 0) {
      challenge.phase = "complete";
      this.inventory.tommy = { owned: true, mag: this.capacity("tommy"), reserve: WEAPONS.tommy.reserve };
      this.weapon = "tommy";
      this.reloadRemaining = 0;
      this.fireCooldown = Math.max(this.fireCooldown, 0.2);
      this.notify("LAST SERVICE COMPLETE · THE CHICAGO TYPEWRITER unlocked · weapon 6");
      this.events.push({ type: "hotelComplete", weapon: "tommy" });
    }
  }
  spawn(ambush = false, players: readonly WorldPosition[] = [this.player]) {
    if (this.enemies.filter(e => e.health > 0).length >= RULES.cap) return false;
    if (ambush && (this.hotelChallenge.phase !== "active" || this.hotelChallenge.pending <= 0 || this.hotelChallengeAlive >= HOTEL_RULES.ambushCap)) return false;
    const options = ALL_SPAWNS.filter(
      (p, i) =>
        this.spawnEnabled(i) &&
        (!ambush || (SPAWN_RECORDS[i].room === "hotel" && (p.y ?? 0) === 4)) &&
        players.every(player => dist(p, player) >= 8) &&
        !collides(p, 0.35, this.rects) &&
        this.enemies.every((e) => dist(e, p) > 0.8),
    );
    if (!options.length) return false;
    const p = options[Math.floor(this.random() * options.length)],
      stats = waveStats(Math.max(1, this.round));
    const inHotel = SPAWN_RECORDS[ALL_SPAWNS.indexOf(p)].room === "hotel";
    const health = ambush ? Math.min(180, stats.health + 20) : Math.round(stats.health * (inHotel ? 1.08 : 1));
    this.enemies.push({
      ...p,
      id: this.nextId++,
      health,
      maxHealth: health,
      speed: ambush ? Math.min(3.2, stats.speed + 0.35) : Math.min(3.5, stats.speed * (inHotel ? 1.08 : 1)),
      yaw: 0,
      attack: 0,
      cooldown: 0,
      stuck: 0,
      flash: 0,
      age: 0,
      hotelAmbush: ambush || undefined,
    });
    if (ambush) this.hotelChallenge.pending--;
    else this.waveRemaining--;
    return true;
  }
  spawnEnabled(index: number) {
    const room = SPAWN_RECORDS[index]?.room;
    switch (room) {
      case "casino": return true;
      case "lounge": return this.lounge && this.loungeAge > 3;
      case "vip": return this.vip && this.vipAge > 3;
      case "supply": return this.supply && this.supplyAge > 3;
      case "cashier": return this.cashier && this.cashierAge > 3;
      case "speakeasy": return this.speakeasy && this.speakeasyAge > 3;
      case "hotel": return this.hotel && this.hotelAge > HOTEL_RULES.spawnGrace;
      default: return false;
    }
  }
  beginRound() {
    this.round++;
    if (this.round > 1) this.grenades = Math.min(4, this.grenades + 2);
    if (this.slowRound < this.round) this.slowRound = 0;
    this.waveRemaining = waveStats(this.round).count;
    this.spawnTimer = 0.4;
    this.events.push({ type: "round", text: `ROUND ${this.round}` });
    this.roundCue = "start";
    this.roundCueRemaining = 3.8;
  }
  step(
    dt: number,
    input: { forward: number; strafe: number; sprint: boolean; fire: boolean },
  ) {
    if (this.phase !== "playing") return;
    this.stepPlayer(dt, input);
    this.stepWorld(dt);
  }
  /** Advance only this actor: personal timers, movement and attacks. */
  stepPlayer(
    dt: number,
    input: { forward: number; strafe: number; sprint: boolean; fire: boolean },
  ) {
    if (this.phase !== "playing") return;
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.mystery && !this.mystery.resolved) {
      this.mystery.remaining = Math.max(0,this.mystery.remaining-dt);
      if (!this.mystery.remaining) {
        this.mystery.resolved = true;
        const reward=this.mystery.reward;
        if (reward) {
          const repeat=this.inventory[reward].owned;
          this.inventory[reward]={owned:true,mag:this.capacity(reward),reserve:WEAPONS[reward].reserve};
          this.weapon=reward;this.holdingChips=false;this.reloadRemaining=0;this.meleeRemaining=0;this.meleeWeapon=null;
          this.fireCooldown=Math.max(this.fireCooldown,.45);
          this.mystery.message=`${this.weaponName(reward)} · ${WEAPONS[reward].label.toLowerCase()} · ${repeat ? "ammunition restocked" : "equipped"}`;
          this.events.push({type:"pickup",weapon:reward});
        } else {this.mystery.message="The house keeps the chips. No weapon this time.";this.events.push({type:"deny"});}
        this.notify(this.mystery.message);
      }
    }
    this.damageAgo += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.fireCooldown <= 0) this.bloom = Math.max(0, this.bloom - dt * 0.09);
    this.knifeCooldown = Math.max(0, this.knifeCooldown - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    const knifeBefore = this.knifeRemaining;
    this.knifeRemaining = Math.max(0, this.knifeRemaining - dt);
    const meleeBefore=this.meleeRemaining;
    this.meleeRemaining=Math.max(0,this.meleeRemaining-dt);
    const contactAt = meleeContactTime(this.meleeWeapon);
    if (meleeBefore>contactAt && this.meleeRemaining<=contactAt) this.meleeContact();
    if (meleeBefore>0 && !this.meleeRemaining) {
      if (this.meleeWeapon === "stick" && this.inventory.stick.mag===0) {
        this.inventory.stick.owned=false;
        this.weapon=this.inventory[this.lastFirearm]?.owned ? this.lastFirearm : WEAPON_ORDER.find(id=>this.inventory[id].owned && !isMelee(id)) ?? "pistol";
        this.fireCooldown=Math.max(this.fireCooldown,.35);
      }
      this.meleeWeapon=null;
    }
    if (knifeBefore > .37 && this.knifeRemaining <= .37) this.knifeContact();
    this.messageRemaining = Math.max(0, this.messageRemaining - dt);
    this.damageBoostRemaining = Math.max(0, this.damageBoostRemaining - dt);
    for (const { id } of ROULETTE_TABLES) {
      const spin = this.rouletteTables[id];
      if (!spin) continue;
      if (!spin.resolved) {
        spin.remaining = Math.max(0, spin.remaining - dt);
        if (!spin.remaining) this.resolveRoulette(id);
      } else spin.resultRemaining = Math.max(0, spin.resultRemaining - dt);
    }
    for (const { id, x, z } of CRAPS_TABLES) {
      const dice = this.diceTables[id];
      if (!dice) continue;
      if (!dice.resolved) {
        dice.remaining = Math.max(0, dice.remaining - dt);
        if (!dice.remaining) {
          dice.resolved = true;
          dice.resultRemaining = 6;
          dice.round = Math.max(dice.round, this.wagerRound);
          this.lastWagerRounds[id] = dice.round;
          const total = dice.values[0] + dice.values[1];
          if (total === 7) {
            this.slowRound = Math.max(this.slowRound, dice.round);
            if (dice.quickWager === false) {
              const lost = Object.values(this.betsByTable[id]).reduce((a,b) => a+b, 0);
              this.betsByTable[id] = {}; this.betBanksByTable[id] = {};
              this.crapsResults[id] = `SEVEN · ${lost} chips lost · 20% slower this round`;
            } else this.crapsResults[id] = "SEVEN’S CURSE · 20% slower this round";
            this.events.push({ type: "diceCurse", position: { x, z } });
          } else {
            const stake = this.betsByTable[id][total as PlaceNumber] ?? 0;
            const profit = dice.quickWager === false ? (stake ? placeProfit(total as PlaceNumber, stake) : 0) : 500;
            this.points += profit; this.earned += profit;
            this.crapsResults[id] = dice.quickWager === false
              ? profit ? `${total} · +${profit} chips · bets stay on the table` : `${total} · no winner · bets stay on the table`
              : `${total} · +500 chips`;
            if (profit) this.events.push({ type: "diceWin", position: { x, z } });
          }
        }
      } else dice.resultRemaining = Math.max(0, dice.resultRemaining - dt);
    }
    if (this.damageAgo > RULES.regenDelay)
      this.health = Math.min(
        this.maxHealth,
        this.health + RULES.regenRate * dt,
      );
    if (this.reloadRemaining > 0) {
      this.reloadRemaining -= dt;
      if (this.reloadRemaining <= 0) {
        this.reloadRemaining = 0;
        const w = this.inventory[this.weapon],
          amount = Math.min(isShellLoading(this.weapon) ? 1 : this.capacity() - w.mag, w.reserve);
        w.mag += amount;
        w.reserve -= amount;
        this.events.push({ type: "reloadDone", weapon: this.weapon });
        if (isShellLoading(this.weapon) && w.mag<this.capacity() && w.reserve>0) this.reload();
      }
    }
    const length = Math.hypot(input.forward, input.strafe);
    this.moving = length > 0;
    this.sprinting = input.sprint && length > 0 && !this.aiming;
    if (length) {
      const f = input.forward / length,
        s = input.strafe / length,
        speed =
          (this.sprinting
            ? RULES.sprint * (this.perks.nightShift ? 1.15 : 1)
            : RULES.walk) *
          (this.slowed ? 0.8 : 1) * weaponSpeed(this.weapon) *
          dt;
      moveActor(
        this.player,
        (Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed,
        (Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed,
        RULES.playerRadius,
        this.rects,
      );
    }
    if (input.fire) {
      this.sprinting = false;
      this.fire();
    }
    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.navigation.update(this.player);
      this.navTimer = 0.3;
    }
  }
  /** Advance the shared world exactly once after all actor inputs. */
  stepWorld(dt: number, actors: readonly Simulation[] = [this]) {
    if (this.phase !== "playing") return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    for (const corpse of this.corpses) corpse.age += dt;
    this.corpses = this.corpses.filter(corpse => corpse.age < 6);
    this.codeFlash = this.codeFlash > 0 ? Math.max(0,this.codeFlash-dt) : Math.min(0,this.codeFlash+dt);
    this.roundCueRemaining = Math.max(0, this.roundCueRemaining - dt);
    if (!this.roundCueRemaining) this.roundCue = null;
    if (this.lounge) this.loungeAge += dt;
    if (this.vip) this.vipAge += dt;
    if (this.tables) this.tablesAge += dt;
    if (this.hotel) this.hotelAge += dt;
    if (this.supply) this.supplyAge += dt;
    if (this.cashier) this.cashierAge += dt;
    if (this.speakeasy) this.speakeasyAge += dt;
    this.stepGrenades(dt, actors);
    const living = () => actors.filter(actor => actor.phase === "playing" && actor.health > 0);
    if (!living().length) return;
    this.enemies = this.enemies.filter((e) => e.health > 0);
    this.stepHotelChallenge(dt);
    // Hold regular wave spawning and intermission during the finite ambush.
    // Already-living regular zombies still pursue, attack and count toward the cap.
    if (this.hotelChallenge.phase === "active") {
      // Challenge owns spawning until its timer AND its finite enemy budget clear.
    } else if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) {
        this.intermission = 0;
        this.beginRound();
      }
    } else if (
      this.round > 0 &&
      this.waveRemaining === 0 &&
      this.enemies.length === 0
    ) {
      this.intermission = RULES.intermission;
      if (this.slowRound === this.round) this.slowRound = 0;
      this.roundCue = "clear";
      this.roundCueRemaining = 3.8;
      this.events.push({
        type: "roundClear",
        text: `ROUND ${this.round} SURVIVED`,
      });
    } else {
      this.spawnTimer -= dt;
      if (
        this.waveRemaining > 0 &&
        this.enemies.length < RULES.cap &&
        this.spawnTimer <= 0
      ) {
        this.spawnTimer = this.spawn(false, living().map(actor => actor.player)) ? waveStats(this.round).cadence : 0.4;
      }
    }
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      const candidates = living();
      if (!candidates.length) break;
      // Lock a windup to its victim; a dead victim cancels that attack.
      let actor = e.attack > 0 ? candidates.find(candidate => candidate.actorId === e.targetId) : undefined;
      if (e.attack > 0 && e.targetId !== undefined && !actor) { e.attack = 0; e.cooldown = 0.3; }
      actor ??= candidates.reduce((best, candidate) => dist(e, candidate.player) < dist(e, best.player) ? candidate : best);
      e.targetId = actor.actorId;
      const range = dist(e, actor.player);
      e.yaw = Math.atan2(actor.player.x - e.x, actor.player.z - e.z);
      if (e.attack > 0) {
        e.attack -= dt;
        if (e.attack <= 0) {
          if (
            dist(e, actor.player) < RULES.attackRange + 0.15 &&
            hasSight(e, actor.player, this.rects)
          )
            actor.hurt(RULES.attackDamage);
          e.cooldown = 1.1;
        }
        continue;
      }
      if (
        range < RULES.attackRange &&
        e.cooldown <= 0 &&
        hasSight(e, actor.player, this.rects)
      ) {
        e.attackStyle = ((e.attackStyle ?? e.id % 3) + 1) % 3;
        e.attack = RULES.attackWindup;
        this.events.push({
          type: "zombieAttack",
          enemyId: e.id,
          position: { x: e.x, y: e.y, z: e.z },
        });
        continue;
      }
      if (range < 0.65) continue;
      // Walking must go around low tables even when the eye-height ray clears them.
      const target = canWalkDirect(e, actor.player, RULES.enemyRadius + 0.02, this.rects)
        ? actor.player
        : actor.navigation.next(e);
      let vx = target.x - e.x,
        vz = target.z - e.z;
      const mag = Math.hypot(vx, vz);
      if (mag > 0.01) {
        vx /= mag;
        vz /= mag;
      }
      for (const other of this.enemies) {
        if (other === e) continue;
        const d = dist(e, other);
        if (d > 0.01 && d < 0.8) {
          vx += ((e.x - other.x) / d) * (0.8 - d) * 1.8;
          vz += ((e.z - other.z) / d) * (0.8 - d) * 1.8;
        }
      }
      const mobility = e.missing?.leftLeg && e.missing?.rightLeg ? 0.23 : e.missing?.leftLeg || e.missing?.rightLeg ? 0.48 : 1;
      const norm = Math.max(1, Math.hypot(vx, vz)),
        before = { x: e.x, y: e.y ?? 0, z: e.z };
      moveActor(
        e,
        (vx / norm) * e.speed * mobility * dt,
        (vz / norm) * e.speed * mobility * dt,
        RULES.enemyRadius,
        this.rects,
      );
      e.stuck =
        dist(before, e) < 0.003 ? e.stuck + dt : Math.max(0, e.stuck - dt * 2);
      if (e.stuck > 7 && range > 8) {
        const replacement = ALL_SPAWNS.find(
          (p, i) =>
            this.spawnEnabled(i) &&
            (!e.hotelAmbush || (SPAWN_RECORDS[i].room === "hotel" && (p.y ?? 0) === 4)) &&
            !collides(p, RULES.enemyRadius, this.rects) &&
            living().every(candidate => dist(p, candidate.player) > 10) &&
            this.enemies.every((o) => o === e || dist(o, p) > 1),
        );
        if (replacement) {
          e.x = replacement.x;
          e.z = replacement.z;
          e.y = replacement.y ?? 0;
          e.surfaceId = replacement.surfaceId ?? "casino";
          e.stuck = 0;
        }
      }
    }
  }
}
