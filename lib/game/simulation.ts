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
export type WeaponId = "pistol" | "shotgun";
export type Phase = "ready" | "playing" | "paused" | "dead";
export type PurchaseId =
  | "pistolAmmo"
  | "shotgun"
  | "lounge"
  | "shortcut"
  | "upgrade";
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
};
export const PRICES = {
  shotgun: 800,
  lounge: 900,
  shortcut: 1200,
  upgrade: 2000,
};
export const STATIC_RECTS: Rect[] = [
  { id: "west", x: -16.25, z: 0, w: 0.5, d: 24.5, h: 4.8 },
  { id: "east", x: 16.25, z: 0, w: 0.5, d: 24.5, h: 4.8 },
  { id: "south", x: 0, z: -12.25, w: 32.5, d: 0.5, h: 4.8 },
  { id: "north", x: 0, z: 12.25, w: 32.5, d: 0.5, h: 4.8 },
  { id: "partition-s", x: 4, z: -9, w: 0.45, d: 6, h: 4.8 },
  { id: "partition-m", x: 4, z: 2.4, w: 0.45, d: 9.2, h: 4.8 },
  { id: "partition-n", x: 4, z: 11.1, w: 0.45, d: 1.8, h: 4.8 },
  { id: "staff-wall-a", x: 7, z: 3, w: 6, d: 0.4, h: 4.8 },
  { id: "staff-wall-b", x: 14.7, z: 3, w: 2.6, d: 0.4, h: 4.8 },
  { id: "slots-a", x: -7, z: 0, w: 3.4, d: 5, h: 1.95 },
  { id: "slots-b", x: -0.7, z: 5, w: 3.4, d: 4.4, h: 1.95 },
  { id: "cashier", x: -11, z: 10.5, w: 6, d: 2.7, h: 3.4 },
  { id: "bar", x: 12, z: -8.7, w: 5.7, d: 1.1, h: 1.25 },
];
export const DOORS: Record<"lounge" | "shortcut", Rect> = {
  lounge: { id: "lounge", x: 4, z: -4.1, w: 0.45, d: 3.8, h: 4.8 },
  shortcut: { id: "shortcut", x: 4, z: 8.6, w: 0.45, d: 3.2, h: 4.8 },
};
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
    z: -8.6,
    name: "Pistol ammunition",
    detail: "Refill reserve",
  },
  {
    id: "shotgun",
    x: -14,
    z: 1.8,
    name: "Room Service",
    detail: "Pump shotgun",
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
    id: "upgrade",
    x: -11,
    z: 8.3,
    name: "High Roller upgrade",
    detail: "Shotgun · 9 shells + more damage",
  },
];
export const SPAWNS: V2[] = [
  { x: -5, z: -10.8 },
  { x: -14.7, z: 6 },
  { x: 1.5, z: 10.6 },
  { x: 14.4, z: -10.6 },
];
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);
export function collides(p: V2, r: number, rects: Rect[]) {
  if (p.x < -16 + r || p.x > 16 - r || p.z < -12 + r || p.z > 12 - r)
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
export function hasSight(a: V2, b: V2, rects: Rect[]) {
  const len = dist(a, b);
  if (len < 0.001) return true;
  return (
    wallDistance(
      { ...a, y: 1 },
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
  readonly nx = 54;
  readonly nz = 40;
  readonly blocked = new Uint8Array(54 * 40);
  readonly distance = new Int32Array(54 * 40);
  index(p: V2) {
    const x = Math.max(
        0,
        Math.min(this.nx - 1, Math.floor((p.x + 16) / this.step)),
      ),
      z = Math.max(
        0,
        Math.min(this.nz - 1, Math.floor((p.z + 12) / this.step)),
      );
    return z * this.nx + x;
  }
  point(i: number): V2 {
    return {
      x: -16 + ((i % this.nx) + 0.5) * this.step,
      z: -12 + (Math.floor(i / this.nx) + 0.5) * this.step,
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
  upgraded = false;
  loungeAge = 0;
  weapon: WeaponId = "pistol";
  inventory = {
    pistol: { owned: true, mag: 12, reserve: 84 },
    shotgun: { owned: false, mag: 0, reserve: 0 },
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
    if (this.phase === "paused") this.phase = this.priorPhase;
  }
  capacity(w: WeaponId = this.weapon) {
    return w === "shotgun" && this.upgraded ? 9 : WEAPONS[w].magazine;
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
    this.reloadRemaining = WEAPONS[this.weapon].reload;
    this.events.push({ type: "reload", weapon: this.weapon });
    return true;
  }
  nearestPurchase() {
    let best: (typeof PURCHASES)[number] | undefined;
    let min = 2.15;
    for (const p of PURCHASES) {
      if (
        (p.id === "lounge" && this.lounge) ||
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
    const w = this.inventory.shotgun;
    if (id === "pistolAmmo") {
      price = 150;
      if (this.inventory.pistol.reserve >= WEAPONS.pistol.reserve)
        reason = "Reserve full";
    }
    if (id === "shotgun") {
      price = w.owned ? 300 : PRICES.shotgun;
      if (w.owned && w.reserve >= WEAPONS.shotgun.reserve)
        reason = "Reserve full";
    }
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
      if (!w.owned) reason = "Requires Room Service";
      else if (this.upgraded) reason = "Already upgraded";
    }
    if (!reason && this.points < price) reason = "Not enough points";
    return { price, reason };
  }
  purchase(id: PurchaseId) {
    if (this.phase !== "playing") return false;
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
    if (id === "pistolAmmo")
      this.inventory.pistol.reserve = WEAPONS.pistol.reserve;
    if (id === "shotgun") {
      if (!this.inventory.shotgun.owned) {
        this.inventory.shotgun = { owned: true, mag: 6, reserve: 30 };
        this.weapon = "shotgun";
        this.reloadRemaining = 0;
      } else this.inventory.shotgun.reserve = 30;
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
    if (id === "upgrade") {
      this.upgraded = true;
      this.inventory.shotgun.mag = 9;
      if (this.weapon === "shotgun") this.reloadRemaining = 0;
    }
    this.notify(
      id === "shotgun"
        ? "Room Service ready"
        : id === "upgrade"
          ? "HIGH ROLLER · bigger magazine, heavier hits"
          : id === "pistolAmmo"
            ? "Pistol reserve refilled"
            : id === "lounge"
              ? "Cocktail lounge opened"
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
        const damage =
          this.weapon === "shotgun" && this.upgraded ? 19 : cfg.damage;
        this.damageEnemy(target, damage * falloff * (head ? 2 : 1), head);
      }
    }
    this.pitch = Math.max(
      -1.3,
      this.pitch - (this.weapon === "shotgun" ? 0.016 : 0.006),
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
        (i < 3 || (this.lounge && this.loungeAge > 3)) &&
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
  beginRound() {
    this.round++;
    this.waveRemaining = waveStats(this.round).count;
    this.spawnTimer = 0.4;
    this.events.push({ type: "round", text: `ROUND ${this.round}` });
    this.notify(`ROUND ${this.round}`);
  }
  step(
    dt: number,
    input: { forward: number; strafe: number; sprint: boolean; fire: boolean },
  ) {
    if (this.phase !== "playing") return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.time += dt;
    this.damageAgo += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.messageRemaining = Math.max(0, this.messageRemaining - dt);
    if (this.lounge) this.loungeAge += dt;
    if (this.damageAgo > RULES.regenDelay)
      this.health = Math.min(100, this.health + RULES.regenRate * dt);
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
        speed = (this.sprinting ? RULES.sprint : RULES.walk) * dt;
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
    } else if (this.waveRemaining === 0 && this.enemies.length === 0) {
      this.intermission = RULES.intermission;
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
        continue;
      }
      if (range < 0.65) continue;
      const target = hasSight(e, this.player, this.walkRects)
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
            (i < 3 || this.lounge) &&
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
