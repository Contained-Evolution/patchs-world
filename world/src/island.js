import {campRecords} from '../../shared/editor/camp.mjs';
import {CAMP_DEFAULTS,applyCampRecords} from './furniture.js';
import {boundsCollision} from '../../shared/editor/collision.mjs';
import { WorldRegistry } from './editor/registry.js';
import { SWING_TREE } from './swing-tree.js';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND, places, coastRadius, shoreFraction, groundHeight, pondOutline, RIVER, riverPoint, streamInfo, nearPondStairs, TIDE_POOLS, tideWaterHeight } from './terrain.js';
import { anchorFor, holdFor, ROPE_TREES, trees } from './world-state.js';
import { forest, isReserved } from './forest.js';
import { createTerrainTiles } from './terrain-mesh.js';
import { addRiverWater, oceanGeometry } from './river-water.js';
import { addPondScenery, createPondSteps, addWaterfallVines } from './pond-scenery.js';
import { pondSwings } from './pond-swings.js';
import { CLIMB_WALLS } from './climbing.js';
import { createIslandCollision, bananaTrees } from './island-collision.js';
import { BANANA_TREE, TRUNK_GEOMETRY, FRUIT_GEOMETRY, bananaFruitConnector, leafGeometry, palmLeafPose } from './banana-tree.js';
import { hammock } from './hammock.js';
import { addCampHammock } from './camp-hammock.js';
import { addCampRulesSign } from './camp-rules-sign.js';
import { createFurniture } from './camp-furniture.js';
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
function surfaceTexture(base, strokes, seed=1){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,512,512);
 for(let i=0;i<3800;i++){const x=rand(i+seed)*512,y=rand(i+seed+4000)*512,r=.5+rand(i+seed+8000)*3;g.globalAlpha=.05+rand(i+20000)*.15;g.fillStyle=strokes[i%strokes.length];g.beginPath();g.ellipse(x,y,r*2,r,rand(i+10)*Math.PI,0,Math.PI*2);g.fill();}
 g.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(100,110);t.anisotropy=4;return t;
}
function rockGeometry(){let g=mergeVertices(new THREE.IcosahedronGeometry(1,2));const p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);let f=1+.16*Math.sin(x*7+z*4)*Math.cos(y*9-z*2);p.setXYZ(i,x*f,y*f,z*f);}g.computeVertexNormals();return g;}
export function createIsland(scene){
 const walkSolids = createIslandCollision(true,true);
 const registry = new WorldRegistry(scene);
 let editorBlocks=()=>false;
 const fixedBlocks=walkSolids.blocks;
 walkSolids.blocks=(...args)=>fixedBlocks(...args)||editorBlocks(...args);

 const block = walkSolids.mesh;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:1,...extra});
 const groundMat=material(0xffffff,{vertexColors:true,map:surfaceTexture('#dfdfdf',['#898989','#ffffff','#bbbbbb'])});
 const grassDetail=new THREE.TextureLoader().load(new URL('./assets/tropical-grass.png',document.baseURI).href);grassDetail.colorSpace=THREE.SRGBColorSpace;grassDetail.wrapS=grassDetail.wrapT=THREE.RepeatWrapping;grassDetail.anisotropy=4;
 groundMat.onBeforeCompile=shader=>{
  shader.uniforms.grassDetail={value:grassDetail};
  shader.uniforms.bankStone={value:rockMap};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>',`#include <common>
attribute vec2 bank;
varying vec2 islandBank;
varying vec3 islandGround;
varying float groundSlope;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
islandGround=position;
islandBank=bank;
groundSlope=1.0-normal.y;`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
varying vec3 islandGround;
varying vec2 islandBank;
varying float groundSlope;
uniform sampler2D grassDetail;
uniform sampler2D bankStone;`)
   .replace('#include <color_fragment>',`#include <color_fragment>
vec2 xz=islandGround.xz;
vec3 grass=texture2D(grassDetail,xz*.18).rgb;
float inland=1.0-smoothstep(.78,.95,length(xz/vec2(320.0,360.0)));
diffuseColor.rgb*=mix(vec3(1.0),grass*1.55,inland*.8);
if(islandBank.x>.001){
 vec3 stoneX=texture2D(bankStone,islandGround.zy*.42).rgb;
 vec3 stoneZ=texture2D(bankStone,islandGround.xy*.42).rgb;
 float axis=abs(dFdx(islandGround.x))+abs(dFdy(islandGround.x));
 float crossAxis=abs(dFdx(islandGround.z))+abs(dFdy(islandGround.z));
 vec3 rock=mix(stoneX,stoneZ,axis/max(.001,axis+crossAxis));
 float grit=dot(texture2D(bankStone,xz*1.7).rgb,vec3(.29,.58,.13));
 float variation=dot(texture2D(bankStone,xz*.027).rgb,vec3(.29,.58,.13));
 float seam=sin(islandGround.y*3.1+xz.x*.29+xz.y*.38+variation*19.0);
 vec3 mud=mix(vec3(.19,.118,.072),vec3(.23,.139,.081),islandBank.y)*(.77+variation*.95);
 vec3 gravel=vec3(.38,.29,.20)*(.66+grit*1.4);
 vec3 slate=vec3(.21,.22,.22)*(.70+rock*1.4)*(.67+.33*smoothstep(-.65,-.22,seam));
 float stones=smoothstep(.055,.21,variation)*mix(.93,.58,islandBank.y);
 float ledge=smoothstep(.065,.22,groundSlope)*islandBank.y;
 vec3 soil=mix(mix(mud,gravel,stones),slate,ledge);
 diffuseColor.rgb=mix(diffuseColor.rgb,soil,smoothstep(0.0,.83,islandBank.x));
}`);
 };
 const barkMap=new THREE.TextureLoader().load(new URL('./assets/tropical-bark.png',document.baseURI).href);barkMap.colorSpace=THREE.SRGBColorSpace;barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;barkMap.repeat.set(1,3);barkMap.anisotropy=4;const bark=material(0xc4b3a0,{map:barkMap});
 const leafMap=new THREE.TextureLoader().load(new URL('./assets/tropical-leaf.png',document.baseURI).href);leafMap.colorSpace=THREE.SRGBColorSpace;leafMap.anisotropy=4;
 const foliage=material(0xc1d9ae,{map:leafMap,alphaTest:.35,side:THREE.DoubleSide,roughness:.9,emissive:0x334b29,emissiveMap:leafMap,emissiveIntensity:.35});
 const rockMap=new THREE.TextureLoader().load(new URL('./assets/volcanic-rock.png',document.baseURI).href);rockMap.colorSpace=THREE.SRGBColorSpace;rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;rockMap.anisotropy=4;const rock=material(0xbab9ad,{map:rockMap});
 const sand=material(0xd8c592),wood=material(0x725039),rope=material(0xd1c7a0);
 const pondScenery=addPondScenery(scene,rope);
 const wet=material(0x67836b,{roughness:.55});
 const add=(geo,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);scene.add(o);return o;};
 const beam=(mat,a,b,r1,r2=r1)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const o=add(new THREE.CylinderGeometry(r2,r1,d.length(),8),mat);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const stones=[];const stone=(x,z,sx,sy,sz)=>{stones.push({x,z,sx,sy,sz});};
 const boulder=rockGeometry(),blade=leafGeometry();
 // Heightfield follows the exact same coast and ground query as movement and Patch.
 for(const geometry of createTerrainTiles()){const mesh=add(geometry,groundMat);mesh.userData.editorTerrain=true;}
 scene.add(...createPondSteps(rock));
 addWaterfallVines(scene,blade,foliage);
 // Transparent, sunlit moving water uses the same shader idea as Tenari's valley.
 const waterTime={value:0},waterLight={value:1},waterRain={value:0};
 const water=material(0x317d87,{roughness:.25,metalness:.16,transparent:true,opacity:.83,depthWrite:false,side:THREE.DoubleSide});
 water.onBeforeCompile=shader=>{shader.uniforms.waterTime=waterTime;shader.uniforms.waterLight=waterLight;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 wavePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nwavePosition = (modelMatrix * vec4(position,1.0)).xz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 wavePosition; uniform float waterTime; uniform float waterLight;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nfloat a=sin(wavePosition.x*.24+wavePosition.y*.14+waterTime*.7); float b=sin(wavePosition.x*-.12+wavePosition.y*.34-waterTime*.5); float waveFade=1.0-smoothstep(1.0,5.0,length(fwidth(wavePosition))); a*=waveFade; b*=waveFade; normal=normalize(normal+vec3(a*.09,b*.09,0.0)); diffuseColor.rgb*=.9+.06*a+.04*b;`).replace('#include <opaque_fragment>',`float fresnel=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0); outgoingLight=mix(outgoingLight,vec3(.45,.65,.68),fresnel*.5); float shine=pow(max(0.0,sin(wavePosition.x*.12+wavePosition.y*.08+waterTime)*sin(wavePosition.y*.16-wavePosition.x*.03-waterTime*.8)),20.0); outgoingLight+=vec3(.8,.88,.76)*shine*waveFade*waterLight*.08;\n#include <opaque_fragment>`);};
 add(oceanGeometry(),water);
 addRiverWater(add,waterTime,waterLight,waterRain);
 // Deterministic irregular tropical growth; activity spaces stay clear.
 const trunkGeo=new THREE.CylinderGeometry(...TRUNK_GEOMETRY),trunks=forest,rocks=[];
 const reserved=isReserved;
 const pose=new THREE.Object3D(),tiles=new Map();
 for(const tree of trunks){const key=`${Math.floor(tree.x/160)},${Math.floor(tree.z/160)}`;if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(tree);}
 const canopyMap=new THREE.TextureLoader().load(new URL('./assets/rainforest-canopy.png',document.baseURI).href);canopyMap.colorSpace=THREE.SRGBColorSpace;canopyMap.anisotropy=4;
 const canopyMaterial=material(0xffffff,{map:canopyMap,alphaTest:.32,side:THREE.DoubleSide}),canopyGeometry=new THREE.PlaneGeometry(1,1),branchGeometry=new THREE.CylinderGeometry(.04,.15,1,6);
 // Clear the line to Patch through the canopy cards while using his tracking camera.
 const trackingPatch = { value: false }, trackingTarget = { value: new THREE.Vector3() };
 canopyMaterial.userData.trackingCutaway = true;
 canopyMaterial.onBeforeCompile = shader => {
  shader.uniforms.trackingPatch = trackingPatch;
  shader.uniforms.trackingTarget = trackingTarget;
  shader.vertexShader = shader.vertexShader
   .replace('#include <common>', '#include <common>\nvarying vec3 canopyPosition;')
   .replace('#include <project_vertex>', `#include <project_vertex>
vec4 canopyPoint = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
 canopyPoint = instanceMatrix * canopyPoint;
#endif
canopyPosition = (modelMatrix * canopyPoint).xyz;`);
  shader.fragmentShader = shader.fragmentShader
   .replace('#include <common>', `#include <common>
varying vec3 canopyPosition;
uniform bool trackingPatch;
uniform vec3 trackingTarget;`)
   .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
if (trackingPatch) {
 vec3 sightLine = trackingTarget - cameraPosition;
 float depth = dot(canopyPosition - cameraPosition, sightLine) / max(dot(sightLine, sightLine), .001);
 vec3 nearest = cameraPosition + clamp(depth, 0.0, 1.0) * sightLine;
 if (distance(canopyPosition, nearest) < mix(.4, 1.55, clamp(depth, 0.0, 1.0))) discard;
}`);
 };
 function setTrackingTarget(position) {
  trackingPatch.value = Boolean(position);
  if (position) {
   trackingTarget.value.copy(position);
   trackingTarget.value.y += 1;
  }
 }
 // Independent chunks let the camera cull forests outside its field of view.
 for(const chunk of tiles.values()){
  const palms=chunk.filter(t=>!t.broad),broadTrees=chunk.filter(t=>t.broad),trunkMesh=new THREE.InstancedMesh(trunkGeo,bark,chunk.length),leafMesh=new THREE.InstancedMesh(blade,foliage,palms.length*7),canopyMesh=new THREE.InstancedMesh(canopyGeometry,canopyMaterial,broadTrees.length*3);
  chunk.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),visibleHeight=tree.h+(tree.swing?SWING_TREE.canopyExtension:0);pose.position.set(tree.x,y+visibleHeight/2,tree.z);pose.rotation.set(0,tree.angle,tree.grove?BANANA_TREE.trunkLean:0);pose.scale.set(tree.grove?BANANA_TREE.trunkScale:1,visibleHeight,tree.grove?BANANA_TREE.trunkScale:1);pose.updateMatrix();trunkMesh.setMatrixAt(i,pose.matrix);});
  palms.forEach((tree, i) => {
   const y = groundHeight(tree.x, tree.z);
   for (let j = 0; j < 7; j++) {
    const size = (tree.grove ? BANANA_TREE.leafScale : 1.05) + rand(i * 9 + j) * .5;
    const leaf = palmLeafPose(tree.angle, j, size, tree.h);
    pose.position.set(tree.x, y + leaf.position[1], tree.z);
    pose.rotation.set(...leaf.rotation);
    pose.scale.set(...leaf.scale);
    pose.updateMatrix();
    leafMesh.setMatrixAt(i * 7 + j, pose.matrix);
   }
  });
  broadTrees.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),w=9+rand(i+81)*5;for(let j=0;j<3;j++){pose.position.set(tree.x,y+tree.h+(tree.swing?SWING_TREE.canopyExtension:.8),tree.z);if(tree.swing){pose.position.y-=.4+j*.08;pose.rotation.set(-Math.PI/2,0,tree.angle+j*Math.PI/3);pose.scale.set(w,w*.8,1);}else{pose.rotation.set(0,tree.angle+j*Math.PI/3,0);pose.scale.set(w,w*.48,1);}pose.updateMatrix();canopyMesh.setMatrixAt(i*3+j,pose.matrix);}});
  const branches=new THREE.InstancedMesh(branchGeometry,bark,broadTrees.length*2);broadTrees.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),height=tree.h+(tree.swing?SWING_TREE.canopyExtension:0);for(let j=0;j<2;j++){const angle=tree.angle+j*2.8,start=new THREE.Vector3(tree.x,y+height*.7,tree.z),end=new THREE.Vector3(tree.x+Math.cos(angle)*2.6,y+height+.4,tree.z+Math.sin(angle)*2.6),direction=end.clone().sub(start);pose.position.copy(start).add(end).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());pose.scale.set(1,direction.length(),1);pose.updateMatrix();branches.setMatrixAt(i*2+j,pose.matrix);}});
  for(const tree of chunk){if(tree.swing||tree.grove)continue;
   const id='base:tree:'+forest.indexOf(tree),origin=[tree.x,groundHeight(tree.x,tree.z),tree.z],bounds=[[-.7,0,-.7],[.7,tree.h,.7]];
   registry.instance(id,'Forest tree',trunkMesh,chunk.indexOf(tree),origin,bounds);
   const pi=palms.indexOf(tree),bi=broadTrees.indexOf(tree);
   if(pi>=0)for(let j=0;j<7;j++)registry.instance(id,'Forest tree',leafMesh,pi*7+j,origin,bounds);
   if(bi>=0){for(let j=0;j<3;j++)registry.instance(id,'Forest tree',canopyMesh,bi*3+j,origin,bounds);for(let j=0;j<2;j++)registry.instance(id,'Forest tree',branches,bi*2+j,origin,bounds);}
  }
  for(const mesh of [trunkMesh,leafMesh,canopyMesh,branches])if(mesh.count){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);}
 }
 // Layered understory turns the trunks into a living forest.
 const understory=[];for(let i=0;i<2200;i++){let x=(rand(i+31000)*2-1)*300,z=(rand(i+36000)*2-1)*335;if(shoreFraction(x,z)>.87||reserved(x,z)||rand(i+39000)>.45)continue;understory.push({x,z,size:.35+rand(i+42000)*.5,angle:rand(i+44000)*6});}
 const lowLeaves=new THREE.InstancedMesh(blade,foliage,understory.length*3);understory.forEach((p,i)=>{for(let k=0;k<3;k++){pose.position.set(p.x,groundHeight(p.x,p.z)+.12,p.z);pose.rotation.set(-.6,p.angle+k*2.1,0);pose.scale.setScalar(p.size);pose.updateMatrix();lowLeaves.setMatrixAt(i*3+k,pose.matrix);}});lowLeaves.instanceMatrix.needsUpdate=true;lowLeaves.computeBoundingSphere();scene.add(lowLeaves);
 // Banana bunches grow in the grove, with visible curved fruit beneath the leaves.
 const fruit = new THREE.InstancedMesh(new THREE.TorusGeometry(...FRUIT_GEOMETRY),
  material(BANANA_TREE.fruitColor), bananaTrees.length * BANANA_TREE.fruitCount);
 bananaTrees.forEach((tree, i) => {
  const ground = groundHeight(tree.x, tree.z);
  for (let k = 0; k < BANANA_TREE.fruitCount; k++) {
   const { position: [x, y, z], rotation } = bananaFruitConnector(k);
   pose.position.set(tree.x + x, ground + y, tree.z + z);
   pose.rotation.set(...rotation);
   pose.scale.setScalar(1);
   pose.updateMatrix();
   fruit.setMatrixAt(i * BANANA_TREE.fruitCount + k, pose.matrix);
  }
 });
 fruit.instanceMatrix.needsUpdate = true;
 fruit.computeBoundingSphere();
 scene.add(fruit);
 // The meadow remains open and is dotted with small flowers.
 const flowers=[];for(let i=0;i<500;i++){let a=rand(i+50000)*6.283,r=Math.sqrt(rand(i+51000))*45,x=places.meadow[0]+Math.cos(a)*r,z=places.meadow[1]+Math.sin(a)*r;if(shoreFraction(x,z)<.89)flowers.push([x,z,i]);}
 const flowerMap=new THREE.TextureLoader().load(new URL('./assets/wildflowers.png',document.baseURI).href);flowerMap.colorSpace=THREE.SRGBColorSpace;flowerMap.anisotropy=4;const flowerMat=material(0xffffff,{map:flowerMap,alphaTest:.65,side:THREE.DoubleSide}),flowerMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),flowerMat,flowers.length*2);flowers.forEach(([x,z,i],k)=>{for(let j=0;j<2;j++){const scale=.5+rand(i+52000)*.4;pose.position.set(x,groundHeight(x,z)+scale*.42,z);pose.rotation.set(0,rand(i+53000)*3+j*Math.PI/2,0);pose.scale.setScalar(scale);pose.updateMatrix();flowerMesh.setMatrixAt(k*2+j,pose.matrix);}});flowerMesh.instanceMatrix.needsUpdate=true;flowerMesh.computeBoundingSphere();scene.add(flowerMesh);
 // Every forest tree has an outward handhold. The traversal trees use the
 // same anchor calculation, so their visible wood and Patch's grip coincide.
 const handholds=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.18,1,7),bark,forest.length);
 forest.forEach((tree,i)=>{const {x,z,h}=tree,a=new THREE.Vector3(...anchorFor([x,z,h])),start=new THREE.Vector3(x,a.y,z),d=a.clone().sub(start);pose.position.copy(start).add(a).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());pose.scale.set(1,a.distanceTo(start),1);pose.updateMatrix();handholds.setMatrixAt(i,pose.matrix);});
 forest.forEach((tree,i)=>{if(!tree.swing&&!tree.grove)registry.instance('base:tree:'+i,'Forest tree',handholds,i,[tree.x,groundHeight(tree.x,tree.z),tree.z],[[-.7,0,-.7],[.7,tree.h,.7]]);});
 handholds.instanceMatrix.needsUpdate=true;handholds.computeBoundingSphere();scene.add(handholds);
 // Rope trees have their own visible rope even when Patch is elsewhere.
 const ropes=new Map();for(const i of ROPE_TREES){const hold=holdFor(i),geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...hold.anchor),new THREE.Vector3(...hold.grip)]),line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xb39a6c}));scene.add(line);ropes.set(i,line);
  const [x,y,z]=hold.anchor,[tx,tz]=trees[i],dx=x-tx,dz=z-tz;
  // A broad, visible bough supports his landing and resting pose at the rope top.
  beam(wood,[tx,groundHeight(tx,tz)+trees[i][2]+2.5,tz],[x,y-.3,z],.32,.42);
  beam(wood,[tx,y-.3,tz],[x+dx*.8,y-.3,z+dz*.8],.42,.42);
 }
 function setRope(i,end){const line=ropes.get(i);if(!line)return;const p=line.geometry.attributes.position,hold=holdFor(i),tip=end||[hold.anchor[0],groundHeight(hold.anchor[0],hold.anchor[2])+.3,hold.anchor[2]];p.setXYZ(1,...tip);p.needsUpdate=true;line.geometry.computeBoundingSphere();}
 // Scrub, flowers and coastal stones are instanced rather than individual meshes.
 for(let i=0;i<600;i++){let x=(rand(i+16000)*2-1)*300,z=(rand(i+18000)*2-1)*340;if(shoreFraction(x,z)>.93||reserved(x,z)||rand(i+19000)<.5)continue;const s=.4+rand(i+20000)*2;rocks.push({x,z,s});}
 const rockMesh=new THREE.InstancedMesh(boulder,rock,rocks.length);rockMesh.count=0;rocks.forEach((r,i)=>{pose.position.set(r.x,groundHeight(r.x,r.z)+r.s*.25,r.z);pose.rotation.set(.1,rand(i+41)*6,.15);pose.scale.set(r.s*1.3,r.s*.55,r.s);pose.updateMatrix();if(walkSolids.rock(r.x,r.z,boulder,pose.matrix,true,false)){const index=rockMesh.count++;rockMesh.setMatrixAt(index,pose.matrix);registry.instance('base:scatter:'+i,'Scattered boulder',rockMesh,index,[r.x,groundHeight(r.x,r.z)+r.s*.25,r.z],[[-r.s*1.6,-r.s,-r.s*1.6],[r.s*1.6,r.s,r.s*1.6]]);}});rockMesh.instanceMatrix.needsUpdate=true;rockMesh.computeBoundingSphere();scene.add(rockMesh);
 const hy=groundHeight(hammock.x,hammock.z);
 addCampHammock(scene, rope).catch(error => console.error('Could not load the camp hammock:', error));
 for(const x of [4.2,6.2]){beam(wood,[x,hy,2],[x,hy+3.4,2],.07);walkSolids.ellipse(x,2,.07,.07);}for(const y of [hy+1.35,hy+2.5]){const shelf=add(new THREE.BoxGeometry(2.5,.13,.9),wood,5.2,y,2);shelf.rotation.y=.03;block(shelf);}
 // Simple useful objects make the clearing feel inhabited without moving Patch's anchors.
 const lamp=add(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xffd99c}),5,hy+2.74,2);
 const basket=add(new THREE.CylinderGeometry(.65,.48,.65,12),wood,6,hy+.33,-1);basket.rotation.z=.05;walkSolids.ellipse(6,-1,.65,.65);
 const basketRim=add(new THREE.TorusGeometry(.65,.045,6,24),rope,6,hy+.68,-1);basketRim.rotation.x=Math.PI/2;
 for(let i=0;i<4;i++){const fruit=add(new THREE.TorusGeometry(.23,.065,6,12,Math.PI*1.25),material(0xd7bc58),5.7+i*.19,hy+.75,-1);fruit.rotation.set(.4,i*.8,.25);}
 for(const [x,z] of [[-5,5],[-7,4],[8,-4]]){let y=groundHeight(x,z);walkSolids.log(x-1,z,x+1,z+.35,.12);beam(wood,[x-1,y+.12,z],[x+1,y+.2,z+.35],.12,.08);}
 // Boulders and reeds frame the pool, leaving open banks and the river mouth.
 const reedData=[];
 for(let i=0;i<40;i++){
  const angle=i*Math.PI*2/40,edge=pondOutline(angle);
  const x=ISLAND.pondX+Math.cos(angle)*ISLAND.pondRX*edge*.94;
  const z=ISLAND.pondZ+Math.sin(angle)*ISLAND.pondRZ*edge*.94;
  const channel=streamInfo(x,z);
  if(Math.abs(Math.sin(angle))<.36||channel.distance<channel.width+4||pondSwings.some(s=>Math.hypot(x-s.x,z-s.z)<4))continue;
  if(i%3!==0&&!nearPondStairs(x,z,2))stone(x,z,.9+rand(i)*1.6,.55+rand(i+40)*1.1,.8+rand(i+90)*1.4);
  if(i%4===0)for(let j=0;j<4;j++)reedData.push({x:x+j*.2,y:groundHeight(x+j*.2,z),z,h:.8+rand(i+j)*.8});
 }
 const reeds=new THREE.InstancedMesh(new THREE.CylinderGeometry(.01,.025,1,5),material(0x567343),reedData.length);
 reedData.forEach((p,i)=>{pose.position.set(p.x,p.y+p.h/2,p.z);pose.rotation.set(0,0,-.1);pose.scale.set(1,p.h,1);pose.updateMatrix();reeds.setMatrixAt(i,pose.matrix);});
 reeds.instanceMatrix.needsUpdate=true;reeds.computeBoundingSphere();scene.add(reeds);
 const shoreStones=new THREE.InstancedMesh(boulder,rock,420);
 shoreStones.count=0;
 for(let i=0;i<420;i++){
  const angle=rand(i+8400)*Math.PI*2,edge=pondOutline(angle)*(.83+rand(i+9200)*.31);
  const x=ISLAND.pondX+Math.cos(angle)*ISLAND.pondRX*edge;
  const z=ISLAND.pondZ+Math.sin(angle)*ISLAND.pondRZ*edge;
  const y=groundHeight(x,z),stream=streamInfo(x,z);
  if(y<ISLAND.pondY-.12||nearPondStairs(x,z,.2)||stream.distance<stream.width+2)continue;
  const slab=i%9===0,size=slab?.28+rand(i+2100)*.49:.052+rand(i+6300)*.15;
  pose.position.set(x,y+.018,z);
  pose.rotation.set(.1,rand(i+8600)*Math.PI*2,.13);
  pose.scale.set(size,slab?size*.19:size*.51,size*.74);
  pose.updateMatrix();
  shoreStones.setMatrixAt(shoreStones.count++,pose.matrix);
 }
 shoreStones.instanceMatrix.needsUpdate=true;shoreStones.computeBoundingSphere();scene.add(shoreStones);
 // Flat bedrock, loose gravel and low ferns frame the inland reach above the falls.
 const bedStones=new THREE.InstancedMesh(boulder,rock,360);
 const riverFerns=new THREE.InstancedMesh(blade,foliage,240);
 bedStones.count=0;
 riverFerns.count=0;
 for(let i=0;i<360;i++){
  const station=THREE.MathUtils.lerp(RIVER.entry+2,RIVER.lip-3,rand(i+4400));
  const side=i%2===0?-1:1;
  const slab=i%11===0;
  const point=riverPoint(station,side*(slab?.54+rand(i+4500)*.57:.24+rand(i+4500)*.88));
  const height=groundHeight(point.x,point.z);
  const size=slab?.45+rand(i+4600)*1.1:.045+rand(i+4600)**2*.26;
  pose.position.set(point.x,height+(slab?.015:.035),point.z);
  pose.rotation.set(.08,point.heading+rand(i+4700)*1.6,.10);
  pose.scale.set(size,slab?size*.14:size*.48,size*(slab?1.38:.79));
  pose.updateMatrix();
  bedStones.setMatrixAt(bedStones.count++,pose.matrix);
  if(i%12!==0)continue;
  const bank=riverPoint(station,(i%24===0?-1:1)*(1.14+rand(i+4800)*.37));
  const bankHeight=groundHeight(bank.x,bank.z);
  if(bankHeight<bank.y+.22)continue;
  for(let leaf=0;leaf<8;leaf++){
   pose.position.set(bank.x,bankHeight+.08,bank.z);
   pose.rotation.set(-.32-leaf%3*.14,leaf*Math.PI/4+rand(i+4900),0);
   pose.scale.setScalar(.25+rand(i+leaf+5100)*.29);
   pose.updateMatrix();
   riverFerns.setMatrixAt(riverFerns.count++,pose.matrix);
  }
 }
 for(const mesh of [bedStones,riverFerns]){
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
 }
 for(let s=RIVER.entry+8;s<RIVER.foot+4;s+=4){
  for(const side of [-1,1]){
   const falls=s>RIVER.lip-8;
   const point=riverPoint(s,side*(falls?1.10:1.02+rand(s+side)*.17));
   const size=falls?2.9+rand(s+side)*1.6:1+rand(s+side)*1.6;
   stone(point.x,point.z,size,falls?size*.92:size*.56,size*.85);
  }
 }

 // Curved sheltered cave: separate wall stones and roof leave a real opening.
 const [cx,cz]=places.cave,cy=groundHeight(cx,cz),caveVertices=[],caveUV=[],caveIndex=[],caveLong=20,caveArch=36;
 // A continuous arched rock shell gives the cave an actual interior.
 for(let j=0;j<=caveLong;j++)for(let i=0;i<=caveArch;i++){const t=j/caveLong,a=i/caveArch*Math.PI,z=cz-3-t*16,rough=.25*Math.sin(i*2.1+j*1.7)+.15*Math.cos(i*3.7-j*.9),width=5.8+.5*Math.sin(t*5),x=cx+Math.cos(a)*(width+rough),y=groundHeight(x,z)+Math.sin(a)*(6.2+rough);caveVertices.push(x,y,z);caveUV.push(i/caveArch*3,t*4);}
 for(let j=0;j<caveLong;j++)for(let i=0;i<caveArch;i++){const a=j*(caveArch+1)+i,b=a+1,c=a+caveArch+1,d=c+1;caveIndex.push(a,c,b,b,c,d);}
 const caveGeo=new THREE.BufferGeometry();caveGeo.setAttribute('position',new THREE.Float32BufferAttribute(caveVertices,3));caveGeo.setAttribute('uv',new THREE.Float32BufferAttribute(caveUV,2));caveGeo.setIndex(caveIndex);caveGeo.computeVertexNormals();add(caveGeo,material(0xbab9ad,{map:rockMap,side:THREE.DoubleSide}));
 for(const [x,z,sx,sy,sz] of [[cx-8,cz-5,2.3,3.6,3],[cx+8,cz-5,2.3,3.6,3],[cx-8,cz-15,2.5,3.4,3],[cx+8,cz-15,2.5,3.4,3]])stone(x,z,sx,sy,sz);
 const floorPositions=[],floorIndices=[],floorUV=[];for(let j=0;j<=20;j++)for(let i=0;i<=10;i++){const x=cx-4.6+i*.92,z=cz-3-j*.61;floorPositions.push(x,groundHeight(x,z)+.08,z);floorUV.push(i/10*3,j/20*4);}for(let j=0;j<20;j++)for(let i=0;i<10;i++){const a=j*11+i,b=a+1,c=a+11,d=c+1;floorIndices.push(a,b,c,b,d,c);}const floorGeo=new THREE.BufferGeometry();floorGeo.setAttribute('position',new THREE.Float32BufferAttribute(floorPositions,3));floorGeo.setAttribute('uv',new THREE.Float32BufferAttribute(floorUV,2));floorGeo.setIndex(floorIndices);floorGeo.computeVertexNormals();add(floorGeo,material(0x716b5b,{map:rockMap,side:THREE.DoubleSide,emissive:0x2d1e10,emissiveIntensity:.45}));
 const backShape=new THREE.Shape();backShape.moveTo(-5.3,0);backShape.quadraticCurveTo(-5.3,5.6,0,5.6);backShape.quadraticCurveTo(5.3,5.6,5.3,0);backShape.lineTo(-5.3,0);const caveBack=add(new THREE.ShapeGeometry(backShape,24),material(0x282e27,{side:THREE.DoubleSide}),cx,groundHeight(cx,cz-15.2),cz-15.2);
 const lanternY=groundHeight(cx-3,cz-6)+3;beam(wood,[cx-6,lanternY+.3,cz-6],[cx-3,lanternY+.3,cz-6],.07,.05);beam(rope,[cx-3,lanternY+.3,cz-6],[cx-3,lanternY,cz-6],.025);const lantern=add(new THREE.SphereGeometry(.22,8,6),new THREE.MeshBasicMaterial({color:0xffd68b}),cx-3,lanternY,cz-6);
 // Lookout rocks and beach driftwood are positioned away from their routes.
 for(let i=0;i<10;i++){let a=i*6.28/10,x=places.lookout[0]+Math.cos(a)*10,z=places.lookout[1]+Math.sin(a)*9;stone(x,z,1.5,1,1.2);}
 // Climbing rocks keep their front exactly flat for Patch's braced feet; only the sides, back and top are rough.
 for(const w of CLIMB_WALLS){const height=w.top-w.bottom,geo=new THREE.BoxGeometry(w.width,height,w.depth,14,8,6),p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),behind=Math.max(0,Math.min(1,(w.depth/2-z)/.35)),bump=(Math.sin(x*3.1+y*2.3)*Math.cos(z*4.7-x)*.12+Math.sin(y*5.3+z*2.9)*.05)*behind;p.setXYZ(i,x*(1+bump*.25),y+(y>height/2-.01?bump*.6-.12*behind:0),z+bump);}geo.computeVertexNormals();const face=add(geo,rock,w.x-w.normal[0]*w.depth/2,w.bottom+height/2,w.z-w.normal[1]*w.depth/2);face.rotation.y=Math.atan2(w.normal[0],w.normal[1]);const lip=add(new THREE.BoxGeometry(w.width-.5,.09,.14),rock,w.x+w.normal[0]*.07,w.ledges[0]-.045,w.z+w.normal[1]*.07);lip.rotation.y=face.rotation.y;}
 for(const [x,z] of [[278,32],[268,41],[285,9]]){const y=groundHeight(x,z);walkSolids.log(x-2.2,z,x+2,z+1,.24);beam(wood,[x-2.2,y+.2,z],[x+2,y+.4,z+1],.24,.14);}
 // Coastal outcrops sit beyond the walking boundary and break up the sand rim.
 const coastal=[];for(let i=0;i<62;i++){const band=i<35?-.72:-2.05,a=band+(rand(i+72000)-.5)*.75,q=1.015+rand(i+73000)*.055,r=coastRadius(a)*q,x=Math.cos(a)*ISLAND.radiusX*r,z=Math.sin(a)*ISLAND.radiusZ*r;coastal.push({x,z,s:2+rand(i+74000)*4,a});}
 const coastalMesh=new THREE.InstancedMesh(boulder,rock,coastal.length);coastal.forEach((p,i)=>{pose.position.set(p.x,groundHeight(p.x,p.z)+.4,p.z);pose.rotation.set(.1,rand(i+75000)*6,.12);pose.scale.set(p.s*1.4,p.s*.65,p.s);pose.updateMatrix();coastalMesh.setMatrixAt(i,pose.matrix);walkSolids.rock(p.x,p.z,boulder,pose.matrix);});coastalMesh.instanceMatrix.needsUpdate=true;coastalMesh.computeBoundingSphere();scene.add(coastalMesh);
 // Tidal basins are carved into the same heightfield used by visitors.
 for(const pool of TIDE_POOLS){const [x,z,rx,rz]=pool,p=add(new THREE.CircleGeometry(1,32),water,x,tideWaterHeight(pool),z);p.rotation.x=-Math.PI/2;p.scale.set(rx*.8,rz*.8,1);for(let i=0;i<7;i++){const a=i*6.28/7,px=x+Math.cos(a)*rx*1.2,pz=z+Math.sin(a)*rz*1.2;stone(px,pz,1,.6,.8);}}
 const boulderMesh=new THREE.InstancedMesh(boulder,rock,stones.length);stones.forEach((p,i)=>{pose.position.set(p.x,groundHeight(p.x,p.z)+p.sy*.10,p.z);pose.rotation.set(rand(p.x+p.z)*.4,rand(p.x-p.z)*6,.1);pose.scale.set(p.sx,p.sy,p.sz);pose.updateMatrix();boulderMesh.setMatrixAt(i,pose.matrix);if(Math.hypot(p.x-places.cave[0],p.z-places.cave[1])<25)walkSolids.rock(p.x,p.z,boulder,pose.matrix);else registry.instance('base:rock:'+i,'Boulder',boulderMesh,i,[p.x,groundHeight(p.x,p.z)+p.sy*.10,p.z],[[-p.sx,-p.sy,-p.sz],[p.sx,p.sy,p.sz]]);});boulderMesh.instanceMatrix.needsUpdate=true;boulderMesh.computeBoundingSphere();scene.add(boulderMesh);
 // Chairs, the camp table and the coconut computer.
 const furniture=createFurniture(scene,{bark,wood},block,registry);
 addCampRulesSign(scene, walkSolids, { bark, wood, rope, foliage }, blade);
 const updateEditorLayout=layout=>{const boxes=boundsCollision(registry.collisionBoxes(layout),groundHeight),fixtures=registry.fixtureCollision(layout,groundHeight);editorBlocks=(...args)=>boxes(...args)||fixtures(...args);applyCampRecords(campRecords(layout,CAMP_DEFAULTS));};
 updateEditorLayout({objects:[]});
 return { registry, setEditorLayout:updateEditorLayout, walkSolids, block, setRope, pondScenery, setTrackingTarget, setComputer:furniture.setComputer, resetRopes(){for(const i of ROPE_TREES)setRope(i,null);}, update(dt,daylight,rain=0){waterRain.value=rain;pondScenery.update(dt);furniture.update(dt,daylight);waterTime.value+=dt;waterLight.value=daylight;foliage.emissiveIntensity=.05+daylight*.3;} };
}
