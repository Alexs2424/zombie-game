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
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

/** Hotel-only lighting; static architecture is captured after each asset replacement. */
export function createHotelFinishLighting(scene: Scene, key: SpotLight) {
  const bounce = new HemisphericLight("hotel plaster bounce", Vector3.Up(), scene);
  bounce.diffuse = Color3.FromHexString("#e4d9c6");
  bounce.groundColor = Color3.FromHexString("#323d38");
  bounce.intensity = 0.16;
  bounce.renderPriority = 3;
  let windowPatternFailed = false;
  const windowPattern = new Texture("/models/hotel-window-light.png", scene, false, false,
    Texture.TRILINEAR_SAMPLINGMODE, undefined,
    () => {
      windowPatternFailed = true;
      console.warn("Hotel window projection unavailable; retaining unpatterned daylight.");
    });
  windowPattern.name = "hotel soft window mullions";
  windowPattern.gammaSpace = false;
  windowPattern.wrapU = windowPattern.wrapV = Texture.CLAMP_ADDRESSMODE;
  const windows = [-1, 1].map(side => {
    const fill = new SpotLight(`hotel window fill ${side}`,
      new Vector3(side < 0 ? -22.4 : 14.4, 6.45, 26),
      new Vector3(-side, -0.62, 0.32).normalize(), 1.65, 1.7, scene);
    fill.diffuse = Color3.FromHexString("#c1d7e5");
    // One stronger direction establishes daylight; the opposite bay supplies fill.
    fill.intensity = side > 0 ? 3.7 : 0.8;
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
  const mapped = new Set<AbstractMesh>();
  // Failed nonblocking textures can report ready; do not bind their fallback pixels.
  let lightmapFailed = false;
  const lightmap = new Texture("/models/hotel-floor-lighting.png", scene, false, false,
    Texture.TRILINEAR_SAMPLINGMODE, undefined,
    () => {
      lightmapFailed = true;
      for (const material of reflective) material.lightmapTexture = null;
      console.warn("Hotel baked lighting unavailable; retaining live floor lighting.");
    });
  lightmap.name = "hotel Cycles static floor lighting";
  lightmap.gammaSpace = false;
  lightmap.coordinatesIndex = 1;
  lightmap.wrapU = lightmap.wrapV = Texture.CLAMP_ADDRESSMODE;
  let disposed = false;
  let lastMeshes: readonly AbstractMesh[] = [];
  const refresh = (meshes: readonly AbstractMesh[]) => {
    if (disposed) return;
    lastMeshes = meshes;
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
        if (!lightmapFailed && lightmap.isReady()) {
          if (!mapped.has(mesh)) {
            const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
            const uv = new Float32Array(positions.length / 3 * 2);
            const matrix = mesh.getWorldMatrix();
            for (let i = 0; i < positions.length / 3; i++) {
              const p = Vector3.TransformCoordinates(Vector3.FromArray(positions, i * 3), matrix);
              uv[i * 2] = (p.x + 23) / 38;
              uv[i * 2 + 1] = 1 - (p.z - 15) / 36;
            }
            mesh.setVerticesData(VertexBuffer.UV2Kind, uv);
            mapped.add(mesh);
          }
          material.lightmapTexture = lightmap;
          material.useLightmapAsShadowmap = true;
        }
        reflective.add(material);
      }
    }
    shadowMap.resetRefreshCounter();
    probe.cubeTexture.resetRefreshCounter();
  };
  lightmap.onLoadObservable.addOnce(() => refresh(lastMeshes));
  const projectWindow = () => {
    if (disposed || windowPatternFailed) return;
    windows[1].projectionTexture = windowPattern;
    refresh(lastMeshes);
  };
  if (windowPattern.isReady()) projectWindow();
  else windowPattern.onLoadObservable.addOnce(projectWindow);
  return {
    lights: [bounce, ...windows],
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of reflective) {
        material.reflectionTexture = null;
        material.lightmapTexture = null;
      }
      reflective.clear();
      mapped.clear();
      lastMeshes = [];
      lightmap.dispose();
      for (const fill of windows) fill.projectionTexture = null;
      windowPattern.dispose();
      shadow.dispose();
      probe.dispose();
      // Light lifetime belongs to buildHotel's shared membership/disposal list.
    },
  };
}
