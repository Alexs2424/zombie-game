import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { GameEvent, WeaponId } from "./simulation";
import { clamp01, smooth, type AnimInput, type HandPose, type NodePose, type Pose, type Vec, type ViewmodelSpec } from "./weapon-viewmodels";

type Rest = { node: TransformNode; pos: Vector3; rot: Quaternion };

/**
 * Game-space (Babylon camera frame) -> glTF node space. The glTF loader's root mirrors X,
 * so translations flip x and rotations about y/z change sign (see weapon-viewmodels.ts).
 */
const toGltfPos = (v: Vec) => new Vector3(-v[0], v[1], v[2]);
function toGltfRot(r: Vec) {
  // Apply x, then y, then z (game space), converted to the mirrored glTF frame.
  const qx = Quaternion.RotationAxis(Vector3.Right(), r[0]);
  const qy = Quaternion.RotationAxis(Vector3.Up(), -r[1]);
  const qz = Quaternion.RotationAxis(Vector3.Forward(), -r[2]);
  return qz.multiply(qy).multiply(qx);
}

/** Binds a loaded viewmodel's named glTF nodes and fitted hands to animator poses. */
export class WeaponRig {
  private nodes = new Map<string, Rest>();
  private left?: Rest;
  private right?: Rest;
  private touched = new Set<string>();
  private recovering = 0;
  private wasReloading = false;
  private recoveryWeight = 1;
  constructor(readonly id: WeaponId, readonly spec: ViewmodelSpec, root: TransformNode) {
    const prefix = `${id}-`;
    for (const n of root.getDescendants(false)) {
      if (!(n instanceof TransformNode)) continue;
      const rest: Rest = {
        node: n,
        pos: n.position.clone(),
        rot: (n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation)).clone(),
      };
      if (n.name === `${id}-grip-LeftHand`) this.left = rest;
      else if (n.name === `${id}-grip-RightHand`) this.right = rest;
      else if (n.name.startsWith(prefix) && !n.name.includes("-grip")) this.nodes.set(n.name.slice(prefix.length), rest);
    }
    // Fitted hands were authored for another gun: move them onto this gun's fore-end.
    if (this.left && spec.leftHand) this.left.pos.addInPlace(toGltfPos(spec.leftHand));
    if (this.right && spec.rightHand) this.right.pos.addInPlace(toGltfPos(spec.rightHand));
    if (this.left && spec.hideLeftHand) this.left.node.setEnabled(false);
  }
  has(name: string) {
    return this.nodes.has(name);
  }
  apply(pose: Pose, dt = 1/60, reloading = false) {
    if (this.wasReloading && !reloading) this.recovering = .18;
    this.wasReloading = reloading;
    this.recovering = Math.max(0,this.recovering-dt);
    this.recoveryWeight = this.recovering > 0 ? 1-Math.exp(-dt*32) : 1;
    const seen = new Set<string>();
    for (const [name, np] of Object.entries(pose.nodes)) {
      const rest = this.nodes.get(name);
      if (!rest) continue;
      seen.add(name);
      this.pose(rest, np);
    }
    // Reset anything animated last frame but not this frame.
    for (const name of this.touched) if (!seen.has(name)) this.pose(this.nodes.get(name)!, {});
    this.touched = this.recovering > 0 ? new Set([...this.touched,...seen]) : seen;
    for (const name of this.spec.hiddenAtRest ?? []) {
      const shown = pose.nodes[name]?.hidden === false;
      this.nodes.get(name)?.node.setEnabled(shown);
    }
    if (this.left) this.poseHand(this.left, pose.left);
    if (this.right) this.poseHand(this.right, pose.right);
  }
  private pose(rest: Rest, np: NodePose) {
    const n = rest.node;
    const previousPosition = n.position.clone();
    const previousRotation = (n.rotationQuaternion ?? rest.rot).clone();
    n.position.copyFrom(rest.pos);
    if (np.pos) n.position.addInPlace(toGltfPos(np.pos));
    n.rotationQuaternion = np.rot ? toGltfRot(np.rot).multiply(rest.rot) : rest.rot.clone();
    if (this.recoveryWeight<1) {
      n.position.copyFrom(Vector3.Lerp(previousPosition,n.position,this.recoveryWeight));
      n.rotationQuaternion=Quaternion.Slerp(previousRotation,n.rotationQuaternion,this.recoveryWeight);
    }
    n.scaling.setAll(np.scale ?? 1);
    if (!this.spec.hideLeftHand || rest !== this.left) n.setEnabled(!np.hidden);
  }
  private poseHand(rest: Rest, hp?: HandPose) {
    if (!hp) return this.pose(rest, {});
    if (!hp.pivot || !hp.rot) return this.pose(rest, hp);
    // Rigid rotation about a remote pivot (e.g. following a break-open barrel).
    const q = toGltfRot(hp.rot);
    const pivot = toGltfPos(hp.pivot);
    const offset = rest.pos.subtract(pivot);
    const rotated = offset.applyRotationQuaternion(q);
    rest.node.position.copyFrom(pivot.add(rotated));
    if (hp.pos) rest.node.position.addInPlace(toGltfPos(hp.pos));
    rest.node.rotationQuaternion = q.multiply(rest.rot);
    rest.node.setEnabled(!hp.hidden);
  }
}

