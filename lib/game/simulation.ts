/** Pure gameplay state. Rendering, audio, input, and wall-clock time live outside this module. */
export type V2 = { x: number; z: number };
export type V3 = V2 & { y: number };
export type Rect = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};
export type WeaponId = "pistol" | "shotgun" | "smg" | "rifle";
export const WEAPON_ORDER: WeaponId[] = ["pistol", "shotgun", "smg", "rifle"];
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
export const BAR_ANCHOR = { x: 12, z: -7.3 };
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
  | "craps";
export type GameEvent = {
  type:
    | "shot"
    | "hit"
    | "kill"
    | "hurt"
    | "purchase"
    | "deny"
    | "reload"
    | "round"
    | "roundClear"
    | "diceRoll"
    | "diceWin"
    | "diceCurse"
    | "zombieAttack"
    | "death";
  weapon?: WeaponId;
  headshot?: boolean;
  position?: V2;
  text?: string;
};
export type Enemy = V2 & {
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
};
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
  attackWindup: 0.4,
  cap: 14,
  reward: 100,
  startingPoints: 400,
  intermission: 8,
};
export const WEAPONS = {
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
    upgradedName: "HIGH ROLLER",
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
};
export const PRICES = {
  shotgun: 800,
  smg: 1100,
  rifle: 1600,
  lounge: 900,
  shortcut: 1200,
  vip: 1300,
  upgrade: 2000,
  tables: 1500,
  craps: 250,
};
export const BOUNDS = { minX: -16, maxX: 42, minZ: -12, maxZ: 12 };
export function roomName(p: V2) {
  return p.x > 28
    ? "The Devil’s Tables"
    : p.x > 16
      ? "High Roller Club"
      : p.x > 4
        ? p.z > 3
          ? "Staff Passage"
          : "The Last Call Lounge"
        : "Casino Floor";
}
export const STATIC_RECTS: Rect[] = [
  { id: "west", x: -16.25, z: 0, w: 0.5, d: 24.5, h: 4.8 },
  { id: "east", x: 42.25, z: 0, w: 0.5, d: 24.5, h: 4.8 },
  { id: "south", x: 13, z: -12.25, w: 58.5, d: 0.5, h: 4.8 },
  { id: "north", x: 13, z: 12.25, w: 58.5, d: 0.5, h: 4.8 },
  { id: "tables-wall-s", x: 28, z: -9, w: 0.45, d: 6, h: 4.8 },
  { id: "tables-wall-m", x: 28, z: 2.4, w: 0.45, d: 9.2, h: 4.8 },
  { id: "tables-wall-n", x: 28, z: 11.1, w: 0.45, d: 1.8, h: 4.8 },
  { id: "craps-table", x: 35, z: -3, w: 4.8, d: 2.5, h: 1.05 },
  { id: "roulette-table", x: 35, z: 5, w: 3.4, d: 2.5, h: 1.05 },
  { id: "tables-sideboard", x: 41.35, z: 1, w: 1.1, d: 3, h: 1.15 },
  { id: "vip-wall-s", x: 16, z: -9, w: 0.45, d: 6, h: 4.8 },
  { id: "vip-wall-m", x: 16, z: 2.4, w: 0.45, d: 9.2, h: 4.8 },
  { id: "vip-wall-n", x: 16, z: 11.1, w: 0.45, d: 1.8, h: 4.8 },
  { id: "partition-s", x: 4, z: -9, w: 0.45, d: 6, h: 4.8 },
  { id: "partition-m", x: 4, z: 2.4, w: 0.45, d: 9.2, h: 4.8 },
  { id: "partition-n", x: 4, z: 11.1, w: 0.45, d: 1.8, h: 4.8 },
  { id: "staff-wall-a", x: 7, z: 3, w: 6, d: 0.4, h: 4.8 },
  { id: "staff-wall-b", x: 14.7, z: 3, w: 2.6, d: 0.4, h: 4.8 },
  { id: "slots-a", x: -7, z: 0, w: 3.4, d: 5, h: 2.1 },
  { id: "slots-b", x: -0.7, z: 5, w: 3.4, d: 4.4, h: 2.1 },
  { id: "cashier", x: -11, z: 10.5, w: 6, d: 2.7, h: 3.4 },
  { id: "bar", x: 12, z: -8.7, w: 5.7, d: 1.1, h: 1.25 },
  { id: "upgrade-machine", x: 24.7, z: 10.9, w: 1.6, d: 1.1, h: 1.8 },
  { id: "poker-a", x: 22, z: -3, w: 3.8, d: 2.4, h: 0.95 },
  { id: "poker-b", x: 22, z: 5, w: 3.8, d: 2.4, h: 0.95 },
  { id: "vip-sofa", x: 27.35, z: 1, w: 1.1, d: 5, h: 1.2 },
];
export const DOORS = {
  lounge: { id: "lounge", x: 4, z: -4.1, w: 0.45, d: 3.8, h: 4.8 },
  shortcut: { id: "shortcut", x: 4, z: 8.6, w: 0.45, d: 3.2, h: 4.8 },
  vip: { id: "vip", x: 16, z: -4.1, w: 0.45, d: 3.8, h: 4.8 },
  vipExit: { id: "vipExit", x: 16, z: 8.6, w: 0.45, d: 3.2, h: 4.8 },
  tables: { id: "tables", x: 28, z: -4.1, w: 0.45, d: 3.8, h: 4.8 },
  tablesExit: { id: "tablesExit", x: 28, z: 8.6, w: 0.45, d: 3.2, h: 4.8 },
} satisfies Record<string, Rect>;
export const PURCHASES: {
  id: PurchaseId;
  x: number;
  z: number;
  name: string;
  detail: string;
}[] = [
  {
    id: "pistolAmmo",
    x: -12.6,
    z: -10.6,
    name: "Pistol ammunition",
    detail: "Refill reserve",
  },
  {
    id: "shotgun",
    x: -14.6,
    z: 1.8,
    name: "Room Service",
    detail: "Pump shotgun",
  },
  {
    id: "smg",
    x: 5.3,
    z: -0.2,
    name: "Dealer’s Choice",
    detail: "Fast-firing SMG",
  },
  {
    id: "rifle",
    x: 26.8,
    z: -8.2,
    name: "Pit Boss",
    detail: "Heavy automatic rifle",
  },
  {
    id: "bartender",
    ...BAR_ANCHOR,
    name: "Marlowe · bartender",
    detail: "Cocktail perks & weapon upgrades",
  },
  {
    id: "lounge",
    x: 3.2,
    z: -4.1,
    name: "Cocktail lounge",
    detail: "Open a new area",
  },
  {
    id: "shortcut",
    x: 5.3,
    z: 8.6,
    name: "Staff shortcut",
    detail: "Complete the escape loop",
  },
  {
    id: "vip",
    x: 15.2,
    z: -4.1,
    name: "High Roller Club",
    detail: "Unlock poker room, upgrade station + staff exit",
  },
  {
    id: "tables",
    x: 27.2,
    z: -4.1,
    name: "The Devil’s Tables",
    detail: "Craps, roulette & a new escape loop",
  },
  {
    id: "craps",
    x: 35,
    z: -5,
    name: "Seven’s Curse · roll the dice",
    detail:
      "250 chips · 7 slows you 20% this round · other rolls pay 500 chips · once per round",
  },
  {
    id: "upgrade",
    x: 24.7,
    z: 9.5,
    name: "Double Down workshop",
    detail: "Upgrade your equipped weapon",
  },
];
export const SPAWNS: V2[] = [
  { x: -5, z: -10.8 },
  { x: -14.7, z: 6 },
  { x: 1.5, z: 10.6 },
  { x: 14.4, z: -10.6 },
  { x: 26.2, z: -10.6 },
  { x: 39.7, z: -10.6 },
];
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);
export function collides(p: V2, r: number, rects: Rect[]) {
  if (
    p.x < BOUNDS.minX + r ||
    p.x > BOUNDS.maxX - r ||
    p.z < BOUNDS.minZ + r ||
    p.z > BOUNDS.maxZ - r
  )
    return true;
  return rects.some((q) => {
    const dx = p.x - Math.max(q.x - q.w / 2, Math.min(p.x, q.x + q.w / 2));
    const dz = p.z - Math.max(q.z - q.d / 2, Math.min(p.z, q.z + q.d / 2));
    return dx * dx + dz * dz < r * r;
  });
}
export function moveActor(
  p: V2,
  dx: number,
  dz: number,
  r: number,
  rects: Rect[],
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let i = 0; i < steps; i++) {
    const x = p.x + dx / steps;
    if (!collides({ x, z: p.z }, r, rects)) p.x = x;
    const z = p.z + dz / steps;
    if (!collides({ x: p.x, z }, r, rects)) p.z = z;
  }
}
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
export function wallDistance(o: V3, d: V3, rects: Rect[]) {
  let best = Infinity;
  for (const q of rects)
    best = Math.min(
      best,
      rayBox(
        o,
        d,
        { x: q.x - q.w / 2, y: 0, z: q.z - q.d / 2 },
        { x: q.x + q.w / 2, y: q.h, z: q.z + q.d / 2 },
      ),
    );
  return best;
}
export function hasSight(a: V2, b: V2, rects: Rect[], height = 1) {
  const len = dist(a, b);
  if (len < 0.001) return true;
  return (
    wallDistance(
      { ...a, y: height },
      { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len },
      rects,
    ) >
    len - 0.05
  );
}
export function waveStats(round: number) {
  return {
    count: [6, 9, 12, 16, 20][round - 1] ?? 20 + (round - 5) * 4,
    health: Math.min(300, 70 + round * 10),
    speed: Math.min(3.4, 1.5 + round * 0.2),
    cadence: Math.max(0.5, 1.65 - round * 0.15),
  };
}

