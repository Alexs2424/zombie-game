import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { HOTEL_FIXTURES, type HotelFixtureKind } from "./hotel-fixtures";
import "@babylonjs/loaders/glTF";

/** Floor-centered Blender furniture uses the same fixtures as collision. */
export async function loadHotelFurniture(scene: Scene) {
  const containers: AssetContainer[] = [];
  const roots: TransformNode[] = [];
  const meshes: AbstractMesh[] = [];
  const handled = new Set<HotelFixtureKind>();
  const kinds = [...new Set(HOTEL_FIXTURES.map((fixture) => fixture.kind))];
  // Small batches avoid eleven simultaneous GLB decodes on the user's Mac.
  for (let offset = 0; offset < kinds.length; offset += 3) {
    await Promise.all(
      kinds.slice(offset, offset + 3).map(async (kind) => {
        let container: AssetContainer | undefined;
        const pendingRoots: TransformNode[] = [];
        const pendingMeshes: AbstractMesh[] = [];
        try {
          container = await LoadAssetContainerAsync(
            `/models/hotel-${kind}.glb`,
            scene,
          );
          if (scene.isDisposed) {
            container.dispose();
            return;
          }
          for (const mesh of container.meshes) {
            mesh.isPickable = false;
            mesh.receiveShadows = true;
          }
          for (const material of container.materials) {
            const lit = material as typeof material & {
              maxSimultaneousLights?: number;
            };
            if ("maxSimultaneousLights" in lit) lit.maxSimultaneousLights = 8;
          }
          for (const fixture of HOTEL_FIXTURES.filter((f) => f.kind === kind)) {
            const root = new TransformNode(`${fixture.id} Blender`, scene);
            pendingRoots.push(root);
            root.setEnabled(false);
            root.position.set(fixture.x, fixture.baseY ?? 0, fixture.z);
            root.rotation.y = -(fixture.yaw ?? 0);
            const imported = container.instantiateModelsToScene(
              (name) => `${fixture.id}:${name}`,
              false,
              { doNotInstantiate: false },
            );
            for (const node of imported.rootNodes) node.parent = root;
            root.computeWorldMatrix(true);
            for (const mesh of root.getChildMeshes()) {
              mesh.isPickable = false;
              mesh.computeWorldMatrix(true);
              mesh.freezeWorldMatrix();
              pendingMeshes.push(mesh);
            }
          }
          containers.push(container);
          roots.push(...pendingRoots);
          meshes.push(...pendingMeshes);
          handled.add(kind);
        } catch (error) {
          pendingRoots.forEach((root) => root.dispose());
          container?.dispose();
          if (!scene.isDisposed)
            console.warn(
              `Hotel ${kind} model unavailable; using procedural fallback.`,
              error,
            );
        }
      }),
    );
    if (scene.isDisposed) break;
  }
  return {
    meshes,
    // Instance lighting is selected through its source mesh in Babylon.
    lightMeshes: [
      ...new Set(
        meshes.flatMap((mesh) =>
          mesh instanceof InstancedMesh ? [mesh, mesh.sourceMesh] : [mesh],
        ),
      ),
    ],
    handled,
    activate() {
      roots.forEach((root) => root.setEnabled(true));
    },
    dispose() {
      roots.forEach((root) => root.dispose());
      containers.forEach((container) => container.dispose());
    },
  };
}
