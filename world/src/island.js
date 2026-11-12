import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ISLAND, places, coastRadius, shoreFraction, groundHeight, STREAM, streamHalfWidth, TIDE_POOLS, tideWaterHeight } from './terrain.js';
import { anchorFor, holdFor, ROPE_TREES, trees } from './world-state.js';
import { forest, isReserved } from './forest.js';
import { createTerrainTiles } from './terrain-mesh.js';
import { CLIMB_WALLS } from './climbing.js';
import { createIslandCollision, bananaTrees, BANANA_TREE } from './island-collision.js';
import { hammock, hammockHeight } from './hammock.js';
import { createFurniture } from './camp-furniture.js';
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
function surfaceTexture(base, strokes, seed=1){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,512,512);
 for(let i=0;i<3800;i++){const x=rand(i+seed)*512,y=rand(i+seed+4000)*512,r=.5+rand(i+seed+8000)*3;g.globalAlpha=.05+rand(i+20000)*.15;g.fillStyle=strokes[i%strokes.length];g.beginPath();g.ellipse(x,y,r*2,r,rand(i+10)*Math.PI,0,Math.PI*2);g.fill();}
 g.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(100,110);t.anisotropy=4;return t;
}
function leafGeometry(){
 // Curved lanceolate blade, tapered at both ends, with a central ridge.
 const p=[],uv=[],idx=[],n=3;
 for(let i=0;i<=n;i++){const t=i/n,w=Math.sin(Math.PI*t)**.72*.48,y=Math.sin(t*Math.PI)*.18-t*t*.3;for(const side of [-1,0,1]){p.push(side*w,y+(side===0?.045:0),t*3.5);uv.push((side+1)/2,t);}}
 for(let i=0;i<n;i++)for(let j=0;j<2;j++){let a=i*3+j,b=a+1,c=a+3,d=c+1;idx.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function rockGeometry(){let g=mergeVertices(new THREE.IcosahedronGeometry(1,2));const p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);let f=1+.16*Math.sin(x*7+z*4)*Math.cos(y*9-z*2);p.setXYZ(i,x*f,y*f,z*f);}g.computeVertexNormals();return g;}
