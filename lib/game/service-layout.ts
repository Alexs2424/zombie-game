/** World-space solid footprints for the Blender-built loading corridor. */
import { SERVICE_OFFSET } from './casino-layout.ts';
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
