import type { GameEvent, Simulation, WeaponId, PurchaseId, BarItemId } from "../game/simulation.ts";

export const COOP_VERSION = "last-jackpot-coop-1";
export const MAX_PLAYERS = 4;
export const SIMULATION_HZ = 60;
export const SNAPSHOT_HZ = 20;

export type CoopInput = {
  seq: number;
  forward: number;
  strafe: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  fire: boolean;
  aim: boolean;
};
export const idleInput = (yaw = 0, pitch = 0): CoopInput => ({
  seq: 0, forward: 0, strafe: 0, yaw, pitch, sprint: false, fire: false, aim: false,
});

export type CoopAction =
  | { kind: "reload" | "knife" | "grenade" | "interact" | "close-menu" }
  | { kind: "switch"; weapon: WeaponId }
  | { kind: "purchase"; purchase: PurchaseId }
  | { kind: "bar"; item: BarItemId; weapon?: WeaponId };

export type PlayerSummary = {
  id: string; name: string; color: number; connected: boolean; alive: boolean;
  x: number; y: number; z: number; yaw: number; pitch: number;
  health: number; maxHealth: number; weapon: WeaponId; moving: boolean; sprinting: boolean;
};
export type CoopEvent = GameEvent & { eventId: number; actorId: string | null };
/** Only serializable own presentation fields are projected by the server. */
export type SimulationSnapshot = Partial<Simulation>;
export type CoopSnapshot = {
  tick: number;
  phase: "lobby" | "playing" | "ended";
  self: SimulationSnapshot;
  players: PlayerSummary[];
  events: CoopEvent[];
};
export type RoomView = {
  code: string;
  hostId: string;
  epoch: number;
  phase: "lobby" | "playing" | "ended";
  players: PlayerSummary[];
};
export type ClientMessage =
  | { type: "create"; version: string; name: string; hostKey?: string }
  | { type: "join"; version: string; name: string; code: string }
  | { type: "resume"; version: string; code: string; token: string }
  | { type: "input"; epoch: number; input: CoopInput }
  | { type: "action"; epoch: number; id: number; action: CoopAction }
  | { type: "start" | "leave" };
export type ServerMessage =
  | { type: "welcome"; playerId: string; token: string; room: RoomView; snapshot: CoopSnapshot }
  | { type: "room"; room: RoomView }
  | { type: "snapshot"; snapshot: CoopSnapshot; acknowledgedInput: number }
  | { type: "action-result"; id: number; ok: boolean; reason?: string }
  | { type: "error"; code: string; message: string };
