import type { Enemy, V2 } from "./simulation";

export type ZombieCueKind = "chase" | "last" | "horde";
export type ZombieCue = {
  kind: ZombieCueKind;
  enemyId: number;
  position: V2;
};
type ZombieAudioState = {
  playing: boolean;
  round: number;
  roundCueRemaining: number;
  waveRemaining: number;
  player: V2;
  enemies: readonly Pick<Enemy, "id" | "x" | "z" | "health">[];
};

/** Uses gameplay time, so pausing never spends a cooldown or queues a new cue. */
export class ZombieAudioDirector {
  private random: () => number;
  private elapsed = 0;
  private sharedReadyAt = 1.5;
  private chaseReadyAt = 0;
  private hordeReadyAt = 0;
  private round = -1;
  private lastPlayed = false;
  private lastCandidateId: number | null = null;
  private lastHeld = 0;
  private hordeHeld = 0;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  reset() {
    this.elapsed = 0;
    this.sharedReadyAt = 1.5;
    this.chaseReadyAt = 0;
    this.hordeReadyAt = 0;
    this.round = -1;
    this.lastPlayed = false;
    this.lastCandidateId = null;
    this.lastHeld = 0;
    this.hordeHeld = 0;
  }

  update(dt: number, state: ZombieAudioState): ZombieCue | null {
    if (!state.playing || !Number.isFinite(dt) || dt <= 0) return null;
    this.elapsed += dt;
    if (state.round !== this.round) {
      this.round = state.round;
      this.lastPlayed = false;
      this.lastCandidateId = null;
      this.lastHeld = 0;
      this.hordeHeld = 0;
    }
    // Round stingers get the room to themselves, including their trailing notes.
    if (state.roundCueRemaining > 0) {
      this.lastCandidateId = null;
      this.lastHeld = 0;
      this.hordeHeld = 0;
      return null;
    }

    let nearest: ZombieAudioState["enemies"][number] | null = null;
    let nearestDistance = Infinity;
    let nearbyCount = 0;
    let aliveCount = 0;
    for (const enemy of state.enemies) {
      if (enemy.health <= 0) continue;
      aliveCount++;
      const distance = Math.hypot(
        enemy.x - state.player.x,
        enemy.z - state.player.z,
      );
      if (distance <= 10) nearbyCount++;
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    const lastCandidate =
      state.round > 0 &&
      state.waveRemaining === 0 &&
      aliveCount === 1 &&
      nearestDistance <= 18
        ? nearest
        : null;
    if (lastCandidate && lastCandidate.id === this.lastCandidateId) {
      this.lastHeld += dt;
    } else {
      this.lastCandidateId = lastCandidate?.id ?? null;
      this.lastHeld = lastCandidate ? dt : 0;
    }
    this.hordeHeld = nearbyCount >= 5 ? this.hordeHeld + dt : 0;

    if (!nearest || this.elapsed < this.sharedReadyAt) return null;
    let kind: ZombieCueKind;
    if (lastCandidate && !this.lastPlayed) {
      // Let the survivor's situation land before the joke, and avoid preceding it
      // with a normal chase sound that would consume the shared cooldown.
      if (this.lastHeld < 1.25) return null;
      kind = "last";
      this.lastPlayed = true;
    } else if (this.hordeHeld >= 1 && this.elapsed >= this.hordeReadyAt) {
      kind = "horde";
      this.hordeReadyAt = this.elapsed + 12 + this.random() * 6;
    } else if (nearestDistance <= 8 && this.elapsed >= this.chaseReadyAt) {
      kind = "chase";
    } else {
      return null;
    }

    this.sharedReadyAt = this.elapsed + 5;
    this.chaseReadyAt = this.elapsed + 5 + this.random() * 3;
    return {
      kind,
      enemyId: nearest.id,
      // Snapshot the current source position; never retain a mutable enemy.
      position: { x: nearest.x, z: nearest.z },
    };
  }
}
