import { Simulation, WEAPONS, type WeaponId } from "./simulation";
import { GameRenderer } from "./renderer";
import { GameAudio } from "./audio";
export type GameView = {
  phase: "ready" | "playing" | "paused" | "dead";
  health: number;
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
  upgraded: boolean;
  message: string;
  prompt: null | {
    name: string;
    detail: string;
    price: number;
    reason: string;
  };
  hit: number;
  headshot: boolean;
  damage: number;
  fps: number;
  p95: number;
};
export const initialView: GameView = {
  phase: "ready",
  health: 100,
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
  private threatTimer = 0;
  private pendingStart = false;
  private suppressUntil = 0;
  private disposed = false;
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
    this.keys.clear();
    this.firing = false;
    this.accumulated = 0;
  }
  private keyDown = (e: KeyboardEvent) => {
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
        "Digit1",
        "Digit2",
        "Space",
        "Tab",
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyR") this.sim.reload();
    if (e.code === "Digit1") this.sim.switchWeapon("pistol");
    if (e.code === "Digit2") this.sim.switchWeapon("shotgun");
    if (e.code === "KeyE") {
      const p = this.sim.nearestPurchase();
      if (p) this.sim.purchase(p.id);
    }
    if (e.code === "Escape") this.pause();
  };
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
    this.clearInput();
    this.sim.pause();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
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
    if (this.sim.phase === "playing") {
      this.accumulated += dt;
      while (this.accumulated >= 1 / 60) {
        this.sim.step(1 / 60, {
          forward: +this.keys.has("KeyW") - +this.keys.has("KeyS"),
          strafe: +this.keys.has("KeyD") - +this.keys.has("KeyA"),
          sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
          fire: this.firing,
        });
        this.accumulated -= 1 / 60;
      }
      this.threatTimer -= dt;
      if (this.threatTimer <= 0) {
        const nearby = [...this.sim.enemies].sort(
          (a, b) =>
            Math.hypot(a.x - this.sim.player.x, a.z - this.sim.player.z) -
            Math.hypot(b.x - this.sim.player.x, b.z - this.sim.player.z),
        )[0];
        if (nearby) this.audio.threat(this.sim.player, nearby, this.sim.yaw);
        this.threatTimer = 1.1 + Math.random();
      }
    }
    for (const event of this.sim.events) {
      this.audio.play(event);
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
    this.onView({
      phase: s.phase,
      health: s.health,
      points: s.points,
      round: s.round,
      kills: s.kills,
      headshots: s.headshots,
      earned: s.earned,
      time: s.time,
      weapon: s.weapon,
      weaponName:
        s.weapon === "shotgun" && s.upgraded
          ? "HIGH ROLLER"
          : WEAPONS[s.weapon].name,
      mag: w.mag,
      reserve: w.reserve,
      capacity: s.capacity(),
      hasShotgun: s.inventory.shotgun.owned,
      reload: s.reloadRemaining,
      reloadTotal: WEAPONS[s.weapon].reload,
      enemies: s.enemies.filter((e) => e.health > 0).length,
      remaining: s.waveRemaining,
      intermission: s.intermission,
      lounge: s.lounge,
      shortcut: s.shortcut,
      upgraded: s.upgraded,
      message: s.messageRemaining > 0 ? s.lastMessage : "",
      prompt:
        p && info
          ? {
              name:
                p.id === "shotgun" && s.inventory.shotgun.owned
                  ? "Shotgun ammunition"
                  : p.name,
              detail: p.detail,
              ...info,
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
