/** Authoritative four-player room. Simulation remains the single source of combat rules. */
import { Simulation, RULES, collides, type PurchaseId } from "../game/simulation.ts";
import { CASINO_ANCHORS } from "../game/casino-layout.ts";
import { MAX_PLAYERS, idleInput, type CoopAction, type CoopEvent, type CoopInput,
  type CoopSnapshot, type PlayerSummary, type SimulationSnapshot } from "./protocol.ts";

/** Every shared field is explicit. Actor health, inventory, rewards and timers are never copied back. */
const SHARED_FIELDS = [
  "time", "round", "waveRemaining", "intermission", "spawnTimer", "nextId", "nextGrenadeId",
  "enemies", "projectiles", "explosions", "fires", "doorsOpen", "rects", "walkRects",
  "lounge", "shortcut", "vip", "tables", "supply", "cashier", "hotel", "speakeasy",
  "loungeAge", "vipAge", "tablesAge", "supplyAge", "cashierAge", "hotelAge", "speakeasyAge",
  "roundCue", "roundCueRemaining", "stickTaken", "axeTaken", "jukeboxOn",
  // These world features stay at their initial values; their interactions are disabled for this playtest.
  "hotelChallenge", "hotelMystery", "paintingOpen", "codeProgress", "codeFlash",
] as const satisfies readonly (keyof Simulation)[];

const PRESENTATION_FIELDS = [
  "actorId", "phase", "player", "yaw", "pitch", "health", "points", "kills", "headshots", "earned",
  "weapon", "inventory", "upgrades", "relics", "perks", "grenades", "aimHeld", "holdingChips",
  "bloom", "lastFirearm", "meleeRemaining", "knifeRemaining", "knifeCooldown", "grenadeCooldown",
  "reloadRemaining", "fireCooldown", "damageAgo", "invulnerable", "moving", "sprinting",
  "lastMessage", "messageRemaining", "shopOpen", "pokerOpen", "hotelDocument", "slowRound",
  "damageBoostRemaining", "mystery", "betBanksByTable", "betsByTable", "crapsResults", "chipValue",
  "lastWagerRounds", "diceTables", "rouletteTables", "pokerTables", "flushRewardUnlocked",
  ...SHARED_FIELDS.filter(key => !["rects", "walkRects", "nextId", "nextGrenadeId"].includes(key)),
] as const satisfies readonly (keyof Simulation)[];

const SUPPORTED_PURCHASES = new Set<PurchaseId>([
  "pistolAmmo", "shotgun", "smg", "rifle", "bartender", "lounge", "shortcut", "vip", "vipExit",
  "supply", "cashier", "hotel", "upgrade", "stick", "axe",
]);
const SIDE_SYSTEM_REASON = "Casino games, the mystery cabinet and hotel challenges are not enabled in this co-op playtest.";
const COLORS = [0x68d4c0, 0xffb76b, 0xbba1ff, 0x78baff];

type CoopPlayer = { id: string; name: string; connected: boolean; sim: Simulation; color: number; retired: boolean };

export class CoopSimulation {
  players = new Map<string, CoopPlayer>();
  phase: "lobby" | "playing" | "ended" = "lobby";
  tick = 0;
  private world = new Simulation();
  private recentEvents: { event: CoopEvent; atTick: number }[] = [];
  private nextEventId = 1;

  private actor(id: string, slot: number) {
    const sim = new Simulation();
    sim.actorId = id;
    for (const key of SHARED_FIELDS) Object.defineProperty(sim, key, {
      enumerable: true, configurable: true,
      get: () => this.world[key],
      set: value => { Reflect.set(this.world, key, value); },
    });
    sim.player = this.spawnPosition(slot);
    sim.navigation.rebuild(sim.rects);
    sim.navigation.update(sim.player);
    return sim;
  }

  private spawnPosition(slot: number) {
    const position = { ...CASINO_ANCHORS.spawn,
      x: CASINO_ANCHORS.spawn.x + (slot % 2 ? 0.7 : -0.7),
      z: CASINO_ANCHORS.spawn.z + (slot >= 2 ? 0.7 : -0.7),
    };
    return collides(position, RULES.playerRadius, this.world.rects) ? { ...CASINO_ANCHORS.spawn } : position;
  }

