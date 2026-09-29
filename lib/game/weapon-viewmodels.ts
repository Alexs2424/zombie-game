/**
 * First-person viewmodel specs and hand-authored animation choreography for the
 * 1970s Mystery Box arsenal (docs/weapon-spec-1970s.md).
 *
 * All positions/rotations here use GAME space as the player sees it: x = right,
 * y = up, z = muzzle-forward (Babylon's camera-local frame). Model nodes live under
 * the glTF loader's mirrored root, so offsets are converted with `toGltf*`.
 * Rotations follow Babylon's convention: +x takes +y toward +z (muzzle dips),
 * +y takes +z toward +x (muzzle swings right), +z takes +x toward +y (rolls left).
 *
 * Reload and action cues are expressed as fractions of the simulation's timers so
 * the audio (`weapon-audio.ts`) and the animation stay locked together even when
 * Quick Pour shortens a reload.
 */
export type Vec = [number, number, number];
export type HandSet = "pistol" | "rifle" | "shotgun" | "smg";

export type NodePose = {
  pos?: Vec;
  /** Euler rotation in game space, applied about the node's own pivot (x, then y, then z). */
  rot?: Vec;
  scale?: number;
  hidden?: boolean;
};
export type HandPose = NodePose & {
  /** Rotate the hand rigidly about this game-space point instead of its wrist. */
  pivot?: Vec;
};
export type Pose = {
  /** Camera-local root offset and rotation, added to the idle placement. */
  pos: Vec;
  rot: Vec;
  nodes: Record<string, NodePose>;
  left?: HandPose;
  right?: HandPose;
};
export type AnimInput = {
  time: number;
  /** Seconds since this weapon's last shot (large when never fired). */
  sinceShot: number;
  shots: number;
  lastAlt: boolean;
  lastSide: number;
  interval: number;
  reloading: boolean;
  /** 0..1 progress through the current reload timer. */
  reload: number;
  reloadDuration: number;
  /** Seconds since the last completed reload segment (for shell loaders' closing motion). */
  sinceReloadDone: number;
  /** Eased 0..1 weight that rises while a (possibly chained) reload is active. */
  reloadBlend: number;
  mag: number;
  capacity: number;
  /** 0..1 progress through a melee swing, or -1. */
  melee: number;
  meleeHit: boolean;
  /** Seconds since the weapon was equipped. */
  equip: number;
  moving: boolean;
  sprinting: boolean;
};
export type ViewmodelSpec = {
  hands: HandSet | null;
  /** Game-space offsets applied to the fitted hand rest pose (for guns whose fore-end sits elsewhere). */
  leftHand?: Vec;
  rightHand?: Vec;
  hideLeftHand?: boolean;
  /** Instantiate a second set of fitted hands under this model node (mirrored by the double glTF flip). */
  extraHands?: { parent: string };
  /** Nodes hidden unless the animator explicitly shows them (loose cartridges, clips). */
  hiddenAtRest?: string[];
  /** Camera-local idle placement. */
  root: Vec;
  scale?: number;
  muzzle: Vec;
  flash: number;
  animate: (a: AnimInput) => Pose;
  /** Reload/action cue points for audio: [fraction, sound] within a reload, and after shots. */
  reloadCues: [number, string][];
  shotCues?: [number, string][];
};

// ----------------------------------------------------------------------------- easing
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Normalised position of t inside [a, b]. */
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeOut = (x: number) => 1 - (1 - x) * (1 - x) * (1 - x);
export const easeIn = (x: number) => x * x * x;
/** Ease out with a small overshoot, for hard mechanical snaps. */
export const snap = (x: number, over = 1.6) => {
  const c = over + 1;
  return x >= 1 ? 1 : 1 + c * Math.pow(x - 1, 3) + over * Math.pow(x - 1, 2);
};
/** 0 -> 1 -> 0 hump over [a, b] with an eased plateau between the inner points. */
export const hump = (t: number, a: number, b: number, c: number, d: number) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));
/** Recoil impulse: fast attack, damped spring return. */
export const kick = (since: number, attack = 0.03, decay = 0.16, wobble = 0) => {
  if (since < 0 || since > decay * 6) return 0;
  if (since < attack) return easeOut(since / attack);
  const k = (since - attack) / decay;
  return Math.exp(-k * 2.2) * (wobble ? Math.cos(k * wobble) : 1);
};
const add = (a: Vec, b: Vec, s = 1): Vec => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const mix = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const Z: Vec = [0, 0, 0];

