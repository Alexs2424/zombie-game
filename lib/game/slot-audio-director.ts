import { STATIC_RECTS, type Rect, type V2 } from "./simulation.ts";
import { SLOT_MACHINE_SOURCES, type SlotMachineSource } from "./slot-machines.ts";

export type SlotCue = {
  source: SlotMachineSource;
  variant: 0 | 1;
};

export type SlotAudioState = {
  playing: boolean;
  player: V2;
  moving: boolean;
  suppressed: boolean;
};

const ENTER_DISTANCE = 3.5;
const EXIT_DISTANCE = 4.5;
const SHARED_COOLDOWN = 4;
const CABINET_COOLDOWN = 20;

/** Whether a horizontal source-to-listener segment crosses a solid rectangle. */
function blockedByRect(source: V2, listener: V2, rect: Rect): boolean {
  let entry = 0;
  let exit = 1;
  for (const [axis, halfSize] of [["x", rect.w / 2], ["z", rect.d / 2]] as const) {
    const delta = listener[axis] - source[axis];
    const min = rect[axis] - halfSize;
    const max = rect[axis] + halfSize;
    if (Math.abs(delta) < 1e-9) {
      if (source[axis] < min || source[axis] > max) return false;
      continue;
    }
    const a = (min - source[axis]) / delta;
    const b = (max - source[axis]) / delta;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return false;
  }
  return true;
}

/** Shared by cue selection and playback so moving behind a wall also mutes a tail. */
export function slotSourceAudible(
  source: SlotMachineSource,
  player: V2,
  maxDistance = ENTER_DISTANCE,
): boolean {
  if (Math.hypot(source.x - player.x, source.z - player.z) > maxDistance) return false;
  // Both banks face their aisles. Do not greet players behind an end panel
  // or on the opposite side of the island, even if they are in range.
  if ((player.x - source.x) * source.side < 0) return false;
  return !STATIC_RECTS.some((rect) => blockedByRect(source, player, rect));
}

/** Sparse cabinet greetings driven entirely by gameplay time and position. */
export class SlotAudioDirector {
  private elapsed = 0;
  private sharedReadyAt = 0;
  private cabinets = new Map<string, { armed: boolean; readyAt: number }>();

  reset() {
    this.elapsed = 0;
    this.sharedReadyAt = 0;
    this.cabinets.clear();
  }

  update(dt: number, state: SlotAudioState): SlotCue | null {
    if (!state.playing || !Number.isFinite(dt) || dt <= 0) return null;
    this.elapsed += dt;

    let nearest: SlotMachineSource | null = null;
    let nearestDistance = Infinity;
    for (const source of SLOT_MACHINE_SOURCES) {
      const distance = Math.hypot(source.x - state.player.x, source.z - state.player.z);
      const cabinet = this.cabinets.get(source.id);
      if (cabinet && distance > EXIT_DISTANCE) cabinet.armed = true;
      if (distance > ENTER_DISTANCE || distance >= nearestDistance) continue;
      if (!slotSourceAudible(source, state.player)) continue;
      nearest = source;
      nearestDistance = distance;
    }

    // Suppression does not spend a cabinet's eligibility. If combat takes
    // priority, the greeting can still happen when walking resumes nearby.
    if (!state.moving || state.suppressed || !nearest || this.elapsed < this.sharedReadyAt) {
      return null;
    }
    const cabinet = this.cabinets.get(nearest.id);
    if (cabinet && (!cabinet.armed || this.elapsed < cabinet.readyAt)) return null;

    this.cabinets.set(nearest.id, {
      armed: false,
      readyAt: this.elapsed + CABINET_COOLDOWN,
    });
    this.sharedReadyAt = this.elapsed + SHARED_COOLDOWN;
    return { source: { ...nearest }, variant: nearest.variant };
  }
}
