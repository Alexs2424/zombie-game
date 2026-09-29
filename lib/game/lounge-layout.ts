/** World-space collision footprints for the Blender-built lounge furniture. */
import { LOUNGE_OFFSET } from './casino-layout.ts';
export type LoungeRect = {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};

// Relocate the baked assembly together. Keep both independently purchased doors clear.
// These solid footprints also feed zombie navigation and projectile obstruction.
export const LOUNGE_RECTS: LoungeRect[] = [
  { id: "bar", x: 12, z: -8.7, w: 5.7, d: 1.1, h: 1.38 },
  { id: "lounge-backbar", x: 12, z: -11.6, w: 6.1, d: 0.7, h: 3.55 },
  { id: "lounge-west-booth", x: 7, z: -7.9, w: 2.2, d: 3.6, h: 1.45 },
  { id: "lounge-north-booth", x: 10.3, z: 0.1, w: 3.4, d: 1.85, h: 1.35 },
  { id: "lounge-cocktail-table", x: 13.8, z: -1.1, w: 1.1, d: 1.1, h: 1.08 },
  { id: "lounge-stool-a", x: 10, z: -7.35, w: 0.65, d: 0.65, h: 0.88 },
  { id: "lounge-stool-b", x: 14.1, z: -7.35, w: 0.65, d: 0.65, h: 0.88 },
].map(rect => ({ ...rect, x: rect.x + LOUNGE_OFFSET.x, z: rect.z + LOUNGE_OFFSET.z }));
