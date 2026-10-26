import { createRange, refillRange, addRangeEnemies, type RangeScenario } from './test-range';
import {
  Simulation,
  waveStats,
  RULES,
  WEAPONS,
  WEAPON_ORDER,
  PERKS,
  roomName,
  type WeaponId,
  type PerkId,
  type BarItemId,
} from "./simulation";
import { GameRenderer } from "./renderer";
import { SERVICE_VIEWS } from "./service-layout";
import { CASINO_ANCHORS, CRAPS_TABLES, ROULETTE_TABLES } from "./casino-layout";
import { GameAudio } from "./audio";
import { CharacterDialogueDirector, CharacterSpeech } from "./character-dialogue";
import { ZombieAudioDirector } from "./zombie-audio-director";
import { HOTEL, stairPoint } from "./world";
import {
  getHotelMysteryDocument,
  type HotelDocumentId,
  type HotelMysteryState,
} from "./hotel-mystery";
import {
  POKER_TABLES,
  bestPokerSuit,
  cardDeck,
  type PlayingCard,
  type CardSuit,
  type PokerTableId,
} from "./poker";
import { PLACE_NUMBERS, KEYPAD_TARGETS, CASINO_SECRET_ANCHORS, placeAmount } from "./casino";
import { WEAPON_FLAVOR, isMelee, weaponSpeed } from "./weapon-expansion";

