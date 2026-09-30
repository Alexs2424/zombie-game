import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/loaders/glTF/index.js';
import { CASINO_CLADDING,CASINO_PORTALS } from '../../lib/game/casino-architecture-layout.ts';
const engine=new NullEngine(),scene=new Scene(engine),fixed=[],gates=[],reports=[];
const layout=JSON.parse(await readFile(new URL('../../docs/casino-architecture/layout.json',import.meta.url)));
assert.deepEqual(layout,{walls:CASINO_CLADDING,portals:CASINO_PORTALS},'export layout must match gameplay');
async function load(asset,x,z,yaw,isGate=false) {
  const bytes=await readFile(new URL(`../../public/models/${asset}.glb`,import.meta.url));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const image of json.images??[]) assert.ok(image.bufferView!==undefined && !image.uri,'self-contained textures');
  const c=await LoadAssetContainerAsync(bytes,scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true}}});
  const root=new TransformNode(asset,scene);root.position.set(x,0,z);root.rotation.y=yaw;c.addAllToScene();
  for(const n of [...c.meshes,...c.transformNodes].filter(n=>!n.parent)) n.parent=root;
  const meshes=root.getChildMeshes().filter(m=>m.getTotalVertices());let triangles=0;
  for(const m of meshes){m.computeWorldMatrix(true);triangles+=m.getTotalIndices()/3;for(const attr of ['position','normal'])assert.ok(m.getVerticesData(attr).every(Number.isFinite));}
  assert.ok(meshes.length<=8 && triangles<50000 && bytes.length<3*1024*1024,`${asset} budget`);
  const b=root.getHierarchyBoundingVectors();assert.ok(b.min.y>=-.001,`${asset} below floor: ${b.min.y}`);
  (isGate?gates:fixed).push(root);reports.push({asset,triangles,meshes:meshes.length,bytes:bytes.length});return root;
}
try {
  for(const w of CASINO_CLADDING)await load(`casino-deco-${w.id}`,w.x,w.z,w.yaw);
  for(const p of CASINO_PORTALS){await load(`casino-deco-portal-${p.style}`,p.x,p.z,p.yaw);await load(`casino-deco-gate-${p.style}`,p.x,p.z,p.yaw,true);}
  for(const kind of ['portal','wall-west','wall-east'])await load(`hotel-entry-${kind}`,-3,12.25,0);
  const pick=(origin,dir,roots)=>scene.pickWithRay(new Ray(new Vector3(...origin),new Vector3(...dir),2),m=>m.isEnabled()&&roots.some(r=>m.isDescendantOf(r)))?.hit;
  let samples=0;
  for(const p of CASINO_PORTALS) {
    const n=[Math.sin(p.yaw),Math.cos(p.yaw)],right=[Math.cos(p.yaw),-Math.sin(p.yaw)];
    for(const side of [-1,1])for(const x of [-1.9,-1,0,1,1.9])for(const y of [.12,1.65,3.90]) {
      assert.ok(!pick([p.x+right[0]*x+n[0]*side,y,p.z+right[1]*x+n[1]*side],[-side*n[0],0,-side*n[1]],fixed),`${p.id} clear opening ${x}/${y}/${side}`);samples++;
    }
    for(const y of [4.02,4.5,5.4,6.76])assert.ok(pick([p.x-n[0],y,p.z-n[1]],[n[0],0,n[1]],fixed),`${p.id} full-height head`);
    assert.ok(pick([p.x-n[0],1.65,p.z-n[1]],[n[0],0,n[1]],gates),`${p.id} closed gate`);
  }
  for(const [axis,value,start,end,inward] of [['x',-33,-19.75,11.75,1],['x',27,-19.75,11.75,-1],['z',-20,-32.75,26.75,1],['z',12,-32.75,26.75,-1]]) {
    for(let along=start;along<=end;along+=.25)for(const y of [.15,1.65,3.85,4.10,5.8,6.75]) {
      const x=axis==='x'?value:along,z=axis==='z'?value:along;
      if(CASINO_PORTALS.some(p=>Math.abs(x-p.x)<(p.w>p.d?2.001:.01)&&Math.abs(z-p.z)<(p.w>p.d?.01:2.001)&&y<4))continue;
      if(axis==='z'&&value===12&&Math.abs(x+3)<2.4&&y<3.07)continue;
      const origin=[x+(axis==='x'?inward:0),y,z+(axis==='z'?inward:0)];
      const dir=[axis==='x'?-inward:0,0,axis==='z'?-inward:0];
      assert.ok(pick(origin,dir,fixed),`perimeter gap at ${x},${y},${z}`);samples++;
    }
  }
  gates.forEach(g=>g.setEnabled(false));
  for(const p of CASINO_PORTALS)assert.ok(!pick([p.x-Math.sin(p.yaw),1.65,p.z-Math.cos(p.yaw)],[Math.sin(p.yaw),0,Math.cos(p.yaw)],gates),'open gates vanish independently');
  const report={status:'passed',samples,checks:['complete four-wall perimeter','four-metre clear room portals','front and rear opening clearance','fixed transoms and ceiling contact','closed/open gate geometry','embedded textures and finite geometry','per-export budgets'],assets:reports};
  await writeFile(new URL('../../docs/casino-architecture/validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,samples,assets:reports.length}));
} finally {scene.dispose();engine.dispose();}
