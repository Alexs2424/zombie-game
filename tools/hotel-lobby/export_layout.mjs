/** Refresh Blender's world-space authoring inputs from the shared game layout. */
import { writeFile } from 'node:fs/promises';
import { HOTEL, HOTEL_RECTS } from '../../lib/game/world.ts';
import { HOTEL_SPAWNS } from '../../lib/game/hotel-gameplay.ts';
const dir = new URL('../../docs/hotel-assets/lobby/', import.meta.url);
await writeFile(new URL('layout.json', dir), JSON.stringify({
  stairs: HOTEL.stairs,
  rails: HOTEL_RECTS.filter(rect => rect.id.startsWith('hotel-upper-rail')),
  polygon: HOTEL.lobbyPolygon,
}, null, 2) + '\n');
await writeFile(new URL('doors.json', dir), JSON.stringify(HOTEL_SPAWNS, null, 2) + '\n');