  addPlayer(id: string, name: string): boolean {
    if (this.players.has(id) || this.players.size >= MAX_PLAYERS) return false;
    const slot = this.players.size;
    const sim = this.actor(id, slot);
    if (this.phase !== "lobby") {
      sim.phase = "dead";
      sim.health = 0;
      sim.notify(this.phase === "playing" ? "Spectating · join the fight next round" : "Run ended · waiting for the host");
    }
    this.players.set(id, { id, name, connected: true, sim, color: COLORS[slot], retired: false });
    return true;
  }

  setConnected(id: string, connected: boolean): void {
    const player = this.players.get(id);
    if (player) {
      player.connected = connected;
      if (connected) player.retired = false;
    }
  }

  expirePlayer(id: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.connected = false;
    player.retired = true;
    this.retireBody(player.sim);
    this.checkWipe();
  }

  private retireBody(sim: Simulation) {
    sim.health = 0;
    sim.phase = "dead";
    sim.moving = sim.sprinting = sim.aimHeld = sim.shopOpen = false;
    sim.reloadRemaining = sim.meleeRemaining = sim.knifeRemaining = 0;
  }

  start(): void {
    if (this.phase === "playing") return;
    this.world = new Simulation();
    this.world.start();
    this.recentEvents = [];
    let slot = 0;
    for (const player of this.players.values()) {
      player.sim = this.actor(player.id, slot++);
      if (player.connected) { player.retired = false; player.sim.start(); }
      else this.retireBody(player.sim);
    }
    this.phase = "playing";
    this.checkWipe();
  }

  private checkWipe() {
    if (this.phase !== "playing" || [...this.players.values()].some(player => player.sim.health > 0 && player.sim.phase === "playing")) return false;
    this.phase = "ended";
    this.world.phase = "dead";
    return true;
  }

