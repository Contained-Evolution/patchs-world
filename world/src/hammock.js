import {groundHeight,places,paths} from './terrain.js';
import catalog from '../../shared/editor/catalog.json' with {type:'json'};
import {transformedBounds} from '../../shared/editor/model.mjs';
import {worldPoint,HAMMOCK_ID} from '../../shared/editor/camp.mjs';
export const hammock = {
  x: 0, z: 1, scale: 3.55, modelHeight: 1.28,
  halfLength: 1.53, halfWidth: 1.46, approach: [2.15, 1],
  sleepOffsetZ: .64, backPose: .84, sidePose: 1.43
};

const palm = { model: 'palm', scale: 5.4, bottom: -.429443, baseRadius: .41 };
const banana = { model: 'banana', scale: 4.85, bottom: -.475342, baseRadius: .36 };

// Each corner names the center of a lash point on the authored hammock mesh.
export const hammockSupports = [
  { ...palm, x: -3.15, z: -1.7, heading: -.3, corner: [-.351, .199, -.341], tie: [-.008, -.12, -.013], radius: [.058, .057] },
  { ...palm, x: 3.12, z: -1.63, heading: 1.05, corner: [.222, .226, -.426], tie: [-.008, -.10, -.013], radius: [.058, .059] },
  { ...banana, x: -3.05, z: 3.7, heading: .45, corner: [-.367, .105, .373], tie: [-.003, -.155, -.021], radius: [.047, .045] },
  { ...banana, x: 3.1, z: 3.86, heading: 2.42, corner: [.299, .05, .345], tie: [-.004, -.19, -.021], radius: [.055, .053] },
];

// Keep source geometry immutable while published placements move the live sleeping spot.
export const HAMMOCK_SOURCE=structuredClone(hammock);
export const HAMMOCK_SUPPORT_SOURCE=structuredClone(hammockSupports);

const ground=groundHeight(HAMMOCK_SOURCE.x,HAMMOCK_SOURCE.z);
export const HAMMOCK_DEFINITION=(()=>{
 const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]],colliders=[[[-HAMMOCK_SOURCE.halfLength,0,-HAMMOCK_SOURCE.halfWidth],[HAMMOCK_SOURCE.halfLength,1.6,HAMMOCK_SOURCE.halfWidth]]];
 const add=(asset,position,rotation,scale)=>{const box=transformedBounds(catalog.find(a=>a.id==='catalog:camp/'+asset+'.glb').bounds,{position,rotation,scale:[scale,scale,scale]});for(let a=0;a<3;a++){bounds[0][a]=Math.min(bounds[0][a],box[0][a]);bounds[1][a]=Math.max(bounds[1][a],box[1][a]);}};
 add('hammock',[0,HAMMOCK_SOURCE.modelHeight,0],[0,0,0],HAMMOCK_SOURCE.scale);
 for(const support of HAMMOCK_SUPPORT_SOURCE){const x=support.x-HAMMOCK_SOURCE.x,z=support.z-HAMMOCK_SOURCE.z,y=groundHeight(support.x,support.z)-ground;add(support.model,[x,y-support.bottom*support.scale-.025,z],[0,support.heading,0],support.scale);colliders.push([[x-support.baseRadius,y,z-support.baseRadius],[x+support.baseRadius,y+1.8,z+support.baseRadius]]);}
 return {id:HAMMOCK_ID,asset:HAMMOCK_ID,name:'Hammock and support palms',position:[HAMMOCK_SOURCE.x,ground,HAMMOCK_SOURCE.z],rotation:[0,0,0],scale:[1,1,1],bounds,colliders};
})();
hammock.heading=0;
export function hammockPoint(x,z){return worldPoint({position:[hammock.x,0,hammock.z],rotation:[0,hammock.heading,0]},x,z);}
export function applyHammockRecord(layout){
 const record=layout.objects.find(o=>o.id===HAMMOCK_ID)||HAMMOCK_DEFINITION;
 hammock.x=record.position[0];hammock.z=record.position[2];hammock.heading=record.rotation[1];hammock.floor=record.position[1];
 hammock.approach=worldPoint(record,HAMMOCK_SOURCE.approach[0]-HAMMOCK_SOURCE.x,HAMMOCK_SOURCE.approach[1]-HAMMOCK_SOURCE.z);
 HAMMOCK_SUPPORT_SOURCE.forEach((source,index)=>{const [x,z]=worldPoint(record,source.x-HAMMOCK_SOURCE.x,source.z-HAMMOCK_SOURCE.z);Object.assign(hammockSupports[index],{x,z,heading:source.heading+record.rotation[1]});});
 places.hammock=worldPoint(record,-HAMMOCK_SOURCE.x,-HAMMOCK_SOURCE.z);
 paths.hammock=Math.hypot(...places.hammock)<1e-9?[[0,0]]:[[0,0],[...places.hammock]];
}
