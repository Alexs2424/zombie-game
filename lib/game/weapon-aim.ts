/** Sight-line anchors in game-space metres, matching the authored sight geometry. */
type Point = readonly [number, number, number];
type Sights = { rear: Point; front: Point; fov?: number; scope?: boolean };
export const SIGHTS: Record<string, Sights> = {
  pistol: { rear: [0,.09,-.083], front: [0,.089,.171] },
  shotgun: { rear: [0,.064,.065], front: [0,.063,.593] },
  smg: { rear: [0,.0675,-.073], front: [0,.075,.306] },
  rifle: { rear: [0,.077,-.069], front: [0,.077,.53] },
  revolver: { rear: [0,.1175,-.037], front: [0,.12,.276] },
  magnum: { rear: [0,.0765,-.008], front: [0,.08,.195] },
  tommy: { rear: [0,.082,-.1], front: [0,.08,.45] },
  doublebarrel: { rear: [0,.049,-.08], front: [0,.0302,.492] },
  dual: { rear: [.21,.0535,-.072], front: [.21,.053,.066], fov: .95 },
  machinepistol: { rear: [0,.072,-.089], front: [0,.072,.094] },
  lever: { rear: [0,.049,.155], front: [0,.028,.565] },
  autoshotgun: { rear: [0,.0535,.2], front: [0,.0535,.62] },
  sniper: { rear: [0,.064,-.15], front: [0,.064,.2], fov: .37, scope: true },
  lmg: { rear: [0,.089,-.115], front: [0,.086,.5], fov: .9 },
  launcher: { rear: [0,.066,.12], front: [0,.066,.33], fov: .95 },
};

/** Rotate and translate so both sights lie on the camera's centre ray. */
export function aimPose(id: string) {
  const sights = SIGHTS[id];
  if (!sights) return undefined;
  const [x, y, z] = sights.rear;
  const pitch = Math.atan2(sights.front[1]-y, sights.front[2]-z);
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return { x: -x, y: -(y*c-z*s), z: .22-(y*s+z*c), pitch, fov: sights.fov ?? .85, scope: !!sights.scope };
}
