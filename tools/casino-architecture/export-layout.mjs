import { writeFile } from 'node:fs/promises';
import { CASINO_CLADDING, CASINO_PORTALS } from '../../lib/game/casino-architecture-layout.ts';
await writeFile(new URL('../../docs/casino-architecture/layout.json',import.meta.url),
  JSON.stringify({walls:CASINO_CLADDING,portals:CASINO_PORTALS},null,2)+'\n');
