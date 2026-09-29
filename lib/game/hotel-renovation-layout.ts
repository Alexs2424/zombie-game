/** Shared solid geometry for the rear gallery and the new architectural details. */
export const HOTEL_GALLERY_WALLS = [
  { id: "hotel-gallery-wall-west", x: -16.65, z: 46, w: 6.7, d: 0.24, h: 3.72 },
  { id: "hotel-gallery-wall-center", x: -4, z: 46, w: 13.4, d: 0.24, h: 3.72 },
  { id: "hotel-gallery-wall-east", x: 8.65, z: 46, w: 6.7, d: 0.24, h: 3.72 },
];
export const HOTEL_RENOVATION_SOLIDS = [
  ...HOTEL_GALLERY_WALLS,
  { id: "hotel-gallery-register", x: -5, z: 49.3, w: 2.4, d: 0.8, h: 1.05 },
  { id: "hotel-gallery-cache", x: 0, z: 49.3, w: 1.2, d: 0.7, h: 0.75 },
  { id: "hotel-salon-column-west", x: -9, z: 34.2, w: 0.72, d: 0.72, h: 3.72 },
  { id: "hotel-salon-column-east", x: 1, z: 34.2, w: 0.72, d: 0.72, h: 3.72 },
];
