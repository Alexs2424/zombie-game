import { CASINO_DOORS, CASINO_WALLS } from './casino-layout.ts';

/** Main-floor portals face into their destination rooms. All widths stay 4 m. */
export const CASINO_PORTALS = (['lounge','shortcut','vip','vipExit','cashier'] as const).map(id => ({
  ...CASINO_DOORS[id],
  style: id === 'lounge' || id === 'shortcut' ? 'lounge' : id === 'cashier' ? 'cashier' : 'vip',
  title: id === 'lounge' || id === 'shortcut' ? 'THE LAST CALL' : id === 'cashier' ? 'CASHIER' : 'HIGH ROLLER CLUB',
  yaw: id === 'lounge' || id === 'shortcut' ? -Math.PI/2 : id === 'cashier' ? Math.PI/2 : Math.PI,
}));

/** Exact existing wall spans; decorative bays stop at the 42 cm portal casings. */
export const CASINO_CLADDING = CASINO_WALLS.filter(w => /^casino-wall-[swe]/.test(w.id)).map(w => {
  const yaw = w.z === -20 && w.w > w.d ? Math.PI : w.x === -33 ? -Math.PI/2 : Math.PI/2;
  const length = Math.max(w.w,w.d);
  const localDoors = CASINO_PORTALS.filter(p => p.yaw === yaw).map(p =>
    Math.cos(yaw)*(p.x-w.x)-Math.sin(yaw)*(p.z-w.z));
  return { id:w.id, x:w.x, z:w.z, yaw, length, height:w.h,
    trimStart:localDoors.some(x => Math.abs(x+length/2+2)<.001) ? .42 : 0,
    trimEnd:localDoors.some(x => Math.abs(x-length/2-2)<.001) ? .42 : 0,
    // The original large floating sign becomes an intentional architectural bay.
    featureX:w.id === 'casino-wall-se' ? 12 : null,
  };
});
