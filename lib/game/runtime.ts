import {
  Simulation,
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
import { GameAudio } from "./audio";
import { ZombieAudioDirector } from "./zombie-audio-director";
import { HOTEL, stairPoint } from "./world";
import {
  POKER_TABLES,
  bestPokerSuit,
  cardDeck,
  type PlayingCard,
  type CardSuit,
  type PokerTableId,
} from "./poker";
export type GameView = {
  grenades: number;
  knifeReady: boolean;
  phase: "ready" | "playing" | "paused" | "dead";
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
  hotel: boolean;
  hotelChallenge: { phase: "idle" | "active" | "complete" | "failed"; remaining: number; pending: number; alive: number };
  slowRound: number;
  dice: Simulation["dice"];
  roulette: Simulation["roulette"];
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
  grenades: 2,
  knifeReady: true,
  phase: "ready",
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
  tables: false,
  hotel: false,
  hotelChallenge: { phase: "idle", remaining: 0, pending: 0, alive: 0 },
  slowRound: 0,
  dice: null,
  roulette: null,
  damageBoostRemaining: 0,
  room: "Casino Floor",
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
  sensitivity = 1;
  private keys = new Set<string>();
  private firing = false;
  private last = 0;
  private accumulated = 0;
  private updateTimer = 0;
  private hit = 0;
  private damage = 0;
  private headshot = false;
  private zombieAudio = new ZombieAudioDirector();
  private pendingStart = false;
  private suppressUntil = 0;
  private disposed = false;
  private playtesting = false;
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
  private clearInput() {
    this.slotWalkRemaining = 0;
    this.keys.clear();
    this.firing = false;
    this.accumulated = 0;
  }
  private keyDown = (e: KeyboardEvent) => {
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
        "KeyG",
        "KeyV",
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Space",
        "Tab",
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyR") this.sim.reload();
    if (e.code === "KeyG") this.sim.throwGrenade();
    if (e.code === "KeyV") this.sim.knife();
    if (e.code === "Digit1") this.sim.switchWeapon("pistol");
    if (e.code === "Digit2") this.sim.switchWeapon("shotgun");
    if (e.code === "Digit3") this.sim.switchWeapon("smg");
    if (e.code === "Digit4") this.sim.switchWeapon("rifle");
    if (e.code === "Digit5") this.sim.switchWeapon("revolver");
    if (e.code === "Digit6") this.sim.switchWeapon("tommy");
    if (e.code === "KeyE") this.interact();
    if (e.code === "Escape") this.pause();
  };
  private interact() {
    const p = this.sim.nearestPurchase();
    if (p) this.sim.purchase(p.id);
    if (this.sim.shopOpen || this.sim.pokerOpen) {
      this.clearInput();
      if (document.pointerLockElement === this.canvas)
        document.exitPointerLock();
      this.publish();
    }
  }
  private keyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private mouseMove = (e: MouseEvent) => {
    if (
      document.pointerLockElement !== this.canvas ||
      this.sim.phase !== "playing"
    )
      return;
    this.sim.yaw += e.movementX * 0.002 * this.sensitivity;
    this.sim.pitch = Math.max(
      -1.3,
      Math.min(1.3, this.sim.pitch + e.movementY * 0.002 * this.sensitivity),
    );
  };
  private mouseDown = (e: MouseEvent) => {
    if (
      e.button !== 0 ||
      document.pointerLockElement !== this.canvas ||
      this.sim.phase !== "playing" ||
      performance.now() < this.suppressUntil
    )
      return;
    this.firing = true;
  };
  private mouseUp = () => {
    this.firing = false;
  };
  private pointerChange = () => {
    this.clearInput();
    if (document.pointerLockElement === this.canvas) {
      if (this.pendingStart) {
        this.sim = new Simulation();
        this.zombieAudio.reset();
        this.audio.resetZombies();
        this.audio.resetSlots();
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
    this.pendingStart =
      restart || this.sim.phase === "ready" || this.sim.phase === "dead";
    this.clearInput();
    void this.audio
      .unlock()
      .catch(() =>
        this.onError(
          "Audio is unavailable. You can still play; check your browser sound settings.",
        ),
      );
    if (this.playtesting) {
      if (this.pendingStart) {
        this.sim = new Simulation();
        this.zombieAudio.reset();
        this.audio.resetZombies();
        this.audio.resetSlots();
        this.sim.start();
        this.pendingStart = false;
      } else this.sim.resume();
      this.publish();
      return;
    }
    try {
      this.canvas.focus();
      await this.canvas.requestPointerLock();
    } catch (error) {
      this.pointerError();
      if (error instanceof Error)
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
  /** Development-only UI controls exercise the real simulation and shop without pointer-lock automation. */
  testAction(action: string) {
    if (process.env.NODE_ENV === "production") return;
    this.playtesting = true;
    const soundScenario = ["sound-chase", "sound-last", "sound-horde"].includes(action);
    const hotelScenario = action.startsWith("hotel-");
    const slotScenario = ["sound-slots-west", "sound-slots-east", "sound-slots-bank"].includes(action);
    if (action === "new" || soundScenario || hotelScenario || slotScenario) {
      this.hotelTour = [];
      this.hotelTourCompleted = false;
      this.clearInput();
      this.sim = new Simulation();
      this.zombieAudio.reset();
      this.audio.resetZombies();
      this.audio.resetSlots();
      this.sim.start();
      this.sim.points = 12000;
      this.sim.intermission = 3600;
      this.sim.round = 1;
      this.sim.invulnerable = 99999;
    }
    const s = this.sim;
    if (slotScenario) {
      s.player = { x: action === "sound-slots-west" ? -10.2 : action === "sound-slots-east" ? -3.8 : 2.4, z: action === "sound-slots-bank" ? 0 : -5.5 };
      s.yaw = 0;
      s.pitch = 0.04;
      s.roundCue = null;
      s.roundCueRemaining = 0;
      s.waveRemaining = 0;
      this.slotWalkRemaining = 2.3;
    }
    if (soundScenario) {
      s.player = { x: -9, z: -8 };
      s.yaw = 0;
      s.pitch = 0;
      s.roundCue = null;
      s.roundCueRemaining = 0;
      s.waveRemaining = action === "sound-chase" ? 2 : 0;
      const positions = [
        [-9, -4.5], [-10.5, -4.5], [-7.5, -4.5],
        [-9, -3.4], [-10.5, -3.4], [-7.5, -3.4],
      ];
      const count = action === "sound-horde" ? 6 : action === "sound-last" ? 1 : 2;
      s.enemies = positions.slice(0, count).map(([x, z], i) => ({
        id: 100 + i,
        x, z,
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
    if (hotelScenario) {
      s.hotel = action !== "hotel-entrance";
      s.hotelAge = 5;
      s.player = { x: -3, y: 0, z: 9.2, surfaceId: "casino" };
      s.yaw = 0;
      s.pitch = 0;
      if (action === "hotel-lobby") s.player = { x: -4, y: 0, z: 20, surfaceId: "hotel-lobby" };
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
        s.inventory.shotgun = { owned: true, mag: 6, reserve: 30 };
        s.inventory.smg = { owned: true, mag: 30, reserve: 180 };
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
          { x: HOTEL.entrance.x, z: 18 }, { x: -10, z: 18 },
          { x: -10, z: lowerZ }, landing(left, 0), stairPoint(left, 0),
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
          landing(right, 0), { x: -4, z: lowerZ }, { x: -4, z: 46 },
          { x: -7, z: 46 }, { x: -7, z: 49 }, { x: -7, z: 46 }, { x: -4, z: 46 },
          { x: -4, z: lowerZ }, { x: -10, z: lowerZ }, { x: -10, z: 18 },
          { x: HOTEL.entrance.x, z: 18 }, { x: HOTEL.entrance.x, z: 9.2 },
        );
      }
      s.refreshMap();
    }
    const poses: Record<string, [number, number, number, number]> = {
      ...SERVICE_VIEWS,
      floor: [-9, -8, 0.3, 0.06],
      slotsWest: [-11.6, -1.8, Math.PI / 2, 0.1],
      slotsEast: [-3, 0, -Math.PI / 2, 0.1],
      slotsBank: [3.2, 5, -Math.PI / 2, 0.1],
      bar: [12, -6.5, Math.PI, 0.03],
      loungeWide: [14.8, 0.65, -2.72, 0.06],
      loungeEntrance: [5.4, -3.4, 2.05, 0.03],
      loungeSeating: [13.1, -4.8, -0.67, 0.08],
      shotgun: [-12.7, 1.8, -Math.PI / 2, 0],
      smg: [6.8, -0.2, -Math.PI / 2, 0],
      rifle: [25.3, -8.2, Math.PI / 2, 0],
      vip: [18, -8, 0.6, 0.08],
      couch: [24.3, -1.3, 0.94, 0.23],
      gate: [2, -4.1, Math.PI / 2, 0],
      staff: [7, 8.6, -Math.PI / 2, 0],
      workshop: [24.7, 8.7, 0, 0.02],
      ammo: [-12.6, -9.1, Math.PI, 0],
      tablesGate: [25.8, -4.1, Math.PI / 2, 0],
      tables: [30, -8, 0.55, 0.1],
      craps: [35, -5.3, 0, 0.28],
      roulette: [35, 2.6, 0, 0.25],
      rouletteClose: [35.735, 3.37, 0, 0.5],
      "poker-a": [22, -4.8, 0, 0.52],
      "poker-b": [22, 3.2, 0, 0.52],
    };
    if (poses[action]) {
      this.hotelTour = [];
      this.slotWalkRemaining = 0;
      if (
        [
          "bar",
          "loungeWide",
          "loungeEntrance",
          "loungeSeating",
          ...Object.keys(SERVICE_VIEWS),
          "smg",
          "rifle",
          "vip",
          "couch",
          "staff",
          "workshop",
          "tablesGate",
          "tables",
          "craps",
          "roulette",
          "rouletteClose",
          "poker-a",
          "poker-b",
        ].includes(action)
      )
        s.lounge = true;
      if (
        [
          "rifle",
          "vip",
          "couch",
          "workshop",
          "tablesGate",
          "tables",
          "craps",
          "roulette",
          "rouletteClose",
          "poker-a",
          "poker-b",
        ].includes(action)
      )
        s.vip = true;
      if (["tables", "craps", "roulette", "rouletteClose"].includes(action))
        s.tables = true;
      s.closeBar();
      s.closePoker();
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
      s.points = Math.max(s.points, 250);
      if (s.purchase("craps") && s.dice)
        (s.dice as NonNullable<Simulation["dice"]>).values =
          action === "dice-seven" ? [3, 4] : [5, 4];
    }
    if (action === "roulette-spin") s.purchase("roulette");
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
      for (const weapon of WEAPON_ORDER)
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
    if (action === "grenade") s.throwGrenade();
    if (action === "knife") s.knife();
    if (action === "melee-target") {
      s.phase="playing";s.intermission=3600;s.invulnerable=99999;
      s.player={x:-12,z:-7};s.yaw=0;s.pitch=0;
      s.enemies=[{id:500,x:-12,z:-5.8,health:80,maxHealth:80,speed:0,yaw:Math.PI,attack:0,cooldown:0,stuck:0,flash:0,age:0}];
    }
    if (action === "reload") s.reload();
    if (action.startsWith("weapon-"))
      s.switchWeapon(action.slice(7) as WeaponId);
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
      s.lounge = s.vip = true;
      s.refreshMap();
      s.intermission = 3600;
      s.invulnerable = 99999;
      s.enemies = Array.from({ length: 14 }, (_, i) => ({
        id: 100 + i,
        x: i % 2 ? 25 : 18,
        z: -5 + Math.floor(i / 2) * 2,
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
      s.player = { x: -12, z: -7 }; s.yaw = 0; s.pitch = .12;
      s.enemies = Array.from({ length: 3 }, (_, i) => ({
        id: 300 + i, x: -13 + i, z: -4, health: 1000, maxHealth: 1000,
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
          sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
          fire: this.firing,
        });
        this.accumulated -= 1 / 60;
        this.slotWalkRemaining = Math.max(0, this.slotWalkRemaining - 1 / 60);
      }
    }
    this.audio.setActive(this.sim.phase === "playing");
    for (const event of this.sim.events) {
      this.audio.play(event);
      if (event.type === "zombieAttack" && event.position)
        this.audio.zombieAttack(
          this.sim.player,
          event.position,
          this.sim.yaw,
        );
      if (event.type === "shot") this.renderer.shot(event.weapon!);
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
      round: this.sim.round,
      roundCueRemaining: this.sim.roundCueRemaining,
      waveRemaining: this.sim.waveRemaining,
      player: this.sim.player,
      enemies: this.sim.enemies,
    });
    if (zombieCue) {
      const source = this.sim.enemies.find((enemy) => enemy.id === zombieCue.enemyId);
      this.audio.zombieCue(
        zombieCue.kind,
        this.sim.player,
        source ?? zombieCue.position,
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
    // Cap work on high-refresh Macs and keep menus/paused tabs inexpensive.
    this.renderer.engine.maxFPS = s.phase === "playing" ? 60 : 15;
    this.audio.setActive(s.phase === "playing");
    this.onView({
      grenades: s.grenades,
      knifeReady: s.knifeCooldown <= 0 && s.grenadeCooldown <= 0,
      phase: s.phase,
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
      hotel: s.hotel,
      hotelChallenge: {
        phase: s.hotelChallenge.phase, remaining: s.hotelChallenge.remaining,
        pending: s.hotelChallenge.pending, alive: s.hotelChallengeAlive,
      },
      slowRound: s.slowRound,
      dice: s.dice ? { ...s.dice, values: [...s.dice.values] } : null,
      roulette: s.roulette ? { ...s.roulette } : null,
      damageBoostRemaining: s.damageBoostRemaining,
      room: roomName(s.player),
      zombieAudioStatus: process.env.NODE_ENV !== "production" ? this.audio.zombieStatus : undefined,
      hotelPlaytestStatus: process.env.NODE_ENV !== "production"
        ? `${roomName(s.player)} · floor ${(s.player.y ?? 0).toFixed(2)} m${this.hotelTour.length ? ` · walking tour: ${this.hotelTour.length} waypoints left` : this.hotelTourCompleted ? " · hotel loop complete" : ""}`
        : undefined,
      slotAudioStatus: process.env.NODE_ENV !== "production" ? this.audio.slotStatus : undefined,
      upgraded: Object.values(s.upgrades).some(Boolean),
      message: s.messageRemaining > 0 ? s.lastMessage : "",
      prompt:
        p && info
          ? {
              name:
                (p.id === "shotgun" || p.id === "smg" || p.id === "rifle") &&
                s.inventory[p.id].owned
                  ? `${WEAPONS[p.id].label} ammunition`
                  : p.name,
              detail:
                p.id === "craps"
                  ? `7 slows you 20% ${s.intermission > 0 ? "next round" : "this round"} · other rolls pay 500 chips · once per round`
                  : p.id === "jukebox" ? (s.jukeboxOn ? "Stop the lobby record" : "Play The Lucky Note · original lounge instrumental")
                  : p.detail,
              ...info,
              actionLabel:
                p.id === "poker-a" || p.id === "poker-b"
                  ? "OPEN HAND"
                  : p.id === "hotelBell" ? "RING BELL"
                  : p.id === "jukebox" ? (s.jukeboxOn ? "STOP MUSIC" : "PLAY MUSIC")
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
    document.removeEventListener("pointerlockchange", this.pointerChange);
    document.removeEventListener("pointerlockerror", this.pointerError);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("contextmenu", this.contextMenu);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.audio.dispose();
    this.renderer.dispose();
  }
}
