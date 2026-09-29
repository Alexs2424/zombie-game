/** One placement list drives both the furniture models and their physical bounds. */
export type HotelFixtureKind =
  | "reception" | "jukebox" | "sofa" | "armchair" | "coffee-table"
  | "luggage-cart" | "planter" | "dining-table" | "booth" | "service-counter" | "host-stand"
  | "reception-backdrop" | "guest-suitcase" | "luggage-shelf" | "porter-cabinet";
export type HotelFixture = {
  id: string; kind: HotelFixtureKind; x: number; z: number;
  w: number; d: number; h: number; baseY?: number; yaw?: number; collisionH?: number;
};
export const HOTEL_FIXTURES: HotelFixture[] = [
  { id: "hotel-prop-reception", kind: "reception", x: -12, z: 20.4, w: 7.6, d: 1.65, h: 1.9, collisionH: 1.22, yaw: Math.PI },
  { id: "hotel-prop-reception-backdrop", kind: "reception-backdrop", x: -12, z: 16.8, w: 8.2, d: 0.65, h: 3.5, yaw: Math.PI },
  { id: "hotel-prop-guest-suitcase", kind: "guest-suitcase", x: -7.8, z: 24.7, w: 1.25, d: 0.85, h: 0.9 },
  { id: "hotel-prop-porter", kind: "porter-cabinet", x: -18, z: 23.7, w: 1.8, d: 0.65, h: 1.15, yaw: Math.PI / 2 },
  { id: "hotel-prop-luggage-shelf-west", kind: "luggage-shelf", x: -10.8, z: 50, w: 3.8, d: 0.7, h: 2.5 },
  { id: "hotel-prop-luggage-shelf-east", kind: "luggage-shelf", x: 4, z: 50, w: 3.8, d: 0.7, h: 2.5 },
  { id: "hotel-prop-jukebox", kind: "jukebox", x: 13, z: 25, w: 1.5, d: 0.85, h: 2.35, yaw: -Math.PI / 2 },
  { id: "hotel-prop-front-sofa", kind: "sofa", x: 5.8, z: 18.8, w: 3.8, d: 1.35, h: 1.12, yaw: Math.PI },
  { id: "hotel-prop-west-sofa", kind: "sofa", x: -16, z: 39, w: 3.8, d: 1.35, h: 1.12, yaw: Math.PI },
  { id: "hotel-prop-west-armchair", kind: "armchair", x: -12.8, z: 42, w: 1.2, d: 1.2, h: 1.12, yaw: -Math.PI / 2 },
  { id: "hotel-prop-west-coffee", kind: "coffee-table", x: -16, z: 42, w: 2.4, d: 1.2, h: 0.58 },
  { id: "hotel-prop-east-sofa", kind: "sofa", x: 8, z: 39, w: 3.8, d: 1.35, h: 1.12, yaw: Math.PI },
  { id: "hotel-prop-east-armchair", kind: "armchair", x: 4.8, z: 42, w: 1.2, d: 1.2, h: 1.12, yaw: Math.PI / 2 },
  { id: "hotel-prop-east-coffee", kind: "coffee-table", x: 8, z: 42, w: 2.4, d: 1.2, h: 0.58 },
  { id: "hotel-prop-luggage", kind: "luggage-cart", x: -17.8, z: 44.8, w: 1.6, d: 1.0, h: 2.0 },
  { id: "hotel-prop-west-palm", kind: "planter", x: -21.2, z: 43.2, w: 1.2, d: 1.2, h: 2.35 },
  { id: "hotel-prop-east-palm", kind: "planter", x: 12.5, z: 38, w: 1.2, d: 1.2, h: 2.35 },
  { id: "hotel-prop-rear-palm", kind: "planter", x: -4, z: 43.8, w: 1.2, d: 1.2, h: 2.35 },
  { id: "hotel-prop-dining-nw", kind: "dining-table", x: -11, z: 39.2, w: 4.2, d: 3.6, h: 1.35, baseY: 4 },
  { id: "hotel-prop-dining-ne", kind: "dining-table", x: 3, z: 39.2, w: 4.2, d: 3.6, h: 1.35, baseY: 4 },
  { id: "hotel-prop-dining-sw", kind: "dining-table", x: -11, z: 45, w: 4.2, d: 3.6, h: 1.35, baseY: 4 },
  { id: "hotel-prop-dining-se", kind: "dining-table", x: 3, z: 45, w: 4.2, d: 3.6, h: 1.35, baseY: 4 },
  { id: "hotel-prop-west-booth", kind: "booth", x: -17.2, z: 40.5, w: 2, d: 6, h: 1.4, baseY: 4 },
  { id: "hotel-prop-east-booth", kind: "booth", x: 9.2, z: 40.5, w: 2, d: 6, h: 1.4, baseY: 4, yaw: Math.PI },
  { id: "hotel-prop-service", kind: "service-counter", x: -4, z: 47, w: 6.4, d: 1.3, h: 1.45, baseY: 4 },
  { id: "hotel-prop-host", kind: "host-stand", x: -4, z: 35.4, w: 1.35, d: 0.9, h: 1.2, baseY: 4 },
];
