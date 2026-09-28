/** Shared pose keeps the visible Blender limbs and bullet volumes in agreement. */
export type HitRegion = "head" | "body" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
export const LIMBS = ["leftArm", "rightArm", "leftLeg", "rightLeg"] as const;
export type Limb = typeof LIMBS[number];
export type PoseState = {
  id: number; age: number; speed: number; attack: number; cooldown: number;
  attackStyle?: number; missing?: Partial<Record<Limb, boolean>>;
};
export const ATTACK_WINDUP = 0.65;
export function zombiePose(e: PoseState) {
  const lostLegs = Number(!!e.missing?.leftLeg) + Number(!!e.missing?.rightLeg);
  const walk = Math.sin(e.age * e.speed * 4 + e.id) * (lostLegs ? 0.13 : 0.3);
  const arms = [[-0.65 - walk * 0.4, 0, -0.12], [-0.8 + walk * 0.4, 0, 0.12]];
  const elbows = [-0.28, -0.4];
  // The strike lands at the end of windup; cooldown begins with a visible follow-through.
  const p = e.attack > 0 ? 1 - e.attack / ATTACK_WINDUP
    : e.cooldown > 0.75 ? 1 + (1.1 - e.cooldown) / 0.35 : -1;
  if (p >= 0) {
    const wind = Math.sin(Math.min(1, p / 0.58) * Math.PI / 2);
    const strike = Math.max(0, Math.min(1, (p - 0.58) / 0.42));
    const recover = p > 1 ? Math.max(0, 2 - p) : 1;
    const style = e.attackStyle ?? e.id % 3;
    if (style === 0) { // Wide backhand rake across the player's face.
      const side = e.missing?.rightArm ? 0 : 1;
      arms[side] = [(-1.2 - wind * 0.4) * recover, 0, (side ? 1 : -1) * (wind * 1.3 - strike * 2.2) * recover];
      elbows[side] = -0.2 - 0.6 * (1 - strike);
    } else if (style === 1) { // Both hands rise high, then hammer down.
      for (let i = 0; i < 2; i++) {
        arms[i] = [(-0.7 - 2.1 * wind + 1.5 * strike) * recover, 0, (i ? 0.25 : -0.25) * recover];
        elbows[i] = -0.75 + 0.6 * strike;
      }
    } else { // Open embrace, forward snatch, then pull inward.
      for (let i = 0; i < 2; i++) {
        arms[i] = [(-0.7 - 0.95 * wind) * recover, 0, (i ? 1 : -1) * (0.85 * wind - 0.8 * strike) * recover];
        elbows[i] = -0.15 - 0.7 * strike;
      }
    }
  }
  if (lostLegs && p < 0) for (let i = 0; i < 2; i++) arms[i][0] = -1.15 + (i ? walk : -walk);
  return { arms, elbows, legs: lostLegs ? [-1.08 + walk, -1.08 - walk] : [walk, -walk], drop: lostLegs === 2 ? -0.65 : lostLegs ? -0.4 : 0, attacking: p >= 0 };
}
export function rotateLimb(v: number[], x: number, z = 0) {
  const xx = v[0] * Math.cos(z) - v[1] * Math.sin(z);
  const yy = v[0] * Math.sin(z) + v[1] * Math.cos(z);
  return [xx, yy * Math.cos(x) - v[2] * Math.sin(x), yy * Math.sin(x) + v[2] * Math.cos(x)];
}
export function zombieHitVolumes(e: PoseState) {
  const pose = zombiePose(e);
  const volumes: { region: HitRegion; center: number[]; radius: number }[] = [
    { region: "head", center: [0, 1.68 + pose.drop, 0.015], radius: 0.225 },
    { region: "body", center: [0, 1.23 + pose.drop, 0], radius: 0.26 },
    { region: "body", center: [0, 0.91 + pose.drop, 0], radius: 0.22 },
  ];
  for (let i = 0; i < 2; i++) {
    const arm = LIMBS[i], leg = LIMBS[i + 2], side = i ? 1 : -1;
    if (!e.missing?.[arm]) {
      for (const length of [0.13, 0.3, 0.46, 0.62]) {
        const local = length <= 0.28 ? [0, -length, 0] : rotateLimb([0, -(length - 0.28), 0], pose.elbows[i]);
        if (length > 0.28) local[1] -= 0.28;
        const p = rotateLimb(local, pose.arms[i][0], pose.arms[i][2]);
        volumes.push({ region: arm, center: [p[0] + side * 0.3, p[1] + 1.36 + pose.drop, p[2]], radius: 0.095 });
      }
    }
    if (!e.missing?.[leg]) for (const length of [0.15, 0.34, 0.53, 0.7]) {
      const p = rotateLimb([0, -length, 0], pose.legs[i]);
      volumes.push({ region: leg, center: [side * 0.11, 0.8 + p[1] + pose.drop, p[2]], radius: 0.105 });
    }
  }
  return volumes;
}
