import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STATIC_RECTS, DOORS, PURCHASES, SPAWN_RECORDS, PRICES } from '../../lib/game/simulation.ts';
import { HOTEL, HOTEL_SURFACES } from '../../lib/game/world.ts';
import { CASINO_ROOMS, CASINO_ANCHORS, SLOT_ISLANDS, CRAPS_TABLES, ROULETTE_TABLES } from '../../lib/game/casino-layout.ts';
import { SLOT_MACHINE_SOURCES } from '../../lib/game/slot-machines.ts';
import { HOTEL_MYSTERY_GATES, HOTEL_MYSTERY_ANCHORS } from '../../lib/game/hotel-mystery.ts';

const rect = (minX, maxX, minZ, maxZ) => [
  { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ },
];
const casinoRoom = (key, id, label, lines) => {
  const r = CASINO_ROOMS[key];
  return { ...r, id, key, level: 0, label, lines, dimensions: `${r.maxX - r.minX} × ${r.maxZ - r.minZ} m` };
};
const rooms = [
  casinoRoom('casino', '01', [-3, 0.9], ['GRAND CASINO']),
  casinoRoom('lounge', '02', [-39, -0.6], ['Last Call', 'Lounge']),
  casinoRoom('vip', '03', [-17, -26], ['High Roller']),
  casinoRoom('cashier', '04', [35, -16], ['Cashier']),
  casinoRoom('cashierSecure', '05', [35, -4], ['SECURE CASH AREA']),
  casinoRoom('supply', '06', [-30, 37.1], ['Supply Room']),
  { id: '07', key: 'foyer', name: 'Hotel Entrance', polygon: rect(-5.5, -0.5, 12, 15), level: 0, label: [-3, 13.5], dimensions: '5 × 3 m connector' },
  { id: '08', key: 'hotel', name: 'Grand Hotel Lobby', polygon: HOTEL.lobbyPolygon, level: 0, label: [-4, 29], lines: ['Grand Hotel Lobby'], dimensions: '38 × 36 m bounds' },
  { id: '09', key: 'restaurant', name: 'Grand Hotel Restaurant', polygon: HOTEL.upperPolygon, level: HOTEL.floorY, label: [-4, 42], lines: ['Grand Hotel', 'Restaurant'], dimensions: '30 × 16.5 m bounds' },
];
const connections = [
  { id: 'lounge', from: '01', to: '02', group: 'A', name: 'Lounge · north entrance' },
  { id: 'shortcut', from: '01', to: '02', group: 'B', name: 'Lounge · south entrance' },
  { id: 'vip', from: '01', to: '03', group: 'C', name: 'High Roller · west entrance' },
  { id: 'vipExit', from: '01', to: '03', group: 'D', name: 'High Roller · east entrance' },
  { id: 'hotel', from: '01', to: '07', group: 'E', name: 'Hotel · lobby + restaurant' },
  { id: 'supply', from: '08', to: '06', group: 'F', name: 'Supply · from hotel lobby' },
  { id: 'cashier', from: '01', to: '04', group: 'G', name: 'Cashier · public room' },
];
const isWall = q => /(?:^|-)wall(?:-|$)/.test(q.id);
// Clip the existing hotel outline at its source-derived gallery wall line.
const galleryZ = STATIC_RECTS.find(q => q.id === 'hotel-gallery-wall-center').z;
const galleryPolygon = [];
for (let i = 0; i < HOTEL.lobbyPolygon.length; i++) {
  const a = HOTEL.lobbyPolygon[i], b = HOTEL.lobbyPolygon[(i + 1) % HOTEL.lobbyPolygon.length];
  if (a.z >= galleryZ) galleryPolygon.push(a);
  if ((a.z >= galleryZ) !== (b.z >= galleryZ)) {
    const t = (galleryZ - a.z) / (b.z - a.z);
    galleryPolygon.push({ x: a.x + t * (b.x - a.x), z: galleryZ });
  }
}
const vertices = rooms.filter(r => r.level === 0).flatMap(r => r.polygon);
const data = {
  source: 'hotel-lobby-prototype', generated: new Date().toISOString(), units: 'metres', north: '+Z', upperElevation: HOTEL.floorY,
  rooms, bounds: { minX: Math.min(...vertices.map(p => p.x)), maxX: Math.max(...vertices.map(p => p.x)), minZ: Math.min(...vertices.map(p => p.z)), maxZ: Math.max(...vertices.map(p => p.z)) },
  walls: STATIC_RECTS.filter(isWall),
  furniture: STATIC_RECTS.filter(q => !isWall(q) && !/rail|lintel|hotel-service-door/.test(q.id)),
  rails: STATIC_RECTS.filter(q => /hotel-upper-rail/.test(q.id)),
  serviceDoors: STATIC_RECTS.filter(q => /hotel-service-door/.test(q.id)),
  gates: connections.map(c => ({ ...c, ...DOORS[c.id], price: PRICES[c.id] })),
  openPassages: [{ id: 'foyer-lobby', from: '07', to: '08', x: -3, z: 15, w: 5, d: 0.2 }],
  stairs: HOTEL.stairs, overhead: HOTEL.upperPolygon,
  foyerSurface: HOTEL_SURFACES.find(s => s.id === 'hotel-foyer').polygon,
  purchases: PURCHASES,
  spawns: SPAWN_RECORDS.map(({ room, position }, i) => ({ ...position, room, id: position.id ?? `${room}-spawn-${i + 1}`, y: position.y ?? 0 })),
  start: CASINO_ANCHORS.spawn,
  slotBanks: SLOT_ISLANDS, slotCabinets: SLOT_MACHINE_SOURCES, crapsTables: CRAPS_TABLES, rouletteTables: ROULETTE_TABLES,
  mystery: { polygon: galleryPolygon, gates: HOTEL_MYSTERY_GATES, anchors: HOTEL_MYSTERY_ANCHORS },
  notes: [
    'Geometry and prices come directly from the implemented game modules. The starting casino is 60 × 32 m.',
    'Only the central casino is initially accessible. Every gold door is purchased separately.',
    'Cashier rear area is inaccessible. Future stairs and trapdoor are reserved only, with no playable level.',
    'The concealed hotel luggage gallery is preserved; both hidden panels open through the existing key puzzle.',
    'Furniture shows collision footprints, not model silhouettes. Glass is shown at its actual barrier line.',
    'Restaurant overlaps the rear lobby at +4 m; the lobby octagon and curved stairs are unchanged.',
  ],
};
const destination = fileURLToPath(new URL('../../docs/maps/map-data.json', import.meta.url));
writeFileSync(destination, JSON.stringify(data, null, 2) + '\n');
console.log(`Exported ${rooms.length} named areas, ${data.slotCabinets.length} cabinets, ${data.gates.length} paid doors: ${destination}`);
