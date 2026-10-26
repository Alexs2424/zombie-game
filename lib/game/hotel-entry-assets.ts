import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { HOTEL_GATE } from "./hotel-gameplay";
import "@babylonjs/loaders/glTF";

/** Original architectural exports share the existing purchase gate's origin. */
export async function loadHotelEntry(scene: Scene) {
  const containers: AssetContainer[] = [], roots: TransformNode[] = [];
  const meshes: AbstractMesh[] = [];
  let gate: TransformNode | undefined;
  const dispose = () => {
    roots.forEach(root => root.dispose());
    containers.forEach(container => container.dispose());
  };
  try {
    for (const kind of ["portal", "gate", "wall-west", "wall-east"] as const) {
      const container = await LoadAssetContainerAsync(`/models/hotel-entry-${kind}.glb`, scene);
      containers.push(container);
      if (scene.isDisposed) throw new Error("Hotel scene disposed during entrance loading");
      const root = new TransformNode(`hotel original entry ${kind}`, scene);
      // All four Blender exports share the gate origin; setbacks are baked
      // into the source so portal, wall courses and grille remain aligned.
      roots.push(root);root.setEnabled(false);root.position.set(HOTEL_GATE.x,0,HOTEL_GATE.z);
      container.addAllToScene();
      for (const node of [...container.meshes,...container.transformNodes].filter(node => !node.parent)) node.parent=root;
      for (const material of container.materials) {
        const lit=material as typeof material & { maxSimultaneousLights?: number };
        if ("maxSimultaneousLights" in lit) lit.maxSimultaneousLights=8;
      }
      for (const mesh of root.getChildMeshes()) {
        mesh.isPickable=false;mesh.receiveShadows=true;mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();
        meshes.push(mesh);
      }
      if (kind==="gate") gate=root;
    }
    roots.forEach(root => root.setEnabled(true));
    return { meshes, setOpen(open: boolean) {gate?.setEnabled(!open);}, dispose };
  } catch (error) {dispose();throw error;}
}
