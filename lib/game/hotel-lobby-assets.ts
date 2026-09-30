import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

/** World-space architectural exports compensate for Babylon's glTF X reflection. */
export async function loadHotelLobbyAsset(scene: Scene, kind: "stairs" | "ceiling" | "floor" | "details") {
  const container = await LoadAssetContainerAsync(`/models/hotel-grand-${kind}.glb`, scene);
  if (scene.isDisposed) { container.dispose(); throw new Error("Hotel disposed during model loading"); }
  container.addAllToScene();
  const meshes: AbstractMesh[] = [];
  for (const material of container.materials) {
    const lit = material as typeof material & { maxSimultaneousLights?: number };
    if ("maxSimultaneousLights" in lit) lit.maxSimultaneousLights = 8;
  }
  for (const mesh of container.meshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
    if (mesh.getTotalVertices()) meshes.push(mesh);
  }
  return { meshes, dispose: () => container.dispose() };
}
