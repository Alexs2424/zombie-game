import type { AssetContainer } from '@babylonjs/core/assetContainer.js';
import type { Material } from '@babylonjs/core/Materials/material.js';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh.js';

/**
 * Bake the rigid casino-chip hierarchy once, without simplifying its geometry.
 * The returned template is disabled; clones share its geometry/materials and
 * should be enabled after placement. The original container remains untouched.
 */
export function createChipTemplate(container: AssetContainer): Mesh {
  const groups = new Map<Material, Mesh[]>();
  for (const source of container.meshes) {
    if (!source.getTotalVertices()) continue;
    if (!(source instanceof Mesh) || source.isAnInstance || source.skeleton ||
      source.morphTargetManager || !source.material || source.material instanceof MultiMaterial) {
      throw new Error('The casino chip template requires rigid meshes with individual materials.');
    }
    const group = groups.get(source.material) ?? [];
    group.push(source);
    groups.set(source.material, group);
  }
  // Keep each material's indices contiguous, so repeated edge inlays become one
  // draw group. MergeMeshes bakes the complete parent hierarchy and reverses
  // indices for glTF's mirrored root. disposeSource=false keeps the asset intact.
  const sources = [...groups.values()].flat();
  const merged = Mesh.MergeMeshes(sources, false, true, undefined, false, true);
  if (!merged) throw new Error('The casino chip template could not be merged.');
  merged.name = 'casino chip template';
  const ranges: { material: number; start: number; count: number }[] = [];
  for (const submesh of merged.subMeshes) {
    const previous = ranges[ranges.length - 1];
    if (previous && previous.material === submesh.materialIndex && previous.start + previous.count === submesh.indexStart)
      previous.count += submesh.indexCount;
    else ranges.push({ material: submesh.materialIndex, start: submesh.indexStart, count: submesh.indexCount });
  }
  merged.releaseSubMeshes();
  for (const range of ranges) SubMesh.CreateFromIndices(range.material, range.start, range.count, merged);
  merged.isPickable = false;
  merged.receiveShadows = true;
  merged.setEnabled(false);
  return merged;
}
