#!/usr/bin/env node
/** Source-derived, same-scale ground/upper floor plan. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const data = JSON.parse(await readFile(path.join(root, 'docs/maps/map-data.json'), 'utf8'));
const output = path.join(root, 'docs/maps/last-jackpot-map.svg');
const W = 2270, H = 1650, SCALE = 14;
const C = { paper: '#F8F7F2', ink: '#243B39', muted: '#687872', line: '#CDD5CF', floor: '#FFFEFA', fixture: '#D0E0D4', fixtureInk: '#567868', amber: '#E3AE52', amberInk: '#63481B', spawn: '#AB635C', violet: '#978AA9', slots: '#B4D7F8', slotInk: '#3068A1', craps: '#F1BDB5', crapsInk: '#B14B43', roulette: '#D0C2EE', rouletteInk: '#756098', poker: '#C6E6AC', pokerInk: '#527C34' };
const out = [], add = s => out.push(s);
const esc = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const num = n => Number(n.toFixed(3));
const text = (x, y, value, { size = 16, fill = C.ink, weight = 400, anchor = 'start', spacing = 0, halo = false } = {}) => add(`<text x="${num(x)}" y="${num(y)}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}"${halo ? ' class="halo"' : ''}>${esc(value)}</text>`);
const line = (x1, y1, x2, y2, attrs = '') => add(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" ${attrs}/>`);
const G = { x: 80, y: 210, minX: data.bounds.minX, maxZ: data.bounds.maxZ };
const U = { x: 1600, y: 219, minX: -23, maxZ: 51 };
const xy = (p, f = G) => [f.x + (p.x - f.minX) * SCALE, f.y + (f.maxZ - p.z) * SCALE];
const poly = (polygon, frame, attrs) => add(`<polygon points="${polygon.map(p => xy(p, frame).map(num).join(',')).join(' ')}" ${attrs}/>`);
function rect(q, frame, attrs) {
  const [x, y] = xy(q, frame);
  add(`<rect x="${num(-q.w * SCALE / 2)}" y="${num(-q.d * SCALE / 2)}" width="${num(q.w * SCALE)}" height="${num(q.d * SCALE)}" transform="translate(${num(x)} ${num(y)}) rotate(${num(-(q.yaw ?? 0) * 180 / Math.PI)})" ${attrs}><title>${esc(q.id)}</title></rect>`);
}
function mapText(x, z, label, options = {}, frame = G) { const p = xy({ x, z }, frame); text(p[0], p[1], label, { anchor: 'middle', ...options }); }
function badge(x, y, label, { fill = C.ink, ink = '#FFFFFF', r = 11 } = {}) {
  add(`<circle cx="${num(x)}" cy="${num(y)}" r="${r}" fill="${fill}" stroke="${C.paper}" stroke-width="1.3"/>`);
  text(x, y + 4, label, { size: 11, fill: ink, weight: 700, anchor: 'middle' });
}
function roomLabel(room, frame = G) {
  const [x, y] = xy({ x: room.label[0], z: room.label[1] }, frame);
  const size = room.key === 'casino' ? 22 : room.key === 'hotel' ? 21 : room.key === 'cashierSecure' ? 13 : 16;
  badge(x, y - 22, room.id);
  room.lines.forEach((label, i) => text(x, y + i * (size + 3), label, { size, weight: 700, anchor: 'middle', halo: true }));
  const detail = room.key === 'cashierSecure' ? 'INACCESSIBLE · RESERVED' : room.dimensions;
  text(x, y + room.lines.length * (size + 3) + 2, detail, { size: 11, fill: C.muted, anchor: 'middle', halo: true });
}
function stairPoint(s, t, r = 4) { return { x: s.cx + s.side * Math.sin(Math.PI * t) * r, z: s.cz - Math.cos(Math.PI * t) * r }; }
function stairs(s, frame, up) {
  const polygon = [];
  for (let i = 0; i <= 40; i++) polygon.push(stairPoint(s, i / 40, s.outerRadius));
  for (let i = 40; i >= 0; i--) polygon.push(stairPoint(s, i / 40, s.innerRadius));
  poly(polygon, frame, `fill="#E3E9E1" stroke="${C.ink}" stroke-width="1.1"`);
  for (let i = 0; i <= 24; i++) line(...xy(stairPoint(s, i / 24, s.innerRadius), frame), ...xy(stairPoint(s, i / 24, s.outerRadius), frame), 'stroke="#A2B2A5" stroke-width="0.75"');
  const route = Array.from({ length: 30 }, (_, i) => xy(stairPoint(s, up ? 0.08 + i / 29 * 0.83 : 0.92 - i / 29 * 0.83), frame));
  add(`<path d="${route.map((p, i) => `${i ? 'L' : 'M'}${p.map(num).join(',')}`).join(' ')}" fill="none" stroke="${C.fixtureInk}" stroke-width="2" marker-end="url(#arrow)"/>`);
  mapText(s.cx, s.cz + 0.5, s.side < 0 ? 'STAIR A' : 'STAIR B', { size: 10, weight: 700 }, frame);
  mapText(s.cx, s.cz - 0.6, up ? 'UP +4 m' : 'DOWN', { size: 9, fill: C.muted }, frame);
}
function furnitureStyle(id) {
  if (id.startsWith('slots-')) return [C.slots, C.slotInk];
  if (id.startsWith('craps-table')) return [C.craps, C.crapsInk];
  if (id.startsWith('roulette-table')) return [C.roulette, C.rouletteInk];
  if (id.startsWith('poker-')) return [C.poker, C.pokerInk];
  return [C.fixture, C.fixtureInk];
}
function furniture(q, frame) {
  const [fill, stroke] = furnitureStyle(q.id);
  if (q.id === 'cashier-glass') return rect(q, frame, 'fill="#42A8AB" stroke="#248B8F" stroke-width="2.7"');
  rect(q, frame, `fill="${fill}" stroke="${stroke}" stroke-width="0.9"`);
}
function furnitureLabel(id, label, size = 10, frame = G) {
  const q = data.furniture.find(q => q.id === id); if (!q) return;
  mapText(q.x, q.z - 0.22, label, { size, weight: 700, fill: furnitureStyle(q.id)[1] }, frame);
}
function spawn(p, frame) {
  const [x, y] = xy(p, frame), r = 4.4;
  add(`<path d="M${x},${y-r}L${x+r},${y}L${x},${y+r}L${x-r},${y}Z" fill="${C.spawn}" stroke="${C.paper}" stroke-width="1.2"><title>${esc(p.id)} — enemy entry</title></path>`);
  if (p.door) rect(data.serviceDoors.find(q => q.id === `hotel-service-door-${p.id}`) ?? { ...p.door, id: p.id, d: 0.16 }, frame, `fill="${C.spawn}"`);
}
function separator(y) { line(1575, y, 2205, y, `stroke="${C.line}"`); }

add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">`);
add('<title id="title">The Last Jackpot — implemented casino and hotel floor plan</title><desc id="desc">Accurate two-dimensional plan of the new 60 by 32 metre starting casino, west bar, east cashier public room and inaccessible cash area, south High Roller, northwest supply, unchanged hotel lobby, upstairs restaurant and concealed luggage gallery. The Velvet Hour speakeasy connects to the cashier public room through a portrait puzzle. Forty-eight slot cabinets, two craps tables, two roulette tables, two existing flush tables and seven individually purchased doors are shown.</desc>');
add(`<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto"><path d="M0,0L7,3.5L0,7Z" fill="${C.fixtureInk}"/></marker><pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70,0H0V70" fill="none" stroke="#D4DED5" stroke-width="0.6" opacity=".6"/></pattern><pattern id="restricted" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#EBECE5"/><path d="M0,0V14" stroke="#D7DBD0" stroke-width="3"/></pattern><style>text{font-family:Arial,Helvetica,sans-serif}.halo{paint-order:stroke;stroke:${C.paper};stroke-width:4px;stroke-linejoin:round}</style></defs>`);
add(`<rect width="${W}" height="${H}" fill="${C.paper}"/>`);
add(`<rect x="55" y="42" width="5" height="72" fill="${C.fixtureInk}"/>`);
text(80, 58, 'THE LAST JACKPOT / WORLD ATLAS', { size: 14, weight: 700, spacing: 2.5, fill: C.fixtureInk });
text(77, 105, 'A grander casino. The same Grand Hotel.', { size: 37, weight: 700 });
text(2205, 60, 'IMPLEMENTED FLOOR PLAN', { size: 13, anchor: 'end', weight: 700, spacing: 1.5 });
text(2205, 91, '60 × 32 m starting casino · 48 slots · 7 paid doors', { size: 16, anchor: 'end', fill: C.muted });
line(55, 135, 2205, 135, `stroke="${C.ink}" stroke-width="1.2"`);
text(80, 171, '00 / GROUND FLOOR', { size: 17, weight: 700, spacing: 1.4 });
text(80, 194, 'All rooms in their actual positions · elevation 0 m', { size: 14, fill: C.muted });
text(1575, 171, '01 / UPSTAIRS RESTAURANT', { size: 17, weight: 700, spacing: 1.4 });
text(1575, 194, 'Elevation +4 m · same scale and orientation', { size: 14, fill: C.muted });
line(1520, 154, 1520, 1572, `stroke="${C.line}"`);

for (const room of data.rooms.filter(r => r.level === 0)) {
  poly(room.polygon, G, `fill="${room.key === 'cashierSecure' ? 'url(#restricted)' : C.floor}"`);
  if (room.key !== 'cashierSecure') poly(room.polygon, G, 'fill="url(#grid)"');
}
poly(data.mystery.polygon, G, 'fill="#E4DEED" fill-opacity=".8"');
poly(data.overhead, G, `fill="none" stroke="${C.violet}" stroke-width="1.4" stroke-dasharray="7 5"`);
for (const q of data.walls) rect(q, G, `fill="${C.ink}"`);
for (const q of data.furniture.filter(q => (q.baseY ?? 0) < 4)) furniture(q, G);
for (const bank of data.slotBanks) {
  for (const cabinet of data.slotCabinets.filter(c => c.islandId === bank.id)) rect({ id: cabinet.id, x: cabinet.rootX, z: cabinet.rootZ, w: 1.35, d: 1.35 }, G, `fill="${C.slots}" stroke="${C.slotInk}" stroke-width=".7"`);
}
for (const s of data.stairs) stairs(s, G, true);
for (const p of data.spawns.filter(p => p.y === 0)) spawn(p, G);
for (const gate of data.gates) {
  rect(gate, G, `fill="${C.amber}" stroke="${C.amberInk}" stroke-width="1"`);
  badge(...xy(gate), gate.group, { fill: C.amber, ink: C.amberInk, r: 10 });
}
for (const gate of data.mystery.gates) rect(gate, G, `fill="#B39BCD" stroke="#79569C" stroke-width="2" stroke-dasharray="4 2"`);
rect(data.casinoSecret.gate, G, `fill="#B39BCD" stroke="#79569C" stroke-width="2" stroke-dasharray="4 2"`);
for (const room of data.rooms.filter(r => r.level === 0 && r.lines)) roomLabel(room);
const ep = xy({ x: -3, z: 13.5 });
badge(ep[0], ep[1], '07', { r: 9 });
line(ep[0] + 12, ep[1], ep[0] + 72, ep[1], `stroke="${C.muted}"`);
text(ep[0] + 79, ep[1] + 4, 'Hotel Entrance', { size: 12, weight: 700, halo: true });
mapText(-4, 47.15, 'CONCEALED LUGGAGE GALLERY', { size: 10, weight: 700, fill: '#715384', halo: true });
mapText(-4, 44.5, 'RESTAURANT OVERHEAD · +4 m', { size: 10, fill: C.muted, spacing: .5, halo: true });
mapText(-4, 39.2, 'LOBBY SEATING', { size: 10, fill: C.fixtureInk, spacing: 1 });
mapText(35, -9.4, 'CASH + SAFE BEHIND GLASS', { size: 9, fill: C.muted, halo: true });
mapText(35, -1.9, 'Future stairs / trapdoor only', { size: 10, fill: C.muted, halo: true });
mapText(48, -13.3, 'PORTRAIT + KEYPAD', { size: 8, fill: '#715384', halo: true });
mapText(data.casinoSecret.anchors.mystery.x, data.casinoSecret.anchors.mystery.z + 1.8, 'MYSTERY SLOT', { size: 8, weight: 700, fill: C.fixtureInk, halo: true });
furnitureLabel('hotel-prop-reception', 'RECEPTION');
furnitureLabel('bar', 'BAR');
furnitureLabel('service-truck', 'TRUCK');
furnitureLabel('poker-a', 'FLUSH'); furnitureLabel('poker-b', 'FLUSH');
for (const t of data.crapsTables) furnitureLabel(t.rectId, 'CRAPS');
for (const t of data.rouletteTables) furnitureLabel(t.rectId, 'ROULETTE', 8);
for (const [id, label] of [['shotgun', 'S'], ['smg', 'M'], ['rifle', 'R'], ['pistolAmmo', 'P'], ['upgrade', 'U']]) {
  const purchase = data.purchases.find(p => p.id === id);
  badge(...xy(purchase), label, { r: 8 });
}
const start = xy(data.start);
add(`<circle cx="${start[0]}" cy="${start[1]}" r="6" fill="${C.fixtureInk}" stroke="${C.paper}" stroke-width="2"/><circle cx="${start[0]}" cy="${start[1]}" r="10" fill="none" stroke="${C.fixtureInk}"/>`);
text(start[0] + 17, start[1] + 4, 'PLAYER START', { size: 10, weight: 700, fill: C.fixtureInk, halo: true });

// Open space east of the hotel provides scale and preservation notes.
text(1170, 254, 'N', { size: 22, weight: 700, anchor: 'middle' });
add(`<path d="M1170 269L1158 305L1170 297L1182 305Z" fill="${C.ink}"/>`);
text(1170, 324, '+Z', { size: 11, anchor: 'middle', fill: C.muted });
text(1020, 374, 'SHARED SCALE', { size: 11, weight: 700, spacing: 1.2, fill: C.muted });
for (let i = 0; i < 4; i++) add(`<rect x="${1020 + i * 35}" y="389" width="35" height="8" fill="${i % 2 ? C.paper : C.ink}" stroke="${C.ink}"/>`);
text(1020, 416, '0', { size: 11 }); text(1090, 416, '5', { size: 11, anchor: 'middle' }); text(1160, 416, '10 m', { size: 11, anchor: 'end' });
text(1020, 473, `${data.bounds.maxX - data.bounds.minX} × ${data.bounds.maxZ - data.bounds.minZ} m`, { size: 29, weight: 700 });
text(1020, 495, 'Overall ground bounds', { size: 12, fill: C.muted });
line(1020, 520, 1290, 520, `stroke="${C.line}"`);
text(1020, 548, 'HOTEL PRESERVED', { size: 12, weight: 700, spacing: 1, fill: C.fixtureInk });
text(1020, 576, 'Same lobby octagon.', { size: 16, weight: 700 });
text(1020, 599, 'Same two curved stairs.', { size: 16, weight: 700 });
text(1020, 626, 'Only the supply connection', { size: 13, fill: C.muted });
text(1020, 646, 'changes the lobby boundary.', { size: 13, fill: C.muted });

const upper = data.rooms.find(r => r.key === 'restaurant');
poly(upper.polygon, U, `fill="${C.floor}"`);
for (const q of data.rails) rect(q, U, `fill="${C.ink}"`);
for (const q of data.furniture.filter(q => (q.baseY ?? 0) === data.upperElevation)) furniture(q, U);
for (const s of data.stairs) stairs(s, U, false);
for (const p of data.spawns.filter(p => p.y === data.upperElevation)) spawn(p, U);
roomLabel(upper, U);
for (const id of ['hotel-prop-dining-nw', 'hotel-prop-dining-ne', 'hotel-prop-dining-sw', 'hotel-prop-dining-se']) furnitureLabel(id, 'DINING', 9, U);
furnitureLabel('hotel-prop-service', 'SERVICE', 9, U);
mapText(-4, 32.9, 'OVERLOOK TO LOBBY', { size: 10, fill: C.muted }, U);
text(1575, 625, 'The restaurant sits above the rear lobby and concealed gallery.', { size: 13, fill: C.muted });
separator(646);
text(1575, 678, 'ROOM REGISTER', { size: 13, weight: 700, spacing: 1.3, fill: C.fixtureInk });
data.rooms.forEach((room, i) => {
  const x = 1575 + (i % 2) * 325, y = 710 + Math.floor(i / 2) * 48;
  badge(x + 10, y - 4, room.id, { r: 10 });
  const names = { casino: 'Grand Casino', lounge: 'Last Call Lounge', vip: 'High Roller', cashierSecure: 'Secure cash area' };
  text(x + 29, y, names[room.key] ?? room.name, { size: 13, weight: 700 });
  text(x + 29, y + 18, room.dimensions, { size: 12, fill: C.muted });
});
separator(943);
text(1575, 978, 'DOORS / INDIVIDUAL UNLOCK COST', { size: 13, weight: 700, spacing: 1.3, fill: C.fixtureInk });
data.gates.forEach((gate, i) => {
  const y = 1010 + i * 28;
  badge(1585, y - 4, gate.group, { fill: C.amber, ink: C.amberInk, r: 10 });
  text(1607, y, gate.name, { size: 14 });
  text(2205, y, `${gate.price.toLocaleString('en-US')} chips`, { size: 14, weight: 700, anchor: 'end' });
});
text(1575, 1213, 'Each door has its own purchase. Buying A does not open B;', { size: 13, fill: C.muted });
text(1575, 1233, 'buying C does not open D. Supply requires hotel access first.', { size: 13, fill: C.muted });
separator(1254);
text(1575, 1287, 'GAME FLOOR / MATCHING YOUR COLOR KEY', { size: 13, weight: 700, spacing: 1.1, fill: C.fixtureInk });
const legend = [[C.slots, C.slotInk, '48 slot cabinets / 8 banks'], [C.craps, C.crapsInk, '2 craps tables / separate wagers'], [C.roulette, C.rouletteInk, '2 roulette tables'], [C.poker, C.pokerInk, '1 flush in the casino + 1 in High Roller']];
legend.forEach(([fill, stroke, label], i) => {
  const y = 1316 + i * 25;
  add(`<rect x="1575" y="${y - 10}" width="20" height="12" rx="2" fill="${fill}" stroke="${stroke}"/>`);
  text(1607, y, label, { size: 13 });
});
text(1575, 1427, 'P  Pistol ammo     S  Shotgun     M  SMG     R  Pit Boss rifle', { size: 12, fill: C.muted });
text(1575, 1448, 'U  Upgrade workshop     ◆  Enemy entry     - -  Floor above', { size: 12, fill: C.muted });
text(1575, 1484, 'Teal barrier: intact cashier glass; actors and shots stop here.', { size: 12, fill: C.muted });
text(1575, 1505, 'Purple doors: hotel gallery key / Velvet Hour portrait puzzle.', { size: 12, fill: C.muted });
text(1575, 1526, 'Hatching: inaccessible cashier staff area reserved for later.', { size: 12, fill: C.muted });
text(1575, 1555, 'Furniture footprints are physical bounds, not mesh silhouettes.', { size: 12, fill: C.muted });

text(80, 1502, 'CENTRAL GAMES OPEN FROM THE START', { size: 13, weight: 700, spacing: 1.2, fill: C.fixtureInk });
text(80, 1527, 'Slots, craps, roulette and the first flush table fill the shared starting hall.', { size: 15, fill: C.muted });
text(80, 1550, 'Every surrounding room opens through progression. The cashier back area stays closed.', { size: 15, fill: C.muted });
line(55, 1582, 2205, 1582, `stroke="${C.ink}" stroke-width="1.2"`);
text(55, 1615, 'DRAWN FROM THE GAME', { size: 11, weight: 700, spacing: 1.3, fill: C.fixtureInk });
text(275, 1615, 'Shared casino layout · live hotel geometry · actual fixtures, purchases and spawns', { size: 12, fill: C.muted });
text(2205, 1615, 'Doors shown in their initial closed state.   /   01', { size: 12, anchor: 'end', fill: C.muted });
add('</svg>');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, out.join('\n') + '\n');
console.log(`Wrote ${output} (${W} × ${H}, shared ${SCALE} px/m scale)`);
if (process.argv.includes('--png')) {
  const require = createRequire(import.meta.url);
  const sharp = require(process.env.MAP_SHARP_MODULE || 'sharp');
  const png = path.join(root, 'docs/maps/last-jackpot-map.png');
  await sharp(output).png().toFile(png);
  console.log(`Rasterized ${png}`);
}
