/** Shared, deterministic hotel geometry, layered walking and navigation. Y is foot height. */
import { HOTEL_FIXTURES } from './hotel-fixtures.ts';
import { HOTEL_AMMO_CRATE, HOTEL_GATE, HOTEL_SERVICE_DOORS } from './hotel-gameplay.ts';
import { HOTEL_MYSTERY_GATES } from './hotel-mystery.ts';
import { HOTEL_RENOVATION_SOLIDS } from './hotel-renovation-layout.ts';
import { CASINO_DOORS, CASINO_GROUND_POLYGONS, CASINO_ROOMS } from './casino-layout.ts';
import { SECRET_DOOR } from './casino.ts';
export type WorldPosition = { x: number; z: number; y?: number; surfaceId?: string };
export type WorldVector = { x: number; y: number; z: number };
export type WorldRect = { id: string; x: number; z: number; w: number; d: number; h: number; baseY?: number; yaw?: number; transparentSight?: boolean };
export type Point = { x: number; z: number };
export type Stair = { id: string; cx: number; cz: number; side: number; innerRadius: number; outerRadius: number; bottomY: number; topY: number };
const points = (pairs: number[][]): Point[] => pairs.map(([x, z]) => ({ x, z }));
export const HOTEL = {
  center: { x: -4, z: 30 }, floorY: 4, ceilingY: 8.8,
  entrance: { x: -3, z: 12, w: 5 },
  foyer: { minX: -5.5, maxX: -0.5, minZ: 11.5, maxZ: 17 },
  lobbyPolygon: points([[-15, 15], [7, 15], [15, 23], [15, 43], [7, 51], [-15, 51], [-23, 43], [-23, 23]]),
  upperPolygon: points([[-15, 32.5], [7, 32.5], [7, 35.5], [11, 35.5], [11, 45], [6, 49], [-14, 49], [-19, 45], [-19, 35.5], [-15, 35.5]]),
  stairs: [
    { id: 'hotel-stair-left', cx: -15, cz: 30, side: -1, innerRadius: 2.5, outerRadius: 5.5, bottomY: 0, topY: 4 },
    { id: 'hotel-stair-right', cx: 7, cz: 30, side: 1, innerRadius: 2.5, outerRadius: 5.5, bottomY: 0, topY: 4 },
  ] as Stair[],
};
const FOYER = points([[-5.5, 11.5], [-0.5, 11.5], [-0.5, 17], [-5.5, 17]]);
export const HOTEL_SURFACES = [
  { id: 'hotel-foyer', kind: 'flat' as const, y: 0, polygon: FOYER },
  { id: 'hotel-lobby', kind: 'flat' as const, y: 0, polygon: HOTEL.lobbyPolygon },
  { id: 'hotel-upper', kind: 'flat' as const, y: 4, polygon: HOTEL.upperPolygon },
  ...HOTEL.stairs.map(stair => ({ kind: 'stair' as const, ...stair })),
];
export function stairPoint(stair: Stair, t: number, radius = 4): WorldPosition & { y: number; surfaceId: string } {
  return { x: stair.cx + stair.side * Math.sin(Math.PI * t) * radius, z: stair.cz - Math.cos(Math.PI * t) * radius, y: stair.bottomY + (stair.topY - stair.bottomY) * t, surfaceId: stair.id };
}
function wall(id: string, a: Point, b: Point, h: number, baseY = 0, thickness = 0.2): WorldRect {
  return { id, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: Math.hypot(b.x - a.x, b.z - a.z), d: thickness, h, baseY, yaw: Math.atan2(b.z - a.z, b.x - a.x) };
}
function makeHotelRects() {
  const rects: WorldRect[] = [];
  const polygon = HOTEL.lobbyPolygon;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (i === 0) {
      rects.push(wall('hotel-wall-0-left', a, { x: -5.5, z: 15 }, 8.8));
      rects.push(wall('hotel-wall-0-right', { x: -0.5, z: 15 }, b, 8.8));
    } else if (i === 6) {
      // The only lobby change: a supply-room connection beyond the curved stair.
      rects.push(wall('hotel-wall-6-north', a, { x: -23, z: 41.7 }, 8.8));
      rects.push(wall('hotel-wall-6-south', { x: -23, z: 38.3 }, b, 8.8));
      rects.push(wall('hotel-supply-lintel', { x: -23, z: 41.7 }, { x: -23, z: 38.3 }, 5.6, 3.2));
    } else rects.push(wall(`hotel-wall-${i}`, a, b, 8.8));
  }
  rects.push(wall('hotel-foyer-wall-left', { x: -5.5, z: 12 }, { x: -5.5, z: 15 }, 4.8));
  rects.push(wall('hotel-foyer-wall-right', { x: -0.5, z: 12 }, { x: -0.5, z: 15 }, 4.8));
  rects.push({ id: 'hotel-entry-lintel', x: -3, z: 12.23, w: 5, d: 0.52, baseY: 3.07, h: 1.8 });
  rects.push({ id: 'hotel-foyer-lintel', x: -3, z: 14.95, w: 5, d: 0.32, baseY: 3.17, h: 1.6 });
  for (const stair of HOTEL.stairs) for (const [edge, radius] of [['inner', stair.innerRadius], ['outer', stair.outerRadius]] as const) {
    for (let i = 0; i < 28; i++) {
      const a = stairPoint(stair, i / 28, radius), b = stairPoint(stair, (i + 1) / 28, radius);
      rects.push(wall(`${stair.id}-rail-${edge}-${i}`, a, b, 1.18 + b.y - a.y, a.y, 0.12));
    }
  }
  for (let i = 0; i < HOTEL.upperPolygon.length; i++) {
    // These two radial edges are the stair-to-mezzanine openings.
    if (i === 1 || i === 9) continue;
    rects.push(wall(`hotel-upper-rail-${i}`, HOTEL.upperPolygon[i], HOTEL.upperPolygon[(i + 1) % HOTEL.upperPolygon.length], 1.15, 4, 0.14));
  }
  rects.push(...HOTEL_FIXTURES.map(f => ({ ...f, h: f.collisionH ?? f.h })));
  rects.push(...HOTEL_RENOVATION_SOLIDS);
  rects.push(HOTEL_AMMO_CRATE);
  rects.push(...HOTEL_SERVICE_DOORS);
  return rects;
}
export const HOTEL_RECTS = makeHotelRects();
export function hotelRoomName(p: WorldPosition): string | null {
  if (!pointInPolygon(p, FOYER) && !pointInPolygon(p, HOTEL.lobbyPolygon)) return null;
  if (p.surfaceId?.startsWith('hotel-stair')) return 'Grand Hotel Staircase';
  if ((p.y ?? 0) > 3.8) return 'Grand Hotel Restaurant';
  return p.z < 15 ? 'Hotel Entrance' : 'Grand Hotel Lobby';
}
function pointInPolygon(p: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const cross = (p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x);
    if (Math.abs(cross) < 1e-7 && p.x >= Math.min(a.x, b.x) - 1e-7 && p.x <= Math.max(a.x, b.x) + 1e-7 && p.z >= Math.min(a.z, b.z) - 1e-7 && p.z <= Math.max(a.z, b.z) + 1e-7) return true;
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function stairAt(p: Point, stair: Stair, strictSide = true) {
  const dx = (p.x - stair.cx) * stair.side, dz = p.z - stair.cz;
  if (strictSide && dx < -1e-7) return null;
  const radius = Math.hypot(dx, dz);
  if (radius < stair.innerRadius - 1e-7 || radius > stair.outerRadius + 1e-7) return null;
  const t = Math.atan2(Math.max(0, dx), -dz) / Math.PI;
  return { t, radius, y: stair.bottomY + (stair.topY - stair.bottomY) * t };
}
function groundContains(p: Point) {
  if (!(CASINO_GROUND_POLYGONS.some(polygon => pointInPolygon(p, polygon)) || pointInPolygon(p, FOYER) || pointInPolygon(p, HOTEL.lobbyPolygon))) return false;
  return !HOTEL.stairs.some(s => {
    const q = stairAt(p, s);
    return q && q.t > 1e-5;
  });
}
function surfaceId(p: WorldPosition) {
  if (p.surfaceId?.startsWith('hotel-stair')) return p.surfaceId;
  return (p.y ?? 0) > 3.7 ? 'hotel-upper' : 'ground';
}
function supported(p: WorldPosition, radius: number) {
  const id = surfaceId(p);
  const stair = HOTEL.stairs.find(s => s.id === id);
  if (stair) {
    const q = stairAt(p, stair);
    return !!q && q.radius >= stair.innerRadius + radius && q.radius <= stair.outerRadius - radius && Math.abs((p.y ?? q.y) - q.y) < 0.2;
  }
  const contains = id === 'hotel-upper' ? (q: Point) => pointInPolygon(q, HOTEL.upperPolygon) || HOTEL.stairs.some(s => { const a = stairAt(q, s); return a && a.t > 0.965; }) : (q: Point) => groundContains(q) || HOTEL.stairs.some(s => { const a = stairAt(q, s); return a && a.t < 0.035; });
  if (!contains(p)) return false;
  for (let i = 0; i < 8; i++) if (!contains({ x: p.x + Math.cos(i * Math.PI / 4) * radius, z: p.z + Math.sin(i * Math.PI / 4) * radius })) return false;
  return true;
}
function resolveStep(from: WorldPosition, x: number, z: number): WorldPosition | null {
  const fromId = surfaceId(from), previousY = from.y ?? 0;
  const p = { x, z };
  if (fromId === 'ground' && groundContains(p)) return { ...p, y: 0, surfaceId: 'ground' };
  if (fromId === 'hotel-upper' && pointInPolygon(p, HOTEL.upperPolygon)) return { ...p, y: 4, surfaceId: 'hotel-upper' };
  const oldStair = HOTEL.stairs.find(s => s.id === fromId);
  if (oldStair) {
    const q = stairAt(p, oldStair);
    if (q && Math.abs(q.y - previousY) < 0.22) return { ...p, y: q.y, surfaceId: fromId };
    if (previousY < 0.22 && groundContains(p) && z < oldStair.cz) return { ...p, y: 0, surfaceId: 'ground' };
    if (previousY > 3.78 && pointInPolygon(p, HOTEL.upperPolygon) && z > oldStair.cz) return { ...p, y: 4, surfaceId: 'hotel-upper' };
    return null;
  }
  for (const stair of HOTEL.stairs) {
    const q = stairAt(p, stair);
    if (!q) continue;
    if ((fromId === 'ground' && q.t < 0.055) || (fromId === 'hotel-upper' && q.t > 0.945)) return { ...p, y: q.y, surfaceId: stair.id };
  }
  return null;
}
type SpatialRects = { bins: Map<string, WorldRect[]> };
const rectCache = new WeakMap<WorldRect[], SpatialRects>();
const BIN = 4;
function spatial(rects: WorldRect[]) {
  let cache = rectCache.get(rects);
  if (cache) return cache;
  cache = { bins: new Map() };
  for (const q of rects) {
    const c = Math.abs(Math.cos(q.yaw ?? 0)), s = Math.abs(Math.sin(q.yaw ?? 0));
    const hw = (q.w * c + q.d * s) / 2, hd = (q.w * s + q.d * c) / 2;
    for (let x = Math.floor((q.x - hw) / BIN); x <= Math.floor((q.x + hw) / BIN); x++) for (let z = Math.floor((q.z - hd) / BIN); z <= Math.floor((q.z + hd) / BIN); z++) {
      const key = `${x},${z}`, list = cache.bins.get(key) ?? [];
      list.push(q); cache.bins.set(key, list);
    }
  }
  rectCache.set(rects, cache); return cache;
}
function solidCollision(p: WorldPosition, r: number, rects: WorldRect[], height = 1.75) {
  const cache = spatial(rects), y = p.y ?? 0;
  for (let x = Math.floor((p.x - r) / BIN); x <= Math.floor((p.x + r) / BIN); x++) for (let z = Math.floor((p.z - r) / BIN); z <= Math.floor((p.z + r) / BIN); z++) for (const q of cache.bins.get(`${x},${z}`) ?? []) {
    const base = q.baseY ?? 0;
    if (y + height <= base + 0.01 || y >= base + q.h - 0.01) continue;
    const c = Math.cos(q.yaw ?? 0), s = Math.sin(q.yaw ?? 0), dx = p.x - q.x, dz = p.z - q.z;
    const lx = c * dx + s * dz, lz = -s * dx + c * dz;
    const ex = Math.max(0, Math.abs(lx) - q.w / 2), ez = Math.max(0, Math.abs(lz) - q.d / 2);
    if (ex * ex + ez * ez < r * r) return true;
  }
  return false;
}
export function collides(p: WorldPosition, r: number, rects: WorldRect[]) {
  return !supported(p, r) || solidCollision(p, r, rects);
}
export function moveActor(p: WorldPosition, dx: number, dz: number, r: number, rects: WorldRect[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.10));
  for (let i = 0; i < steps; i++) {
    // Try the actual diagonal first: axis-only movement on curved surfaces can snag at a mouth.
    let q = resolveStep(p, p.x + dx / steps, p.z + dz / steps);
    if (q && !collides(q, r, rects)) { Object.assign(p, q); continue; }
    q = resolveStep(p, p.x + dx / steps, p.z);
    if (q && !collides(q, r, rects)) Object.assign(p, q);
    q = resolveStep(p, p.x, p.z + dz / steps);
    if (q && !collides(q, r, rects)) Object.assign(p, q);
  }
}
export function canWalkDirect(a: WorldPosition, b: WorldPosition, r: number, rects: WorldRect[]) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-7) return Math.abs((a.y ?? 0) - (b.y ?? 0)) < 0.15 && !collides(a, r, rects);
  const p = { ...a }, steps = Math.max(1, Math.ceil(len / 0.18));
  for (let i = 1; i <= steps; i++) {
    const q = resolveStep(p, a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps);
    if (!q || collides(q, r, rects)) return false;
    Object.assign(p, q);
  }
  return Math.abs((p.y ?? 0) - (b.y ?? 0)) < 0.2;
}
export function rayBox(o: WorldVector, d: WorldVector, min: WorldVector, max: WorldVector) {
  let near = 0, far = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    if (Math.abs(d[axis]) < 1e-8) { if (o[axis] < min[axis] || o[axis] > max[axis]) return Infinity; }
    else {
      let a = (min[axis] - o[axis]) / d[axis], b = (max[axis] - o[axis]) / d[axis];
      if (a > b) [a, b] = [b, a]; near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) return Infinity;
    }
  }
  return far >= 0 ? near : Infinity;
}
type RayHit = { distance: number; normal: WorldVector };
function rectHit(o: WorldVector, d: WorldVector, q: WorldRect): RayHit | null {
  const c = Math.cos(q.yaw ?? 0), s = Math.sin(q.yaw ?? 0), dx = o.x - q.x, dz = o.z - q.z;
  const lo = { x: c * dx + s * dz, y: o.y, z: -s * dx + c * dz }, ld = { x: c * d.x + s * d.z, y: d.y, z: -s * d.x + c * d.z };
  const min = { x: -q.w / 2, y: q.baseY ?? 0, z: -q.d / 2 }, max = { x: q.w / 2, y: (q.baseY ?? 0) + q.h, z: q.d / 2 };
  const distance = rayBox(lo, ld, min, max);
  if (!Number.isFinite(distance)) return null;
  const p = { x: lo.x + distance * ld.x, y: lo.y + distance * ld.y, z: lo.z + distance * ld.z };
  let axis: 'x' | 'y' | 'z' = 'x', sign = -1, error = Infinity;
  for (const a of ['x', 'y', 'z'] as const) for (const edge of [-1, 1]) {
    const e = Math.abs(p[a] - (edge === -1 ? min[a] : max[a]));
    if (e < error) { error = e; axis = a; sign = edge; }
  }
  const n = { x: 0, y: 0, z: 0 }; n[axis] = sign;
  return { distance, normal: { x: c * n.x - s * n.z, y: n.y, z: s * n.x + c * n.z } };
}
const sub = (a: WorldVector, b: WorldVector) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: WorldVector, b: WorldVector) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: WorldVector, b: WorldVector) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
function triangleHit(o: WorldVector, d: WorldVector, a: WorldVector, b: WorldVector, c: WorldVector): RayHit | null {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-8) return null;
  const t = sub(o, a), u = dot(t, p) / det;
  if (u < -1e-7 || u > 1 + 1e-7) return null;
  const q = cross(t, e1), v = dot(d, q) / det;
  if (v < -1e-7 || u + v > 1 + 1e-7) return null;
  const distance = dot(e2, q) / det;
  if (distance < 0.00001) return null;
  const n = cross(e1, e2), len = Math.hypot(n.x, n.y, n.z), sign = dot(n, d) > 0 ? -1 : 1;
  return { distance, normal: { x: n.x / len * sign, y: n.y / len * sign, z: n.z / len * sign } };
}
const stairTriangles: [WorldVector, WorldVector, WorldVector][] = [];
const upperEdgeTriangles: [WorldVector, WorldVector, WorldVector][] = [];
function verticalFace(target: [WorldVector, WorldVector, WorldVector][], a: WorldVector, b: WorldVector, base = 0) {
  const c = { ...b, y: base }, d = { ...a, y: base };
  target.push([a, b, c], [a, c, d]);
}
for (const stair of HOTEL.stairs) for (let i = 0; i < 56; i++) {
  const a = stairPoint(stair, i / 56, stair.innerRadius), b = stairPoint(stair, i / 56, stair.outerRadius), c = stairPoint(stair, (i + 1) / 56, stair.outerRadius), d = stairPoint(stair, (i + 1) / 56, stair.innerRadius);
  stairTriangles.push([a, b, c], [a, c, d]);
  verticalFace(stairTriangles, a, d);
  verticalFace(stairTriangles, b, c);
  if (i === 55) verticalFace(stairTriangles, d, c);
}
for (let i = 0; i < HOTEL.upperPolygon.length; i++) verticalFace(upperEdgeTriangles, { ...HOTEL.upperPolygon[i], y: 4 }, { ...HOTEL.upperPolygon[(i + 1) % HOTEL.upperPolygon.length], y: 4 }, 3.72);
function polygonBounds(polygon: Point[]) {
  return { minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)), minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) };
}
const stairRayBounds = {
  min: { x: Math.min(...HOTEL.stairs.map(s => s.cx - s.outerRadius)), y: Math.min(...HOTEL.stairs.map(s => s.bottomY)), z: Math.min(...HOTEL.stairs.map(s => s.cz - s.outerRadius)) },
  max: { x: Math.max(...HOTEL.stairs.map(s => s.cx + s.outerRadius)), y: Math.max(...HOTEL.stairs.map(s => s.topY)), z: Math.max(...HOTEL.stairs.map(s => s.cz + s.outerRadius)) },
};
const upperBounds = polygonBounds(HOTEL.upperPolygon);
/** Floors and their undersides occlude rays, as do the shared wall/guard colliders. */
export function raycastWorld(o: WorldVector, d: WorldVector, rects: WorldRect[], maxDistance = Infinity, sightOnly = false): RayHit | null {
  let best: RayHit | null = null;
  const accept = (hit: RayHit | null) => { if (hit && hit.distance <= maxDistance && (!best || hit.distance < best.distance)) best = hit; };
  for (const q of rects) if (!sightOnly || !q.transparentSight) accept(rectHit(o, d, q));
  if (Math.abs(d.y) > 1e-8) {
    const casinoPlanes = Object.values(CASINO_ROOMS).flatMap(room => [[0, room.polygon], [room.ceilingY, room.polygon]] as const);
    for (const [y, polygon] of [...casinoPlanes, [0, FOYER], [4.77, FOYER], [0, HOTEL.lobbyPolygon], [8.8, HOTEL.lobbyPolygon], [4, HOTEL.upperPolygon], [3.72, HOTEL.upperPolygon]] as const) {
      const distance = (y - o.y) / d.y;
      if (distance > 0.00001 && distance <= maxDistance && pointInPolygon({ x: o.x + d.x * distance, z: o.z + d.z * distance }, polygon)) accept({ distance, normal: { x: 0, y: d.y < 0 ? 1 : -1, z: 0 } });
    }
  }
  // Derive broadphase bounds from the same geometry as rendering/navigation.
  const stairDistance = rayBox(o, d, stairRayBounds.min, stairRayBounds.max);
  if (Number.isFinite(stairDistance) && stairDistance <= maxDistance) for (const t of stairTriangles) accept(triangleHit(o, d, ...t));
  const upperDistance = rayBox(o, d, { x: upperBounds.minX, y: 3.72, z: upperBounds.minZ }, { x: upperBounds.maxX, y: 4, z: upperBounds.maxZ });
  if (Number.isFinite(upperDistance) && upperDistance <= maxDistance) for (const t of upperEdgeTriangles) accept(triangleHit(o, d, ...t));
  return best;
}
export function wallDistance(o: WorldVector, d: WorldVector, rects: WorldRect[]) { return raycastWorld(o, d, rects)?.distance ?? Infinity; }
export function hasSight(a: WorldPosition, b: WorldPosition, rects: WorldRect[], height = 1) {
  const o = { x: a.x, y: (a.y ?? 0) + height, z: a.z }, delta = { x: b.x - a.x, y: (b.y ?? 0) - (a.y ?? 0), z: b.z - a.z };
  const len = Math.hypot(delta.x, delta.y, delta.z);
  return len < 0.001 || !raycastWorld(o, { x: delta.x / len, y: delta.y / len, z: delta.z / len }, rects, len - 0.05, true);
}

