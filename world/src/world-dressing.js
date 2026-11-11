import * as THREE from 'three';
import { places, paths, trees, groundHeight } from './world-state.js';
import { shoreFraction } from './terrain.js';

const routes=Object.values(paths).flatMap(route=>route.slice(1).map((p,i)=>[route[i],p]));
function segmentDistance(x,z,[a,b]) {
  const dx=b[0]-a[0],dz=b[1]-a[1],denom=dx*dx+dz*dz;
  const t=denom?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/denom)):0;
  return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
// A stable scatter that leaves activity, swing and route clearances untouched.
export function plantPositions() {
  const result=[]; let seed=18391;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<1400;i++){
    const x=(random()*2-1)*43,z=(random()*2-1)*34,r=random(),scale=.65+random()*.7,turn=random()*Math.PI*2;
    if(shoreFraction(x,z)>.79 || Object.values(places).some(([px,pz])=>Math.hypot(x-px,z-pz)<3.5) || routes.some(segment=>segmentDistance(x,z,segment)<2.1) || trees.some(([tx,tz])=>Math.hypot(x-tx,z-tz)<1.2) || Math.hypot(x-18,z-10)<6 || Math.hypot(x-21,z-3)<3.4 || (x>-19&&x<0&&z>1&&z<17)) continue;
    result.push({x,z,scale,turn,flower:r>.87});
  }
  return result;
}
export function addWorldDressing(scene) {
  const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:1});
  const greenery=mat(0x588d52), flowerMat=mat(0xf2c77d), stone=mat(0x829082), bark=mat(0x795a3c), reed=mat(0x718d4c), pale=mat(0xd4bd85), leaf=mat(0x49884a);
  const mesh=(geo,material,x,y,z)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);scene.add(m);return m;};
  const oval=(material,x,y,z,sx,sy,sz)=>{const m=mesh(new THREE.SphereGeometry(1,10,7),material,x,y,z);m.scale.set(sx,sy,sz);return m;};
  const beam=(material,a,b,r1,r2=r1)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),o=mesh(new THREE.CylinderGeometry(r2,r1,v.length(),6),material,0,0,0);o.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
  const plants=plantPositions(),matrix=new THREE.Object3D();
  function scatter(list,geometry,material,sy){const instanced=new THREE.InstancedMesh(geometry,material,list.length);list.forEach((p,i)=>{matrix.position.set(p.x,groundHeight(p.x,p.z)+sy*p.scale/2,p.z);matrix.rotation.set(0,p.turn,0);matrix.scale.set(p.scale,p.scale,p.scale);matrix.updateMatrix();instanced.setMatrixAt(i,matrix.matrix);});instanced.instanceMatrix.needsUpdate=true;instanced.computeBoundingSphere();scene.add(instanced);}
  scatter(plants.filter(p=>!p.flower),new THREE.ConeGeometry(.08,.32,4),greenery,.32);
  scatter(plants.filter(p=>p.flower),new THREE.SphereGeometry(.08,6,4),flowerMat,.16);
  // Buttress roots and branches enrich the tall trees without changing swing anchors.
  const branches=[];
  trees.forEach(([x,z,h],i)=>{const y=groundHeight(x,z);for(let k=0;k<3;k++){const a=k*2.094+i*.7;branches.push([[x,y+.32,z],[x+Math.cos(a)*.65,y+.03,z+Math.sin(a)*.65],.12]);}const a=i*2.4;branches.push([[x,y+h*.94,z],[x+Math.cos(a)*1.5,y+h*1.02,z+Math.sin(a)*1.5],.12]);});
  const branchMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.45,1,1,6),bark,branches.length),up=new THREE.Vector3(0,1,0);
  branches.forEach(([a,b,r],i)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);matrix.position.copy(start).add(end).multiplyScalar(.5);matrix.quaternion.setFromUnitVectors(up,direction.clone().normalize());matrix.scale.set(r,direction.length(),r);matrix.updateMatrix();branchMesh.setMatrixAt(i,matrix.matrix);});branchMesh.instanceMatrix.needsUpdate=true;branchMesh.computeBoundingSphere();scene.add(branchMesh);
  // Pond reeds and a rocky lip frame the existing swim and fish area.
  for(let i=0;i<18;i++){const a=i*2*Math.PI/18;if(Math.sin(a)<-.55)continue;const x=18+Math.cos(a)*4.55,z=10+Math.sin(a)*3.25,y=groundHeight(x,z);beam(reed,[x,y,z],[x+.08,y+.8+(i%3)*.15,z+.04],.035,.018);oval(bark,x+.08,y+.86+(i%3)*.15,z+.04,.07,.18,.07);}
  // Sand-side driftwood and shells sit away from the beach route.
  for(const [x,z,a] of [[30,4,.5],[31,-8,-.7]]){const y=groundHeight(x,z);beam(bark,[x-1,y+.16,z],[x+1,y+.28,z+a],.16,.1);}
  for(let i=0;i<12;i++){const x=28+(i%4)*1.1,z=-8+Math.floor(i/4)*1.2;oval(pale,x,groundHeight(x,z)+.04,z,.12,.05,.08);}
  // Low meadow stones and flowers keep the open sky visible.
  for(const [x,z,s] of [[-24,-1,.5],[-25,5,.7],[-16,5,.4],[-22,7,.45]])oval(stone,x,groundHeight(x,z)+s*.3,z,s,s*.35,s*.7);
  // Warm lantern by the home clearing and markers on the lookout.
  beam(bark,[-3,.9,-1],[-3,2.1,-1],.08,.06);oval(flowerMat,-3,2.05,-1,.17,.22,.17);
  for(const [x,z] of [[-18,-24],[-14,-24],[-18,-20],[-14,-20]])oval(stone,x,groundHeight(x,z)+.12,z,.35,.2,.28);
  // Low forest-edge shrubs frame the clearing without obstructing the paths.
  for(const [x,z] of [[-10,-4],[-12,-8],[12,-5],[15,-9],[-8,13],[2,15]]){if(routes.some(segment=>segmentDistance(x,z,segment)<2.5))continue;const y=groundHeight(x,z);oval(leaf,x,y+.4,z,.85,.45,.7);oval(greenery,x+.55,y+.3,z+.2,.55,.35,.5);}
}
