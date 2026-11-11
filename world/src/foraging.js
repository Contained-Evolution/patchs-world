import { places } from './terrain.js';
import { forest } from './forest.js';
import { walkable } from './visitor-controls.js';
import { trunkClearance, rng } from './patch-motion.js';
import { CLIPS } from './patch-clips.js';

export const FOOD_STORE = places['banana-grove'];
const mix=(a,b,t)=>a+(b-a)*t;
// Clear spokes keep every basket trip on dry ground and outside tree trunks.
export function forageTrees(){
 const [x,z]=FOOD_STORE;
 return forest.filter(t=>t.grove&&Math.hypot(t.x-x,t.z-z)<30).map(tree=>{
  const d=Math.hypot(tree.x-x,tree.z-z),end=[tree.x+(x-tree.x)/d*1.05,tree.z+(z-tree.z)/d*1.05];
  return {tree,end};
 }).filter(({end})=>{
  const n=Math.ceil(Math.hypot(end[0]-x,end[1]-z)*4);let prev=[x,z];
  for(let i=1;i<=n;i++){const p=[mix(x,end[0],i/n),mix(z,end[1],i/n)];if(!walkable(...p,...prev)||trunkClearance(...p)<.7)return false;prev=p;}
  return true;
 });
}
export function foragePlan(seed){
 const random=rng(seed),trees=forageTrees(),segments=[];let endTime=0,trip=0;
 function add(clip,duration,from,to,extra={}){segments.push({clip,t0:endTime,t1:endTime+duration,from,to,...extra});endTime+=duration;}
 function next(){
  if(!trees.length){add('idle',30,FOOD_STORE,FOOD_STORE);return;}
  const {tree,end}=trees[Math.floor(random()*trees.length)],home=FOOD_STORE,d=Math.hypot(end[0]-home[0],end[1]-home[1]);
  const gait=['carry-walk','carry-jog','carry-run'][trip++%3],speed={'carry-walk':1.05,'carry-jog':1.8,'carry-run':2.8}[gait];
  const faceTree=Math.atan2(tree.x-end[0],tree.z-end[1]);
  const still=(clip,at,extra={})=>add(clip,CLIPS[clip].duration,at,at,extra);
  still('pick-up',home,{basket:'lifting',filled:false,heading:0});
  add(gait,d/speed,home,end,{basket:'held',filled:false,moving:true});
  still('carry-stop',end,{basket:'held',filled:false,heading:faceTree});
  still('pick-up',end,{basket:'lowering',reverse:true,heading:faceTree});
  still('pick-fruit',end,{basket:'ground',heading:faceTree,picking:true});
  still('pick-up',end,{basket:'lifting',filled:true,heading:faceTree});
  add(gait,d/speed,end,home,{basket:'held',filled:true,moving:true});
  still('carry-stop',home,{basket:'held',filled:true,heading:0});
  still('pick-up',home,{basket:'lowering',reverse:true,filled:true,heading:0});
  still('open-lid',home,{basket:'ground',filled:true,heading:0,opening:true});
  still('pick-up',home,{basket:'ground',filled:true,heading:0,deposit:true});
  still('open-lid',home,{basket:'ground',heading:0,closing:true,reverse:true});
 }
 return {at(seconds){
  seconds=Math.max(0,seconds);while(endTime<=seconds)next();
  let lo=0,hi=segments.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(segments[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const seg=segments[lo],progress=(seconds-seg.t0)/(seg.t1-seg.t0),time=seconds-seg.t0;
  return {...seg,x:mix(seg.from[0],seg.to[0],progress),z:mix(seg.from[1],seg.to[1],progress),heading:seg.heading??Math.atan2(seg.to[0]-seg.from[0],seg.to[1]-seg.from[1]),progress,time:seg.reverse?CLIPS[seg.clip].duration-time:time,filled:seg.picking?progress>.72:seg.deposit?progress<.6:!!seg.filled,lid:seg.opening?Math.min(1,progress*1.6):seg.closing?Math.max(0,1-progress*1.6):seg.deposit?1:0};
 }};
}
