/** The shared plan for casino rendering, collision, purchases and navigation. */
import { POKER_TABLES } from './poker.ts';

export type CasinoPoint = { x: number; z: number };
export type CasinoRect = CasinoPoint & {
  id: string; w: number; d: number; h: number;
  baseY?: number; yaw?: number; transparentSight?: boolean;
};
export type CasinoRoom = {
  id: string; name: string; minX: number; maxX: number; minZ: number; maxZ: number;
  polygon: CasinoPoint[]; ceilingY: number; accessibleGround: boolean;
};
function room(id: string, name: string, minX: number, maxX: number, minZ: number, maxZ: number, ceilingY = 4.8, accessibleGround = true): CasinoRoom {
  return { id, name, minX, maxX, minZ, maxZ, ceilingY, accessibleGround,
    polygon: [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }] };
}

export const SECRET_ROOM = room('speakeasy', 'The Velvet Hour · Speakeasy', 43, 53, -24, 0);

export const CASINO_ROOMS = {
  speakeasy: SECRET_ROOM,
  casino: room('casino', 'Grand Casino', -33, 27, -20, 12, 6.8),
  lounge: room('lounge', 'The Last Call Lounge', -45, -33, -20, 4),
  cashier: room('cashier', 'Cashier', 27, 43, -20, -12),
  cashierSecure: room('cashier-secure', 'Cashier · reserved staff area', 27, 43, -12, 4, 4.8, false),
  vip: room('vip', 'High Roller Club', -28, -6, -38, -20),
  supply: room('supply', 'Supply Room', -37, -23, 35, 49),
};
export const CASINO_GROUND_POLYGONS = Object.values(CASINO_ROOMS).filter(r => r.accessibleGround).map(r => r.polygon);
export const CASINO_BOUNDS = { minX: -45, maxX: 53, minZ: -38, maxZ: 49 };
export const LOUNGE_OFFSET = { x: -50, z: -5 };
export const SERVICE_OFFSET = { x: -40, z: 35 };

export function casinoRoomName(p: CasinoPoint) {
  return Object.values(CASINO_ROOMS).find(r => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ)?.name ?? null;
}

export const CASINO_DOORS = {
  lounge: { id: 'lounge', x: -33, z: -2, w: 0.45, d: 4, h: 4.8 },
  shortcut: { id: 'shortcut', x: -33, z: -14, w: 0.45, d: 4, h: 4.8 },
  vip: { id: 'vip', x: -23, z: -20, w: 4, d: 0.45, h: 4.8 },
  vipExit: { id: 'vipExit', x: -11, z: -20, w: 4, d: 0.45, h: 4.8 },
  supply: { id: 'supply', x: -23, z: 40, w: 0.2, d: 3.4, h: 3.2 },
  cashier: { id: 'cashier', x: 27, z: -16, w: 0.45, d: 4, h: 4.8 },
} satisfies Record<string, CasinoRect>;

function horizontal(id: string, z: number, minX: number, maxX: number, h = 4.8): CasinoRect {
  return { id, x: (minX + maxX) / 2, z, w: maxX - minX, d: 0.45, h };
}
function vertical(id: string, x: number, minZ: number, maxZ: number, h = 4.8): CasinoRect {
  return { id, x, z: (minZ + maxZ) / 2, w: 0.45, d: maxZ - minZ, h };
}

export const CASINO_WALLS: CasinoRect[] = [
  horizontal('casino-wall-nw', 12, -33, -5.5, 6.8),
  horizontal('casino-wall-ne', 12, -0.5, 27, 6.8),
  { id: 'casino-lintel-hotel', x: -3, z: 12, w: 5, d: 0.45, h: 2, baseY: 4.8 },
  horizontal('casino-wall-sw', -20, -33, -25, 6.8),
  horizontal('casino-wall-sm', -20, -21, -13, 6.8),
  horizontal('casino-wall-se', -20, -9, 27, 6.8),
  vertical('casino-wall-ws', -33, -20, -16, 6.8),
  vertical('casino-wall-wm', -33, -12, -4, 6.8),
  vertical('casino-wall-wn', -33, 0, 12, 6.8),
  vertical('casino-wall-es', 27, -20, -18, 6.8),
  vertical('casino-wall-en', 27, -14, 12, 6.8),
  vertical('lounge-wall-west', -45, -20, 4),
  horizontal('lounge-wall-north', 4, -45, -33),
  horizontal('lounge-wall-south', -20, -45, -33),
  vertical('cashier-wall-east', 43, -20, 4),
  horizontal('cashier-wall-north', 4, 27, 43),
  horizontal('cashier-wall-south', -20, 27, 43),
  vertical('vip-wall-west', -28, -38, -20),
  vertical('vip-wall-east', -6, -38, -20),
  horizontal('vip-wall-south', -38, -28, -6),
  vertical('supply-wall-west', -37, 35, 49),
  horizontal('supply-wall-north', 49, -37, -23),
  horizontal('supply-wall-south', 35, -37, -23),
  // The hotel owns its unchanged west wall below Z=43. Only the supply-room
  // portion beyond that wall needs an additional east enclosure.
  vertical('supply-wall-east', -23, 43, 49),
  // Close the additional ceiling height above purchased four-metre gates.
  ...(['lounge', 'shortcut', 'vip', 'vipExit', 'cashier'] as const).map(id => ({
    ...CASINO_DOORS[id], id: `casino-lintel-${id}`, h: 2, baseY: 4.8,
  })),
];