/** Two firearm slots, followed by separately carried melee tools. */
export function ownedSlots(s: Simulation) {
  const owned = [...s.firearms, ...WEAPON_ORDER.filter(id => isMelee(id) && s.inventory[id].owned)];
  return owned.map((id,index) => ({id,label:WEAPONS[id].label,key:String(index+1)}));
}
function weaponCard(id: WeaponId, s: Simulation, at: number): WeaponCard {
  const w = WEAPONS[id];
  return {
    id,
    name: s.weaponName(id),
    label: w.label,
    flavor: WEAPON_FLAVOR[id] ?? "",
    melee: isMelee(id),
    capacity: s.capacity(id),
    stats: {
      damage: Math.min(1, (s.weaponDamage(id) * w.pellets) / 260),
      rate: Math.min(1, Math.sqrt(1 / w.interval / 18)),
      capacity: isMelee(id) ? 0 : Math.min(1, Math.sqrt(s.capacity(id) / 60)),
      mobility: Math.max(0.05, Math.min(1, (weaponSpeed(id) - 0.7) / 0.4)),
    },
    at,
  };
}
export type CasinoView = {
  holding: boolean; chip: number; bets: Partial<Record<number,number>>;
  nearTable: boolean; tableId?: "craps" | "craps-b"; result: string; speakeasy: boolean;
  nearPainting: boolean; paintingOpen: boolean; codeProgress: number;
  mystery: string; nearMystery: boolean;
  hover?: { number: number; amount: number; affordable: boolean };
};
export type WeaponCard = {
  id: WeaponId;
  name: string;
  label: string;
  flavor: string;
  /** 0..1 bars for the pickup card. */
  stats: { damage: number; rate: number; capacity: number; mobility: number };
  melee: boolean;
  capacity: number;
  at: number;
};
export type GameView = {
  dialogue?: string;
  previewControls?: boolean;
  aiming?: boolean;
  scoped?: boolean;
  casino: CasinoView;
  /** Owned weapons in slot order with their hotkey (1-5 house guns, 6-0 for Mystery Box finds). */
  owned: { id: WeaponId; label: string; key: string }[];
  pickup: WeaponCard | null;
  mysteryReel: { spinning: boolean; id: WeaponId | null };
  grenades: number;
  knifeReady: boolean;
  phase: "ready" | "playing" | "paused" | "dead";
  stamina: number;
  sprintExhausted: boolean;
  health: number;
  maxHealth: number;
  inventory: { id: WeaponId; label: string; owned: boolean }[];
  perks: { id: PerkId; name: string }[];
  shopOpen: boolean;
  pokerOpen: boolean;
  poker: null | {
    id: PokerTableId;
    name: string;
    hand: PlayingCard[];
    bestCount: number;
    bestSuit: CardSuit;
    canSwap: boolean;
    reason: string;
    completed: boolean;
    rewardUnlocked: boolean;
    swaps: number;
  };
  shopOffers: {
    id: BarItemId;
    name: string;
    detail: string;
    price: number;
    reason: string;
  }[];
  roundCue: "start" | "clear" | null;
  roundCueRemaining: number;
  points: number;
  round: number;
  kills: number;
  headshots: number;
  earned: number;
  time: number;
  weapon: WeaponId;
  weaponName: string;
  mag: number;
  reserve: number;
  capacity: number;
  hasShotgun: boolean;
  reload: number;
  reloadTotal: number;
  enemies: number;
  remaining: number;
  intermission: number;
  lounge: boolean;
  shortcut: boolean;
  vip: boolean;
  tables: boolean;
  supply: boolean;
  cashier: boolean;
  doorsOpen: Simulation["doorsOpen"];
  hotel: boolean;
  hotelMystery: HotelMysteryState;
  hotelDocument: null | ({ id: HotelDocumentId } & ReturnType<typeof getHotelMysteryDocument>);
  hotelChallenge: { phase: "idle" | "active" | "complete" | "failed"; remaining: number; pending: number; alive: number };
  slowRound: number;
  dice: Simulation["dice"];
  roulette: Simulation["roulette"];
  diceResults: { tableId: string; label: string; result: string; dice: NonNullable<Simulation["dice"]> }[];
  rouletteResults: { tableId: string; label: string; roulette: NonNullable<Simulation["roulette"]> }[];
  damageBoostRemaining: number;
  room: string;
  upgraded: boolean;
  message: string;
  prompt: null | {
    name: string;
    detail: string;
    price: number;
    reason: string;
    actionLabel?: string;
  };
  hit: number;
  headshot: boolean;
  damage: number;
  fps: number;
  p95: number;
  zombieAudioStatus?: string;
  hotelPlaytestStatus?: string;
  slotAudioStatus?: string;
};
export const initialView: GameView = {
  owned: [{ id: "pistol", label: "Pistol", key: "1" }],
  pickup: null,
  mysteryReel: { spinning: false, id: null },
  casino: {holding:false,chip:25,bets:{},nearTable:false,result:"",speakeasy:false,nearPainting:false,paintingOpen:false,codeProgress:0,mystery:"",nearMystery:false},
  grenades: 2,
  knifeReady: true,
  phase: "ready",
  stamina: 100,
  sprintExhausted: false,
  health: 100,
  maxHealth: 100,
  inventory: WEAPON_ORDER.map((id) => ({
    id,
    label: WEAPONS[id].label,
    owned: id === "pistol",
  })),
  perks: [],
  shopOpen: false,
  pokerOpen: false,
  poker: null,
  shopOffers: [],
  roundCue: null,
  roundCueRemaining: 0,
  points: 400,
  round: 0,
  kills: 0,
  headshots: 0,
  earned: 0,
  time: 0,
  weapon: "pistol",
  weaponName: "HOUSE SPECIAL",
  mag: 12,
  reserve: 84,
  capacity: 12,
  hasShotgun: false,
  reload: 0,
  reloadTotal: 1.5,
  enemies: 0,
  remaining: 0,
  intermission: 1,
  lounge: false,
  shortcut: false,
  vip: false,
  tables: true,
  supply: false,
  cashier: false,
  doorsOpen: { lounge: false, shortcut: false, vip: false, vipExit: false, supply: false, cashier: false },
  hotel: false,
  hotelMystery: { ledgerFound: false, suitcaseFound: false, keyFound: false, passageOpen: false, registerFound: false, cacheClaimed: false },
  hotelDocument: null,
  hotelChallenge: { phase: "idle", remaining: 0, pending: 0, alive: 0 },
  slowRound: 0,
  dice: null,
  roulette: null,
  diceResults: [],
  rouletteResults: [],
  damageBoostRemaining: 0,
  room: "Grand Casino",
  upgraded: false,
  message: "",
  prompt: null,
  hit: 0,
  headshot: false,
  damage: 0,
  fps: 60,
  p95: 0,
};
export class GameRuntime {
  sim = new Simulation();
  renderer: GameRenderer;
  audio = new GameAudio();
  private dialogue = new CharacterDialogueDirector();
  private speech = new CharacterSpeech();
  private dialogueSimulation: Simulation | null = null;
  sensitivity = 1;
  private keys = new Set<string>();
  private firing = false;
  private last = 0;
  private accumulated = 0;
  private updateTimer = 0;
  private hit = 0;
  private damage = 0;
  private headshot = false;
  private pickupCard: WeaponCard | null = null;
  private zombieAudio = new ZombieAudioDirector();
  private pendingStart = false;
  private suppressUntil = 0;
  private disposed = false;
  private hotelTour: { x: number; z: number }[] = [];
  private hotelTourCompleted = false;
  private slotWalkRemaining = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private onView: (v: GameView) => void,
    private onError: (message: string) => void,
  ) {
    this.renderer = new GameRenderer(canvas);
    canvas.tabIndex = 0;
    document.addEventListener("keydown", this.keyDown);
    document.addEventListener("keyup", this.keyUp);
    document.addEventListener("mousemove", this.mouseMove);
    document.addEventListener("mousedown", this.mouseDown);
    document.addEventListener("mouseup", this.mouseUp);
    document.addEventListener("wheel", this.wheel, { passive: true });
    document.addEventListener("pointerlockchange", this.pointerChange);
    document.addEventListener("pointerlockerror", this.pointerError);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("contextmenu", this.contextMenu);
    canvas.addEventListener("webglcontextlost", this.contextLost);
    this.renderer.engine.runRenderLoop(this.frame);
    this.publish();
  }
  private contextMenu = (e: Event) => e.preventDefault();
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.onError(
      "The graphics context was interrupted. Reload the page to start a fresh run.",
    );
  };
  private resize = () => this.renderer.resize();
  private mouseAim = false;
  private clearInput() {
    this.mouseAim = false;
    this.sim.aimHeld = false;
    this.slotWalkRemaining = 0;
    this.keys.clear();
    this.firing = false;
    this.accumulated = 0;
  }
  private keyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && (e.target.closest(".dev-panel, .range-panel") || e.target.matches("input, textarea, select") || e.target.isContentEditable)) return;
    if (this.sim.hotelDocument) {
      if (e.code === "Escape") {
        e.preventDefault();
        this.closeHotelDocument();
      }
      return;
    }
    if (this.sim.pokerOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        this.sim.closePoker();
        this.publish();
      }
      return;
    }
    if (this.sim.shopOpen && e.code === "Escape") {
      e.preventDefault();
      this.sim.closeBar();
      this.publish();
      return;
    }
    if (this.sim.phase !== "playing") return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ShiftLeft",
        "ShiftRight",
        "KeyR",
        "KeyE",
        "KeyF",
        "KeyG",
        "KeyV",
        "KeyC",
        "KeyX",
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Digit7",
        "Digit8",
        "Digit9",
        "Digit0",
        "KeyQ",
        "KeyB",
        "Space",
        "Tab",
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.sim.aimHeld = true;
    if (e.repeat) return;
    if (e.code === "KeyC") {this.sim.toggleChips();this.firing=false;}
    if (e.code === "KeyX" && !this.sim.declineMystery()) this.sim.takeBets();
    if (this.sim.holdingChips) {
      if (e.code === "KeyR") {this.sim.chipValue = this.sim.chipValue === 25 ? 50 : this.sim.chipValue === 50 ? 100 : 25;return;}
    }
    if (e.code === "KeyR") this.sim.reload();
    if (e.code === "KeyG") this.sim.throwGrenade();
    if (e.code === "KeyV") this.sim.knife();
    if (e.code === "KeyB" && !this.sim.holdingChips) this.sim.fire(true);
    if (e.code.startsWith("Digit") || e.code === "KeyQ" || e.code === "KeyE") this.sim.stowChips();
    if (e.code.startsWith("Digit")) {
      const slot = ownedSlots(this.sim).find(o => o.key === e.code.slice(5));
      if (slot) this.sim.switchWeapon(slot.id);
    }
    if (e.code === "KeyQ") this.sim.cycleWeapon(-1);
    if (e.code === "KeyE") this.sim.cycleWeapon(1);
    if (e.code === "KeyF") this.interact();
    if (e.code === "Escape") this.pause();
  };
  private interact() {
    const wasHolding = this.sim.holdingChips;
    this.sim.stowChips();
    this.firing = false;
    const p = this.sim.nearestPurchase();
    if (p && (!wasHolding || ((p.id === "craps" || p.id === "craps-b") && Object.values(this.sim.betsByTable[p.id]).some(b => b > 0)))) this.sim.purchase(p.id);
    if (this.sim.shopOpen || this.sim.pokerOpen || this.sim.hotelDocument) {
      this.clearInput();
      if (document.pointerLockElement === this.canvas)
        document.exitPointerLock();
      this.publish();
    }
  }
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "ShiftLeft" || e.code === "ShiftRight")
      this.sim.aimHeld = this.mouseAim || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  };
  private previewInput = false;
  private rangeScenario: RangeScenario = "targets";
  private get rangeMode() { return process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("range"); }
  private freshSimulation() { return this.rangeMode ? createRange(this.rangeScenario) : new Simulation(); }
  private mouseMove = (e: MouseEvent) => {
    if (
      (document.pointerLockElement !== this.canvas && !(this.previewInput && e.target === this.canvas && (e.buttons & 2))) ||
      this.sim.phase !== "playing"
    )
      return;
    const aimSensitivity = this.sim.aiming ? (this.sim.weapon === "sniper" ? .28 : .65) : 1;
    this.sim.yaw += e.movementX * 0.002 * this.sensitivity * aimSensitivity;
    this.sim.pitch = Math.max(
      -1.3,
      Math.min(1.3, this.sim.pitch + e.movementY * 0.002 * this.sensitivity * aimSensitivity),
    );
  };
  private mouseDown = (e: MouseEvent) => {
    const controlsActive = document.pointerLockElement === this.canvas || (this.previewInput && e.target === this.canvas);
    // Hold right button for aligned sights; B retains the double-barrel alternate shot.
    if (
      e.button === 2 &&
      controlsActive &&
      this.sim.phase === "playing" &&
      !this.sim.holdingChips
    ) {
      this.mouseAim = true;
      this.sim.aimHeld = true;
      return;
    }
    if (
      e.button !== 0 ||
      !controlsActive ||
      this.sim.phase !== "playing" ||
      performance.now() < this.suppressUntil
    )
      return;
    if (this.sim.holdingChips) {this.sim.placeAimedBet();return;}
    this.firing = true;
  };
  private mouseUp = (e: MouseEvent) => {
    if (e.button === 2) {
      this.mouseAim = false;
      this.sim.aimHeld = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    }
    if (e.button === 0) this.firing = false;
  };
  private wheel = (e: WheelEvent) => {
    if (document.pointerLockElement !== this.canvas || this.sim.phase !== "playing" || !e.deltaY) return;
    this.sim.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  };

  private pointerChange = () => {
    this.clearInput();
    if (document.pointerLockElement === this.canvas) {
      this.previewInput = false;
      if (this.pendingStart) {
        this.sim = this.freshSimulation();
        this.zombieAudio.reset();
        this.audio.resetZombies();
        this.audio.resetSlots();
        this.audio.resetHotel();
        this.sim.start();
        this.pendingStart = false;
      } else this.sim.resume();
      this.suppressUntil = performance.now() + 150;
      this.onError("");
    } else {
      this.pendingStart = false;
      this.sim.pause();
    }
    this.publish();
  };
  private pointerError = () => {
    if (this.rangeMode) {
      if (this.pendingStart) {
        this.sim = this.freshSimulation();
        this.zombieAudio.reset(); this.audio.resetZombies(); this.audio.resetSlots(); this.audio.resetHotel();
      }
      this.pendingStart = false; this.previewInput = true; this.clearInput();
      this.sim.resume(); this.canvas.focus(); this.onError(""); this.publish(); return;
    }
    // Embedded preview browsers may not support pointer lock. Keep a normal
    // drag interaction available in the development workspace only.
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("playtest")) {
      if (this.pendingStart) {
        this.sim = this.freshSimulation();
        this.zombieAudio.reset(); this.audio.resetZombies(); this.audio.resetSlots(); this.audio.resetHotel();
        this.sim.start();
      } else this.sim.resume();
      this.pendingStart = false;
      this.previewInput = true;
      this.clearInput();
      this.canvas.focus();
      this.onError("");
      this.publish();
      return;
    }
    this.pendingStart = false;
    this.sim.pause();
    this.clearInput();
    this.onError(
      "Mouse capture was blocked. Open the game directly in Chrome, then click Enter or Resume again.",
    );
    this.publish();
  };
  private blur = () => this.pause();
  private visibility = () => {
    if (document.hidden) this.pause();
  };
  async enter(restart = false) {
    if (this.disposed) return;
    this.sim.closeBar();
    this.sim.closePoker();
    if (this.sim.hotelDocument) {
      this.sim.closeHotelDocument();
      this.sim.pause();
    }
    this.pendingStart =
      restart || this.sim.phase === "ready" || this.sim.phase === "dead";
    this.clearInput();
    void this.audio
      .unlock()
      .then(() => { if (this.audio.context) return this.speech.preload(this.audio.context); })
      .catch(() =>
        this.onError(
          "Audio is unavailable. You can still play; check your browser sound settings.",
        ),
      );
    try {
      this.canvas.focus();
      await this.canvas.requestPointerLock();
    } catch (error) {
      this.pointerError();
      if (error instanceof Error && !this.previewInput)
        this.onError(
          `Mouse capture was blocked: ${error.message} Open the game in a focused Chrome tab and click Enter or Resume.`,
        );
    }
  }
  pause() {
    this.hotelTour = [];
    this.clearInput();
    this.sim.pause();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.publish();
  }
  readHotelDocument(id: HotelDocumentId) {
    this.sim.readHotelDocument(id);
    this.clearInput();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.publish();
  }
  closeHotelDocument(resume = false) {
    if (!this.sim.hotelDocument) return;
    this.clearInput();
    this.sim.closeHotelDocument();
    // Resume only after mouse capture succeeds. Escape always returns to pause.
    this.sim.pause();
    this.publish();
    if (resume) void this.enter();
  }
  rangeAction(action: string) {
    if (!this.rangeMode) return;
    if (action.startsWith("spawn:")) {
      const [, count, behavior] = action.split(":");
      const added = addRangeEnemies(this.sim, Number(count), behavior === "stationary");
      this.sim.notify(added ? `Added ${added} zombies` : "No spawn space · clear enemies or restart");
      this.publish();
      return;
    }
    this.pause();
    if (["targets", "pursuit", "blast", "empty", "reset"].includes(action)) {
      if (action !== "reset") this.rangeScenario = action as RangeScenario;
      this.sim = createRange(this.rangeScenario);
      this.zombieAudio.reset(); this.audio.resetZombies(); this.audio.resetSlots(); this.audio.resetHotel();
      this.sim.pause();
    } else if (action === "refill") refillRange(this.sim);
    else if (action.startsWith("round-health:")) {
      const round = Number(action.slice(13));
      if (Number.isInteger(round) && round >= 1 && round <= 100) { this.sim.round = round; for (const e of this.sim.enemies) e.health = e.maxHealth = waveStats(round).health; }
    }
    else if (action === "clear") { this.sim.enemies = []; this.sim.projectiles = []; }
    else if (action === "god") this.sim.invulnerable = this.sim.invulnerable > 1 ? 0 : 99999;
    else if (action.startsWith("equip:")) {
      this.sim.resume(); this.sim.acquireWeapon(action.slice(6) as WeaponId); this.sim.pause();
    }
    this.publish();
  }
  /** Small cheats for the current run; preserve pause, position, weapons and input mode. */
  debugAction(action: "unlock-all" | "add-chips" | "toggle-invulnerability") {
    if (process.env.NODE_ENV === "production") return;
    const s = this.sim;
    if (s.phase === "ready" || s.phase === "dead") return;
    if (action === "toggle-invulnerability") {
      s.invulnerable = s.invulnerable > 1 ? 0 : 99999;
      s.notify(s.invulnerable ? "DEBUG · Invulnerability on" : "DEBUG · Invulnerability off · damage enabled");
    } else if (action === "unlock-all") {
      s.doorsOpen = { lounge: true, shortcut: true, vip: true, vipExit: true, supply: true, cashier: true };
      s.hotel = s.speakeasy = true;
      s.paintingOpen = true;
      s.refreshMap();
      s.notify("DEBUG · All doors open, including the hotel and speakeasy");
    } else {
      s.points += 10000;
      s.notify("DEBUG · Added 10,000 chips");
    }
    this.publish();
  }
  /** Development-only UI controls exercise the real simulation and shop without pointer-lock automation. */
  testAction(action: string) {
    if (process.env.NODE_ENV === "production") return;
    if (action === "unlock-all" || action === "add-chips" || action === "toggle-invulnerability") {
      this.debugAction(action);
      return;
    }
    const soundScenario = ["sound-chase", "sound-last", "sound-horde"].includes(action);
    const mysteryView = ["hotel-reception", "hotel-suitcase", "hotel-panel", "hotel-register", "hotel-cache"].includes(action);
    const hotelScenario = action.startsWith("hotel-") || action === "mystery-unlock";
    const slotScenario = ["sound-slots-west", "sound-slots-east", "sound-slots-bank"].includes(action);
    if (action === "new" || soundScenario || (hotelScenario && !mysteryView && action !== "mystery-unlock") || slotScenario ||
      ((mysteryView || action === "mystery-unlock") && (this.sim.phase === "ready" || this.sim.phase === "dead"))) {
      this.hotelTour = [];
      this.hotelTourCompleted = false;
      this.clearInput();
      this.sim = this.freshSimulation();
      this.zombieAudio.reset();
      this.audio.resetZombies();
      this.audio.resetSlots();
      this.audio.resetHotel();
      this.sim.start();
      this.sim.points = 12000;
      this.sim.intermission = 3600;
      this.sim.round = 1;
      this.sim.invulnerable = 99999;
    }
    const s = this.sim;
    if (slotScenario) {
      s.player = { x: action === "sound-slots-west" ? -20.5 : action === "sound-slots-east" ? -14.1 : 9.9, z: action === "sound-slots-bank" ? -9.7 : 0.3 };
      s.yaw = 0;
      s.pitch = 0.04;
      s.roundCue = null;
      s.roundCueRemaining = 0;
      s.waveRemaining = 0;
      this.slotWalkRemaining = 2.3;
    }
    if (soundScenario) {
      s.player = { x: -3, z: -16 };
      s.yaw = 0;
      s.pitch = 0;
      s.roundCue = null;
      s.roundCueRemaining = 0;
      s.waveRemaining = action === "sound-chase" ? 2 : 0;
      const positions = [
        [-3, -12.5], [-4.5, -12.5], [-1.5, -12.5],
        [-3, -11.4], [-4.5, -11.4], [-1.5, -11.4],
      ];
      const count = action === "sound-horde" ? 6 : action === "sound-last" ? 1 : 2;
      s.enemies = positions.slice(0, count).map(([x, z], i) => ({
        id: 100 + i,
        x, z,
        health: 100,
        maxHealth: 100,
        // Keep the survivor audition clear of the higher-priority attack cue.
        speed: action === "sound-last" ? 0 : 1.7,
        yaw: 0,
        attack: 0,
        cooldown: 0,
        stuck: 0,
        flash: 0,
        age: 0,
      }));
    }
    if (hotelScenario) {
      this.hotelTour = [];
      this.clearInput();
      s.closeHotelDocument();
      s.closeBar();
      s.closePoker();
      s.phase = "playing";
      s.hotel = action !== "hotel-entrance";
      s.hotelAge = 5;
      s.player = { x: -3, y: 0, z: 9.2, surfaceId: "casino" };
      s.yaw = 0;
      s.pitch = 0;
      if (action === "hotel-lobby") s.player = { x: -4, y: 0, z: 20, surfaceId: "hotel-lobby" };
      if (action === "hotel-reception") {
        s.player = { x: -12, y: 0, z: 23.2, surfaceId: "hotel-lobby" };
        s.yaw = Math.PI;
        s.pitch = 0.2;
      }
      if (action === "hotel-suitcase") {
        s.player = { x: -7.8, y: 0, z: 22, surfaceId: "hotel-lobby" };
        s.pitch = 0.34;
      }
      if (action === "hotel-panel" || action === "mystery-unlock") {
        s.player = { x: -12, y: 0, z: 42.9, surfaceId: "hotel-lobby" };
        s.pitch = 0.02;
      }
      if (action === "mystery-unlock") {
        s.hotelMystery.ledgerFound = true;
        s.hotelMystery.suitcaseFound = true;
        s.hotelMystery.keyFound = true;
        s.hotelMystery.passageOpen = true;
        s.notify("QA: service gallery prepared. Guest documents retained.");
      }
      if (action === "hotel-register" || action === "hotel-cache") {
        if (s.hotelMystery.passageOpen) {
          s.player = { x: action === "hotel-register" ? -5 : 0, y: 0, z: 47.3, surfaceId: "hotel-lobby" };
          s.pitch = 0.26;
        } else {
          s.player = { x: -12, y: 0, z: 42.9, surfaceId: "hotel-lobby" };
          s.notify("Find the service key and unlock the panel before entering the gallery.");
        }
      }
      if (action === "hotel-upper" || action === "hotel-chase") {
        s.player = { x: -4, y: HOTEL.floorY, z: 37, surfaceId: "hotel-upper" };
        s.yaw = action === "hotel-chase" ? Math.PI : 0;
        s.pitch = 0.08;
      }
      if (action === "hotel-jukebox") {
        s.player = { x: 10.2, y: 0, z: 25, surfaceId: "hotel-lobby" };
        s.yaw = Math.PI / 2;
        s.pitch = 0.08;
      }
      if (action === "hotel-bell") {
        s.player = { x: -4, y: HOTEL.floorY, z: 33.8, surfaceId: "hotel-upper" };
        s.yaw = 0;
        s.pitch = 0.24;
        s.acquireWeapon("shotgun");
        s.acquireWeapon("smg");
        s.weapon = "smg";
      }
      if (action === "hotel-chase") {
        s.enemies = [-6, -4, -2].map((x, i) => ({
          id: 800 + i, x, y: 0, z: 37, surfaceId: "hotel-lobby",
          health: 100, maxHealth: 100, speed: 2.6, yaw: 0,
          attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0,
        }));
      }
      if (action === "hotel-tour") {
        const [left, right] = HOTEL.stairs;
        const landing = (stair: typeof left, t: number) => {
          const p = stairPoint(stair, t);
          return { x: p.x - stair.side, z: p.z };
        };
        const lowerZ = landing(left, 0).z;
        const upperZ = landing(left, 1).z;
        this.hotelTour = [
          { x: HOTEL.entrance.x, z: 18 }, { x: -6, z: 18 },
          { x: -6, z: lowerZ }, landing(left, 0), stairPoint(left, 0),
        ];
        for (let i = 1; i <= 36; i++) {
          this.hotelTour.push(stairPoint(left, i / 36));
        }
        this.hotelTour.push(
          landing(left, 1), { x: -6, z: upperZ }, { x: -6, z: 37 },
          { x: -4, z: 37 }, { x: -4, z: 44 }, { x: -8, z: 44 },
          { x: -8, z: 48.25 }, { x: -4, z: 48.25 }, { x: 0, z: 48.25 },
          { x: 0, z: 44 }, { x: -4, z: 44 }, { x: -4, z: 37 },
          { x: -2, z: 37 }, { x: -2, z: upperZ }, landing(right, 1), stairPoint(right, 1),
        );
        for (let i = 35; i >= 0; i--) {
          this.hotelTour.push(stairPoint(right, i / 36));
        }
        this.hotelTour.push(
          landing(right, 0), { x: -4, z: lowerZ }, { x: -4, z: 42 },
          { x: -7, z: 42 }, { x: -7, z: 44 }, { x: -7, z: 42 },
          { x: 0, z: 42 }, { x: 0, z: 44 },
          { x: 0, z: 42 }, { x: -4, z: 42 },
          { x: -4, z: lowerZ }, { x: -6, z: lowerZ }, { x: -6, z: 18 },
          { x: HOTEL.entrance.x, z: 18 }, { x: HOTEL.entrance.x, z: 9.2 },
        );
      }
      s.refreshMap();
    }
    const [crapsA, crapsB] = CRAPS_TABLES;
    const [rouletteA, rouletteB] = ROULETTE_TABLES;
    const [pokerA, pokerB] = POKER_TABLES;
    const poses: Record<string, [number, number, number, number]> = {
      ...SERVICE_VIEWS,
      floor: [-3, -17, 0, 0.03],
      casinoWide: [23, -17, -0.88, 0.03],
      slotsWest: [-21.4, 4, Math.PI / 2, 0.1],
      slotsEast: [-13.6, 5.5, -Math.PI / 2, 0.1],
      slotsBank: [10.2, -4.5, -Math.PI / 2, 0.1],
      bar: [-38, -11.5, Math.PI, 0.03],
      loungeWide: [-34.8, 1.8, -2.9, 0.03],
      loungeEntrance: [-34.8, -2, -2.5, 0.03],
      loungeSeating: [-36.9, -9.8, -0.67, 0.08],
      shotgun: [CASINO_ANCHORS.shotgun.x - 1.5, CASINO_ANCHORS.shotgun.z, Math.PI / 2, 0],
      smg: [CASINO_ANCHORS.smg.x + 1.5, CASINO_ANCHORS.smg.z, -Math.PI / 2, 0],
      rifle: [CASINO_ANCHORS.rifle.x + 0.1, CASINO_ANCHORS.rifle.z, -Math.PI / 2, 0],
      vip: [-24, -23, 0.5 + Math.PI / 2, 0.08],
      couch: [-11, -27, Math.PI / 2, 0.2],
      casinoCouchNorth: [-12.8, 7.2, 0, 0.2],
      casinoCouchSouth: [21, -15.3, Math.PI, 0.2],
      loungeCouch: [-39, -0.7, 0, 0.2],
      gate: [-31.5, -2, -Math.PI / 2, 0],
      barExit: [-31.5, -14, -Math.PI / 2, 0],
      vipGate: [-23, -18.5, Math.PI, 0],
      vipExit: [-11, -18.5, Math.PI, 0],
      staff: [-21.5, 40, -Math.PI / 2, 0],
      workshop: [CASINO_ANCHORS.upgrade.x - 1.1, CASINO_ANCHORS.upgrade.z, Math.PI / 2, 0.08],
      ammo: [CASINO_ANCHORS.pistolAmmo.x, CASINO_ANCHORS.pistolAmmo.z + 1.5, Math.PI, 0],
      cashierGate: [25.5, -16, Math.PI / 2, 0],
      cashier: [29.5, -17, 0.5, 0.05],
      tables: [-21, -17.5, 0.55, 0.1],
      craps: [crapsA.x, crapsA.approachZ - 0.4, 0, 0.28],
      crapsB: [crapsB.x, crapsB.approachZ - 0.4, 0, 0.28],
      roulette: [rouletteA.x, rouletteA.approachZ - 0.4, 0, 0.25],
      rouletteB: [rouletteB.x, rouletteB.approachZ - 0.4, 0, 0.25],
      rouletteClose: [rouletteA.x + 0.735, rouletteA.z - 1.63, 0, 0.5],
      "poker-a": [pokerA.x, pokerA.approachZ - 0.1, 0, 0.52],
      "poker-b": [pokerB.x, pokerB.approachZ - 0.1, 0, 0.52],
    };
    if (poses[action]) {
      this.hotelTour = [];
      this.slotWalkRemaining = 0;
      if (["bar", "loungeWide", "loungeEntrance", "loungeSeating", "loungeCouch", "smg"].includes(action)) {
        s.doorsOpen.lounge = true;
      }
      if (["vip", "couch", "workshop", "poker-b"].includes(action)) {
        s.doorsOpen.vip = true;
      }
      if ([...Object.keys(SERVICE_VIEWS), "rifle"].includes(action)) {
        s.hotel = true;
        s.doorsOpen.supply = true;
      }
      if (action === "staff") s.hotel = true;
      if (action === "cashier") s.doorsOpen.cashier = true;
      s.closeBar();
      s.closePoker();
      s.closeHotelDocument();
      s.phase = "playing";
      s.intermission = 3600;
      s.invulnerable = 99999;
      const p = poses[action];
      s.player = { x: p[0], z: p[1] };
      s.yaw = p[2];
      s.pitch = p[3];
      s.refreshMap();
    }
    if (action === "use") this.interact();
    if (action === "bell-clear-wave") {
      for (const enemy of s.enemies) if (enemy.hotelAmbush && enemy.health > 0) s.damageEnemy(enemy, 100000, false, "body");
    }
    if (action === "dice-seven" || action === "dice-win") {
      s.lastWagerRound = -1;
      s.dice = null;
      s.points = Math.max(s.points, 25);
      s.holdingChips = true;
      s.placeBet(9, "craps");
      if (s.purchase("craps") && s.dice)
        (s.dice as NonNullable<Simulation["dice"]>).values =
          action === "dice-seven" ? [3, 4] : [5, 4];
    }
    if (action === "roulette-spin") s.purchase("roulette");
    if (action === "roulette-spin-b") s.purchase("roulette-b");
    if (action === "craps-roll-b") s.purchase("craps-b");
    const rouletteOutcomes: Record<string, number> = {
      "roulette-4": 4,
      "roulette-24": 24,
      "roulette-7": 7,
      "roulette-0": 0,
      "roulette-miss": 13,
    };
    if (action in rouletteOutcomes && s.purchase("roulette") && s.roulette) {
      s.roulette.number = rouletteOutcomes[action];
      // Visible development controls provide repeatable reward checks using a paid spin.
      for (const weapon of s.firearms)
        s.inventory[weapon] = { owned: true, mag: 1, reserve: 2 };
      s.reloadRemaining = 0;
    }
    if (action === "roulette-expire")
      s.damageBoostRemaining = Math.min(s.damageBoostRemaining, 0.05);
    if (action === "roulette-pause") s.pause();
    if (action === "roulette-resume") s.resume();
    if (action === "poker-near-flush") {
      const id = s.pokerOpen ?? "poker-a";
      const state = s.pokerTables[id];
      state.hand = [
        { rank: 2, suit: "hearts" },
        { rank: 5, suit: "hearts" },
        { rank: 8, suit: "hearts" },
        { rank: 11, suit: "hearts" },
        { rank: 1, suit: "clubs" },
      ];
      state.drawPile = cardDeck().filter(
        (card) =>
          !state.hand.some(
            (held) => held.rank === card.rank && held.suit === card.suit,
          ) && !(card.rank === 13 && card.suit === "hearts"),
      );
      state.drawPile.push({ rank: 13, suit: "hearts" });
      state.discard = [];
      state.lastSwapRound = -1;
      state.swaps = 0;
      state.completed = false;
    }
    if (action === "poker-swap") s.swapPoker(4);
    if (action === "left") s.yaw -= Math.PI / 4;
    if (action === "right") s.yaw += Math.PI / 4;
    if (action === "forward" || action === "back")
      for (let i = 0; i < 30; i++)
        s.step(1 / 60, {
          forward: action === "forward" ? 1 : -1,
          strafe: 0,
          sprint: false,
          fire: false,
        });
    if (action === "shoot") s.fire();
    if (action === "hold-chips") s.toggleChips();
    if (action === "take-bets") s.takeBets();
    if (action.startsWith("bet-")) {
      const number=PLACE_NUMBERS.find(n=>String(n)===action.slice(4));
      if(number) s.placeBet(number);
    }
    if (action === "clue") {
      s.doorsOpen.vip = true;
      s.refreshMap();
      s.player = { x: pokerB.x, z: pokerB.approachZ };
      s.yaw = 0;
      s.pitch = .45;
    }
    if (action === "portrait") {
      s.doorsOpen.cashier = true;
      s.refreshMap();
      s.player = { x: CASINO_SECRET_ANCHORS.painting.x - 1.3, z: CASINO_SECRET_ANCHORS.painting.z };
      s.yaw = Math.PI / 2;
      s.pitch = -.12;
    }
    if (action === "mystery-view" && s.speakeasy) {
      s.player = { x: CASINO_SECRET_ANCHORS.mystery.x, z: CASINO_SECRET_ANCHORS.mystery.z + 1.3 };
      s.yaw = Math.PI;
      s.pitch = .2;
    }
    if(action.startsWith("key-")) {
      const key=KEYPAD_TARGETS.find(k=>k.key===action.slice(4));
      if(key) {s.holdingChips=false;s.yaw=Math.atan2(key.x-s.player.x,key.z-s.player.z);s.pitch=-Math.atan2(key.y-1.65,Math.hypot(key.x-s.player.x,key.z-s.player.z));s.fireCooldown=0;s.fire();}
    }
    if (action === "grenade") s.throwGrenade();
    if (action === "knife") s.knife();
    if (action === "melee-target") {
      s.phase="playing";s.intermission=3600;s.invulnerable=99999;
      s.player={x:-3,z:-16};s.yaw=0;s.pitch=0;
      s.enemies=[{id:500,x:-3,z:-14.8,health:80,maxHealth:80,speed:0,yaw:Math.PI,attack:0,cooldown:0,stuck:0,flash:0,age:0}];
    }
    if (action === "reload") s.reload();
    if (action === "aim") s.aimHeld = true;
    if (action === "hip") s.aimHeld = false;
    if (action.startsWith("weapon-"))
      s.switchWeapon(action.slice(7) as WeaponId);
    if (action.startsWith("give-")) {
      const id = action.slice(5) as WeaponId;
      if (s.inventory[id]) {
        s.acquireWeapon(id);
        if (id === "stick") s.stickTaken = true;
        s.switchWeapon(id);
        s.events.push({ type: "pickup", weapon: id });
      }
    }
    if (action === "shoot-alt") s.fire(true);
    if (action === "empty-mag") s.inventory[s.weapon].mag = 0;
    if (action === "clear") {
      s.round = Math.max(1, s.round);
      s.phase = "playing";
      s.waveRemaining = 0;
      s.enemies = [];
      s.intermission = 0;
      s.step(0.016, { forward: 0, strafe: 0, sprint: false, fire: false });
    }
    if (action === "round") {
      s.phase = "playing";
      s.intermission = 0;
      s.beginRound();
    }
    if (action === "crowd") {
      s.phase = "playing";
      s.doorsOpen.lounge = s.doorsOpen.vip = true;
      s.refreshMap();
      s.intermission = 3600;
      s.invulnerable = 99999;
      s.enemies = Array.from({ length: 14 }, (_, i) => ({
        id: 100 + i,
        x: i % 2 ? -4.7 : -1.3,
        z: -9 + Math.floor(i / 2) * 2.5,
        health: 100,
        maxHealth: 100,
        speed: 1.7,
        yaw: 0,
        attack: 0,
        cooldown: 0,
        stuck: 0,
        flash: 0,
        age: 0,
      }));
    }
    if (action === "zombies") {
      s.phase = "playing"; s.intermission = 3600; s.invulnerable = 99999;
      s.player = { x: -3, z: -16 }; s.yaw = 0; s.pitch = .12;
      s.enemies = Array.from({ length: 3 }, (_, i) => ({
        id: 300 + i, x: -4 + i, z: -13, health: 1000, maxHealth: 1000,
        speed: 0, yaw: Math.PI, attack: 0, cooldown: 0, stuck: 0, flash: 0, age: 0,
      }));
    }
    if (action === "zombie-wounds") for (const e of s.enemies) {
      s.damageEnemy(e, 10, false, "body");
      s.damageEnemy(e, 10, true, "head");
    }
    if (action === "zombie-limbs") for (const e of s.enemies) {
      s.damageEnemy(e, 34, false, e.id % 2 ? "leftLeg" : "rightArm");
    }
    if (action === "zombie-attacks") for (const e of s.enemies) {
      e.attackStyle = e.id % 3; e.attack = RULES.attackWindup;
    }
    if (action === "zombie-deaths") for (const e of s.enemies) {
      s.damageEnemy(e, e.health + 1, false);
    }
    void this.audio.unlock();
    this.publish();
  }
  buyBar(id: BarItemId) {
    this.sim.purchaseBar(id);
    this.publish();
  }
  swapPoker(index: number) {
    this.sim.swapPoker(index);
    this.publish();
  }
  selectBarWeapon(id: WeaponId) {
    if (
      this.sim.phase !== "paused" ||
      !this.sim.shopOpen ||
      !this.sim.canUseBar() ||
      !this.sim.inventory[id].owned ||
      id === this.sim.weapon
    )
      return;
    this.sim.weapon = id;
    this.sim.reloadRemaining = 0;
    this.publish();
  }
  setSensitivity(value: number) {
    this.sensitivity = value;
  }
  setVolume(value: number) {
    this.audio.setVolume(value);
  }
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.hit = Math.max(0, this.hit - dt);
    this.damage = Math.max(0, this.damage - dt);
    const playerBeforeStep = { ...this.sim.player };
    if (this.sim.phase === "playing") {
      this.accumulated += dt;
      while (this.accumulated >= 1 / 60) {
        if (this.hotelTour.length && this.keys.size) this.hotelTour = [];
        let tourForward = 0;
        const target = this.hotelTour[0];
        if (target) {
          const dx = target.x - this.sim.player.x;
          const dz = target.z - this.sim.player.z;
          if (Math.hypot(dx, dz) < 0.12) {
            this.hotelTour.shift();
            if (!this.hotelTour.length) this.hotelTourCompleted = true;
          } else {
            this.sim.yaw = Math.atan2(dx, dz);
            this.sim.pitch = -0.08;
            tourForward = 1;
          }
        }
        this.sim.step(1 / 60, {
          forward: tourForward || (this.slotWalkRemaining > 0 ? 1 : +this.keys.has("KeyW") - +this.keys.has("KeyS")),
          strafe: +this.keys.has("KeyD") - +this.keys.has("KeyA"),
          sprint: this.keys.has("Space"),
          fire: this.firing,
        });
        this.accumulated -= 1 / 60;
        this.slotWalkRemaining = Math.max(0, this.slotWalkRemaining - 1 / 60);
      }
    }
    this.audio.setActive(this.sim.phase === "playing");
    this.audio.updateMystery(this.sim.mystery, this.sim.phase === "playing", this.sim.player, this.sim.yaw);
    const ownedWeapons = WEAPON_ORDER.filter(id => this.sim.inventory[id].owned);
    if (this.dialogueSimulation !== this.sim) {
      this.dialogueSimulation = this.sim;
      this.dialogue.reset(ownedWeapons);
      this.speech.stop();
    }
    const line = this.dialogue.update(performance.now() / 1000, this.sim.phase === "playing", this.sim.events, ownedWeapons, this.speech.busy);
    if (this.sim.phase !== "playing") this.speech.stop();
    else if (line && this.audio.context && this.audio.master) this.speech.play(line, this.audio.context, this.audio.master);
    for (const event of this.sim.events) {
      this.audio.play(event);
      this.renderer.weaponEvent(event);
      if (event.type === "zombieAttack") {
        const source = this.sim.enemies.find(enemy => enemy.id === event.enemyId);
        if (source && source.health > 0)
          this.audio.zombieAttack(this.sim.player, source, this.sim.yaw);
      }
      if (event.type === "kill" && event.position)
        this.audio.zombieDeath(this.sim.player, event.position, this.sim.yaw);
      if (event.type === "shot") this.renderer.shot(event.weapon!, event.side);
      if (event.type === "pickup" && event.weapon)
        this.pickupCard = weaponCard(event.weapon, this.sim, performance.now());
      if (event.type === "hit") {
        this.hit = 0.16;
        this.headshot = !!event.headshot;
      }
      if (event.type === "hurt") this.damage = 0.4;
      if (event.type === "death") {
        this.clearInput();
        if (document.pointerLockElement === this.canvas)
          document.exitPointerLock();
      }
    }
    this.sim.events.length = 0;
    const zombieCue = this.zombieAudio.update(dt, {
      playing: this.sim.phase === "playing",
      suppressed: !this.audio.canPlayZombieCue(),
      round: this.sim.round,
      roundCueRemaining: this.sim.roundCueRemaining,
      waveRemaining: this.sim.waveRemaining,
      player: this.sim.player,
      enemies: this.sim.enemies,
    });
    if (zombieCue) {
      const source = this.sim.enemies.find((enemy) => enemy.id === zombieCue.enemyId);
      if (source && source.health > 0) this.audio.zombieCue(
        zombieCue.kind,
        this.sim.player,
        source,
        this.sim.yaw,
        zombieCue.enemyId,
      );
    }
    this.audio.update(
      dt,
      this.sim.phase === "playing",
      this.sim.player,
      this.sim.yaw,
      // Movement input can remain held against a wall; only real displacement
      // should make footsteps or wake a nearby slot cabinet.
      Math.hypot(this.sim.player.x - playerBeforeStep.x, this.sim.player.z - playerBeforeStep.z) > 0.0001,
      this.sim.sprinting,
    );
    this.audio.weaponFrame(dt, {
      weapon: this.sim.weapon,
      reloadRemaining: this.sim.reloadRemaining,
      reloadDuration: this.sim.reloadDuration(),
      mag: this.sim.inventory[this.sim.weapon].mag,
      playing: this.sim.phase === "playing",
    });
    // The Velvet Fortune decides its reward when the reels start: fetch that gun's foley now.
    if (this.sim.mystery?.reward && !this.sim.mystery.resolved) void this.audio.weapons.preload(this.sim.mystery.reward);
    this.audio.updateHotel(dt, this.sim.phase === "playing", this.sim.jukeboxOn, this.sim.player, this.sim.yaw);
    this.renderer.update(this.sim, dt);
    this.updateTimer -= dt;
    if (this.updateTimer <= 0) {
      this.publish();
      this.updateTimer = 0.05;
    }
  };
  private publish() {
    const s = this.sim,
      w = s.inventory[s.weapon],
      p = s.nearestPurchase(),
      info = p ? s.purchaseInfo(p.id) : null;
    const pokerId = s.pokerOpen;
    const pokerState = pokerId ? s.pokerTables[pokerId] : null;
    const bestSuit = bestPokerSuit(pokerState?.hand ?? []);
    const crapsId = s.nearCrapsTable();
    const betTarget = s.aimedBetTarget();
    // Cap work on high-refresh Macs and keep menus/paused tabs inexpensive.
    this.renderer.engine.maxFPS = s.phase === "playing" ? 60 : 15;
    this.audio.setActive(s.phase === "playing");
    const card = !s.aiming && !s.holdingChips && this.pickupCard && performance.now() - this.pickupCard.at < 4200 ? this.pickupCard : null;
    if (s.phase !== "playing") this.speech.stop();
    this.onView({
      dialogue: this.speech.caption,
      aiming: this.renderer.aimBlend > .85,
      scoped: this.renderer.aimBlend > .95 && s.weapon === "sniper",
      owned: ownedSlots(s),
      pickup: card,
      mysteryReel: {
        spinning: !!s.mystery && !s.mystery.resolved,
        id: s.mystery?.resolved ? s.mystery.reward : null,
      },
      casino: {
        holding: s.holdingChips,
        chip: s.chipValue,
        bets: crapsId ? { ...s.betsByTable[crapsId] } : {},
        nearTable: !!crapsId,
        tableId: crapsId ?? undefined,
        result: crapsId ? s.crapsResults[crapsId] : "",
        hover: betTarget ? {
          number: betTarget.number,
          amount: placeAmount(betTarget.number, s.chipValue),
          affordable: s.points >= placeAmount(betTarget.number, s.chipValue),
        } : undefined,
        speakeasy: s.speakeasy,
        nearPainting: s.cashier && Math.hypot(s.player.x - CASINO_SECRET_ANCHORS.painting.x, s.player.z - CASINO_SECRET_ANCHORS.painting.z) < 4,
        paintingOpen: s.paintingOpen,
        codeProgress: s.codeProgress,
        mystery: s.mysteryOffer ? `${s.weaponName(s.mysteryOffer)} · F take${s.firearms.length >= 2 && !s.inventory[s.mysteryOffer].owned ? ` / replace ${s.weaponName(isMelee(s.weapon) ? s.lastFirearm : s.weapon)}` : ""} · X decline · ${Math.ceil(s.mystery?.offerRemaining ?? 0)}s` : s.mystery && (!s.mystery.resolved || (s.mystery.closingRemaining ?? 0) > 0) ? s.mystery.message : "",
        nearMystery: s.speakeasy && Math.hypot(s.player.x - CASINO_SECRET_ANCHORS.mystery.x, s.player.z - CASINO_SECRET_ANCHORS.mystery.z) < 4,
      },
      grenades: s.grenades,
      knifeReady: s.knifeCooldown <= 0 && s.grenadeCooldown <= 0,
      phase: s.phase,
      previewControls: this.previewInput,
      stamina: s.stamina,
      sprintExhausted: s.sprintExhausted,
      health: s.health,
      maxHealth: s.maxHealth,
      inventory: WEAPON_ORDER.map((id) => ({
        id,
        label: WEAPONS[id].label,
        owned: s.inventory[id].owned,
      })),
      perks: (Object.keys(PERKS) as PerkId[])
        .filter((id) => s.perks[id])
        .map((id) => ({ id, name: PERKS[id].name })),
      shopOpen: s.shopOpen,
      pokerOpen: !!pokerId,
      poker:
        pokerId && pokerState
          ? {
              id: pokerId,
              name: POKER_TABLES.find((table) => table.id === pokerId)!.name,
              hand: pokerState.hand.map((card) => ({ ...card })),
              bestCount: bestSuit.count,
              bestSuit: bestSuit.suit,
              ...s.pokerInfo(pokerId),
              completed: pokerState.completed,
              rewardUnlocked: s.flushRewardUnlocked,
              swaps: pokerState.swaps,
            }
          : null,
      shopOffers: [
        ...(Object.keys(PERKS) as PerkId[]).map((id) => ({
          id,
          name: PERKS[id].name,
          detail: PERKS[id].detail,
          ...s.barInfo(id),
        })),
        {
          id: "weaponUpgrade",
          name: `Double Down · ${WEAPONS[s.weapon].label}`,
          detail:
            s.weapon === "revolver"
              ? "+35% damage · reload 25% faster · full cylinder"
              : "+50% magazine · heavier hits · full magazine",
          ...s.barInfo("weaponUpgrade"),
        },
      ],
      roundCue: s.roundCue,
      roundCueRemaining: s.roundCueRemaining,
      points: s.points,
      round: s.round,
      kills: s.kills,
      headshots: s.headshots,
      earned: s.earned,
      time: s.time,
      weapon: s.weapon,
      weaponName: s.weaponName(),
      mag: w.mag,
      reserve: w.reserve,
      capacity: s.capacity(),
      hasShotgun: s.inventory.shotgun.owned,
      reload: s.reloadRemaining,
      reloadTotal: s.reloadDuration(),
      enemies: s.enemies.filter((e) => e.health > 0).length,
      remaining: s.waveRemaining,
      intermission: s.intermission,
      lounge: s.lounge,
      shortcut: s.shortcut,
      vip: s.vip,
      tables: s.tables,
      supply: s.supply,
      cashier: s.cashier,
      doorsOpen: { ...s.doorsOpen },
      hotel: s.hotel,
      hotelMystery: { ...s.hotelMystery },
      hotelDocument: s.hotelDocument ? { id: s.hotelDocument, ...getHotelMysteryDocument(s.hotelDocument, s.hotelMystery) } : null,
      hotelChallenge: {
        phase: s.hotelChallenge.phase, remaining: s.hotelChallenge.remaining,
        pending: s.hotelChallenge.pending, alive: s.hotelChallengeAlive,
      },
      slowRound: s.slowRound,
      dice: s.dice ? { ...s.dice, values: [...s.dice.values] } : null,
      roulette: s.roulette ? { ...s.roulette } : null,
      diceResults: CRAPS_TABLES.flatMap((table, i) => {
        const dice = s.diceTables[table.id];
        return dice ? [{ tableId: table.id, label: `CRAPS ${i + 1}`, result: s.crapsResults[table.id], dice: { ...dice, values: [...dice.values] as [number, number] } }] : [];
      }),
      rouletteResults: ROULETTE_TABLES.flatMap((table, i) => {
        const roulette = s.rouletteTables[table.id];
        return roulette ? [{ tableId: table.id, label: `ROULETTE ${i + 1}`, roulette: { ...roulette } }] : [];
      }),
      damageBoostRemaining: s.damageBoostRemaining,
      room: roomName(s.player),
      zombieAudioStatus: process.env.NODE_ENV !== "production" ? this.audio.zombieStatus : undefined,
      hotelPlaytestStatus: process.env.NODE_ENV !== "production"
        ? `${roomName(s.player)} · floor ${(s.player.y ?? 0).toFixed(2)} m${this.hotelTour.length ? ` · walking tour: ${this.hotelTour.length} waypoints left` : this.hotelTourCompleted ? " · hotel loop complete" : ""} · clues ${+s.hotelMystery.ledgerFound + +s.hotelMystery.suitcaseFound + +s.hotelMystery.registerFound}/3 · key ${s.hotelMystery.keyFound ? "found" : "missing"} · gallery ${s.hotelMystery.passageOpen ? "open" : "locked"} · cache ${s.hotelMystery.cacheClaimed ? "claimed" : "waiting"}`
        : undefined,
      slotAudioStatus: process.env.NODE_ENV !== "production" ? this.audio.slotStatus : undefined,
      upgraded: Object.values(s.upgrades).some(Boolean),
      message: s.messageRemaining > 0 ? s.lastMessage : "",
      prompt:
        p && info
          ? {
              name:
                p.id === "mystery" && s.mysteryOffer ? `Take ${s.weaponName(s.mysteryOffer)}` :
                (p.id === "shotgun" || p.id === "smg" || p.id === "rifle") &&
                s.inventory[p.id].owned
                  ? `${WEAPONS[p.id].label} ammunition`
                  : (p.id === "craps" || p.id === "craps-b") && info.price === 0
                    ? `Craps place bets · ${p.id === "craps" ? "Table I" : "Table II"}`
                    : p.name,
              detail: (p.id === "shotgun" || p.id === "smg" || p.id === "rifle") && !s.inventory[p.id].owned && s.firearms.length >= 2
                ? `Replaces ${s.weaponName(isMelee(s.weapon) ? s.lastFirearm : s.weapon)} · two-gun limit`
                : p.id === "mystery" && s.mysteryOffer ? "F take · X decline · no extra cost"
                : p.id === "craps" || p.id === "craps-b"
                ? info.price === 0
                  ? "Roll placed bets · no extra fee · one roll per table each round"
                  : `7 slows you 20% ${s.intermission > 0 ? "next round" : "this round"} · other rolls pay 500 · C for place bets`
                : p.id === "jukebox" ? (s.jukeboxOn ? "Stop the lobby record" : "Play The Lucky Note · original lounge instrumental") : p.detail,
              ...info,
              actionLabel:
                p.id === "mystery" && s.mysteryOffer ? "TAKE · F" :
                p.id === "poker-a" || p.id === "poker-b"
                  ? "OPEN HAND"
                  : p.id === "stick" || p.id === "axe"
                    ? "TAKE"
                  : (p.id === "craps" || p.id === "craps-b") && info.price === 0 ? "ROLL DICE"
                  : p.id === "hotelBell" ? "RING BELL"
                  : p.id === "jukebox" ? (s.jukeboxOn ? "STOP MUSIC" : "PLAY MUSIC")
                  : p.id === "hotelLedger" || p.id === "hotelSuitcase" || p.id === "hotelRegister" ? "EXAMINE"
                  : p.id === "hotelPanel" ? "UNLOCK"
                  : p.id === "hotelCache" ? "TAKE SUPPLIES"
                  : undefined,
            }
          : null,
      hit: this.hit,
      headshot: this.headshot,
      damage: this.damage,
      fps: this.renderer.fps,
      p95: this.renderer.frameP95,
    });
  }
  dispose() {
    this.disposed = true;
    this.clearInput();
    this.renderer.engine.stopRenderLoop(this.frame);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    document.removeEventListener("keydown", this.keyDown);
    document.removeEventListener("keyup", this.keyUp);
    document.removeEventListener("mousemove", this.mouseMove);
    document.removeEventListener("mousedown", this.mouseDown);
    document.removeEventListener("mouseup", this.mouseUp);
    document.removeEventListener("wheel", this.wheel);
    document.removeEventListener("pointerlockchange", this.pointerChange);
    document.removeEventListener("pointerlockerror", this.pointerError);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.speech.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