const NAV_STEP = 0.6;
const navigationBounds = polygonBounds([...CASINO_GROUND_POLYGONS.flat(), ...FOYER, ...HOTEL.lobbyPolygon, ...HOTEL.upperPolygon]);
const NAV_MIN_X = Math.floor(navigationBounds.minX / NAV_STEP) * NAV_STEP;
const NAV_MIN_Z = Math.floor(navigationBounds.minZ / NAV_STEP) * NAV_STEP;
const NAV_NX = Math.ceil((navigationBounds.maxX - NAV_MIN_X) / NAV_STEP);
const NAV_NZ = Math.ceil((navigationBounds.maxZ - NAV_MIN_Z) / NAV_STEP);
type NavGeometry = { nodes: WorldPosition[]; cells: Map<string, number[]>; edges: number[][] };
type NavBuild = {
  blocked: Uint8Array;
  edges: number[][];
  staticKey: string;
  doors: Map<string, WorldRect> | null;
};
let navGeometry: NavGeometry | null = null;
// Gate states recur when runs restart and in independent simulations. Keep the
// bounded cache separate from the mutable target-distance field of each run.
const navRebuildCache = new Map<string, NavBuild>();
const navigationDoorIds = new Set([
  ...Object.values(CASINO_DOORS), HOTEL_GATE, ...HOTEL_MYSTERY_GATES, SECRET_DOOR,
].map(door => door.id));
const navRectKey = (q: WorldRect) => [q.id, q.x, q.z, q.w, q.d, q.h, q.baseY ?? 0, q.yaw ?? 0].join(',');
function gridKey(x: number, z: number) { return `${x},${z}`; }
function gridPosition(p: Point) { return { x: Math.floor((p.x - NAV_MIN_X) / NAV_STEP), z: Math.floor((p.z - NAV_MIN_Z) / NAV_STEP) }; }
function makeNavGeometry(): NavGeometry {
  if (navGeometry) return navGeometry;
  const nodes: WorldPosition[] = [], cells = new Map<string, number[]>(), edges: number[][] = [];
  for (let iz = 0; iz < NAV_NZ; iz++) for (let ix = 0; ix < NAV_NX; ix++) {
    const x = NAV_MIN_X + (ix + 0.5) * NAV_STEP, z = NAV_MIN_Z + (iz + 0.5) * NAV_STEP;
    const candidates: WorldPosition[] = [];
    if (groundContains({ x, z })) candidates.push({ x, z, y: 0, surfaceId: 'ground' });
    if (pointInPolygon({ x, z }, HOTEL.upperPolygon)) candidates.push({ x, z, y: 4, surfaceId: 'hotel-upper' });
    for (const stair of HOTEL.stairs) { const q = stairAt({ x, z }, stair); if (q) candidates.push({ x, z, y: q.y, surfaceId: stair.id }); }
    for (const p of candidates) if (supported(p, 0.34)) {
      const i = nodes.length, key = gridKey(ix, iz), list = cells.get(key) ?? [];
      nodes.push(p); edges.push([]); list.push(i); cells.set(key, list);
    }
  }
  const noRects: WorldRect[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i], cell = gridPosition(p);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      for (const j of cells.get(gridKey(cell.x + dx, cell.z + dz)) ?? []) if (j > i && Math.abs((p.y ?? 0) - (nodes[j].y ?? 0)) < 0.5 && canWalkDirect(p, nodes[j], 0.34, noRects) && canWalkDirect(nodes[j], p, 0.34, noRects)) {
        edges[i].push(j); edges[j].push(i);
      }
    }
  }
  navGeometry = { nodes, cells, edges }; return navGeometry;
}
/** One shared layered flow field: overlapping floors have different nodes. */
export class Navigation {
  readonly step = NAV_STEP;
  readonly nx = NAV_NX;
  readonly nz = NAV_NZ;
  readonly blocked: Uint8Array;
  readonly distance: Int32Array;
  private readonly geometry = makeNavGeometry();
  private readonly queue: Int32Array;
  private rects: WorldRect[] = [];
  private edges: number[][];
  private lastBuild?: NavBuild;
  constructor() {
    this.blocked = new Uint8Array(this.geometry.nodes.length);
    this.distance = new Int32Array(this.geometry.nodes.length); this.distance.fill(-1);
    this.queue = new Int32Array(this.geometry.nodes.length);
    this.edges = this.geometry.edges;
  }
  point(i: number): WorldPosition { return { ...this.geometry.nodes[Math.max(0, i)] }; }
  index(p: WorldPosition) {
    const cell = gridPosition(p), y = p.y ?? 0;
    let best = -1, score = Infinity;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const i of this.geometry.cells.get(gridKey(cell.x + dx, cell.z + dz)) ?? []) {
      const q = this.geometry.nodes[i], dy = Math.abs((q.y ?? 0) - y);
      if (dy > 0.6 || this.blocked[i]) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z) + dy * 2;
      if (d < score) { score = d; best = i; }
    }
    if (best >= 0) return best;
    // Recovery for a caller testing a point just inside an obstacle or doorway.
    for (let i = 0; i < this.geometry.nodes.length; i++) if (!this.blocked[i]) {
      const q = this.geometry.nodes[i], dy = Math.abs((q.y ?? 0) - y);
      if (dy > 0.6) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z) + dy * 2;
      if (d < score) { score = d; best = i; }
    }
    return Math.max(0, best);
  }
  rebuild(rects: WorldRect[]) {
    this.rects = rects;
    // Rebuild also supports callers editing an existing collider array in place.
    rectCache.delete(rects);
    const key = rects.map(navRectKey).join(';');
    const cached = navRebuildCache.get(key);
    if (cached) {
      this.blocked.set(cached.blocked); this.edges = cached.edges; this.lastBuild = cached; return;
    }
    const staticKey = rects.filter(q => !navigationDoorIds.has(q.id)).map(navRectKey).join(';');
    const doorRects = rects.filter(q => navigationDoorIds.has(q.id));
    // Copies retain old bounds even if a caller later moves the same door object.
    const doors = new Map(doorRects.map(q => [q.id, { ...q }]));
    const prior = this.lastBuild;
    if (prior?.doors && prior.staticKey === staticKey && doors.size === doorRects.length) {
      const changed: WorldRect[] = [];
      for (const [id, door] of prior.doors) {
        const next = doors.get(id);
        if (!next || navRectKey(door) !== navRectKey(next)) changed.push(door);
      }
      for (const [id, door] of doors) {
        const previous = prior.doors.get(id);
        if (!previous || navRectKey(door) !== navRectKey(previous)) changed.push(door);
      }
      const affected = new Set<number>();
      for (const door of changed) {
        const c = Math.abs(Math.cos(door.yaw ?? 0)), s = Math.abs(Math.sin(door.yaw ?? 0));
        // A collision can affect an edge only if its source is within one grid
        // step of the door's radius-expanded bounds. Include every floor here:
        // the unchanged collision test still decides vertical overlap/stairs.
        const pad = 0.34 + NAV_STEP + 1e-7;
        const hw = (door.w * c + door.d * s) / 2 + pad;
        const hd = (door.w * s + door.d * c) / 2 + pad;
        const lo = gridPosition({ x: door.x - hw, z: door.z - hd });
        const hi = gridPosition({ x: door.x + hw, z: door.z + hd });
        for (let x = lo.x; x <= hi.x; x++) for (let z = lo.z; z <= hi.z; z++)
          for (const i of this.geometry.cells.get(gridKey(x, z)) ?? []) affected.add(i);
      }
      this.blocked.set(prior.blocked);
      // Copy the outer array and replace only affected neighbor lists; other
      // simulations and cached door states may still own the previous graph.
      this.edges = prior.edges.slice();
      for (const i of affected) this.blocked[i] = +solidCollision(this.geometry.nodes[i], 0.34, rects);
      for (const i of affected) this.edges[i] = this.blocked[i] ? [] : this.geometry.edges[i].filter(j =>
        !this.blocked[j] && canWalkDirect(this.geometry.nodes[i], this.geometry.nodes[j], 0.34, rects));
    } else {
      // Initial construction and changes to static scenery retain the complete
      // rebuild, so this optimization cannot conceal a moved wall or fixture.
      for (let i = 0; i < this.blocked.length; i++) this.blocked[i] = +solidCollision(this.geometry.nodes[i], 0.34, rects);
      this.edges = this.geometry.edges.map((neighbors, i) => this.blocked[i] ? [] : neighbors.filter(j => !this.blocked[j] && canWalkDirect(this.geometry.nodes[i], this.geometry.nodes[j], 0.34, rects)));
    }
    this.lastBuild = {
      blocked: this.blocked.slice(), edges: this.edges, staticKey,
      doors: doors.size === doorRects.length ? doors : null,
    };
    if (navRebuildCache.size >= 32) navRebuildCache.delete(navRebuildCache.keys().next().value!);
    navRebuildCache.set(key, this.lastBuild);
  }
  update(target: WorldPosition) {
    this.distance.fill(-1);
    const start = this.index(target); this.queue[0] = start; this.distance[start] = 0;
    let head = 0, tail = 1;
    while (head < tail) {
      const cur = this.queue[head++];
      for (const n of this.edges[cur]) if (this.distance[n] === -1) { this.distance[n] = this.distance[cur] + 1; this.queue[tail++] = n; }
    }
  }
  neighbors(i: number) { return this.edges[i] ?? []; }
  next(p: WorldPosition) {
    const i = this.index(p);
    let best = i, score = this.distance[i] >= 0 ? this.distance[i] : Infinity;
    for (const n of this.edges[i]) if (this.distance[n] >= 0 && this.distance[n] < score && canWalkDirect(p, this.geometry.nodes[n], 0.3, this.rects)) { score = this.distance[n]; best = n; }
    return this.point(best);
  }
}