/** Keyframed vector track: [[t, value], ...] with smoothstep interpolation. */
export function track(t: number, keys: [number, Vec][]): Vec {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return mix(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}
export function scalar(t: number, keys: [number, number][]) {
  return track(t, keys.map(([k, v]) => [k, [v, 0, 0]] as [number, Vec]))[0];
}

/** Shared idle/sway/sprint/equip motion; weapons add their own choreography on top. */
function base(a: AnimInput, heavy = 1): Pose {
  const bob = a.moving ? Math.sin(a.time * (a.sprinting ? 15 : 10)) : 0;
  const breathe = Math.sin(a.time * 1.3) * 0.004;
  const raise = 1 - smooth(clamp01(a.equip / 0.38));
  return {
    pos: [bob * 0.006 * heavy, bob * 0.009 + breathe - raise * 0.28, 0],
    rot: [raise * 0.7 + breathe * 0.6, 0, a.sprinting ? -0.22 : 0],
    nodes: {},
  };
}
function recoil(p: Pose, a: AnimInput, back: number, climb: number, roll = 0, attack = 0.028, decay = 0.13, wobble = 0) {
  const k = kick(a.sinceShot, attack, decay, wobble);
  p.pos = add(p.pos, [0, climb * 0.12, -back], k);
  p.rot = add(p.rot, [-climb, roll * 0.3, roll], k);
  return k;
}
/** Generic reload carry: lower and roll the weapon while the reload weight is up. */
function reloadCarry(p: Pose, a: AnimInput, lower: Vec, rot: Vec) {
  const w = a.reloadBlend;
  p.pos = add(p.pos, lower, w);
  p.rot = add(p.rot, rot, w);
  return w;
}

// ============================================================================= HIGH ROLLER
const magnum: ViewmodelSpec = {
  hands: "pistol",
  root: [0.27, -0.215, 0.6],
  muzzle: [0, 0.052, 0.21],
  flash: 1.25,
  reloadCues: [[0.1, "reload-start"], [0.3, "eject"], [0.52, "reload-loop"], [0.71, "reload-end"]],
  animate(a) {
    const p = base(a);
    // Heavy magnum flip with a little right roll and a slow settle.
    const k = recoil(p, a, 0.075, 0.42, -0.08, 0.025, 0.17, 1.2);
    // Double action: the cylinder indexes 60 degrees just after the break,
    // the hammer lies forward, and the trigger resets through the recovery.
    const index = smooth(seg(a.sinceShot, 0.0, 0.1));
    const turns = a.shots - 1 + index;
    const trig = a.sinceShot < 0.35 ? 1 - smooth(seg(a.sinceShot, 0.06, 0.3)) : 0;
    p.nodes.Trigger = { rot: [0.32 * trig, 0, 0] };
    p.nodes.Hammer = { rot: [0.05 * k, 0, 0] };
    const r = a.reloading ? a.reload : 0;
    // Crane swings out to the left, then snaps home.
    const open = a.reloading ? smooth(seg(r, 0.1, 0.2)) * (1 - snap(seg(r, 0.66, 0.74))) : 0;
    p.nodes.Crane = { rot: [0, 0, 1.55 * open] };
    p.nodes.Cylinder = { rot: [0, 0, (turns * Math.PI) / 3] };
    // Ejector stroke, then the empties fall away; fresh rounds arrive on a speedloader.
    const eject = smooth(seg(r, 0.26, 0.31)) * (1 - seg(r, 0.34, 0.341));
    const fall = seg(r, 0.31, 0.42);
    const load = 1 - smooth(seg(r, 0.46, 0.58));
    p.nodes["Ejector rod"] = { pos: [0, 0, -0.024 * eject] };
    if (a.reloading && r > 0.26 && r < 0.46)
      p.nodes.Cartridges = { pos: [0, -0.09 * fall * fall, -0.024 - 0.05 * fall], rot: [fall * 2.4, 0, 0], hidden: r > 0.42 };
    else if (a.reloading && r >= 0.46 && r < 0.62)
      p.nodes.Cartridges = { pos: [0, -0.02 * load, -0.075 * load] };
    // Whole-gun choreography: roll left and tip the muzzle up to dump brass,
    // point it down to load, then roll back and settle.
    if (a.reloading) {
      const roll = track(r, [[0, Z], [0.1, [0.02, 0.05, 0.9]], [0.24, [-0.02, 0.1, 0.35]], [0.36, [-0.03, 0.09, 0.2]],
        [0.46, [-0.04, 0.02, 0.55]], [0.62, [-0.04, 0.0, 0.6]], [0.74, [0.0, 0.03, 0.15]], [1, Z]]);
      const pitch = track(r, [[0, Z], [0.1, [-0.15, 0, 0]], [0.24, [-1.05, 0, 0]], [0.34, [-1.1, 0, 0]],
        [0.46, [0.55, 0, 0]], [0.62, [0.5, 0, 0]], [0.74, [0.05, 0, 0]], [1, Z]]);
      const move = track(r, [[0, Z], [0.1, [-0.1, 0.03, -0.04]], [0.3, [-0.12, 0.08, -0.08]], [0.5, [-0.12, 0.02, -0.06]],
        [0.74, [-0.05, 0, -0.02]], [1, Z]]);
      p.rot = add(p.rot, [pitch[0], roll[1], roll[2]]);
      p.pos = add(p.pos, move);
      // Support hand leaves to fetch the speedloader, then pushes it home.
      const away = hump(r, 0.14, 0.3, 0.6, 0.7);
      p.left = { pos: [-0.06 * away, -0.12 * away + 0.05 * hump(r, 0.44, 0.52, 0.56, 0.62), -0.08 * away] };
    }
    return p;
  },
};

// ============================================================================= SNAKE EYES
const dual: ViewmodelSpec = {
  hands: "pistol",
  hideLeftHand: true,
  extraHands: { parent: "Left pistol" },
  root: [0.0, -0.205, 0.5],
  muzzle: [0.21, 0.035, 0.08],
  flash: 0.7,
  reloadCues: [[0.12, "reload-start"], [0.58, "reload-loop"], [0.8, "reload-end"]],
  animate(a) {
    const p = base(a, 0.8);
    // Pistols sit either side of the camera; each fires in turn with its own slide cycle.
    const since = a.sinceShot;
    const kr = a.lastSide === 0 ? kick(since, 0.02, 0.09) : 0;
    const kl = a.lastSide === 1 ? kick(since, 0.02, 0.09) : 0;
    const prevK = kick(since + a.interval, 0.02, 0.09) * 0.4;
    const r = a.reloading ? a.reload : 0;
    const drop = a.reloading ? hump(r, 0.02, 0.16, 0.8, 0.95) : 0;
    const mag = a.reloading ? (r < 0.3 ? smooth(seg(r, 0.12, 0.3)) : 1 - smooth(seg(r, 0.46, 0.6))) : 0;
    const slideBack = a.reloading ? (r < 0.78 ? smooth(seg(r, 0.05, 0.12)) : 1 - snap(seg(r, 0.78, 0.84))) : 0;
    const emptyLock = !a.reloading && a.mag === 0 ? 1 : 0;
    const R: Vec = [0.21, 0.015 - 0.012 * drop, -0.04 * drop];
    const L: Vec = [-0.21 + 0.11, 0.015 - 0.012 * drop, -0.04 * drop];
    const rr: Vec = [-0.3 * kr - prevK * 0.1 + 0.55 * drop, 0.1 * drop, -0.35 * drop];
    const lr: Vec = [-0.3 * kl + 0.55 * drop, -0.1 * drop, 0.35 * drop];
    p.nodes["Right pistol"] = { pos: add(R, [0, 0.01 * kr, -0.035 * kr]), rot: rr };
    p.nodes["Left pistol"] = { pos: add(L, [0, 0.01 * kl, -0.035 * kl]), rot: lr };
    p.right = { pivot: [0, 0, 0], rot: rr, pos: add(R, [0, 0.01 * kr, -0.035 * kr]) };
    p.nodes["Right Slide"] = { pos: [0, 0, -0.022 * Math.max(kick(since, 0.012, 0.035) * (a.lastSide === 0 ? 1 : 0), slideBack, emptyLock)] };
    p.nodes["Left Slide"] = { pos: [0, 0, -0.022 * Math.max(kick(since, 0.012, 0.035) * (a.lastSide === 1 ? 1 : 0), slideBack, emptyLock)] };
    p.nodes["Right Trigger"] = { rot: [0.3 * kr, 0, 0] };
    p.nodes["Left Trigger"] = { rot: [0.3 * kl, 0, 0] };
    p.nodes["Right Hammer"] = { rot: [-0.5 * (1 - kr), 0, 0] };
    p.nodes["Right Magazine"] = { pos: [0, -0.12 * mag, 0.01 * mag], hidden: mag > 0.95 };
    p.nodes["Left Magazine"] = { pos: [0, -0.12 * mag, 0.01 * mag], hidden: mag > 0.95 };
    p.pos = add(p.pos, [0, -0.07 * drop, -0.03 * drop]);
    return p;
  },
};

// ============================================================================= THE ENFORCER
const machinepistol: ViewmodelSpec = {
  hands: "pistol",
  root: [0.27, -0.22, 0.58],
  muzzle: [0, 0.028, 0.17],
  flash: 0.85,
  reloadCues: [[0.12, "reload-start"], [0.55, "reload-loop"], [0.8, "reload-end"]],
  animate(a) {
    const p = base(a);
    const k = recoil(p, a, 0.028, 0.09, 0.02, 0.012, 0.05);
    // Rattle: a small pseudo-random shake that alternates every round.
    const jitter = kick(a.sinceShot, 0.01, 0.06) * (a.shots % 2 ? 1 : -1);
    p.rot = add(p.rot, [0, 0.02 * jitter, 0.03 * jitter]);
    p.nodes.Bolt = { pos: [0, 0, -0.03 * kick(a.sinceShot, 0.008, 0.02)] };
    p.nodes.Trigger = { rot: [0.3 * Math.min(1, k * 2), 0, 0] };
    const r = a.reloading ? a.reload : 0;
    if (a.reloading) {
      reloadCarry(p, a, [-0.04, -0.03, -0.05], [0.25, 0.2, 0.55]);
      const out = smooth(seg(r, 0.1, 0.26));
      const back = 1 - smooth(seg(r, 0.4, 0.56));
      const off = r < 0.33 ? out : back;
      p.nodes.Magazine = { pos: [0, -0.22 * off, -0.02 * off], hidden: r > 0.3 && r < 0.4 };
      const rack = hump(r, 0.7, 0.76, 0.8, 0.82);
      p.nodes.Bolt = { pos: [0, 0, -0.045 * rack] };
      const away = hump(r, 0.08, 0.2, 0.55, 0.64);
      p.left = { pos: [-0.04 * away, -0.14 * away, 0.02 * away] };
      p.rot = add(p.rot, [0.1 * hump(r, 0.5, 0.55, 0.57, 0.62), 0, 0]);
    } else if (a.mag === 0) p.nodes.Bolt = { pos: [0, 0, -0.045] };
    return p;
  },
};

// ============================================================================= CHICAGO TYPEWRITER
const tommy: ViewmodelSpec = {
  hands: "rifle",
  leftHand: [0, -0.016, 0.115],
  root: [0.28, -0.22, 0.58],
  muzzle: [0, 0.02, 0.48],
  flash: 1.0,
  reloadCues: [[0.14, "reload-start"], [0.62, "reload-loop"], [0.82, "reload-end"]],
  animate(a) {
    const p = base(a, 1.2);
    const k = recoil(p, a, 0.03, 0.06, 0, 0.012, 0.07);
    const buzz = kick(a.sinceShot, 0.008, 0.05) * (a.shots % 2 ? 1 : -1);
    p.pos = add(p.pos, [0.003 * buzz, 0.002 * buzz, 0]);
    p.rot = add(p.rot, [0, 0.012 * buzz, 0.016 * buzz]);
    // Drum jostles with the receiver and advances as rounds feed.
    p.nodes.Drum = { rot: [0.05 * buzz + a.shots * 0.12, 0, 0] };
    p.nodes["Drum key"] = { rot: [0, 0, 0] };
    p.nodes.Bolt = { pos: [0, 0, -0.05 * kick(a.sinceShot, 0.006, 0.03)] };
    p.nodes.Trigger = { rot: [0.3 * Math.min(1, k * 3), 0, 0] };
    const r = a.reloading ? a.reload : 0;
    if (a.reloading) {
      reloadCarry(p, a, [-0.03, -0.02, -0.06], [0.3, 0.18, -0.35]);
      // Old drum slides out to the right and drops; a fresh drum is thumped home.
      const outX = smooth(seg(r, 0.14, 0.26)), fall = seg(r, 0.26, 0.38);
      const inX = 1 - smooth(seg(r, 0.46, 0.62));
      if (r < 0.4) p.nodes.Drum = { pos: [0.16 * outX, -0.25 * fall * fall, 0], rot: [fall * 1.2, 0, -fall * 0.5], hidden: r > 0.37 };
      else p.nodes.Drum = { pos: [0.2 * inX, -0.05 * inX, 0], rot: [0, 0, -0.2 * inX] };
      const thump = hump(r, 0.62, 0.63, 0.64, 0.7);
      p.pos = add(p.pos, [-0.006 * thump, -0.01 * thump, 0]);
      const pull = hump(r, 0.74, 0.8, 0.82, 0.84);
      p.nodes.Bolt = { pos: [0, 0, -0.085 * pull] };
      const away = hump(r, 0.1, 0.18, 0.84, 0.94);
      p.left = { pos: [0.1 * away * (r < 0.7 ? 1 : 0.2), -0.1 * away + 0.1 * hump(r, 0.7, 0.74, 0.82, 0.86), -0.12 * away] };
    }
    return p;
  },
};

// ============================================================================= DOUBLE OR NOTHING
const HINGE_DB: Vec = [0, -0.02, 0.028];
const doublebarrel: ViewmodelSpec = {
  hands: "shotgun",
  leftHand: [0, 0, -0.06],
  root: [0.29, -0.215, 0.6],
  muzzle: [0, 0.013, 0.51],
  flash: 1.5,
  reloadCues: [[0.06, "reload-start"], [0.22, "eject"], [0.54, "reload-loop"], [0.69, "reload-end"], [0.8, "cock"]],
  animate(a) {
    const p = base(a, 1.1);
    const heavy = a.lastAlt ? 1.45 : 1;
    const k = recoil(p, a, 0.07 * heavy, 0.3 * heavy, -0.05, 0.022, 0.16, 1.1);
    const r = a.reloading ? a.reload : 0;
    const open = a.reloading ? smooth(seg(r, 0.06, 0.18)) * (1 - snap(seg(r, 0.64, 0.7), 1.2)) : 0;
    const lever = a.reloading ? hump(r, 0.02, 0.07, 0.62, 0.7) : 0;
    p.nodes.Barrels = { rot: [0.62 * open, 0, 0] };
    p.nodes["Top lever"] = { rot: [0, 0.55 * lever, 0] };
    // Hammers: fall on the shot (right barrel first), thumb-cocked after closing.
    const cocked = a.reloading ? smooth(seg(r, 0.74, 0.86)) : 0;
    const rightDown = a.mag <= 1 && !(a.reloading && cocked > 0.5);
    const leftDown = a.mag === 0 && !(a.reloading && cocked > 0.5);
    p.nodes["Right hammer"] = { rot: [rightDown ? 0.55 * (1 - cocked) : 0, 0, 0] };
    p.nodes["Left hammer"] = { rot: [leftDown ? 0.55 * (1 - cocked) : 0, 0, 0] };
    p.nodes["Front trigger"] = { rot: [0.35 * (a.lastSide === 0 || a.lastAlt ? k : 0), 0, 0] };
    p.nodes["Rear trigger"] = { rot: [0.35 * (a.mag === 0 ? k : 0), 0, 0] };
    if (a.reloading) {
      // Extractors throw the empties over the shoulder, fresh shells go in, snap closed.
      const ex = seg(r, 0.18, 0.32);
      const load = 1 - smooth(seg(r, 0.46, 0.58));
      if (r < 0.34) p.nodes.Shells = { pos: [0.02 * ex, 0.09 * ex - 0.2 * ex * ex, -0.02 - 0.16 * ex], rot: [-3 * ex, 0, 0], hidden: r > 0.32 };
      else if (r < 0.46) p.nodes.Shells = { hidden: true };
      else p.nodes.Shells = { pos: [0, -0.02 * load, -0.09 * load] };
      p.rot = add(p.rot, track(r, [[0, Z], [0.12, [0.25, 0.05, 0.25]], [0.3, [-0.2, 0.08, 0.35]], [0.45, [0.35, 0.05, 0.3]],
        [0.62, [0.3, 0.02, 0.2]], [0.72, [-0.05, 0, 0.05]], [0.86, [0.05, 0, 0.1]], [1, Z]]));
      p.pos = add(p.pos, track(r, [[0, Z], [0.15, [-0.06, 0.02, -0.04]], [0.6, [-0.08, 0.02, -0.06]], [0.8, [-0.03, 0, -0.02]], [1, Z]]));
      // The support hand rides the barrels down, leaves for two shells, then returns.
      const away = hump(r, 0.3, 0.38, 0.58, 0.64);
      p.left = { pivot: HINGE_DB, rot: [0.62 * open, 0, 0], pos: [-0.05 * away, -0.14 * away, -0.06 * away] };
      const thumb = hump(r, 0.72, 0.76, 0.84, 0.9);
      p.right = { pos: [0, 0.03 * thumb, 0.015 * thumb], rot: [-0.25 * thumb, 0, 0] };
    }
    return p;
  },
};

// ============================================================================= LAST CALL
const autoshotgun: ViewmodelSpec = {
  hands: "shotgun",
  root: [0.29, -0.215, 0.6],
  muzzle: [0, 0.033, 0.71],
  flash: 1.35,
  hiddenAtRest: ["Loading shell"],
  reloadCues: [[0.5, "reload-loop"]],
  // Gas-action clacks are already baked into the report at 34 ms and 78 ms.
  animate(a) {
    const p = base(a, 1.1);
    const k = recoil(p, a, 0.055, 0.2, -0.03, 0.02, 0.1);
    // Gas action: the bolt blows back and slams home within ~90 ms.
    const cyc = a.sinceShot < 0.12 ? hump(a.sinceShot, 0.005, 0.03, 0.045, 0.09) : 0;
    const locked = a.mag === 0 && !a.reloading ? 1 : 0;
    const closing = a.sinceReloadDone < 0.2 && !a.reloading ? 1 - snap(seg(a.sinceReloadDone, 0.02, 0.1)) : 0;
    p.nodes.Bolt = { pos: [0, 0, -0.058 * Math.max(cyc, locked, a.reloading && a.mag === 0 ? 1 : 0, closing * 0)] };
    p.nodes.Trigger = { rot: [0.3 * Math.min(1, k * 2), 0, 0] };
    const w = reloadCarry(p, a, [-0.07, 0.03, -0.06], [-0.55, 0.18, 0.45]);
    if (a.reloading) {
      const r = a.reload;
      // One shell per cycle: fetched from below, thumbed up into the loading port.
      const reach = track(r, [[0, [0, -0.12, -0.02]], [0.3, [0.005, -0.05, -0.06]], [0.5, [0.01, -0.03, -0.1]], [0.62, [0.01, -0.02, -0.07]], [0.8, [0, -0.08, -0.03]], [1, [0, -0.12, -0.02]]]);
      p.left = { pos: reach };
      const up = smooth(seg(r, 0.25, 0.5)), push = smooth(seg(r, 0.5, 0.62));
      p.nodes["Loading shell"] = { pos: [0, -0.07 * (1 - up) + 0.022 * up, -0.04 * (1 - up) + 0.07 * push], hidden: r > 0.64 || r < 0.12 };
      p.nodes.Carrier = { rot: [-0.25 * hump(r, 0.45, 0.52, 0.6, 0.68), 0, 0] };
    } else if (w > 0.01) p.left = { pos: [0, -0.12 * w, -0.02 * w] };
    return p;
  },
};

// ============================================================================= SILVER DOLLAR
const LEVER_PIV: Vec = [0, -0.032, 0.036];
const lever: ViewmodelSpec = {
  hands: "shotgun",
  leftHand: [0, 0.013, -0.04],
  root: [0.29, -0.215, 0.6],
  muzzle: [0, 0.006, 0.59],
  flash: 1.0,
  hiddenAtRest: ["Loading round"],
  reloadCues: [[0.55, "reload-loop"]],
  shotCues: [[0.16, "cycle"], [0.32, "cycle-close"]],
  animate(a) {
    const p = base(a);
    const k = recoil(p, a, 0.05, 0.2, -0.02, 0.02, 0.12);
    // Signature lever cycle after every shot: down-and-forward arc, hammer cocked, back up.
    const t = a.sinceShot;
    const cyc = t < 0.6 ? smooth(seg(t, 0.12, 0.24)) * (1 - smooth(seg(t, 0.28, 0.4))) : 0;
    p.nodes.Lever = { rot: [-0.95 * cyc, 0, 0] };
    const hammerDown = t < 0.16 ? 1 - smooth(seg(t, 0.0, 0.02)) * 0 : 0;
    p.nodes.Hammer = { rot: [t < 0.18 ? 0.45 * (1 - smooth(seg(t, 0.14, 0.2))) * Math.min(1, t / 0.01) : 0, 0, 0] };
    void hammerDown;
    p.nodes.Trigger = { rot: [0.3 * Math.min(1, k * 2), 0, 0] };
    p.right = { pivot: LEVER_PIV, rot: [-0.38 * cyc, 0, 0], pos: [0, -0.01 * cyc, 0] };
    p.rot = add(p.rot, [0.08 * cyc, 0, -0.1 * cyc]);
    p.pos = add(p.pos, [0, -0.01 * cyc, 0]);
    // Cartridge-by-cartridge through the loading gate on the right side.
    const w = reloadCarry(p, a, [-0.08, 0.04, -0.06], [-0.35, 0.35, -0.35]);
    if (a.reloading) {
      const r = a.reload;
      const reach = track(r, [[0, [0.01, -0.1, -0.06]], [0.3, [0.03, -0.05, -0.12]], [0.5, [0.035, -0.03, -0.15]], [0.62, [0.03, -0.03, -0.14]], [0.85, [0.02, -0.08, -0.09]], [1, [0.01, -0.1, -0.06]]]);
      p.left = { pos: reach };
      const inn = smooth(seg(r, 0.3, 0.55));
      p.nodes["Loading round"] = { pos: [0.05 * (1 - inn), -0.04 * (1 - inn), 0.03 * inn], hidden: r < 0.12 || r > 0.6 };
    } else if (w > 0.01) p.left = { pos: [0.01 * w, -0.1 * w, -0.06 * w] };
    return p;
  },
};

// ============================================================================= EYE IN THE SKY
const sniper: ViewmodelSpec = {
  hands: "shotgun",
  leftHand: [0, 0.015, 0.0],
  root: [0.29, -0.215, 0.6],
  muzzle: [0, 0.016, 0.77],
  flash: 1.1,
  hiddenAtRest: ["Stripper clip"],
  reloadCues: [[0.1, "reload-start"], [0.46, "reload-loop"], [0.79, "reload-end"]],
  shotCues: [[0.3, "bolt-open"], [0.66, "bolt-close"]],
  animate(a) {
    const p = base(a);
    recoil(p, a, 0.08, 0.3, -0.04, 0.02, 0.2, 0.9);
    // Dry bolt lift and throw after every shot; the firing hand leaves the wrist to work it.
    const t = a.sinceShot;
    const boltCycle = (u: number) => {
      const lift = smooth(seg(u, 0.0, 0.14)) * (1 - smooth(seg(u, 0.86, 1)));
      const slide = smooth(seg(u, 0.14, 0.36)) * (1 - smooth(seg(u, 0.56, 0.84)));
      return { lift, slide };
    };
    let b = { lift: 0, slide: 0 };
    let hand = 0;
    if (t > 0.25 && t < 1.2) {
      const u = seg(t, 0.28, 1.05);
      b = boltCycle(u);
      hand = hump(t, 0.2, 0.3, 1.05, 1.18);
      p.rot = add(p.rot, [0.05 * hand, 0, 0.12 * hand]);
    }
    const r = a.reloading ? a.reload : 0;
    if (a.reloading) {
      const lift = smooth(seg(r, 0.04, 0.1)) * (1 - smooth(seg(r, 0.8, 0.86)));
      const slide = smooth(seg(r, 0.1, 0.18)) * (1 - smooth(seg(r, 0.7, 0.8)));
      b = { lift, slide };
      hand = hump(r, 0.0, 0.05, 0.86, 0.94);
      reloadCarry(p, a, [-0.05, 0.03, -0.04], [0.3, 0, 0.45]);
      const clip = smooth(seg(r, 0.22, 0.34)), press = smooth(seg(r, 0.38, 0.56));
      p.nodes["Stripper clip"] = { pos: [0, 0.12 * (1 - clip) - 0.028 * press, 0], hidden: r < 0.2 || r > 0.64 };
      const away = hump(r, 0.14, 0.24, 0.62, 0.7);
      p.left = { pos: [-0.02 * away, -0.08 * away, -0.08 * away] };
    }
    p.nodes.Bolt = { pos: [0, 0, -0.075 * b.slide], rot: [0, 0, 1.15 * b.lift] };
    p.right = { pos: [0.04 * hand, 0.035 * hand, 0.06 * hand - 0.075 * b.slide * hand], rot: [-0.2 * hand, 0.25 * hand, 0.3 * hand] };
    p.nodes.Trigger = { rot: [0.3 * kick(t, 0.01, 0.08), 0, 0] };
    return p;
  },
};

// ============================================================================= HOUSE EDGE
const lmg: ViewmodelSpec = {
  hands: "rifle",
  leftHand: [0, -0.02, 0.11],
  root: [0.29, -0.235, 0.6],
  muzzle: [0, 0.022, 0.65],
  flash: 1.2,
  reloadCues: [[0.1, "reload-start"], [0.3, "eject"], [0.55, "reload-loop"], [0.74, "cover"], [0.88, "reload-end"]],
  animate(a) {
    const p = base(a, 1.4);
    const k = recoil(p, a, 0.028, 0.05, 0, 0.014, 0.1);
    const buzz = kick(a.sinceShot, 0.01, 0.06) * (a.shots % 2 ? 1 : -1);
    p.pos = add(p.pos, [0.002 * buzz, 0.003 * buzz, 0]);
    p.rot = add(p.rot, [0.006 * buzz, 0.008 * buzz, 0.006 * buzz]);
    // Belt steps one link per shot; the charging handle reciprocates with the bolt.
    p.nodes.Belt = { pos: [0.004 * (a.shots % 2), 0.003 * kick(a.sinceShot, 0.01, 0.05), 0] };
    p.nodes.Trigger = { rot: [0.3 * Math.min(1, k * 3), 0, 0] };
    if (a.reloading) {
      const r = a.reload;
      reloadCarry(p, a, [-0.05, -0.02, -0.07], [0.25, 0.25, 0.5]);
      const cover = smooth(seg(r, 0.1, 0.2)) * (1 - snap(seg(r, 0.7, 0.76), 1.3));
      p.nodes["Feed cover"] = { rot: [-1.25 * cover, 0, 0] };
      const beltOut = seg(r, 0.2, 0.3), beltIn = smooth(seg(r, 0.6, 0.68));
      p.nodes.Belt = r < 0.34 ? { pos: [-0.04 * beltOut, -0.05 * beltOut * beltOut, 0], hidden: r > 0.3 }
        : r < 0.6 ? { hidden: true } : { pos: [-0.03 * (1 - beltIn), 0.04 * (1 - beltIn), 0] };
      const off = smooth(seg(r, 0.26, 0.38)), on = 1 - smooth(seg(r, 0.44, 0.56));
      p.nodes["Ammo box"] = r < 0.41 ? { pos: [-0.05 * off, -0.3 * off * off, 0], rot: [0, 0, -0.6 * off], hidden: r > 0.39 }
        : { pos: [-0.06 * on, -0.2 * on, 0.02 * on], rot: [0, 0, -0.3 * on] };
      const seat = hump(r, 0.55, 0.56, 0.57, 0.62);
      const slam = hump(r, 0.74, 0.745, 0.75, 0.8);
      p.pos = add(p.pos, [0, -0.01 * (seat + slam), 0]);
      const rack = hump(r, 0.82, 0.86, 0.87, 0.885);
      p.nodes["Charging handle"] = { pos: [0, 0, -0.1 * rack] };
      const away = hump(r, 0.06, 0.12, 0.9, 0.97);
      const path = track(r, [[0, Z], [0.14, [-0.04, 0.02, -0.14]], [0.3, [-0.06, -0.08, -0.14]], [0.5, [-0.06, -0.09, -0.14]], [0.66, [-0.03, 0.02, -0.14]],
        [0.76, [-0.01, 0.03, -0.14]], [0.84, [0.03, -0.01, -0.12]], [0.9, [0.03, -0.02, -0.1]], [1, Z]]);
      p.left = { pos: [path[0] * away, path[1] * away, path[2] * away] };
    }
    return p;
  },
};

// ============================================================================= THE DEBT COLLECTOR
const HINGE_GL: Vec = [0, -0.018, 0.035];
const launcher: ViewmodelSpec = {
  hands: "shotgun",
  leftHand: [0, 0, -0.06],
  root: [0.29, -0.23, 0.6],
  muzzle: [0, 0.028, 0.34],
  flash: 1.6,
  reloadCues: [[0.08, "reload-start"], [0.2, "hinge"], [0.32, "eject"], [0.62, "reload-loop"], [0.77, "reload-end"]],
  animate(a) {
    const p = base(a, 1.3);
    // Low, heavy shove: the whole gun rides back and up and settles slowly.
    recoil(p, a, 0.12, 0.5, -0.1, 0.03, 0.26, 0.8);
    const r = a.reloading ? a.reload : 0;
    const latch = a.reloading ? hump(r, 0.04, 0.08, 0.72, 0.78) : 0;
    p.nodes.Latch = { rot: [0.35 * latch, 0, 0] };
    const open = a.reloading ? smooth(seg(r, 0.1, 0.22)) * (1 - snap(seg(r, 0.7, 0.77), 1.2)) : 0;
    p.nodes.Barrel = { rot: [0.72 * open, 0, 0] };
    if (a.reloading) {
      const ex = seg(r, 0.28, 0.42);
      const load = 1 - smooth(seg(r, 0.5, 0.64));
      p.nodes.Shell = r < 0.44 ? { pos: [0, -0.02 * ex - 0.25 * ex * ex, -0.05 - 0.12 * ex], rot: [2.2 * ex, 0, 0], hidden: r > 0.42 }
        : r < 0.48 ? { hidden: true } : { pos: [0, -0.02 * load, -0.14 * load] };
      p.rot = add(p.rot, track(r, [[0, Z], [0.12, [0.2, 0.05, 0.2]], [0.3, [0.35, 0.08, 0.3]], [0.62, [0.35, 0.05, 0.25]], [0.78, [-0.05, 0, 0]], [0.9, [0.02, 0, 0]], [1, Z]]));
      p.pos = add(p.pos, track(r, [[0, Z], [0.15, [-0.06, 0.03, -0.05]], [0.62, [-0.07, 0.03, -0.06]], [0.8, [-0.02, 0, -0.01]], [1, Z]]));
      const away = hump(r, 0.26, 0.34, 0.62, 0.7);
      p.left = { pivot: HINGE_GL, rot: [0.72 * open * (1 - away), 0, 0], pos: [-0.04 * away, -0.15 * away, -0.08 * away] };
      p.pos = add(p.pos, [0, -0.012 * hump(r, 0.76, 0.765, 0.77, 0.82), 0]);
    }
    return p;
  },
};

// ============================================================================= STICKMAN
const STICK_IDLE: Vec = [-0.32, -0.55, 0.42];
const stick: ViewmodelSpec = {
  hands: "shotgun",
  root: [0.25, -0.26, 0.42],
  muzzle: [0, -0.05, 1.0],
  flash: 0,
  reloadCues: [],
  animate(a) {
    const p = base(a);
    // Carried like a croupier: across the body, bent cane raised toward the left of frame.
    let rot: Vec = STICK_IDLE;
    let pos: Vec = Z;
    if (a.melee >= 0) {
      // Low-right wind-up, fast sweep to high-left so the curved hook arcs across the view.
      const m = a.melee;
      rot = track(m, [[0, STICK_IDLE], [0.26, [0.3, 0.45, 0.65]], [0.36, [0.28, 0.3, 0.55]], [0.5, [-0.5, -1.05, -0.35]],
        [0.64, [-0.55, -1.15, -0.4]], [1, STICK_IDLE]]);
      pos = track(m, [[0, Z], [0.26, [0.1, -0.1, -0.05]], [0.5, [-0.18, 0.1, 0.04]], [0.64, [-0.2, 0.12, 0.02]], [1, Z]]);
      if (a.meleeHit) pos = add(pos, [0.01 * Math.sin(a.time * 90), 0.008 * Math.cos(a.time * 70), 0]);
      const broken = a.mag === 0 ? Math.max(0, (m - .46) / .54) : 0;
      p.nodes["Rake head"] = {
        rot: [broken * 3, 0, -0.09 * hump(m, 0.3, 0.42, 0.56, 0.75)],
        pos: [-broken*.2, -broken*broken*.8, broken*.1],
      };
    }
    p.rot = add(p.rot, rot);
    p.pos = add(p.pos, pos);
    return p;
  },
};

// ============================================================================= FIRE EXIT
const AXE_IDLE: Vec = [-0.62, -0.25, 0.35];
const axe: ViewmodelSpec = {
  hands: "shotgun",
  root: [0.26, -0.3, 0.42],
  muzzle: [0, -0.1, 0.6],
  flash: 0,
  reloadCues: [],
  animate(a) {
    const p = base(a, 1.2);
    // Head raised to the upper right, ready to chop.
    let rot: Vec = AXE_IDLE;
    let pos: Vec = Z;
    if (a.melee >= 0) {
      const m = a.melee;
      rot = track(m, [[0, AXE_IDLE], [0.3, [-1.45, 0.05, 0.2]], [0.38, [-1.5, 0.02, 0.15]], [0.48, [0.55, -0.1, 0.05]], [0.6, [0.62, -0.1, 0.05]],
        [1, AXE_IDLE]]);
      pos = track(m, [[0, Z], [0.3, [-0.05, 0.1, -0.1]], [0.48, [-0.1, -0.02, 0.1]], [0.6, [-0.1, -0.04, 0.08]], [1, Z]]);
      if (a.meleeHit) pos = add(pos, [0.012 * Math.sin(a.time * 80), 0.012 * Math.cos(a.time * 60), 0]);
    }
    p.rot = add(p.rot, rot);
    p.pos = add(p.pos, pos);
    return p;
  },
};

// ============================================================================= generic fallback
function simpleSpec(hands: HandSet | null, muzzle: Vec, back = 0.05, climb = 0.18): ViewmodelSpec {
  return {
    hands,
    root: [0.29, -0.21, 0.61],
    muzzle,
    flash: 1,
    reloadCues: [[0.1, "reload-start"], [0.55, "reload-loop"], [0.85, "reload-end"]],
    animate(a) {
      const p = base(a);
      recoil(p, a, back, climb);
      if (a.reloading) reloadCarry(p, a, [-0.05, -0.08, -0.04], [0.45, 0.1, 0.35]);
      return p;
    },
  };
}

export const VIEWMODELS: Record<string, ViewmodelSpec> = {
  magnum,
  tommy,
  doublebarrel,
  dual,
  machinepistol,
  lever,
  autoshotgun,
  sniper,
  lmg,
  launcher,
  stick,
  axe,
};
export function viewmodelFor(id: string): ViewmodelSpec | undefined {
  return VIEWMODELS[id];
}
export { simpleSpec };