/** Per-weapon action history derived from simulation events, for the animators. */
export class ViewmodelState {
  private lastShot: Partial<Record<WeaponId, number>> = {};
  private shots: Partial<Record<WeaponId, number>> = {};
  private alt: Partial<Record<WeaponId, boolean>> = {};
  private side: Partial<Record<WeaponId, number>> = {};
  private reloadDone: Partial<Record<WeaponId, number>> = {};
  private meleeHit = -10;
  private equippedAt = 0;
  private weapon: WeaponId | null = null;
  private blend = 0;
  event(e: GameEvent, now: number) {
    const w = e.weapon;
    if (!w) return;
    if (e.type === "shot") {
      this.reloadDone[w] = -100; // Interrupting a shell reload must not reapply its completion pose.
      this.lastShot[w] = now;
      this.shots[w] = (this.shots[w] ?? 0) + (e.alternate ? 2 : 1);
      this.alt[w] = !!e.alternate;
      this.side[w] = e.side ?? 0;
    }
    if (e.type === "reloadDone") this.reloadDone[w] = now;
    if (e.type === "meleeHit") this.meleeHit = now;
  }
  input(
    w: WeaponId,
    now: number,
    dt: number,
    s: {
      reloadRemaining: number;
      reloadDuration: number;
      mag: number;
      capacity: number;
      interval: number;
      melee: number;
      moving: boolean;
      sprinting: boolean;
    },
  ): AnimInput {
    if (w !== this.weapon) {
      this.weapon = w;
      this.equippedAt = now;
      this.blend = 0;
    }
    const reloading = s.reloadRemaining > 0;
    // Shell-by-shell reloads chain several timers: keep the carry pose up between them.
    const target = reloading || now - (this.reloadDone[w] ?? -10) < 0.12 ? 1 : 0;
    this.blend += (target - this.blend) * clamp01(dt * (target ? 9 : 6));
    return {
      time: now,
      sinceShot: now - (this.lastShot[w] ?? -100),
      shots: this.shots[w] ?? 0,
      lastAlt: !!this.alt[w],
      lastSide: this.side[w] ?? 0,
      interval: s.interval,
      reloading,
      reload: reloading ? clamp01(1 - s.reloadRemaining / Math.max(1e-6, s.reloadDuration)) : 0,
      reloadDuration: s.reloadDuration,
      sinceReloadDone: now - (this.reloadDone[w] ?? -100),
      reloadBlend: smooth(clamp01(this.blend)),
      mag: s.mag,
      capacity: s.capacity,
      melee: s.melee,
      meleeHit: now - this.meleeHit < 0.25,
      equip: now - this.equippedAt,
      moving: s.moving,
      sprinting: s.sprinting,
    };
  }
}
