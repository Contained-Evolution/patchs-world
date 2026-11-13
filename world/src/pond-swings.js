import catalog from '../../shared/editor/catalog.json' with {type:'json'};
import {transformedBounds} from '../../shared/editor/model.mjs';
import {localPoint} from '../../shared/editor/camp.mjs';
import { ISLAND, groundHeight, pondOutline } from './terrain.js';

const models={
 fig:{bottom:-.453369,tie:[.247803,-.044678,.008057],tilt:0,radius:1.7},
 palm:{bottom:-.429443,tie:[0,-.047,0],tilt:.29,radius:.91}
};
const startAngle=-.08, releaseAngle=.79, swingSeconds=1.65, gravity=9.81;
const reach=1.8;

function makeSwing(model,degrees,scale,shore) {
 const a=degrees*Math.PI/180,edge=pondOutline(a)*shore;
 const x=ISLAND.pondX+Math.cos(a)*ISLAND.pondRX*edge;
 const z=ISLAND.pondZ+Math.sin(a)*ISLAND.pondRZ*edge;
 const heading=Math.atan2(ISLAND.pondX-x,ISLAND.pondZ-z);
 return swingAt(model,x,z,scale,heading);
}

function swingAt(model,x,z,scale,heading,height=groundHeight){
 const y=height(x,z)-.09;
 const dx=Math.sin(heading),dz=Math.cos(heading);
 const {bottom,tie,tilt,radius}=models[model];
 const localY=tie[1]-bottom;
 const forward=(tie[0]*Math.cos(tilt)+localY*Math.sin(tilt))*scale;
 const cross=tie[2]*scale;
 const anchor=[x+dx*forward-dz*cross,y+(localY*Math.cos(tilt)-tie[0]*Math.sin(tilt))*scale,z+dz*forward+dx*cross];
 // Size the rope for its actual mount point, not the lower ground under the anchor.
 let length=(anchor[1]-height(anchor[0],anchor[2])-reach)/Math.cos(startAngle);
 for(let i=0;i<5;i++){
  const offset=length*Math.sin(startAngle);
  const surface=height(anchor[0]+dx*offset,anchor[2]+dz*offset);
  length=(anchor[1]-surface-reach)/Math.cos(startAngle);
 }
 const swing={model,x,y,z,heading,scale,bottom,tilt,radius,anchor,length,dx,dz};
 const start=gripAt(swing,startAngle);
 return {...swing,mount:[start[0],start[2]],start};
}

export const pondSwings=[
 makeSwing('palm',52,23,.98),
 makeSwing('palm',102,21,.98),
 makeSwing('fig',153,23,1.01),
 makeSwing('palm',239,20,.98),
 makeSwing('palm',304,22,.98)
];

export const POND_SWING_BASE=pondSwings.map(swing=>structuredClone(swing));
export const POND_SWING_DEFINITIONS=POND_SWING_BASE.map((swing,index)=>{
 const id='base:pond-swing:'+index,asset=catalog.find(a=>a.id===(swing.model==='fig'?'catalog:pond-fig.glb':'catalog:camp/palm.glb'));
 const h=-swing.bottom*swing.scale;
 const bounds=transformedBounds(asset.bounds,{position:[Math.sin(swing.tilt)*h,Math.cos(swing.tilt)*h,0],rotation:[0,0,-swing.tilt],scale:[swing.scale,swing.scale,swing.scale]});
 const record={id,asset:id,name:(swing.model==='fig'?'Fig':'Palm')+' rope swing '+(index+1),position:[swing.x,swing.y,swing.z],rotation:[0,swing.heading-Math.PI/2,0],scale:[1,1,1],bounds,colliders:[[[-swing.radius,0,-swing.radius],[swing.radius+(swing.model==='palm'?.5:0),1.8,swing.radius]]]};
 for(const point of [swing.anchor,swing.start]){const [x,z]=localPoint(record,point[0],point[2]),p=[x,point[1]-swing.y,z];for(let a=0;a<3;a++){bounds[0][a]=Math.min(bounds[0][a],p[a]-.1);bounds[1][a]=Math.max(bounds[1][a],p[a]+.1);}}
 return record;
});
export function relocatedPondSwing(index,record){const source=POND_SWING_BASE[index];return swingAt(source.model,record.position[0],record.position[2],source.scale,record.rotation[1]+Math.PI/2);}
export function applyPondRecords(layout){for(let index=0;index<pondSwings.length;index++){const base=POND_SWING_DEFINITIONS[index],record=layout.objects.find(o=>o.id===base.id)||base;Object.assign(pondSwings[index],relocatedPondSwing(index,record));}}

// Turn back along the bank at either end, where the waterfall separates the two sides.
export function nextPondSwing({index,direction}) {
 if(index+direction<0||index+direction>=pondSwings.length)direction=-direction;
 return {index:index+direction,direction,elapsed:null};
}

function gripAt(swing,angle) {
 const offset=swing.length*Math.sin(angle);
 return [swing.anchor[0]+swing.dx*offset,swing.anchor[1]-swing.length*Math.cos(angle),swing.anchor[2]+swing.dz*offset];
}

export function pondSwingPose(swing,elapsed) {
 if(elapsed<swingSeconds){
  const progress=Math.sin(elapsed/swingSeconds*Math.PI/3)/Math.sin(Math.PI/3);
  const grip=gripAt(swing,startAngle+(releaseAngle-startAngle)*progress);
  return {position:[grip[0],grip[1]-reach,grip[2]],grip,clip:'rope-swing'};
 }
 const [x,handY,z]=gripAt(swing,releaseAngle);
 const y=handY-reach;
 const speed=swing.length*(releaseAngle-startAngle)*Math.PI/3/swingSeconds/Math.sqrt(3);
 const horizontal=speed*Math.cos(releaseAngle),vertical=speed*Math.sin(releaseAngle);
 const surface=ISLAND.pondY-.35;
 const landingTime=(vertical+Math.sqrt(vertical**2+2*gravity*(y-surface)))/gravity;
 const t=Math.min(elapsed-swingSeconds,landingTime),distance=horizontal*t;
 const landed=t===landingTime;
 return {position:[x+swing.dx*distance,landed?surface:y+vertical*t-gravity*t*t/2,z+swing.dz*distance],
  clip:landed?'swim':'fall',landed};
}
