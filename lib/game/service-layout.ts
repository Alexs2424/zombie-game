/** World-space solid footprints for the Blender-built loading corridor. */
import { CASINO_DOORS, CASINO_ROOMS, SERVICE_OFFSET } from './casino-layout.ts';

// Keep wall cladding and the exported utility equipment on the same room faces.
// These are world coordinates; the Blender export remains relative to SERVICE_OFFSET.
const supply = CASINO_ROOMS.supply;
export const SERVICE_FINISH = {
  west: supply.minX + .245, east: supply.maxX - .245,
  south: supply.minZ + .245, north: supply.maxZ - .245,
  thickness: .025, ceiling: supply.ceilingY,
};
export const SERVICE_ASSET_MOUNTS = {
  west: SERVICE_FINISH.west + SERVICE_FINISH.thickness / 2 - SERVICE_OFFSET.x,
  east: SERVICE_FINISH.east - SERVICE_FINISH.thickness / 2 - SERVICE_OFFSET.x,
  south: SERVICE_FINISH.south + SERVICE_FINISH.thickness / 2 - SERVICE_OFFSET.z,
  north: SERVICE_FINISH.north - SERVICE_FINISH.thickness / 2 - SERVICE_OFFSET.z,
  ceiling: SERVICE_FINISH.ceiling,
};
const supplyDoor = CASINO_DOORS.supply;
export const SERVICE_WALL_PANELS = [
  { x: SERVICE_FINISH.west, z: (SERVICE_FINISH.south + SERVICE_FINISH.north) / 2,
    length: SERVICE_FINISH.north - SERVICE_FINISH.south, alongX: false, inward: 1 },
  ...[[SERVICE_FINISH.south, supplyDoor.z - supplyDoor.d / 2],
    [supplyDoor.z + supplyDoor.d / 2, SERVICE_FINISH.north]].map(([start, end]) => ({
    x: SERVICE_FINISH.east, z: (start + end) / 2, length: end - start, alongX: false, inward: -1,
  })),
  ...[[SERVICE_FINISH.south, 1], [SERVICE_FINISH.north, -1]].map(([z, inward]) => ({
    x: (SERVICE_FINISH.west + SERVICE_FINISH.east) / 2, z,
    length: SERVICE_FINISH.east - SERVICE_FINISH.west, alongX: true, inward,
  })),
];
export const SERVICE_RECTS = [
  { id: "service-truck", x: 7.8, z: 5.65, w: 5.5, d: 2.55, h: 2.95 },
  { id: "service-cartons", x: 14.5, z: 5.45, w: 1.7, d: 2.1, h: 1.9 },
  { id: "service-shelf", x: 6.5, z: 11.25, w: 2.7, d: 1.1, h: 2.7 },
  { id: "service-pallet-jack", x: 13.9, z: 10.95, w: 2.7, d: 1.3, h: 1.35 },
  { id: "service-cabinet", x: 15.25, z: 6.95, w: 0.7, d: 0.75, h: 2 },
].map(rect => ({ ...rect, x: rect.x + SERVICE_OFFSET.x, z: rect.z + SERVICE_OFFSET.z }));

// Retain the loading-corridor walk lanes in the new northwest supply room.
export const SERVICE_VIEWS: Record<string, [number, number, number, number]> = {
  serviceOverview: [-25, 43.75, -2.08, 0.04],
  serviceTruck: [-34.9, 43.9, 2.51, 0.05],
  serviceStorage: [-29.5, 43.7, 0.98, 0.10],
};
