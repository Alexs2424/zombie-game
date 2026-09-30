import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { ReflectionProbe } from "@babylonjs/core/Probes/reflectionProbe";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

/** Hotel-only lighting; static architecture is captured after each asset replacement. */
export function createHotelFinishLighting(scene: Scene, key: SpotLight) {
  const bounce = new HemisphericLight("hotel plaster bounce", Vector3.Up(), scene);
  bounce.diffuse = Color3.FromHexString("#e4d9c6");
  bounce.groundColor = Color3.FromHexString("#323d38");
  bounce.intensity = 0.24;
  bounce.renderPriority = 3;
  const windows = [-1, 1].map(side => {
    const fill = new SpotLight(`hotel window fill ${side}`,
      new Vector3(side < 0 ? -22.4 : 14.4, 6.3, 26),
      new Vector3(-side, -0.45, 0.3).normalize(), 2.25, 1.1, scene);
    fill.diffuse = Color3.FromHexString("#b6cdd9");
    fill.intensity = 1.1;
    fill.range = 26;
    fill.renderPriority = 2;
    return fill;
  });
  key.shadowMinZ = 0.4;
  key.shadowMaxZ = 28;
  const shadow = new ShadowGenerator(1024, key);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.001;
  shadow.normalBias = 0.025;
  shadow.setDarkness(0.22);
  const shadowMap = shadow.getShadowMap()!;
  shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;

  const probe = new ReflectionProbe("hotel static marble reflection", 128, scene, true, true, true);
  probe.position.set(-4, 2.3, 28);
  probe.cubeTexture.boundingBoxPosition.set(-4, 4.4, 33);
  probe.cubeTexture.boundingBoxSize = new Vector3(38, 8.8, 36);
  probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
  probe.renderList = [];
  const reflective = new Set<PBRMaterial>();
  let disposed = false;
  return {
    lights: [bounce, ...windows],
    refresh(meshes: readonly AbstractMesh[]) {
      if (disposed) return;
      const visible = [...new Set(meshes)].filter(m =>
        !m.isDisposed() && m.isEnabled() && m.getTotalVertices() > 0 &&
        !m.name.startsWith("hotel concealed") && m.name !== "hotel supply case lid");
      // Exclude the floor receiving the probe to avoid sampling its own capture.
      probe.renderList = visible.filter(m => !m.name.startsWith("hotel-grand-floor") && m.material?.name !== "hotel polished ivory marble floor");
      shadowMap.renderList = visible.filter(m =>
        !m.name.startsWith("hotel-grand-ceiling") &&
        !m.name.startsWith("hotel-grand-floor") &&
        !m.material?.name.includes("contact shade"));
      for (const mesh of visible) {
        const material = mesh.material;
        if (mesh.name.startsWith("hotel-grand-floor") && material instanceof PBRMaterial) {
          material.reflectionTexture = probe.cubeTexture;
          material.environmentIntensity = 0.45;
          if (material.name.startsWith("Hotel marble slab")) material.albedoColor.set(0.76, 0.74, 0.68);
          reflective.add(material);
        }
      }
      shadowMap.resetRefreshCounter();
      probe.cubeTexture.resetRefreshCounter();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of reflective) material.reflectionTexture = null;
      reflective.clear();
      shadow.dispose();
      probe.dispose();
      // Light lifetime belongs to buildHotel's shared membership/disposal list.
    },
  };
}
