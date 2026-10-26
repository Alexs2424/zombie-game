import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { PlayerSummary } from './protocol.ts';

export const PLAYER_COLORS = ['#79cbbb', '#e7b967', '#a7a2f2', '#ec8b9e'];
type Avatar = { root: TransformNode; legs: TransformNode[]; arms: TransformNode[]; material: StandardMaterial; labelMaterial: StandardMaterial; texture: DynamicTexture; name: string; previous: PlayerSummary; next: PlayerSummary; received: number };

/** Lightweight human teammates. Network snapshots interpolate over one 50ms server interval. */
export class RemotePlayers {
  private avatars = new Map<string, Avatar>();
  constructor(private scene: Scene) {}
  receive(players: PlayerSummary[], selfId: string, now: number) {
    const present = new Set(players.filter(p => p.id !== selfId && p.connected && p.alive).map(p => p.id));
    for (const [id, avatar] of this.avatars) if (!present.has(id)) { this.remove(avatar); this.avatars.delete(id); }
    for (const p of players) {
      if (!present.has(p.id)) continue;
      let avatar = this.avatars.get(p.id);
      if (!avatar) { avatar = this.create(p, now); this.avatars.set(p.id, avatar); }
      const distance = Math.hypot(avatar.root.position.x - p.x, avatar.root.position.z - p.z);
      avatar.previous = distance > 3 ? { ...p } : { ...avatar.next, x: avatar.root.position.x, y: avatar.root.position.y, z: avatar.root.position.z, yaw: avatar.root.rotation.y };
      avatar.next = { ...p };
      avatar.received = now;
      if (avatar.name !== p.name) { avatar.name = p.name; this.paintName(avatar); }
    }
  }
  private create(p: PlayerSummary, now: number): Avatar {
    const root = new TransformNode(`teammate-${p.id}`, this.scene);
    const material = new StandardMaterial(`teammate-color-${p.id}`, this.scene);
    const color = p.color > 3 ? `#${p.color.toString(16).padStart(6, '0')}` : PLAYER_COLORS[p.color % PLAYER_COLORS.length];
    material.diffuseColor = Color3.FromHexString(color);
    material.emissiveColor = material.diffuseColor.scale(.12);
    material.specularColor.set(.05, .05, .05);
    const box = (name: string, size: [number, number, number], position: [number, number, number], parent = root) => {
      const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
      mesh.position.set(...position); mesh.parent = parent; mesh.material = material; mesh.isPickable = false;
      return mesh;
    };
    box('teammate jacket', [.46, .64, .27], [0, 1.09, 0]);
    const head = MeshBuilder.CreateSphere('teammate head', { diameter: .29, segments: 10 }, this.scene);
    head.parent = root; head.position.y = 1.58; head.material = material; head.isPickable = false;
    box('teammate cap visor', [.27, .035, .19], [0, 1.7, .12]);
    const legs: TransformNode[] = [], arms: TransformNode[] = [];
    for (const side of [-1, 1]) {
      const leg = new TransformNode('teammate hip', this.scene);
      leg.parent = root; leg.position.set(side * .12, .81, 0);
      box('teammate trouser', [.17, .7, .18], [0, -.35, 0], leg);
      box('teammate shoe', [.19, .12, .28], [0, -.75, .04], leg); legs.push(leg);
      const arm = new TransformNode('teammate shoulder', this.scene);
      arm.parent = root; arm.position.set(side * .28, 1.35, .01);
      box('teammate sleeve', [.15, .48, .15], [0, -.22, 0], arm); arms.push(arm);
    }
    box('teammate weapon', [.085, .1, .48], [.27, 1.05, .28]);
    const texture = new DynamicTexture(`teammate-label-${p.id}`, { width: 512, height: 80 }, this.scene, false);
    texture.hasAlpha = true;
    const labelMaterial = new StandardMaterial(`teammate-label-material-${p.id}`, this.scene);
    labelMaterial.diffuseTexture = texture; labelMaterial.emissiveTexture = texture; labelMaterial.opacityTexture = texture;
    labelMaterial.disableLighting = true; labelMaterial.backFaceCulling = false;
    const label = MeshBuilder.CreatePlane('teammate name', { width: 1.8, height: .28 }, this.scene);
    label.parent = root; label.position.y = 2.02; label.material = labelMaterial; label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false;
    root.position.set(p.x, p.y, p.z); root.rotation.y = p.yaw;
    const avatar = { root, legs, arms, material, labelMaterial, texture, name: p.name, previous: { ...p }, next: { ...p }, received: now };
    this.paintName(avatar);
    return avatar;
  }
  private paintName(avatar: Avatar) {
    const c = avatar.texture.getContext();
    c.clearRect(0, 0, 512, 80); c.fillStyle = 'rgba(5,20,18,.75)'; c.fillRect(0, 0, 512, 80);
    const name = avatar.name.slice(0, 20);
    c.font = 'bold 38px sans-serif'; c.fillStyle = '#f4eee0'; c.fillText(name, (512 - c.measureText(name).width) / 2, 54);
    avatar.texture.update();
  }
  update(now: number, hiddenPlayer?: string) {
    for (const [id, avatar] of this.avatars) {
      const t = Math.min(1, Math.max(0, (now - avatar.received) / 50));
      const a = avatar.previous, b = avatar.next;
      avatar.root.setEnabled(id !== hiddenPlayer);
      avatar.root.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
      avatar.root.rotation.y = a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * t;
      const stride = b.moving ? Math.sin(now / (b.sprinting ? 75 : 105)) * .48 : 0;
      avatar.legs[0].rotation.x = stride; avatar.legs[1].rotation.x = -stride;
      avatar.arms[0].rotation.x = -.8 - b.pitch * .45; avatar.arms[1].rotation.x = -.8 - b.pitch * .45;
    }
  }
  private remove(avatar: Avatar) { avatar.root.dispose(); avatar.material.dispose(); avatar.labelMaterial.dispose(); avatar.texture.dispose(); }
  reset() { for (const avatar of this.avatars.values()) this.remove(avatar); this.avatars.clear(); }
  dispose() { this.reset(); }
}
