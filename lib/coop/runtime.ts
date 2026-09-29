import { GameRenderer } from '../game/renderer';
import { GameAudio } from '../game/audio';
import { Simulation, RULES, WEAPONS, WEAPON_ORDER, PERKS, type WeaponId, type BarItemId, type PurchaseId, type Enemy } from '../game/simulation';
import { moveActor, type WorldPosition } from '../game/world';
import { weaponSpeed } from '../game/weapon-expansion';
import { CoopClient, defaultCoopEndpoint, type ConnectionStatus, type ConnectOptions } from './client';
import { idleInput, type CoopInput, type CoopAction, type CoopSnapshot, type RoomView, type CoopEvent, type ServerMessage } from './protocol';
import { RemotePlayers } from './remote-players';

export type CoopGameView = {
  health: number; maxHealth: number; points: number; round: number; kills: number;
  weapon: WeaponId; weaponName: string; mag: number; reserve: number; capacity: number;
  reload: number; reloadTotal: number; grenades: number; enemies: number; remaining: number; intermission: number;
  message: string; hit: number; headshot: boolean; damage: number; aiming: boolean; scoped: boolean;
  owned: { id: WeaponId; label: string; key: string }[];
  prompt: { id: PurchaseId; name: string; detail: string; price: number; reason: string } | null;
  shopOpen: boolean; shopOffers: { id: BarItemId; name: string; detail: string; price: number; reason: string }[]; fps: number;
};
export type CoopView = {
  status: ConnectionStatus; room: RoomView | null; playerId: string | null; localPaused: boolean;
  alive: boolean; endpoint: string; error: string; game: CoopGameView;
};
export const initialCoopView: CoopView = {
  status: 'idle', room: null, playerId: null, localPaused: true, alive: false, endpoint: '', error: '',
  game: { health: 100, maxHealth: 100, points: 400, round: 0, kills: 0, weapon: 'pistol', weaponName: 'HOUSE SPECIAL', mag: 12, reserve: 84, capacity: 12, reload: 0, reloadTotal: 1.5, grenades: 2, enemies: 0, remaining: 0, intermission: 0, message: '', hit: 0, headshot: false, damage: 0, aiming: false, scoped: false, owned: [{ id: 'pistol', label: 'Pistol', key: '1' }], prompt: null, shopOpen: false, shopOffers: [], fps: 60 },
};
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const BASE_SLOTS: WeaponId[] = ['pistol', 'shotgun', 'smg', 'rifle', 'revolver'];
function slots(sim: Simulation) {
  const owned = WEAPON_ORDER.filter(id => sim.inventory[id].owned);
  const extra = owned.filter(id => !BASE_SLOTS.includes(id));
  return owned.map(id => ({ id, label: WEAPONS[id].label, key: BASE_SLOTS.includes(id) ? SLOT_KEYS[BASE_SLOTS.indexOf(id)] : SLOT_KEYS[5 + extra.indexOf(id)] ?? 'Q' }));
}
function mapKey(sim: Simulation) { return JSON.stringify([sim.doorsOpen, sim.hotel, sim.speakeasy, sim.hotelMystery.passageOpen]); }

