/** Original period-inspired mystery-box weapons; units are seconds and metres. */
const gun = (name: string, upgradedName: string, label: string, magazine: number, reserve: number, damage: number, interval: number, reload: number, spread: number, pellets = 1) =>
  ({ name, upgradedName, label, magazine, reserve, damage, interval, reload, spread, pellets, price: 0, refill: 500 });
export const EXTRA_WEAPONS = {
  revolver: gun("HIGH ROLLER", "DIAMOND SIX", "Magnum", 6, 48, 115, .48, 2.8, .004),
  tommy: gun("CHICAGO TYPEWRITER", "MOB RULES", "Drum SMG", 50, 200, 29, .095, 3.8, .019),
  doublebarrel: gun("DOUBLE OR NOTHING", "ALL IN", "Double barrel", 2, 40, 24, .22, 2.4, .085, 10),
  dual: gun("SNAKE EYES", "PAIR OF ACES", "Twin pistols", 16, 128, 37, .14, 3.1, .025),
  machinepistol: gun("THE ENFORCER", "COLLECTION NOTICE", "Machine pistol", 32, 192, 20, .055, 2.1, .035),
  lever: gun("SILVER DOLLAR", "STERLING STANDARD", "Lever action", 8, 64, 95, .65, .55, .003),
  autoshotgun: gun("LAST CALL", "CLOSING TIME", "Auto shotgun", 5, 40, 17, .34, .65, .045, 8),
  sniper: gun("THE EYE IN THE SKY", "OMNISCIENT", "Bolt action", 5, 35, 180, 1.15, 3.2, .001),
  lmg: gun("HOUSE EDGE", "THE HOUSE ALWAYS COLLECTS", "LMG", 60, 240, 43, .115, 4.8, .018),
  launcher: gun("THE DEBT COLLECTOR", "FINAL NOTICE", "Grenade launcher", 1, 8, 220, 1, 2.8, .01),
  flare: gun("RED CARPET", "INFERNO LOUNGE", "Flare pistol", 1, 12, 100, .9, 2.2, .012),
  axe: gun("FIRE EXIT", "EVACUATION NOTICE", "Fire axe", 1, 0, 200, 1.1, 0, 0),
  stick: gun("STICKMAN", "STICKMAN", "Craps rake", 3, 0, 350, .8, 0, 0),
};
export type ExtraWeaponId = keyof typeof EXTRA_WEAPONS;
export const isMelee = (id: string) => id === "stick" || id === "axe";
export const isShellLoading = (id: string) => id === "lever" || id === "autoshotgun";
export const penetration = (id: string) => id === "sniper" ? 4 : id === "lever" ? 3 : 1;
export const weaponSpeed = (id: string) => id === "lmg" ? .78 : id === "tommy" ? .9 : id === "dual" ? 1.08 : 1;
export const muzzleLength = (id: string) => ({ revolver:.32,tommy:.54,doublebarrel:.44,dual:.26,machinepistol:.28,lever:.72,autoshotgun:.72,sniper:.85,lmg:.85,launcher:.43,flare:.23 }[id] ?? .4);
