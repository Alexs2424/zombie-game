import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { CASINO_CLADDING, CASINO_PORTALS } from './casino-architecture-layout';
import '@babylonjs/loaders/glTF';

/** Material-batched originals share the collision layout, with independent gates. */
export async function loadCasinoArchitecture(scene: Scene) {
  const containers = new Map<string, AssetContainer>();
  const roots: TransformNode[] = [];
  const meshes: AbstractMesh[] = [];
  const gates = new Map<string, TransformNode>();
  const dispose = () => {
    roots.forEach(root => root.dispose());
    containers.forEach(asset => asset.dispose());
  };
  try {
    const place = async (assetId: string, id: string, x: number, z: number, yaw: number) => {
      let asset = containers.get(assetId);
      if (!asset) {
        asset = await LoadAssetContainerAsync(`/models/casino-deco-${assetId}.glb`, scene);
        containers.set(assetId, asset);
      }
      if (scene.isDisposed) throw new Error('Casino disposed during architecture loading');
      const root = new TransformNode(`casino architecture ${id}`, scene);
      roots.push(root);
      root.setEnabled(false);
      root.position.set(x, 0, z);
      root.rotation.y = yaw;
      const instance = asset.instantiateModelsToScene(name => `${id}: ${name}`, false, { doNotInstantiate: true });
      instance.rootNodes.forEach(node => { node.parent = root; });
      for (const mesh of root.getChildMeshes()) {
        mesh.isPickable = false;
        mesh.receiveShadows = true;
        const material = mesh.material as (typeof mesh.material & { maxSimultaneousLights?: number });
        if (material && 'maxSimultaneousLights' in material) material.maxSimultaneousLights = 8;
        mesh.material?.getActiveTextures().forEach(texture => { texture.anisotropicFilteringLevel = 8; });
        mesh.computeWorldMatrix(true);
        mesh.freezeWorldMatrix();
        meshes.push(mesh);
      }
      return root;
    };
    for (const wall of CASINO_CLADDING) await place(wall.id, wall.id, wall.x, wall.z, wall.yaw);
    for (const portal of CASINO_PORTALS) {
      const { id, style, x, z, yaw } = portal;
      await place(`portal-${style}`, `${id} portal`, x, z, yaw);
      gates.set(id, await place(`gate-${style}`, `${id} gate`, x, z, yaw));
    }
    roots.forEach(root => root.setEnabled(true));
    return {
      meshes,
      gateIds: new Set(gates.keys()),
      setOpen(id: string, open: boolean) { gates.get(id)?.setEnabled(!open); },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
