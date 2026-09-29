/** Shared gameplay placements. Door yaw faces inward using (sin(yaw), cos(yaw)). */
export const HOTEL_RULES = {
  price: 2000,
  spawnGrace: 3,
  ambushDuration: 35,
  ambushCount: 12,
  ambushCap: 6,
  ambushCadence: 1.5,
  ammoPrice: 500,
} as const;
export const HOTEL_GATE = { id: "hotel", x: -3, z: 12.25, w: 5, d: 0.45, h: 3.07 };
// Keep its interaction anchor in front of the physical crate, not inside it.
export const HOTEL_AMMO_CRATE = { id: "hotel-ammo-crate", x: -3.1, z: 36.2, w: 0.75, d: 0.55, h: 0.55, baseY: 4 };
export const HOTEL_ANCHORS = {
  hotel: { x: -3, z: 10.5, y: 0 },
  hotelBell: { x: -4, z: 34.3, y: 4 },
  tommyAmmo: { x: -2.5, z: 35.4, y: 4 },
  jukebox: { x: 11.9, z: 25, y: 0 },
} as const;
export type HotelSpawn = {
  id: string; x: number; y: number; z: number; surfaceId: string; yaw: number;
  door: { x: number; y: number; z: number; w: number; h: number; yaw: number };
};
export const HOTEL_SPAWNS: HotelSpawn[] = [
  { id: "hotel-west", x: -21.3, z: 35.8, y: 0, surfaceId: "ground", yaw: Math.PI / 2,
    door: { x: -22.88, z: 36, y: 0, w: 1.8, h: 2.7, yaw: Math.PI / 2 } },
  { id: "hotel-east", x: 13.5, z: 33, y: 0, surfaceId: "ground", yaw: -Math.PI / 2,
    door: { x: 14.88, z: 33, y: 0, w: 1.8, h: 2.7, yaw: -Math.PI / 2 } },
  { id: "hotel-rear", x: 11.7, z: 43.7, y: 0, surfaceId: "ground", yaw: -3 * Math.PI / 4,
    door: { x: 13, z: 45, y: 0, w: 1.8, h: 2.7, yaw: -3 * Math.PI / 4 } },
  { id: "hotel-restaurant-service", x: 3, z: 48.1, y: 4, surfaceId: "hotel-upper", yaw: Math.PI,
    door: { x: 3, z: 48.9, y: 4, w: 1.8, h: 2.7, yaw: Math.PI } },
  { id: "hotel-restaurant-west", x: -17.6, z: 36, y: 4, surfaceId: "hotel-upper", yaw: Math.PI / 2,
    door: { x: -18.9, z: 36, y: 4, w: 1.8, h: 2.7, yaw: Math.PI / 2 } },
];
/** Ground portals already have perimeter walls; upper service panels need their own solids. */
export const HOTEL_SERVICE_DOORS = HOTEL_SPAWNS.filter(spawn => spawn.y > 0).map(spawn => ({
  id: `hotel-service-door-${spawn.id}`,
  x: spawn.door.x, z: spawn.door.z, w: spawn.door.w, d: 0.12,
  h: spawn.door.h, baseY: spawn.door.y, yaw: spawn.door.yaw,
}));
export type HotelChallenge = {
  phase: "idle" | "active" | "complete" | "failed";
  remaining: number;
  pending: number;
  attempt: number;
  spawnTimer: number;
};
export function freshHotelChallenge(): HotelChallenge {
  return { phase: "idle", remaining: 0, pending: 0, attempt: 0, spawnTimer: 0 };
}
