/** Original period-inspired mystery-box weapons (docs/weapon-spec-1970s.md); units are seconds and metres. */
const gun = (name: string, upgradedName: string, label: string, magazine: number, reserve: number, damage: number, interval: number, reload: number, spread: number, pellets = 1) =>
  ({ name, upgradedName, label, magazine, reserve, damage, interval, reload, spread, pellets, price: 0, refill: 500 });
// The spec's `revolver` id is taken by the poker table's Dead Man's Hand, so High Roller ships as `magnum`.
export const EXTRA_WEAPONS = {
  magnum: gun("HIGH ROLLER", "DIAMOND SIX", "Magnum", 6, 48, 160, .52, 2.9, .003),
  // Shared by the hotel reward and Mystery Box; preserve the hotel's tuning.
  tommy: gun("THE CHICAGO TYPEWRITER", "THE HOUSE COLLECTOR", "Drum SMG", 50, 250, 30, .105, 3, .017),
  doublebarrel: gun("DOUBLE OR NOTHING", "ALL IN", "Double barrel", 2, 40, 24, .2, 2.4, .085, 10),
  dual: gun("SNAKE EYES", "PAIR OF ACES", "Twin pistols", 16, 128, 34, .13, 3.1, .028),
  machinepistol: gun("THE ENFORCER", "COLLECTION NOTICE", "Machine pistol", 32, 192, 19, .055, 2.1, .03),
  lever: gun("SILVER DOLLAR", "STERLING STANDARD", "Lever action", 8, 64, 95, .62, .55, .003),
  autoshotgun: gun("LAST CALL", "CLOSING TIME", "Auto shotgun", 5, 40, 17, .3, .6, .05, 8),
  sniper: gun("THE EYE IN THE SKY", "OMNISCIENT", "Bolt action", 5, 35, 150, 1.25, 3.2, .0008),
  lmg: gun("HOUSE EDGE", "THE HOUSE ALWAYS COLLECTS", "LMG", 60, 240, 43, .11, 5.2, .016),
  launcher: gun("THE DEBT COLLECTOR", "FINAL NOTICE", "Grenade launcher", 1, 8, 220, 1, 2.8, .01),
  flare: gun("RED CARPET", "INFERNO LOUNGE", "Flare pistol", 1, 12, 100, .9, 2.2, .012),
  axe: gun("FIRE EXIT", "EVACUATION NOTICE", "Fire axe", 1, 0, 260, 1.35, 0, 0),
  stick: gun("STICKMAN", "STICKMAN", "Craps rake", 3, 0, 350, .8, 0, 0),
};
export type ExtraWeaponId = keyof typeof EXTRA_WEAPONS;
/** The ten firearms the Velvet Fortune cabinet may award. */
export const MYSTERY_POOL = ["magnum", "tommy", "doublebarrel", "dual", "machinepistol", "lever", "autoshotgun", "sniper", "lmg", "launcher"] as const satisfies readonly ExtraWeaponId[];
export const isMelee = (id: string) => id === "stick" || id === "axe";
export const isShellLoading = (id: string) => id === "lever" || id === "autoshotgun";
export const penetration = (id: string) => id === "sniper" ? 4 : id === "lever" ? 3 : 1;
export const weaponSpeed = (id: string) => id === "lmg" ? .78 : id === "tommy" ? .9 : id === "axe" ? .92 : id === "dual" ? 1.08 : 1;
/** Extra spread (radians) added per consecutive automatic shot, capped by `maxBloom`. */
export const bloomPerShot = (id: string) => ({ tommy: .0022, machinepistol: .0035, lmg: .0012, smg: .001 }[id] ?? 0);
export const maxBloom = (id: string) => ({ tommy: .03, machinepistol: .045, lmg: .03, smg: .012 }[id] ?? 0);
export const muzzleLength = (id: string) => ({ magnum:.32,tommy:.54,doublebarrel:.44,dual:.26,machinepistol:.28,lever:.72,autoshotgun:.72,sniper:.85,lmg:.85,launcher:.43,flare:.23 }[id] ?? .4);
/** Radians of camera climb per shot. */
export const recoilPitch = (id: string) => ({
  pistol: .006, shotgun: .016, smg: .0035, rifle: .011,
  magnum: .024, tommy: .0042, doublebarrel: .022, dual: .0045, machinepistol: .0065,
  lever: .013, autoshotgun: .014, sniper: .02, lmg: .0048, launcher: .032,
}[id] ?? .006);
/** Melee swing length and the remaining-time moment at which the swing connects. */
export const meleeDuration = (id: string) => id === "axe" ? 1.1 : .6;
export const meleeContactTime = (id: string | null) => id === "axe" ? .62 : .32;
/** Fire cabinet on the relocated supply room's north storage wall. */
export const AXE_CABINET = { x: -30, z: 48.77 };
/** One-line house descriptions for the pickup card (docs/weapon-spec-1970s.md). */
export const WEAPON_FLAVOR: Record<string, string> = {
  pistol: "The house sidearm. Reliable, forgiving, always in reach.",
  shotgun: "Pump-action room service. Clears a doorway.",
  smg: "The dealer's choice when the floor gets crowded.",
  rifle: "Pit boss issue. Steady, hard-hitting, patient.",
  revolver: "Won at the table. Six chambers of pure spite.",
  magnum: "Six precise, heavy shots. Aim for the head and mind the kick.",
  tommy: "Fifty-round drum from the old owners. Heavy, loud, hungry.",
  doublebarrel: "Two barrels, one decision. Alt-fire bets both.",
  dual: "A pair of card-cheat pocket pistols, fired in turn.",
  machinepistol: "Fastest gun in the house and the least precise. Arm's length only.",
  lever: "Punches through three in a line. Lever between every shot.",
  autoshotgun: "Five quick shells, loaded one at a time; fire whenever you like.",
  sniper: "Surplus bolt-action with a 4x tube. Four targets deep.",
  lmg: "Belt-fed suppression. Staggers the crowd, slows your feet.",
  launcher: "One 40 mm round. Clears a crowd and does not care who.",
  stick: "The stickman's rake. Three solid sweeps before it snaps.",
  axe: "From the fire cabinet by the exit. Slow, heavy, never breaks.",
};