/** A small cardinal flow field avoids corners and makes all enemies share one path search. */
export class Navigation {
  readonly step = 0.6;
  readonly nx = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / this.step);
  readonly nz = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / this.step);
  readonly blocked = new Uint8Array(this.nx * this.nz);
  readonly distance = new Int32Array(this.nx * this.nz);
  index(p: V2) {
    const x = Math.max(
        0,
        Math.min(this.nx - 1, Math.floor((p.x - BOUNDS.minX) / this.step)),
      ),
      z = Math.max(
        0,
        Math.min(this.nz - 1, Math.floor((p.z - BOUNDS.minZ) / this.step)),
      );
    return z * this.nx + x;
  }
  point(i: number): V2 {
    return {
      x: BOUNDS.minX + ((i % this.nx) + 0.5) * this.step,
      z: BOUNDS.minZ + (Math.floor(i / this.nx) + 0.5) * this.step,
    };
  }
  rebuild(rects: Rect[]) {
    for (let i = 0; i < this.blocked.length; i++)
      this.blocked[i] = +collides(this.point(i), 0.34, rects);
  }
  update(target: V2) {
    this.distance.fill(-1);
    let start = this.index(target);
    if (this.blocked[start]) {
      let best = Infinity;
      for (let i = 0; i < this.blocked.length; i++) {
        const d = dist(this.point(i), target);
        if (!this.blocked[i] && d < best) {
          best = d;
          start = i;
        }
      }
    }
    const q = new Int32Array(this.blocked.length);
    let head = 0,
      tail = 1;
    q[0] = start;
    this.distance[start] = 0;
    while (head < tail) {
      const cur = q[head++];
      for (const n of this.neighbors(cur)) {
        if (!this.blocked[n] && this.distance[n] === -1) {
          this.distance[n] = this.distance[cur] + 1;
          q[tail++] = n;
        }
      }
    }
  }
  neighbors(i: number) {
    const a: number[] = [];
    if (i % this.nx > 0) a.push(i - 1);
    if (i % this.nx < this.nx - 1) a.push(i + 1);
    if (i >= this.nx) a.push(i - this.nx);
    if (i < this.nx * (this.nz - 1)) a.push(i + this.nx);
    return a;
  }
  next(p: V2) {
    const i = this.index(p);
    let best = i;
    for (const n of this.neighbors(i))
      if (
        this.distance[n] >= 0 &&
        (this.distance[best] < 0 || this.distance[n] < this.distance[best])
      )
        best = n;
    return this.point(best);
  }
}
export class Simulation {
  phase: Phase = "ready";
  player: V2 = { x: -9, z: -8 };
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
  tables = false;
  tablesAge = 0;
  lastWagerRound = -1;
  slowRound = 0;
  dice: {
    values: [number, number];
    round: number;
    remaining: number;
    resultRemaining: number;
    resolved: boolean;
  } | null = null;
  get slowed() {
    return (
      this.slowRound === this.round && this.round > 0 && this.intermission <= 0
    );
  }
  get wagerRound() {
    return Math.max(1, this.round + (this.intermission > 0 ? 1 : 0));
  }
  upgrades: Record<WeaponId, boolean> = {
    pistol: false,
    shotgun: false,
    smg: false,
    rifle: false,
  };
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
  inventory: Record<
    WeaponId,
    { owned: boolean; mag: number; reserve: number }
  > = {
    pistol: { owned: true, mag: 12, reserve: 84 },
    shotgun: { owned: false, mag: 0, reserve: 0 },
    smg: { owned: false, mag: 0, reserve: 0 },
    rifle: { owned: false, mag: 0, reserve: 0 },
  };
  enemies: Enemy[] = [];
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
  constructor() {
    this.refreshMap();
  }
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  refreshMap() {
    this.rects = [
      ...STATIC_RECTS,
      ...(!this.lounge ? [DOORS.lounge] : []),
      ...(!this.shortcut ? [DOORS.shortcut] : []),
      ...(!this.vip ? [DOORS.vip, DOORS.vipExit] : []),
      ...(!this.tables ? [DOORS.tables, DOORS.tablesExit] : []),
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
    if (this.phase === "paused" && !this.shopOpen) this.phase = this.priorPhase;
  }
  capacity(w: WeaponId = this.weapon) {
    return Math.round(WEAPONS[w].magazine * (this.upgrades[w] ? 1.5 : 1));
  }
  weaponName(w = this.weapon) {
    return this.upgrades[w] ? WEAPONS[w].upgradedName : WEAPONS[w].name;
  }
  reloadDuration(w = this.weapon) {
    return WEAPONS[w].reload * (this.perks.quickPour ? 0.7 : 1);
  }
  weaponDamage(w = this.weapon) {
    return Math.round(WEAPONS[w].damage * (this.upgrades[w] ? 1.35 : 1));
  }
  canUseBar() {
    return (
      this.lounge &&
      dist(this.player, BAR_ANCHOR) <= 2.2 &&
      hasSight(this.player, BAR_ANCHOR, this.rects)
    );
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
        ? this.upgrades[this.weapon]
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
    if (
      this.phase !== "playing" ||
      !this.inventory[w].owned ||
      w === this.weapon
    )
      return;
    this.weapon = w;
    this.reloadRemaining = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.2);
  }
  reload() {
    const w = this.inventory[this.weapon];
    if (
      this.phase !== "playing" ||
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
        (p.id === "lounge" && this.lounge) ||
        (p.id === "vip" && this.vip) ||
        (p.id === "tables" && this.tables) ||
        (p.id === "shortcut" && this.shortcut)
      )
        continue;
      const d = dist(this.player, p);
      if (d < min && hasSight(this.player, p, this.rects)) {
        best = p;
        min = d;
      }
    }
    return best;
  }
  purchaseInfo(id: PurchaseId) {
    let price = 0;
    let reason = "";

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
      else if (id === "rifle" && !this.vip)
        reason = "Open the High Roller Club first";
      else if (inv.owned && inv.reserve >= cfg.reserve) reason = "Reserve full";
    }
    if (id === "bartender")
      return { price: 0, reason: this.lounge ? "" : "Open the lounge first" };
    if (id === "lounge") {
      price = PRICES.lounge;
      if (this.lounge) reason = "Already open";
    }
    if (id === "shortcut") {
      price = PRICES.shortcut;
      if (!this.lounge) reason = "Open the lounge first";
      else if (this.player.x < 4.5) reason = "Open from staff side";
      else if (this.shortcut) reason = "Already open";
    }
    if (id === "upgrade") {
      price = PRICES.upgrade;
      if (!this.vip) reason = "Open the High Roller Club first";
      else if (this.upgrades[this.weapon]) reason = "Already upgraded";
    }
    if (id === "vip") {
      price = PRICES.vip;
      if (!this.lounge) reason = "Open the lounge first";
      else if (this.vip) reason = "Already open";
    }
    if (id === "tables") {
      price = PRICES.tables;
      if (!this.vip) reason = "Open the High Roller Club first";
      else if (this.tables) reason = "Already open";
    }
    if (id === "craps") {
      price = PRICES.craps;
      if (!this.tables) reason = "Open The Devil’s Tables first";
      else if (this.dice && !this.dice.resolved) reason = "Dice are rolling";
      else if (this.lastWagerRound >= this.wagerRound)
        reason = "One wager per round · come back next round";
    }
    if (!reason && this.points < price) reason = "Not enough chips";
    return { price, reason };
  }
  purchase(id: PurchaseId) {
    if (this.phase !== "playing") return false;
    if (id === "bartender") return this.openBar();
    const p = PURCHASES.find((p) => p.id === id)!;
    if (dist(this.player, p) > 2.2 || !hasSight(this.player, p, this.rects))
      return false;
    const { price, reason } = this.purchaseInfo(id);
    if (reason) {
      this.notify(reason);
      this.events.push({ type: "deny" });
      return false;
    }
    this.points -= price;
    if (id === "craps") {
      this.lastWagerRound = this.wagerRound;
      this.dice = {
        values: [
          1 + Math.floor(this.random() * 6),
          1 + Math.floor(this.random() * 6),
        ],
        round: this.wagerRound,
        remaining: 1.6,
        resultRemaining: 0,
        resolved: false,
      };
      this.events.push({ type: "diceRoll", position: { x: 35, z: -3 } });
      this.notify("The dice are rolling… keep moving.");
      return true;
    }
    if (id === "tables") {
      this.tables = true;
      this.tablesAge = 0;
      this.refreshMap();
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
    if (id === "lounge") {
      this.lounge = true;
      this.loungeAge = 0;
      this.refreshMap();
    }
    if (id === "shortcut") {
      this.shortcut = true;
      this.refreshMap();
    }
    if (id === "upgrade") this.applyUpgrade();
    if (id === "vip") {
      this.vip = true;
      this.vipAge = 0;
      this.refreshMap();
    }
    this.notify(
      id === "shotgun" || id === "smg" || id === "rifle"
        ? `${WEAPONS[id].label} ready`
        : id === "upgrade"
          ? `${this.weaponName()} · upgraded`
          : id === "pistolAmmo"
            ? "Pistol reserve refilled"
            : id === "lounge"
              ? "Cocktail lounge opened"
              : id === "vip"
                ? "High Roller Club · both entrances unlocked"
                : id === "tables"
                  ? "The Devil’s Tables · both entrances unlocked"
                  : "Staff shortcut opened",
    );
    this.events.push({ type: "purchase" });
    return true;
  }
  damageEnemy(e: Enemy, damage: number, headshot: boolean) {
    if (e.health <= 0) return;
    e.health -= damage;
    e.flash = 0.12;
    this.events.push({ type: "hit", headshot, position: { x: e.x, z: e.z } });
    if (e.health <= 0) {
      this.kills++;
      this.points += RULES.reward;
      this.earned += RULES.reward;
      if (headshot) this.headshots++;
      this.events.push({
        type: "kill",
        headshot,
        position: { x: e.x, z: e.z },
      });
    }
  }
  fire() {
    if (
      this.phase !== "playing" ||
      this.reloadRemaining > 0 ||
      this.fireCooldown > 0
    )
      return false;
    const w = this.inventory[this.weapon],
      cfg = WEAPONS[this.weapon];
    if (w.mag <= 0) {
      this.reload();
      return false;
    }
    w.mag--;
    this.fireCooldown = cfg.interval;
    this.events.push({ type: "shot", weapon: this.weapon });
    for (let i = 0; i < cfg.pellets; i++) {
      const yaw = this.yaw + (this.random() - 0.5) * cfg.spread * 2,
        pitch = this.pitch + (this.random() - 0.5) * cfg.spread * 2;
      const d: V3 = {
        x: Math.sin(yaw) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch),
      };
      const o = { ...this.player, y: 1.65 };
      let nearest = wallDistance(o, d, this.rects),
        target: Enemy | undefined,
        head = false;
      for (const e of this.enemies) {
        if (e.health <= 0) continue;
        const h = raySphere(o, d, { x: e.x, y: 1.63, z: e.z }, 0.235),
          b = rayBox(
            o,
            d,
            { x: e.x - 0.28, y: 0.35, z: e.z - 0.28 },
            { x: e.x + 0.28, y: 1.4, z: e.z + 0.28 },
          );
        const n = Math.min(h, b);
        if (n < nearest) {
          nearest = n;
          target = e;
          head = h < b;
        }
      }
      if (target) {
        const falloff =
          this.weapon === "shotgun"
            ? Math.max(0.4, 1 - Math.max(0, nearest - 8) * 0.06)
            : 1;
        const damage = this.weaponDamage();
        this.damageEnemy(target, damage * falloff * (head ? 2 : 1), head);
      }
    }
    this.pitch = Math.max(
      -1.3,
      this.pitch -
        (this.weapon === "shotgun"
          ? 0.016
          : this.weapon === "rifle"
            ? 0.011
            : this.weapon === "smg"
              ? 0.0035
              : 0.006),
    );
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
      this.events.push({ type: "death" });
    }
  }
  spawn() {
    const options = SPAWNS.filter(
      (p, i) =>
        this.spawnEnabled(i) &&
        dist(p, this.player) >= 8 &&
        !collides(p, 0.35, this.rects) &&
        this.enemies.every((e) => dist(e, p) > 0.8),
    );
    if (!options.length) return false;
    const p = options[Math.floor(this.random() * options.length)],
      stats = waveStats(this.round);
    this.enemies.push({
      ...p,
      id: this.nextId++,
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      yaw: 0,
      attack: 0,
      cooldown: 0,
      stuck: 0,
      flash: 0,
      age: 0,
    });
    this.waveRemaining--;
    return true;
  }
  spawnEnabled(index: number) {
    return (
      index < 3 ||
      (index === 3 && this.lounge && this.loungeAge > 3) ||
      (index === 4 && this.vip && this.vipAge > 3) ||
      (index === 5 && this.tables && this.tablesAge > 3)
    );
  }
  beginRound() {
    this.round++;
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
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    this.roundCueRemaining = Math.max(0, this.roundCueRemaining - dt);
    if (!this.roundCueRemaining) this.roundCue = null;
    this.damageAgo += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.messageRemaining = Math.max(0, this.messageRemaining - dt);
    if (this.lounge) this.loungeAge += dt;
    if (this.vip) this.vipAge += dt;
    if (this.tables) this.tablesAge += dt;
    if (this.dice) {
      if (!this.dice.resolved) {
        this.dice.remaining = Math.max(0, this.dice.remaining - dt);
        if (!this.dice.remaining) {
          this.dice.resolved = true;
          this.dice.resultRemaining = 6;
          this.dice.round = Math.max(this.dice.round, this.wagerRound);
          this.lastWagerRound = this.dice.round;
          const seven = this.dice.values[0] + this.dice.values[1] === 7;
          if (seven) {
            this.slowRound = this.dice.round;
            this.events.push({ type: "diceCurse" });
          } else {
            this.points += 500;
            this.earned += 500;
            this.events.push({ type: "diceWin" });
          }
        }
      } else
        this.dice.resultRemaining = Math.max(0, this.dice.resultRemaining - dt);
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
          amount = Math.min(this.capacity() - w.mag, w.reserve);
        w.mag += amount;
        w.reserve -= amount;
      }
    }
    const length = Math.hypot(input.forward, input.strafe);
    this.moving = length > 0;
    this.sprinting = input.sprint && length > 0;
    if (length) {
      const f = input.forward / length,
        s = input.strafe / length,
        speed =
          (this.sprinting
            ? RULES.sprint * (this.perks.nightShift ? 1.15 : 1)
            : RULES.walk) *
          (this.slowed ? 0.8 : 1) *
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
    this.enemies = this.enemies.filter((e) => e.health > 0);
    if (this.intermission > 0) {
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
        this.spawnTimer = this.spawn() ? waveStats(this.round).cadence : 0.4;
      }
    }
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      const range = dist(e, this.player);
      e.yaw = Math.atan2(this.player.x - e.x, this.player.z - e.z);
      if (e.attack > 0) {
        e.attack -= dt;
        if (e.attack <= 0) {
          if (
            dist(e, this.player) < RULES.attackRange + 0.15 &&
            hasSight(e, this.player, this.rects)
          )
            this.hurt(RULES.attackDamage);
          e.cooldown = 1.1;
        }
        continue;
      }
      if (
        range < RULES.attackRange &&
        e.cooldown <= 0 &&
        hasSight(e, this.player, this.rects)
      ) {
        e.attack = RULES.attackWindup;
        this.events.push({
          type: "zombieAttack",
          position: { x: e.x, z: e.z },
        });
        continue;
      }
      if (range < 0.65) continue;
      // Walking must go around low tables even when the eye-height ray clears them.
      const target = hasSight(e, this.player, this.walkRects, 0.1)
        ? this.player
        : this.navigation.next(e);
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
      const norm = Math.max(1, Math.hypot(vx, vz)),
        before = { x: e.x, z: e.z };
      moveActor(
        e,
        (vx / norm) * e.speed * dt,
        (vz / norm) * e.speed * dt,
        RULES.enemyRadius,
        this.rects,
      );
      e.stuck =
        dist(before, e) < 0.003 ? e.stuck + dt : Math.max(0, e.stuck - dt * 2);
      if (e.stuck > 7 && range > 8) {
        const replacement = SPAWNS.find(
          (p, i) =>
            this.spawnEnabled(i) &&
            !collides(p, RULES.enemyRadius, this.rects) &&
            dist(p, this.player) > 10 &&
            this.enemies.every((o) => o === e || dist(o, p) > 1),
        );
        if (replacement) {
          e.x = replacement.x;
          e.z = replacement.z;
          e.stuck = 0;
        }
      }
      if (this.health <= 0) break;
    }
  }
}