export const CRAPS_TABLES = [
  { id: 'craps', rectId: 'craps-table', x: -15.6, z: -13.75, approachZ: -15.75 },
  { id: 'craps-b', rectId: 'craps-table-b', x: 11.4, z: -13.75, approachZ: -15.75 },
] as const;
export const ROULETTE_TABLES = [
  { id: 'roulette', rectId: 'roulette-table', x: -26.3, z: 4.25, approachZ: 2.25 },
  { id: 'roulette-b', rectId: 'roulette-table-b', x: -26.3, z: -5.75, approachZ: -7.75 },
] as const;
export const SLOT_ISLANDS: CasinoRect[] = [-17.3, -8.3, 6.7, 15.7].flatMap((x, column) =>
  [5.5, -4.5].map((z, row) => ({ id: `slots-${String.fromCharCode(97 + column * 2 + row)}`, x, z, w: 3.4, d: 5, h: 2.1 })));

export const CASINO_ANCHORS = {
  spawn: { x: -3, z: -16.5, y: 0, surfaceId: 'ground' },
  pistolAmmo: { x: 0, z: -18.5 },
  shotgun: { x: 24.9, z: -7.5 },
  smg: { x: -43.7, z: -5.2 },
  rifle: { x: -35, z: 47.5 },
  upgrade: { x: -8, z: -33.8 },
  bartender: { x: -38, z: -12.3 },
} as const;

export const CASINO_SPAWNS = {
  speakeasy: [{ x: 51.5, z: -22.5 }, { x: 51.5, z: -1.5 }],
  casino: [{ x: -31.5, z: 9.5 }, { x: 25.5, z: 9.5 }, { x: -30.5, z: -18.5 }, { x: 25.5, z: -18.5 }, { x: 10, z: 10.5 }],
  lounge: [{ x: -43.5, z: 2.5 }, { x: -43.5, z: -18.5 }],
  vip: [{ x: -26.5, z: -36.5 }, { x: -7.5, z: -36.5 }],
  supply: [{ x: -35.5, z: 36.5 }, { x: -24.5, z: 47.5 }],
  cashier: [{ x: 41.5, z: -18.5 }, { x: 41.5, z: -13.5 }],
};

export const CASINO_FIXTURES: CasinoRect[] = [
  ...SLOT_ISLANDS,
  ...CRAPS_TABLES.map(t => ({ id: t.rectId, x: t.x, z: t.z, w: 4.8, d: 2.5, h: 1.05 })),
  ...ROULETTE_TABLES.map(t => ({ id: t.rectId, x: t.x, z: t.z, w: 3.4, d: 2.5, h: 1.05 })),
  ...POKER_TABLES.map(t => ({ id: t.id, x: t.x, z: t.z, w: 3.8, d: 2.4, h: 0.95 })),
  { id: 'vip-sofa', x: -7.2, z: -27, w: 1.1, d: 5, h: 1.2 },
  { id: 'upgrade-machine', x: -7.05, z: -33.8, w: 1.1, d: 1.6, h: 1.8 },
  { id: 'cashier-counter', x: 35, z: -12.3, w: 15.8, d: 0.8, h: 1.15 },
  // Intact cashier glass passes sight but blocks actors and projectiles.
  { id: 'cashier-glass', x: 35, z: -12, w: 16, d: 0.12, h: 3.65, baseY: 1.15, transparentSight: true },
  { id: 'cashier-rear-counter', x: 35, z: -10.2, w: 11, d: 1.25, h: 1.05 },
  { id: 'cashier-safe', x: 40, z: 1.5, w: 2.1, d: 1.6, h: 2.4 },
  { id: 'cashier-shelves', x: 29, z: 2.9, w: 2.8, d: 0.7, h: 2.6 },
  { id: 'casino-bench-nw', x: -12.8, z: 10.8, w: 5, d: 1.1, h: 1.25 },
  // Wall seating keeps the hotel entrance, enemy entries, and slot aisles open.
  { id: 'casino-bench-north-west', x: -23.5, z: 10.8, w: 5, d: 1.1, h: 1.25 },
  { id: 'casino-bench-north-center', x: 3.5, z: 10.8, w: 5, d: 1.1, h: 1.25 },
  { id: 'casino-bench-north-east', x: 18.5, z: 10.8, w: 5, d: 1.1, h: 1.25 },
  { id: 'casino-bench-south-center', x: 5.5, z: -18.9, w: 5, d: 1.1, h: 1.25 },
  { id: 'casino-bench-south', x: 21, z: -18.9, w: 3.8, d: 1.1, h: 1.25 },
  { id: 'casino-planter-nw', x: -29.5, z: 10.3, w: 1, d: 1, h: 1.8 },
  { id: 'casino-planter-mid', x: 21, z: -1, w: 1, d: 1, h: 1.8 },
  { id: 'lounge-bench-north', x: -39, z: 2.9, w: 5, d: 1.1, h: 1.25 },
];