/** Server-owned gameplay projected into the existing renderer. This never calls Simulation.step(). */
export class CoopRuntime {
  readonly sim = new Simulation();
  readonly renderer: GameRenderer;
  readonly audio = new GameAudio();
  readonly client: CoopClient;
  sensitivity = 1;
  private remotes: RemotePlayers;
  private room: RoomView | null = null;
  private playerId: string | null = null;
  private localPaused = true;
  private alive = false;
  private error = '';
  private keys = new Set<string>();
  private firing = false;
  private aiming = false;
  private yaw = this.sim.yaw;
  private pitch = this.sim.pitch;
  private seq = 0;
  private last = 0;
  private sendTimer = 0;
  private viewTimer = 0;
  private snapshotAt = 0;
  private predictedFor = 0;
  private authoritativePlayer: WorldPosition = { ...this.sim.player };
  private renderOffset = { x: 0, z: 0 };
  private highestEvent = 0;
  private latestTick = -1;
  private hit = 0;
  private headshot = false;
  private damage = 0;
  private suppressUntil = 0;
  private disposed = false;
  private staleNotified = false;
  private awaitingRunSnapshot = false;
  private closingMenuUntil = 0;
  private zombiePrevious = new Map<number, Enemy>();
  private zombieTarget: Enemy[] = [];
  constructor(private canvas: HTMLCanvasElement, private onView: (view: CoopView) => void, private onError: (message: string) => void) {
    this.renderer = new GameRenderer(canvas);
    this.remotes = new RemotePlayers(this.renderer.scene);
    this.client = new CoopClient({
      message: message => this.receive(message),
      status: status => {
        if (status !== 'connected') { this.clearInput(); this.localPaused = true; this.snapPrediction(); this.releasePointer(); }
        this.publish();
      },
      error: message => this.reportError(message),
    });
    canvas.tabIndex = 0;
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    document.addEventListener('mousemove', this.mouseMove);
    document.addEventListener('mousedown', this.mouseDown);
    document.addEventListener('mouseup', this.mouseUp);
    document.addEventListener('wheel', this.wheel, { passive: true });
    document.addEventListener('pointerlockchange', this.pointerChange);
    document.addEventListener('pointerlockerror', this.pointerError);
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('blur', this.blur);
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('contextmenu', this.contextMenu);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.renderer.engine.runRenderLoop(this.frame);
    this.publish();
  }
  async connect(options: ConnectOptions) {
    this.pause(); this.remotes.reset(); this.room = null; this.playerId = null; this.alive = false;
    this.latestTick = -1; this.highestEvent = 0; this.snapshotAt = 0; this.reportError('');
    await this.client.connect(options);
  }
  start() { this.clearInput(); this.client.start(); }
  async enter() {
    if (this.disposed || this.client.status !== 'connected' || this.room?.phase !== 'playing' || !this.alive || this.awaitingRunSnapshot) return;
    this.clearInput();
    if (this.sim.shopOpen || this.sim.pokerOpen || this.sim.hotelDocument) {
      if (this.client.action({ kind: 'close-menu' }) === null) return;
      // Mouse capture needs the user's click now, while the authoritative menu
      // close arrives later. An older in-flight snapshot must not release it.
      // Movement stays disabled until the server actually closes the menu.
      this.closingMenuUntil = performance.now() + 1000;
    }
    void this.audio.unlock().catch(() => this.reportError('Audio is unavailable; you can still play.'));
    this.canvas.focus();
    try { await this.canvas.requestPointerLock(); }
    catch { this.pointerError(); }
  }
  pause() {
    this.localPaused = true; this.clearInput(); this.sendInput(); this.releasePointer(); this.publish();
  }
  leave() {
    this.pause(); this.client.disconnect(); this.room = null; this.playerId = null; this.alive = false;
    this.remotes.reset(); this.zombieTarget = []; this.sim.enemies = []; this.sim.phase = 'ready'; this.publish();
  }
  action(action: CoopAction) {
    if (this.client.status !== 'connected' || this.room?.phase !== 'playing' || !this.alive || this.awaitingRunSnapshot) return;
    this.client.action(action);
  }
  buyBar(item: BarItemId) { this.action({ kind: 'bar', item, weapon: this.sim.weapon }); }
  selectBarWeapon(weapon: WeaponId) { this.action({ kind: 'switch', weapon }); }
  closeMenu() { this.action({ kind: 'close-menu' }); }
  setVolume(value: number) { this.audio.setVolume(Math.max(0, Math.min(1, value))); }
  setSensitivity(value: number) { this.sensitivity = Math.max(.2, Math.min(3, value)); }
  private reportError(message: string) { this.error = message; this.onError(message); this.publish(); }
  private receive(message: ServerMessage) {
    if (message.type === 'welcome') {
      this.playerId = message.playerId; this.room = message.room; this.latestTick = -1;
      this.awaitingRunSnapshot = true; this.closingMenuUntil = 0;
      this.highestEvent = Math.max(0, ...message.snapshot.events.map(event => event.eventId));
      this.clearInput(); this.localPaused = true; this.reportError(''); this.project(message.snapshot, true);
    } else if (message.type === 'room') {
      if (this.room?.epoch !== message.room.epoch) {
        this.latestTick = -1; this.highestEvent = 0; this.clearInput(); this.snapPrediction();
        this.hit = this.damage = 0; this.zombiePrevious.clear(); this.zombieTarget = [];
        this.awaitingRunSnapshot = true; this.closingMenuUntil = 0;
        this.localPaused = true; this.releasePointer(); this.reportError('');
      }
      this.room = message.room; this.publish();
    } else if (message.type === 'snapshot') this.project(message.snapshot, false);
    else if (message.type === 'action-result' && !message.ok && message.reason) this.reportError(message.reason);
  }
  private project(snapshot: CoopSnapshot, welcome: boolean) {
    if (snapshot.tick < this.latestTick || !this.playerId) return;
    this.latestTick = snapshot.tick;
    const now = performance.now(), oldMap = mapKey(this.sim), oldAlive = this.alive, newRun = this.awaitingRunSnapshot;
    const previous = { x: this.sim.player.x + this.renderOffset.x, z: this.sim.player.z + this.renderOffset.z };
    this.zombiePrevious = new Map(this.sim.enemies.map(enemy => [enemy.id, { ...enemy }]));
    // Only own serializable presentation fields are sent; methods/navigation remain local.
    Object.assign(this.sim, snapshot.self);
    this.sim.events = [];
    this.authoritativePlayer = { ...this.sim.player }; this.sim.player = { ...this.sim.player };
    this.zombieTarget = this.sim.enemies.map(enemy => ({ ...enemy }));
    this.sim.enemies = this.zombieTarget.map(enemy => ({ ...enemy }));
    if (oldMap !== mapKey(this.sim)) this.sim.refreshMap();
    this.room = this.room ? { ...this.room, phase: snapshot.phase, players: snapshot.players } : null;
    this.alive = snapshot.players.find(player => player.id === this.playerId)?.alive ?? false;
    const snap = welcome || newRun || oldAlive !== this.alive || Math.hypot(previous.x - this.sim.player.x, previous.z - this.sim.player.z) > 2 || !this.active();
    this.renderOffset = snap ? { x: 0, z: 0 } : { x: previous.x - this.sim.player.x, z: previous.z - this.sim.player.z };
    this.awaitingRunSnapshot = false;
    if (welcome || newRun || oldAlive !== this.alive) { this.yaw = this.sim.yaw; this.pitch = this.sim.pitch; this.pause(); }
    this.sim.yaw = this.yaw; this.sim.pitch = this.pitch;
    this.snapshotAt = now; this.predictedFor = 0; this.staleNotified = false;
    this.remotes.receive(snapshot.players, this.playerId, now);
    const menuOpen = this.sim.shopOpen || this.sim.pokerOpen || this.sim.hotelDocument;
    if (!menuOpen) this.closingMenuUntil = 0;
    if ((menuOpen && now >= this.closingMenuUntil) || !this.alive || snapshot.phase !== 'playing') this.pause();
    for (const event of snapshot.events) {
      if (event.eventId <= this.highestEvent) continue;
      this.highestEvent = event.eventId;
      if (!welcome) this.event(event);
    }
    this.publish();
  }
  private event(event: CoopEvent) {
    if (event.actorId === this.playerId) {
      this.audio.play(event); this.renderer.weaponEvent(event);
      if (event.type === 'shot' && event.weapon) this.renderer.shot(event.weapon, event.side);
      if (event.type === 'hit') { this.hit = .16; this.headshot = !!event.headshot; }
      if (event.type === 'hurt') this.damage = .4;
      if (event.type === 'death') this.pause();
    } else if (event.type === 'zombieAttack' && event.position) {
      this.audio.zombieAttack(this.sim.player, event.position, this.yaw);
    } else if (event.type === 'shot' || event.type === 'explosion' || event.type === 'melee') this.remoteSound(event);
    else if (event.actorId === null && ['round', 'roundClear', 'hotelBell', 'hotelComplete', 'hotelFail'].includes(event.type)) this.audio.play(event);
  }
  private remoteSound(event: CoopEvent) {
    const context = this.audio.context, output = this.audio.master;
    if (!context || !output || context.state !== 'running' || document.hidden || this.client.status !== 'connected') return;
    const source = event.position ?? this.room?.players.find(player => player.id === event.actorId);
    if (!source) return;
    const distance = Math.hypot(source.x - this.sim.player.x, source.z - this.sim.player.z);
    if (distance > 45) return;
    const pan = Math.sin(Math.atan2(source.x - this.sim.player.x, source.z - this.sim.player.z) - this.yaw);
    const duration = event.type === 'explosion' ? .45 : event.type === 'melee' ? .12 : .09;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 3;
    const voice = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), panner = context.createStereoPanner();
    voice.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = event.type === 'explosion' ? 450 : 2400;
    gain.gain.value = (event.type === 'explosion' ? .6 : .22) / (1 + distance * .12); panner.pan.value = pan;
    voice.connect(filter).connect(gain).connect(panner).connect(output); voice.start();
    voice.onended = () => { voice.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); };
  }
  private active() { return this.client.status === 'connected' && this.room?.phase === 'playing' && this.alive && !this.awaitingRunSnapshot && !this.localPaused && !this.sim.shopOpen && !this.sim.pokerOpen && !this.sim.hotelDocument; }
  private clearInput() { this.keys.clear(); this.firing = this.aiming = false; this.sim.aimHeld = false; this.sim.moving = this.sim.sprinting = false; }
  private releasePointer() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  private snapPrediction() { this.sim.player = { ...this.authoritativePlayer }; this.renderOffset = { x: 0, z: 0 }; this.predictedFor = .15; }
  private input(): CoopInput {
    const input = idleInput(this.yaw, this.pitch); input.seq = ++this.seq;
    if (this.active()) Object.assign(input, { forward: +this.keys.has('KeyW') - +this.keys.has('KeyS'), strafe: +this.keys.has('KeyD') - +this.keys.has('KeyA'), sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), fire: this.firing, aim: this.aiming });
    return input;
  }
  private sendInput() {
    // Lobby/ended worlds do not consume controls. Wait for a new run's spawn
    // snapshot before sending its first input (including camera direction).
    if (this.room?.phase === 'playing' && !this.awaitingRunSnapshot) this.client.input(this.input());
  }
  private cycleWeapon(direction: number) {
    const owned = slots(this.sim), index = owned.findIndex(weapon => weapon.id === this.sim.weapon);
    if (owned.length) this.action({ kind: 'switch', weapon: owned[(index + direction + owned.length) % owned.length].id });
  }
  private keyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape' && (this.sim.shopOpen || this.sim.pokerOpen || this.sim.hotelDocument)) { event.preventDefault(); this.closeMenu(); this.pause(); return; }
    if (!this.active() || document.pointerLockElement !== this.canvas) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyV', 'KeyG', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight', 'Space', 'Tab'].includes(event.code) || event.code.startsWith('Digit')) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'Escape') this.pause();
    if (event.code === 'KeyR') this.action({ kind: 'reload' });
    if (event.code === 'KeyV') this.action({ kind: 'knife' });
    if (event.code === 'KeyG') this.action({ kind: 'grenade' });
    if (event.code === 'KeyE') { this.firing = false; this.sendInput(); this.action({ kind: 'interact' }); }
    if (event.code === 'KeyQ') this.cycleWeapon(1);
    if (event.code.startsWith('Digit')) { const weapon = slots(this.sim).find(slot => slot.key === event.code.slice(5)); if (weapon) this.action({ kind: 'switch', weapon: weapon.id }); }
    this.sendInput();
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); if (this.active()) this.sendInput(); };
  private mouseMove = (event: MouseEvent) => {
    if (!this.active() || document.pointerLockElement !== this.canvas) return;
    const multiplier = this.sim.aiming ? this.sim.weapon === 'sniper' ? .28 : .65 : 1;
    this.yaw += event.movementX * .002 * this.sensitivity * multiplier;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + event.movementY * .002 * this.sensitivity * multiplier));
    this.sim.yaw = this.yaw; this.sim.pitch = this.pitch;
  };
  private mouseDown = (event: MouseEvent) => {
    if (!this.active() || document.pointerLockElement !== this.canvas || performance.now() < this.suppressUntil) return;
    if (event.button === 0) this.firing = true;
    if (event.button === 2) this.aiming = true;
    this.sendInput();
  };
  private mouseUp = (event: MouseEvent) => { if (event.button === 0) this.firing = false; if (event.button === 2) this.aiming = false; if (this.active()) this.sendInput(); };
  private wheel = (event: WheelEvent) => { if (this.active() && document.pointerLockElement === this.canvas && event.deltaY) this.cycleWeapon(event.deltaY > 0 ? 1 : -1); };
  private pointerChange = () => {
    this.clearInput();
    this.localPaused = document.pointerLockElement !== this.canvas;
    if (!this.localPaused) { this.suppressUntil = performance.now() + 150; this.reportError(''); }
    this.sendInput(); this.publish();
  };
  private pointerError = () => { this.pause(); this.reportError('Mouse capture was blocked. Open the game in a focused browser tab, then click Enter or Resume.'); };
  private blur = () => this.pause();
  private visibility = () => { if (document.hidden) this.pause(); };
  private resize = () => this.renderer.resize();
  private contextMenu = (event: Event) => event.preventDefault();
  private contextLost = (event: Event) => { event.preventDefault(); this.pause(); this.reportError('Graphics were interrupted. Reload this tab and reconnect to your saved seat.'); };
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now(), dt = this.last ? Math.min(.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now; this.hit = Math.max(0, this.hit - dt); this.damage = Math.max(0, this.damage - dt);
    if (this.snapshotAt && now - this.snapshotAt > 2000 && this.client.status === 'connected' && !this.staleNotified) {
      this.staleNotified = true; this.pause(); this.snapPrediction(); this.reportError('Waiting for the server. Controls are paused; the world may still be running.');
    }
    const before = { ...this.sim.player };
    if (this.active()) {
      const input = this.input(); this.sim.aimHeld = input.aim;
      const length = Math.hypot(input.forward, input.strafe);
      this.sim.moving = length > 0; this.sim.sprinting = input.sprint && length > 0 && !this.sim.aiming;
      // Limited local movement prediction. Received sequence is not a simulated-tick ack;
      // do not replay input history or claim full reconciliation until that protocol exists.
      const predictDt = Math.min(dt, Math.max(0, .15 - this.predictedFor));
      this.predictedFor += predictDt;
      if (length && predictDt) {
        const speed = (this.sim.sprinting ? RULES.sprint * (this.sim.perks.nightShift ? 1.15 : 1) : RULES.walk) * (this.sim.slowed ? .8 : 1) * weaponSpeed(this.sim.weapon) * predictDt;
        const forward = input.forward / length, strafe = input.strafe / length;
        moveActor(this.sim.player, (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed, (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed, RULES.playerRadius, this.sim.rects);
      }
      if (input.fire) this.sim.sprinting = false;
    }
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) { this.sendInput(); this.sendTimer = 1 / 30; }
    const t = Math.max(0, Math.min(1, (now - this.snapshotAt) / 50));
    this.sim.enemies = this.zombieTarget.map(target => {
      const previous = this.zombiePrevious.get(target.id);
      if (!previous || Math.hypot(target.x - previous.x, target.z - previous.z) > 3) return { ...target };
      return { ...target, x: previous.x + (target.x - previous.x) * t, z: previous.z + (target.z - previous.z) * t, y: (previous.y ?? 0) + ((target.y ?? 0) - (previous.y ?? 0)) * t, yaw: previous.yaw + Math.atan2(Math.sin(target.yaw - previous.yaw), Math.cos(target.yaw - previous.yaw)) * t };
    });
    this.renderOffset.x *= Math.exp(-dt * 18); this.renderOffset.z *= Math.exp(-dt * 18);
    const predicted = this.sim.player, phase = this.sim.phase, ownYaw = this.sim.yaw, ownPitch = this.sim.pitch;
    const spectator = !this.alive && this.room?.phase === 'playing' ? this.room.players.find(player => player.connected && player.alive && player.id !== this.playerId) : undefined;
    if (spectator) { this.sim.player = { x: spectator.x, y: spectator.y, z: spectator.z }; this.sim.yaw = spectator.yaw; this.sim.pitch = spectator.pitch; this.sim.phase = 'ready'; }
    else this.sim.player = { ...predicted, x: predicted.x + this.renderOffset.x, z: predicted.z + this.renderOffset.z };
    const audible = this.client.status === 'connected' && this.room?.phase === 'playing' && !document.hidden;
    this.audio.setActive(audible);
    this.audio.update(dt, audible, this.sim.player, this.sim.yaw, this.active() && Math.hypot(predicted.x - before.x, predicted.z - before.z) > .0001, this.sim.sprinting);
    this.audio.weaponFrame(dt, { weapon: this.sim.weapon, reloadRemaining: this.sim.reloadRemaining, reloadDuration: this.sim.reloadDuration(), mag: this.sim.inventory[this.sim.weapon].mag, playing: audible && this.alive });
    this.audio.updateHotel(dt, audible, this.sim.jukeboxOn, this.sim.player, this.sim.yaw);
    this.remotes.update(now, spectator?.id);
    this.renderer.update(this.sim, dt);
    this.sim.player = predicted; this.sim.phase = phase; this.sim.yaw = ownYaw; this.sim.pitch = ownPitch;
    this.viewTimer -= dt;
    if (this.viewTimer <= 0) { this.publish(); this.viewTimer = .05; }
  };
  private publish() {
    if (this.disposed || !this.client) return;
    const s = this.sim, weapon = s.inventory[s.weapon], purchase = this.alive ? s.nearestPurchase() : null;
    const info = purchase ? s.purchaseInfo(purchase.id) : null;
    this.renderer.engine.maxFPS = this.room?.phase === 'playing' && !document.hidden ? 60 : 15;
    this.onView({ status: this.client.status, room: this.room, playerId: this.playerId, localPaused: this.localPaused, alive: this.alive, endpoint: this.client.endpoint || defaultCoopEndpoint(), error: this.error, game: {
      health: s.health, maxHealth: s.maxHealth, points: s.points, round: s.round, kills: s.kills, weapon: s.weapon, weaponName: s.weaponName(), mag: weapon.mag, reserve: weapon.reserve, capacity: s.capacity(), reload: s.reloadRemaining, reloadTotal: s.reloadDuration(), grenades: s.grenades,
      enemies: s.enemies.filter(enemy => enemy.health > 0).length, remaining: s.waveRemaining, intermission: s.intermission,
      message: s.messageRemaining > 0 ? s.lastMessage : '', hit: this.hit, headshot: this.headshot, damage: this.damage, aiming: this.renderer.aimBlend > .85, scoped: this.renderer.aimBlend > .95 && s.weapon === 'sniper', owned: slots(s),
      prompt: purchase && info ? { id: purchase.id, name: purchase.name, detail: purchase.detail, ...info } : null,
      shopOpen: s.shopOpen, shopOffers: [
        ...(Object.keys(PERKS) as (keyof typeof PERKS)[]).map(id => ({ id, name: PERKS[id].name, detail: PERKS[id].detail, ...s.barInfo(id) })),
        { id: 'weaponUpgrade', name: `Double Down · ${WEAPONS[s.weapon].label}`, detail: 'Upgrade the equipped weapon', ...s.barInfo('weaponUpgrade') },
      ], fps: this.renderer.fps,
    } });
  }
  dispose() {
    if (this.disposed) return;
    this.pause(); this.disposed = true; this.client.disconnect(false);
    this.renderer.engine.stopRenderLoop(this.frame);
    document.removeEventListener('keydown', this.keyDown); document.removeEventListener('keyup', this.keyUp);
    document.removeEventListener('mousemove', this.mouseMove); document.removeEventListener('mousedown', this.mouseDown); document.removeEventListener('mouseup', this.mouseUp);
    document.removeEventListener('wheel', this.wheel); document.removeEventListener('pointerlockchange', this.pointerChange); document.removeEventListener('pointerlockerror', this.pointerError);
    document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('blur', this.blur); window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('contextmenu', this.contextMenu); this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.remotes.dispose(); this.audio.dispose(); this.renderer.dispose();
  }
}