  step(dt: number, inputs: Map<string, CoopInput>): void {
    if (this.phase !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(0.05, dt);
    this.tick++;
    const roster = [...this.players.values()];
    for (const player of roster) {
      const sim = player.sim;
      if (sim.phase !== "playing") continue;
      const input = player.connected ? inputs.get(player.id) ?? idleInput(sim.yaw, sim.pitch) : idleInput(sim.yaw, sim.pitch);
      if (Number.isFinite(input.yaw)) sim.yaw = input.yaw;
      if (Number.isFinite(input.pitch)) sim.pitch = Math.max(-1.3, Math.min(1.3, input.pitch));
      sim.aimHeld = !sim.shopOpen && input.aim;
      sim.stepPlayer(dt, sim.shopOpen ? idleInput(sim.yaw, sim.pitch) : {
        forward: Number.isFinite(input.forward) ? Math.max(-1, Math.min(1, input.forward)) : 0,
        strafe: Number.isFinite(input.strafe) ? Math.max(-1, Math.min(1, input.strafe)) : 0,
        sprint: input.sprint, fire: input.fire,
      });
    }
    const round = this.world.round;
    if (!this.checkWipe()) this.world.stepWorld(dt, roster.map(player => player.sim));
    // A final self-grenade or zombie hit must end the run before any dead player can respawn.
    if (!this.checkWipe() && this.world.round > round) {
      for (const [slot, player] of roster.entries()) {
        const sim = player.sim;
        if (!player.connected || player.retired) continue;
        if (sim.health <= 0) {
          sim.player = this.spawnPosition(slot);
          sim.health = sim.maxHealth;
          sim.inventory.pistol.mag = sim.capacity("pistol");
          sim.inventory.pistol.reserve = Math.max(24, sim.inventory.pistol.reserve);
          sim.phase = "playing";
          sim.shopOpen = false;
          sim.damageAgo = 0;
          sim.invulnerable = 2;
          sim.reloadRemaining = sim.fireCooldown = sim.knifeRemaining = sim.knifeCooldown = sim.grenadeCooldown = sim.meleeRemaining = 0;
          sim.navigation.update(sim.player);
          sim.notify("Back in the fight · equipment and chips retained");
        }
        if (this.world.round > 1) sim.grenades = Math.min(4, sim.grenades + 2);
      }
    }
    for (const player of roster) if (player.sim.health <= 0) this.retireBody(player.sim);
    this.collectEvents();
  }

  action(id: string, action: CoopAction): { ok: boolean; reason?: string } {
    const player = this.players.get(id);
    if (!player || !player.connected || player.retired) return { ok: false, reason: "Player is not connected" };
    const sim = player.sim;
    if (action.kind === "close-menu") {
      sim.shopOpen = false;
      return { ok: true };
    }
    if (this.phase !== "playing" || sim.phase !== "playing" || sim.health <= 0)
      return { ok: false, reason: "Wait for the next round to join the fight" };
    let ok = false;
    let reason: string | undefined;
    const oldMessage = sim.lastMessage;
    if (sim.shopOpen && action.kind !== "bar" && action.kind !== "switch") return { ok: false, reason: "Close the bartender menu first" };
    switch (action.kind) {
      case "reload": ok = sim.reload(); break;
      case "knife": ok = sim.knife(); break;
      case "grenade": ok = sim.throwGrenade(); break;
      case "switch":
        ok = !!sim.inventory[action.weapon]?.owned && sim.meleeRemaining <= 0;
        if (ok) sim.switchWeapon(action.weapon);
        break;
      case "interact":
      case "purchase": {
        const purchase = action.kind === "purchase" ? action.purchase : sim.nearestPurchase()?.id;
        if (!purchase) { reason = "Move closer to an interaction"; break; }
        if (!SUPPORTED_PURCHASES.has(purchase)) { reason = SIDE_SYSTEM_REASON; break; }
        ok = sim.purchase(purchase);
        // Solo opens a paused bar session. Co-op keeps this player vulnerable and the world running.
        if (purchase === "bartender" && ok) sim.phase = "playing";
        if (ok && (purchase === "hotel" || purchase in sim.doorsOpen)) {
          for (const member of this.players.values()) {
            member.sim.navigation.rebuild(sim.rects);
            member.sim.navigation.update(member.sim.player);
          }
        }
        break;
      }
      case "bar": {
        if (!sim.shopOpen) { reason = "Open the bartender menu first"; break; }
        if (action.weapon && !sim.inventory[action.weapon]?.owned) { reason = "Weapon is not owned"; break; }
        if (action.weapon) sim.switchWeapon(action.weapon);
        sim.phase = "paused";
        try { ok = sim.purchaseBar(action.item); }
        finally { sim.phase = "playing"; }
        break;
      }
    }
    if (!ok) {
      reason ??= sim.lastMessage !== oldMessage ? sim.lastMessage : "Action unavailable here or still cooling down";
      sim.notify(reason);
    }
    this.collectEvents();
    return ok ? { ok: true } : { ok: false, reason };
  }

  private collectEvents() {
    const collect = (sim: Simulation, actorId: string | null) => {
      for (const event of sim.events.splice(0)) this.recentEvents.push({ event: { ...event, eventId: this.nextEventId++, actorId }, atTick: this.tick });
    };
    collect(this.world, null);
    for (const player of this.players.values()) collect(player.sim, player.id);
    // Repeat recent events across snapshots to tolerate jitter; clients deduplicate by eventId.
    this.recentEvents = this.recentEvents.filter(event => this.tick - event.atTick <= 120).slice(-128);
  }

  private summaries(): PlayerSummary[] {
    return [...this.players.values()].map(({ id, name, connected, sim, color }) => ({
      id, name, connected, color, alive: sim.health > 0 && sim.phase !== "dead",
      x: sim.player.x, y: sim.player.y ?? 0, z: sim.player.z, yaw: sim.yaw, pitch: sim.pitch,
      health: sim.health, maxHealth: sim.maxHealth, weapon: sim.weapon, moving: sim.moving, sprinting: sim.sprinting,
    }));
  }

  snapshot(id: string): CoopSnapshot {
    const sim = this.players.get(id)?.sim;
    if (!sim) throw new Error("Unknown co-op player");
    const self = Object.fromEntries(PRESENTATION_FIELDS.map(key => [key, sim[key]])) as SimulationSnapshot;
    return structuredClone({ tick: this.tick, phase: this.phase, self, players: this.summaries(),
      events: this.recentEvents.map(entry => entry.event) });
  }
}
