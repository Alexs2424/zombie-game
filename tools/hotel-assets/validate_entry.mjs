/** Inspect actual entrance exports through Babylon's default left-handed loader. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import "@babylonjs/loaders/glTF/index.js";
import { HOTEL_GATE } from "../../lib/game/hotel-gameplay.ts";

const engine=new NullEngine(),scene=new Scene(engine),assets=[];
let portal,gate;
try {
  for (const kind of ["portal","gate"]) {
    const bytes=await readFile(new URL(`../../public/models/hotel-entry-${kind}.glb`,import.meta.url));
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    for (const image of gltf.images??[]) assert.ok(image.bufferView!==undefined && image.uri===undefined,"embedded textures only");
    const container=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:".glb",pluginOptions:{gltf:{skipMaterials:true}}});
    const root=new TransformNode(`entry ${kind}`,scene);root.position.set(HOTEL_GATE.x,0,HOTEL_GATE.z-(kind==="portal"?.13:0));
    container.addAllToScene();
    for (const node of [...container.meshes,...container.transformNodes].filter(node=>!node.parent)) node.parent=root;
    const meshes=root.getChildMeshes().filter(mesh=>mesh.getTotalVertices()>0);
    let triangles=0;
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);triangles+=mesh.getTotalIndices()/3;
      for (const attribute of ["position","normal"]) assert.ok(mesh.getVerticesData(attribute).every(Number.isFinite));
    }
    const bounds=root.getHierarchyBoundingVectors();
    assert.ok(bounds.min.y>=-.001,"no geometry below floor");
    assert.ok(meshes.length<=8 && triangles<40000,"bounded material/triangle cost");
    assert.ok(bytes.length<3*1024*1024,"bounded binary size");
    assets.push({kind,bytes:bytes.length,meshes:meshes.length,triangles,bounds:{min:bounds.min.asArray(),max:bounds.max.asArray()}});
    if(kind==="portal") portal=root;else gate=root;
  }
  const pick=(x,y,root)=>scene.pickWithRay(new Ray(new Vector3(HOTEL_GATE.x+x,y,HOTEL_GATE.z-1),Vector3.Forward(),2),
    mesh=>mesh.isEnabled() && mesh.isDescendantOf(root));
  // The actual corridor is 4.8 m between the existing foyer wall faces.
  for(const x of [-2.35,-1.5,0,1.5,2.35]) for(const y of [.1,1.65,2.95])
    assert.equal(Boolean(pick(x,y,portal)?.hit),false,`opening obstructed at ${x},${y}`);
  for(const x of [-2.67,2.67]) assert.equal(Boolean(pick(x,1.65,portal)?.hit),true,"solid jamb");
  assert.equal(Boolean(pick(0,3.1,portal)?.hit),true,"lintel begins at gate head");
  assert.equal(Boolean(pick(0,1.65,gate)?.hit),true,"closed gate visible");
  gate.setEnabled(false);
  assert.equal(Boolean(pick(0,1.65,gate)?.hit),false,"opened gate disappears");
  const report={status:"passed",assets,checks:["clear foyer opening","jamb and lintel contact","gate visibility","embedded textures","finite geometry and normals","asset budgets"]};
  await writeFile(new URL("../../docs/hotel-assets/entry/runtime-validation.json",import.meta.url),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report,null,2));
} finally {scene.dispose();engine.dispose();}
