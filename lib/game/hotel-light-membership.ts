import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Light } from "@babylonjs/core/Lights/light";

/** Keep hotel light membership current without repeatedly visiting static scenery. */
export function createHotelLightMembership(scene: Scene, lights: readonly Light[]) {
  const pending = new Set(scene.meshes);
  const enemies = new Set<AbstractMesh>();
  const includedEnemies = new Set<AbstractMesh>();
  let staticMeshes: readonly AbstractMesh[] = [];
  let changed = false;
  let syncAt = -Infinity;
  let disposed = false;
  const added = scene.onNewMeshAddedObservable.add((mesh) => {
    // Babylon defers this notification; a short-lived mesh can already be gone.
    if (!mesh.isDisposed()) pending.add(mesh);
  });
  const removed = scene.onMeshRemovedObservable.add((mesh) => {
    pending.delete(mesh);
    enemies.delete(mesh);
    if (includedEnemies.delete(mesh)) changed = true;
  });
  const refresh = () => {
    const included = [...staticMeshes, ...includedEnemies];
    // Babylon hooks push/splice on each array. Sharing one array between lights
    // chains those hooks, so each light must own its own copy.
    for (const light of lights) light.includedOnlyMeshes = [...included];
    changed = false;
  };
  return {
    setStaticMeshes(meshes: readonly AbstractMesh[]) {
      if (disposed) return;
      staticMeshes = [...meshes];
      refresh();
    },
    update(time: number) {
      if (disposed) return;
      if (time - syncAt > 0.4 || time < syncAt) {
        syncAt = time;
        // Classify each addition once, after createZombie has finished assigning
        // its material and parent. Subsequent checks only visit enemy meshes.
        for (const mesh of pending) {
          if (mesh.material?.name.startsWith("zombie-")) enemies.add(mesh);
        }
        pending.clear();
        for (const mesh of enemies) {
          const inHotel = mesh.getAbsolutePosition().z > 11;
          if (inHotel === includedEnemies.has(mesh)) continue;
          if (inHotel) includedEnemies.add(mesh);
          else includedEnemies.delete(mesh);
          changed = true;
        }
      }
      if (changed) refresh();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.onNewMeshAddedObservable.remove(added);
      scene.onMeshRemovedObservable.remove(removed);
      pending.clear();
      enemies.clear();
      includedEnemies.clear();
      staticMeshes = [];
    },
  };
}
