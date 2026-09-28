import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { LIMBS, zombiePose, type HitRegion } from "./zombie-pose";
import type { Enemy } from "./simulation";

type ZombieAsset = {
  colors: Record<string, string>;
  variants: { name: string; meshes: { part: string; material: string; positions: number[]; indices: number[] }[] }[];
};
export async function loadZombieAsset(): Promise<ZombieAsset> {
  const response = await fetch('/models/zombies.json');
  if (!response.ok) throw new Error(`Zombie models: ${response.status}`);
  return response.json();
}

export function createZombie(scene: Scene, id: number, asset: ZombieAsset) {
  const variant = asset.variants[id % 3];
  const root = new TransformNode(`${variant.name}-${id}`, scene);
  const materials = Object.fromEntries(Object.entries(asset.colors).map(([name, hex]) => {
    const m = new StandardMaterial(`zombie-${id}-${name}`, scene);
    m.diffuseColor = Color3.FromHexString(hex);
    if (name === 'suit') m.diffuseColor = Color3.FromHexString(['#364e49', '#593e49', '#3b425a'][id % 3]);
    if (name === 'skin') m.diffuseColor = Color3.FromHexString(['#849574', '#a0a082', '#819393'][id % 3]);
    m.specularColor.set(name === 'blood' ? .22 : .045, .025, .025);
    m.maxSimultaneousLights = 8;
    if (name === 'eye') m.emissiveColor.set(.3,.15,.015);
    return [name,m];
  }));
  const pivots: Record<string, TransformNode> = { body: root };
  const pivot = (name: string, position: number[], parent = root) => {
    const node = new TransformNode(name, scene);
    node.parent = parent; node.position.set(position[0], position[1], position[2]);
    pivots[name] = node; return node;
  };
  const head = pivot('head',[0,1.48,0]);
  const jaw = pivot('jaw',[0,.13,.035],head);
  for (let i=0;i<2;i++) {
    const side = i ? 1 : -1;
    const arm = pivot(LIMBS[i],[side*.3,1.36,0]);
    pivot(i ? 'rightForearm' : 'leftForearm',[0,-.28,0],arm);
    pivot(LIMBS[i+2],[side*.11,.8,0]);
  }
  const wounds: { mesh: Mesh; region: HitRegion; stump: boolean }[] = [];
  for (const data of variant.meshes) {
    const mesh = new Mesh(data.part, scene);
    const vd = new VertexData(); vd.positions=data.positions; vd.indices=data.indices;
    vd.normals=[]; VertexData.ComputeNormals(data.positions, data.indices, vd.normals);
    vd.applyToMesh(mesh); mesh.material=materials[data.material];
    mesh.isPickable=false; mesh.receiveShadows=true;
    if (data.part.startsWith('wound_') || data.part.startsWith('stump_')) {
      const stump = data.part.startsWith('stump_');
      const region = data.part.slice(6) as HitRegion;
      mesh.parent = stump ? root : pivots[region];
      mesh.setEnabled(false); wounds.push({mesh,region,stump});
    } else mesh.parent=pivots[data.part];
  }
  const shadow=MeshBuilder.CreateDisc('contact shadow',{radius:.37,tessellation:18},scene);
  shadow.rotation.x=Math.PI/2;shadow.material=materials.dark;shadow.isPickable=false;
  return {root,pivots,head,jaw,wounds,shadow,materials:Object.values(materials),skin:materials.skin};
}
export function animateZombie(v: ReturnType<typeof createZombie>, e: Enemy) {
  const pose=zombiePose(e);
  v.root.position.set(e.x,(e.y ?? 0)+pose.drop,e.z);v.root.rotation.y=e.yaw;
  for (let i=0;i<2;i++) {
    const arm=v.pivots[LIMBS[i]], leg=v.pivots[LIMBS[i+2]];
    arm.setEnabled(!e.missing?.[LIMBS[i]]);leg.setEnabled(!e.missing?.[LIMBS[i+2]]);
    arm.rotation.set(...pose.arms[i] as [number,number,number]);
    v.pivots[i ? 'rightForearm' : 'leftForearm'].rotation.x=pose.elbows[i];
    leg.rotation.x=pose.legs[i];
  }
  for (const wound of v.wounds) {
    const missing = wound.region !== 'head' && wound.region !== 'body' && !!e.missing?.[wound.region];
    wound.mesh.setEnabled(wound.stump ? missing : !missing && !!e.wounds?.[wound.region]);
    if (!wound.stump) {
      const spread = Math.min(1.8,1+(e.wounds?.[wound.region] ?? 0)*.12);
      wound.mesh.scaling.set(spread,1,1);
    }
  }
  // Snarl, crooked grin, and slack-jawed gasp; open wider during the strike.
  v.jaw.rotation.x = -.08 - (e.id%3)*.09 - (pose.attacking ? .3 : Math.sin(e.age*2.5)*.035);
  v.head.rotation.z = Math.sin(e.age*1.6+e.id)*.045 + (e.id%3-1)*.04;
  v.head.rotation.x = e.flash > 0 ? -.16 : pose.attacking ? .09 : 0;
  v.skin.emissiveColor.set(e.flash>0?.16:0,0,0);
  v.shadow.position.set(e.x,(e.y ?? 0)+.025,e.z);
}