export function createIsland(scene){
 const walkSolids = createIslandCollision();
 const block = walkSolids.mesh;
 const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:1,...extra});
 const groundMat=material(0xffffff,{vertexColors:true,map:surfaceTexture('#dfdfdf',['#898989','#ffffff','#bbbbbb'])});
 const grassDetail=new THREE.TextureLoader().load(new URL('./assets/tropical-grass.png',document.baseURI).href);grassDetail.colorSpace=THREE.SRGBColorSpace;grassDetail.wrapS=grassDetail.wrapT=THREE.RepeatWrapping;grassDetail.anisotropy=4;
 groundMat.onBeforeCompile=shader=>{shader.uniforms.grassDetail={value:grassDetail};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 islandGround;').replace('#include <begin_vertex>','#include <begin_vertex>\nislandGround = position.xz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 islandGround; uniform sampler2D grassDetail;').replace('#include <map_fragment>',`#include <map_fragment>
vec3 detail=texture2D(grassDetail,islandGround*.18).rgb;float inland=1.0-smoothstep(.78,.95,length(islandGround/vec2(320.0,360.0)));diffuseColor.rgb*=mix(vec3(1.0),detail*1.55,inland*.8);`);};
 const barkMap=new THREE.TextureLoader().load(new URL('./assets/tropical-bark.png',document.baseURI).href);barkMap.colorSpace=THREE.SRGBColorSpace;barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;barkMap.repeat.set(1,3);barkMap.anisotropy=4;const bark=material(0xc4b3a0,{map:barkMap});
 const leafMap=new THREE.TextureLoader().load(new URL('./assets/tropical-leaf.png',document.baseURI).href);leafMap.colorSpace=THREE.SRGBColorSpace;leafMap.anisotropy=4;
 const foliage=material(0xc1d9ae,{map:leafMap,alphaTest:.35,side:THREE.DoubleSide,roughness:.9,emissive:0x334b29,emissiveMap:leafMap,emissiveIntensity:.35});const foliageDark=material(0x92b888,{map:leafMap,alphaTest:.35,side:THREE.DoubleSide,emissive:0x283e24,emissiveMap:leafMap,emissiveIntensity:.35});
 const rockMap=new THREE.TextureLoader().load(new URL('./assets/volcanic-rock.png',document.baseURI).href);rockMap.colorSpace=THREE.SRGBColorSpace;rockMap.wrapS=rockMap.wrapT=THREE.RepeatWrapping;rockMap.anisotropy=4;const rock=material(0xbab9ad,{map:rockMap});
 const sand=material(0xd8c592),wood=material(0x725039),rope=material(0xd1c7a0),cloth=material(0xb36551,{side:THREE.DoubleSide,emissive:0x26150f});
 const wet=material(0x67836b,{roughness:.55});
 const add=(geo,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);scene.add(o);return o;};
 const beam=(mat,a,b,r1,r2=r1)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const o=add(new THREE.CylinderGeometry(r2,r1,d.length(),8),mat);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;};
 const stones=[];const stone=(x,z,sx,sy,sz)=>{stones.push({x,z,sx,sy,sz});};
 const boulder=rockGeometry(),blade=leafGeometry();
 // Heightfield follows the exact same coast and ground query as movement and Patch.
 for(const geometry of createTerrainTiles())add(geometry,groundMat);
 // Transparent, sunlit moving water uses the same shader idea as Tenari's valley.
 const waterTime={value:0},waterLight={value:1};
 const water=material(0x317d87,{roughness:.25,metalness:.16,transparent:true,opacity:.83,depthWrite:false,side:THREE.DoubleSide});
 water.onBeforeCompile=shader=>{shader.uniforms.waterTime=waterTime;shader.uniforms.waterLight=waterLight;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 wavePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nwavePosition = (modelMatrix * vec4(position,1.0)).xz;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 wavePosition; uniform float waterTime; uniform float waterLight;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nfloat a=sin(wavePosition.x*.24+wavePosition.y*.14+waterTime*.7); float b=sin(wavePosition.x*-.12+wavePosition.y*.34-waterTime*.5); float waveFade=1.0-smoothstep(1.0,5.0,length(fwidth(wavePosition))); a*=waveFade; b*=waveFade; normal=normalize(normal+vec3(a*.09,b*.09,0.0)); diffuseColor.rgb*=.9+.06*a+.04*b;`).replace('#include <opaque_fragment>',`float fresnel=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0); outgoingLight=mix(outgoingLight,vec3(.45,.65,.68),fresnel*.5); float shine=pow(max(0.0,sin(wavePosition.x*.12+wavePosition.y*.08+waterTime)*sin(wavePosition.y*.16-wavePosition.x*.03-waterTime*.8)),20.0); outgoingLight+=vec3(.8,.88,.76)*shine*waveFade*waterLight*.08;\n#include <opaque_fragment>`);};
 const ocean=add(new THREE.PlaneGeometry(12000,12000),water,0,ISLAND.ocean,0);ocean.rotation.x=-Math.PI/2;
 const pond=add(new THREE.CircleGeometry(1,80),water,ISLAND.pondX,ISLAND.pondY,ISLAND.pondZ);pond.rotation.x=-Math.PI/2;pond.scale.set(ISLAND.pondRX,ISLAND.pondRZ,1);
 // Deterministic irregular tropical growth; activity spaces stay clear.
 const trunkGeo=new THREE.CylinderGeometry(.06,.5,1,8),trunks=forest,rocks=[];
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
  chunk.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),visibleHeight=tree.h+(tree.swing?3.5:0);pose.position.set(tree.x,y+visibleHeight/2,tree.z);pose.rotation.set(0,tree.angle,tree.grove?.055:0);pose.scale.set(tree.grove?.75:1,visibleHeight,tree.grove?.75:1);pose.updateMatrix();trunkMesh.setMatrixAt(i,pose.matrix);});
  palms.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z);for(let j=0;j<7;j++){pose.position.set(tree.x,y+tree.h,tree.z);pose.rotation.set(-.25-(j%3)*.12,tree.angle+j*Math.PI*2/7,(j%2)*.08);let size=(tree.grove?1.25:1.05)+rand(i*9+j)*.5;pose.scale.set(size,size,size);pose.updateMatrix();leafMesh.setMatrixAt(i*7+j,pose.matrix);}});
  broadTrees.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),w=9+rand(i+81)*5;for(let j=0;j<3;j++){pose.position.set(tree.x,y+tree.h+(tree.swing?3.5:.8),tree.z);if(tree.swing){pose.position.y-=.4+j*.08;pose.rotation.set(-Math.PI/2,0,tree.angle+j*Math.PI/3);pose.scale.set(w,w*.8,1);}else{pose.rotation.set(0,tree.angle+j*Math.PI/3,0);pose.scale.set(w,w*.48,1);}pose.updateMatrix();canopyMesh.setMatrixAt(i*3+j,pose.matrix);}});
  const branches=new THREE.InstancedMesh(branchGeometry,bark,broadTrees.length*2);broadTrees.forEach((tree,i)=>{const y=groundHeight(tree.x,tree.z),height=tree.h+(tree.swing?3.5:0);for(let j=0;j<2;j++){const angle=tree.angle+j*2.8,start=new THREE.Vector3(tree.x,y+height*.7,tree.z),end=new THREE.Vector3(tree.x+Math.cos(angle)*2.6,y+height+.4,tree.z+Math.sin(angle)*2.6),direction=end.clone().sub(start);pose.position.copy(start).add(end).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());pose.scale.set(1,direction.length(),1);pose.updateMatrix();branches.setMatrixAt(i*2+j,pose.matrix);}});
  for(const mesh of [trunkMesh,leafMesh,canopyMesh,branches])if(mesh.count){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);}
 }
 // Layered understory turns the trunks into a living forest.
 const understory=[];for(let i=0;i<2200;i++){let x=(rand(i+31000)*2-1)*300,z=(rand(i+36000)*2-1)*335;if(shoreFraction(x,z)>.87||reserved(x,z)||rand(i+39000)>.45)continue;understory.push({x,z,size:.35+rand(i+42000)*.5,angle:rand(i+44000)*6});}
 const lowLeaves=new THREE.InstancedMesh(blade,foliage,understory.length*3);understory.forEach((p,i)=>{for(let k=0;k<3;k++){pose.position.set(p.x,groundHeight(p.x,p.z)+.12,p.z);pose.rotation.set(-.6,p.angle+k*2.1,0);pose.scale.setScalar(p.size);pose.updateMatrix();lowLeaves.setMatrixAt(i*3+k,pose.matrix);}});lowLeaves.instanceMatrix.needsUpdate=true;lowLeaves.computeBoundingSphere();scene.add(lowLeaves);
 // Banana bunches grow in the grove, with visible curved fruit beneath the leaves.
 const fruitMat=material(0xd7ba4d),fruit=new THREE.InstancedMesh(new THREE.TorusGeometry(.24,.075,3,6,Math.PI*1.2),fruitMat,bananaTrees.length*4);
 bananaTrees.forEach((t,i)=>{for(let k=0;k<4;k++){pose.position.set(t.x+Math.cos(k*1.6)*.2,groundHeight(t.x,t.z)+BANANA_TREE.fruitHeight,t.z+Math.sin(k*1.6)*.2);pose.rotation.set(.2,k*1.6,0);pose.scale.setScalar(1);pose.updateMatrix();fruit.setMatrixAt(i*4+k,pose.matrix);}});fruit.instanceMatrix.needsUpdate=true;fruit.computeBoundingSphere();scene.add(fruit);
 // The meadow remains open and is dotted with small flowers.
 const flowers=[];for(let i=0;i<500;i++){let a=rand(i+50000)*6.283,r=Math.sqrt(rand(i+51000))*45,x=places.meadow[0]+Math.cos(a)*r,z=places.meadow[1]+Math.sin(a)*r;if(shoreFraction(x,z)<.89)flowers.push([x,z,i]);}
 const flowerMap=new THREE.TextureLoader().load(new URL('./assets/wildflowers.png',document.baseURI).href);flowerMap.colorSpace=THREE.SRGBColorSpace;flowerMap.anisotropy=4;const flowerMat=material(0xffffff,{map:flowerMap,alphaTest:.65,side:THREE.DoubleSide}),flowerMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),flowerMat,flowers.length*2);flowers.forEach(([x,z,i],k)=>{for(let j=0;j<2;j++){const scale=.5+rand(i+52000)*.4;pose.position.set(x,groundHeight(x,z)+scale*.42,z);pose.rotation.set(0,rand(i+53000)*3+j*Math.PI/2,0);pose.scale.setScalar(scale);pose.updateMatrix();flowerMesh.setMatrixAt(k*2+j,pose.matrix);}});flowerMesh.instanceMatrix.needsUpdate=true;flowerMesh.computeBoundingSphere();scene.add(flowerMesh);
 // Every forest tree has an outward handhold. The traversal trees use the
 // same anchor calculation, so their visible wood and Patch's grip coincide.
 const handholds=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.18,1,7),bark,forest.length);
 forest.forEach((tree,i)=>{const {x,z,h}=tree,a=new THREE.Vector3(...anchorFor([x,z,h])),start=new THREE.Vector3(x,a.y,z),d=a.clone().sub(start);pose.position.copy(start).add(a).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());pose.scale.set(1,a.distanceTo(start),1);pose.updateMatrix();handholds.setMatrixAt(i,pose.matrix);});
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
 const rockMesh=new THREE.InstancedMesh(boulder,rock,rocks.length);rockMesh.count=0;rocks.forEach((r,i)=>{pose.position.set(r.x,groundHeight(r.x,r.z)+r.s*.25,r.z);pose.rotation.set(.1,rand(i+41)*6,.15);pose.scale.set(r.s*1.3,r.s*.55,r.s);pose.updateMatrix();if(walkSolids.rock(r.x,r.z,boulder,pose.matrix,true))rockMesh.setMatrixAt(rockMesh.count++,pose.matrix);});rockMesh.instanceMatrix.needsUpdate=true;rockMesh.computeBoundingSphere();scene.add(rockMesh);
 // Home: two living supports, hanging ropes and a curved cloth bed.
 const hy=groundHeight(hammock.x,hammock.z);
 for(const x of [-3.4,3.4]){
  beam(bark,[x,hy,1],[x,hy+6,1],.38,.24);
  walkSolids.ellipse(x,1,.38,.38);
  for(let j=0;j<5;j++){let a=j*1.25;const f=add(blade,foliageDark,x,hy+5.8,1);f.rotation.set(-.3,a,0);f.scale.setScalar(1.1);}
 }
 const bedGeo=new THREE.PlaneGeometry(2,2,48,24);
 const bp=bedGeo.attributes.position;
 for(let i=0;i<bp.count;i++){
  const u=bp.getX(i),v=bp.getY(i);
  bp.setXYZ(i,u*hammock.halfLength,hammockHeight(u,v),v*hammock.halfWidth*Math.cos(u*Math.PI/2));
 }
 bedGeo.computeVertexNormals();
 add(bedGeo,cloth,hammock.x,hy,hammock.z);
 walkSolids.ellipse(hammock.x,hammock.z,hammock.halfLength,hammock.halfWidth);
 for(const x of [-1,1])beam(rope,[x*hammock.halfLength,hy+hammockHeight(1,0),1],[x*3.4,hy+4.2,1],.035);
 for(const x of [4.2,6.2]){beam(wood,[x,hy,2],[x,hy+3.4,2],.07);walkSolids.ellipse(x,2,.07,.07);}for(const y of [hy+1.35,hy+2.5]){const shelf=add(new THREE.BoxGeometry(2.5,.13,.9),wood,5.2,y,2);shelf.rotation.y=.03;block(shelf);}
 // Simple useful objects make the clearing feel inhabited without moving Patch's anchors.
 const lamp=add(new THREE.SphereGeometry(.18,8,6),new THREE.MeshBasicMaterial({color:0xffd99c}),5,hy+2.74,2);
 const basket=add(new THREE.CylinderGeometry(.65,.48,.65,12),wood,6,hy+.33,-1);basket.rotation.z=.05;walkSolids.ellipse(6,-1,.65,.65);
 const basketRim=add(new THREE.TorusGeometry(.65,.045,6,24),rope,6,hy+.68,-1);basketRim.rotation.x=Math.PI/2;
 for(let i=0;i<4;i++){const fruit=add(new THREE.TorusGeometry(.23,.065,6,12,Math.PI*1.25),material(0xd7bc58),5.7+i*.19,hy+.75,-1);fruit.rotation.set(.4,i*.8,.25);}
 for(const [x,z] of [[-5,5],[-7,4],[8,-4]]){let y=groundHeight(x,z);walkSolids.log(x-1,z,x+1,z+.35,.12);beam(wood,[x-1,y+.12,z],[x+1,y+.2,z+.35],.12,.08);}
 // Pond edge, stream, falls and waterside boulders; geometry sits on the basin.
 for(let i=0;i<30;i++){const a=i*Math.PI*2/30,x=ISLAND.pondX+Math.cos(a)*(ISLAND.pondRX+1.4),z=ISLAND.pondZ+Math.sin(a)*(ISLAND.pondRZ+1.3);if(i%4!==0&&Math.hypot(x-places.pond[0],z-places.pond[1])>5)stone(x,z,.7+rand(i)*.6,.45+rand(i+40)*.5,.6+rand(i+90)*.5);}
 const reedData=[];for(let i=0;i<22;i++){let a=i*6.28/22,x=ISLAND.pondX+Math.cos(a)*27,z=ISLAND.pondZ+Math.sin(a)*19,y=groundHeight(x,z);for(let j=0;j<3;j++)reedData.push({x:x+j*.2,y,z,h:1.4+rand(i+j)*.8});}
 const reeds=new THREE.InstancedMesh(new THREE.CylinderGeometry(.01,.025,1,5),material(0x567343),reedData.length);reedData.forEach((p,i)=>{pose.position.set(p.x+.075,p.y+p.h/2,p.z);pose.rotation.set(0,0,-.1);pose.scale.set(1,p.h,1);pose.updateMatrix();reeds.setMatrixAt(i,pose.matrix);});reeds.instanceMatrix.needsUpdate=true;reeds.computeBoundingSphere();scene.add(reeds);
 // A continuous shallow stream meets the pond; its bed uses the terrain query.
 const sv=[],si=[];for(let k=1;k<STREAM.length;k++){const a=STREAM[k-1],b=STREAM[k],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),steps=Math.ceil(len/2),nx=-dz/len,nz=dx/len,base=sv.length/3;for(let i=0;i<=steps;i++){const t=i/steps,x=a[0]+dx*t,z=a[1]+dz*t,y=a[2]+(b[2]-a[2])*t,w=streamHalfWidth(k,t);for(const side of [-1,1])sv.push(x+nx*w*side,y,z+nz*w*side);}for(let i=0;i<steps;i++){const q=base+i*2;si.push(q,q+2,q+1,q+1,q+2,q+3);}}
 const streamGeo=new THREE.BufferGeometry();streamGeo.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));streamGeo.setIndex(si);streamGeo.computeVertexNormals();add(streamGeo,water);
 // The ledge's water surface falls between two rocks, leaving both banks visible.
 const source=STREAM.at(-1),previousSource=STREAM.at(-2),sourceDX=source[0]-previousSource[0],sourceDZ=source[1]-previousSource[1],sourceLength=Math.hypot(sourceDX,sourceDZ),sourceTX=sourceDX/sourceLength,sourceTZ=sourceDZ/sourceLength,sourceNX=-sourceTZ,sourceNZ=sourceTX;for(const side of [-1,1])stone(source[0]+sourceNX*6*side,source[1]+sourceNZ*6*side,2.3,1.8,2.3);stone(source[0]+sourceTX*5,source[1]+sourceTZ*5,2.4,2.2,2.4);
 const flowCanvas=document.createElement('canvas');flowCanvas.width=128;flowCanvas.height=256;const flowCtx=flowCanvas.getContext('2d');const flowGradient=flowCtx.createLinearGradient(0,0,128,0);flowGradient.addColorStop(0,'rgba(186,226,223,0)');flowGradient.addColorStop(.2,'rgba(186,226,223,.42)');flowGradient.addColorStop(.8,'rgba(186,226,223,.42)');flowGradient.addColorStop(1,'rgba(186,226,223,0)');flowCtx.fillStyle=flowGradient;flowCtx.fillRect(0,0,128,256);for(let i=0;i<32;i++){const x=12+rand(i+12)*104;flowCtx.fillStyle=`rgba(255,255,245,${.06+rand(i+4)*.2})`;flowCtx.fillRect(x,rand(i+32)*256,1+rand(i+6)*3,30+rand(i+7)*95);}const flowMap=new THREE.CanvasTexture(flowCanvas);flowMap.wrapT=THREE.RepeatWrapping;flowMap.colorSpace=THREE.SRGBColorSpace;const fallsMat=new THREE.MeshBasicMaterial({map:flowMap,transparent:true,depthWrite:false,side:THREE.DoubleSide});const fallsGeo=new THREE.PlaneGeometry(3.4,2,12,12),fallsPositions=fallsGeo.attributes.position;for(let i=0;i<fallsPositions.count;i++){const x=fallsPositions.getX(i),y=fallsPositions.getY(i),t=(y+1)/2;fallsPositions.setX(i,x*(.82+.18*t)+.08*Math.sin(t*7));}fallsGeo.computeVertexNormals();const fallingWater=add(fallsGeo,fallsMat,source[0],source[2]+.95,source[1]);fallingWater.rotation.y=Math.atan2(sourceTX,sourceTZ);const fallDetail=new THREE.TextureLoader().load(new URL('./assets/waterfall.png',document.baseURI).href);fallDetail.colorSpace=THREE.SRGBColorSpace;const detailMat=new THREE.MeshBasicMaterial({map:fallDetail,transparent:true,alphaTest:.08,opacity:.72,depthWrite:false,side:THREE.DoubleSide});const fallOverlay=add(fallsGeo,detailMat,source[0]+sourceTX*.03,source[2]+.95,source[1]+sourceTZ*.03);fallOverlay.rotation.y=fallingWater.rotation.y;

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
 const boulderMesh=new THREE.InstancedMesh(boulder,rock,stones.length);stones.forEach((p,i)=>{pose.position.set(p.x,groundHeight(p.x,p.z)+p.sy*.10,p.z);pose.rotation.set(rand(p.x+p.z)*.4,rand(p.x-p.z)*6,.1);pose.scale.set(p.sx,p.sy,p.sz);pose.updateMatrix();boulderMesh.setMatrixAt(i,pose.matrix);walkSolids.rock(p.x,p.z,boulder,pose.matrix);});boulderMesh.instanceMatrix.needsUpdate=true;boulderMesh.computeBoundingSphere();scene.add(boulderMesh);
 // Chairs, the camp table and the coconut computer.
 const furniture=createFurniture(scene,{bark,wood},block);
 return { walkSolids, block, setRope, setTrackingTarget, setComputer:furniture.setComputer, resetRopes(){for(const i of ROPE_TREES)setRope(i,null);}, update(dt,daylight){furniture.update(dt,daylight);waterTime.value+=dt;waterLight.value=daylight;flowMap.offset.y-=dt*.7;foliage.emissiveIntensity=.05+daylight*.3;foliageDark.emissiveIntensity=.05+daylight*.3;} };
}
