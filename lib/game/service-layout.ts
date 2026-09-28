/** World-space solid footprints for the Blender-built loading corridor. */
export const SERVICE_RECTS = [
  { id: "service-truck", x: 7.8, z: 5.65, w: 5.5, d: 2.55, h: 2.95 },
  { id: "service-cartons", x: 14.5, z: 5.45, w: 1.7, d: 2.1, h: 1.9 },
  { id: "service-shelf", x: 6.5, z: 11.25, w: 2.7, d: 1.1, h: 2.7 },
  { id: "service-pallet-jack", x: 13.9, z: 10.95, w: 2.7, d: 1.3, h: 1.35 },
  { id: "service-cabinet", x: 15.25, z: 6.95, w: 0.7, d: 0.75, h: 2 },
];

// The cross-corridor escape lane at Z=8.6 and the lounge opening at X=11.7
// remain clear for players and for the shared zombie navigation grid.
export const SERVICE_VIEWS: Record<string, [number, number, number, number]> = {
  serviceOverview: [15, 8.75, -2.08, 0.04],
  serviceTruck: [5.1, 8.9, 2.51, 0.05],
  serviceStorage: [10.5, 8.7, 0.98, 0.10],
};
