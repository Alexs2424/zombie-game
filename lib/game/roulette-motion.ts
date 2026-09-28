/** Exact pocket order and coordinates of public/models/roulette-table.glb. */
export const ROULETTE_SEQUENCE = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const TAU = Math.PI * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const wrap = (n: number) => ((n % TAU) + TAU) % TAU;
const smoothstep = (n: number) => n * n * (3 - 2 * n);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const pocketSlope = 0.017 / 0.076;
export const ROULETTE_GEOMETRY = {
  centerX: -0.735,
  centerZ: 0,
  pivotY: 0.86,
  ballRadius: 0.015,
  trackRadius: 0.755,
  trackHeight: 0.913,
  // Use the visible inner pocket floor; the outer edge enters the wooden rotor.
  pocketRadius: 0.468,
  pocketBallHeight:
    0.9 - (0.468 - 0.432) * pocketSlope + 0.015 * Math.hypot(1, pocketSlope),
} as const;

export type RoulettePose = {
  wheelAngle: number;
  ballAngle: number;
  ballRadius: number;
  ballHeight: number;
};

export type RouletteSpinMotion = {
  start: RoulettePose;
  wheelEnd: number;
  ballEnd: number;
};

export function roulettePocketAngle(number: number) {
  const index = ROULETTE_SEQUENCE.findIndex((pocket) => pocket === number);
  if (index < 0) throw new RangeError("Roulette pocket must be 0 through 36");
  return -Math.PI / 2 + (index * TAU) / 37;
}

export function idleRoulettePose(): RoulettePose {
  return {
    wheelAngle: 0,
    ballAngle: Math.atan2(0.115, 0.716),
    ballRadius: Math.hypot(0.716, 0.115),
    ballHeight: 0.895,
  };
}

export function createRouletteSpin(
  number: number,
  start: RoulettePose,
): RouletteSpinMotion {
  // Present the winning pocket on the player-facing side of the bowl.
  const landingAngle = -Math.PI / 2;
  const wheelTarget = roulettePocketAngle(number) - landingAngle;
  return {
    start: { ...start },
    wheelEnd: start.wheelAngle + TAU * 2 + wrap(wheelTarget - start.wheelAngle),
    // Positive ball polar angle counter-rotates against positive wheel Euler Y.
    ballEnd: start.ballAngle + TAU * 4 + wrap(landingAngle - start.ballAngle),
  };
}

export function sampleRouletteSpin(
  spin: RouletteSpinMotion,
  progress: number,
): RoulettePose {
  const t = clamp(progress);
  const travel = 1 - (1 - t) ** 3;
  const launch = smoothstep(clamp(t / 0.14));
  const drop = clamp((t - 0.64) / 0.3);
  const fall = smoothstep(drop);
  const launchRadius = mix(
    spin.start.ballRadius,
    ROULETTE_GEOMETRY.trackRadius,
    launch,
  );
  const launchHeight =
    mix(spin.start.ballHeight, ROULETTE_GEOMETRY.trackHeight, launch) +
    0.028 * Math.sin(Math.PI * launch) ** 2;
  const bounce = 0.045 * Math.sin(drop * Math.PI * 4) ** 2 * drop * (1 - drop);
  return {
    wheelAngle: mix(spin.start.wheelAngle, spin.wheelEnd, travel),
    ballAngle: mix(spin.start.ballAngle, spin.ballEnd, travel),
    ballRadius: mix(launchRadius, ROULETTE_GEOMETRY.pocketRadius, fall),
    ballHeight:
      mix(launchHeight, ROULETTE_GEOMETRY.pocketBallHeight, fall) + bounce,
  };
}

type SpinState = {
  id: number;
  number: number;
  remaining: number;
  resolved: boolean;
};

/** Driven solely by simulation remaining time, including pauses and death. */
export class RouletteMotion {
  private run?: object;
  private spinId?: number;
  private motion?: RouletteSpinMotion;
  private pose = idleRoulettePose();

  update(run: object, spin: SpinState | null, duration: number): RoulettePose {
    if (this.run !== run) {
      this.run = run;
      this.spinId = undefined;
      this.motion = undefined;
      this.pose = idleRoulettePose();
    }
    if (!spin) {
      this.spinId = undefined;
      this.motion = undefined;
      return this.pose;
    }
    if (spin.id !== this.spinId || !this.motion) {
      this.spinId = spin.id;
      this.motion = createRouletteSpin(spin.number, this.pose);
    }
    this.pose = sampleRouletteSpin(
      this.motion,
      spin.resolved ? 1 : 1 - spin.remaining / duration,
    );
    return this.pose;
  }
}
