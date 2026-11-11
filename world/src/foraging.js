import { places } from './terrain.js';
import { bananaTrees, bananaPickingSpots } from './island-collision.js';
import { patchRoute, rng } from './patch-motion.js';
import { CLIPS } from './patch-clips.js';

export const FOOD_STORE = places['banana-grove'];
const mix=(a,b,t)=>a+(b-a)*t;
const lidAt=progress=>Math.min(1,Math.max(0,progress)*1.6);
const targetsByMap = new WeakMap();
export function forageTrees(solids){
 if(solids&&targetsByMap.has(solids))return targetsByMap.get(solids);
 const targets=bananaTrees.map(tree=>({tree,candidates:bananaPickingSpots(tree,FOOD_STORE,solids)}))
  .filter(({candidates})=>candidates.length);
 if(solids)targetsByMap.set(solids,targets);
 return targets;
}

export function foragePlan(seed,solids){
 const random=rng(seed),trees=forageTrees(solids),segments=[];let endTime=0,trip=0;
 const remaining=[];
 function nextTree(){
  if(!remaining.length)remaining.push(...trees);
  while(remaining.length){
   const [target]=remaining.splice(Math.floor(random()*remaining.length),1);
   if(!target.route){
    for(const end of target.candidates){
     const route=patchRoute(FOOD_STORE,end,0,[],solids);
     if(route.at(-1)[0]===end[0]&&route.at(-1)[1]===end[1]){
      target.route=route;
      break;
     }
    }
   }
   if(target.route)return target;
  }
  return null;
 }
 function add(clip,duration,from,to,extra={}){segments.push({clip,t0:endTime,t1:endTime+duration,from,to,...extra});endTime+=duration;}
 function next(){
  const target=nextTree();
  if(!target){add('idle',30,FOOD_STORE,FOOD_STORE);return;}
  const {tree,route}=target,home=route[0],end=route.at(-1);
  const gait=['carry-walk','carry-jog','carry-run'][trip++%3],speed={'carry-walk':1.05,'carry-jog':1.8,'carry-run':2.8}[gait];
  const faceTree=Math.atan2(tree.x-end[0],tree.z-end[1]);
  const still=(clip,at,extra={})=>add(clip,CLIPS[clip].duration,at,at,extra);
  still('pick-up',home,{basket:'lifting',filled:false,heading:0});
  const carry=(path,filled)=>{
   for(let i=1;i<path.length;i++){
    const from=path[i-1],to=path[i],distance=Math.hypot(to[0]-from[0],to[1]-from[1]);
    if(distance>0)add(gait,distance/speed,from,to,{basket:'held',filled,moving:true});
   }
  };
  carry(route,false);
  still('carry-stop',end,{basket:'held',filled:false,heading:faceTree});
  still('pick-up',end,{basket:'lowering',reverse:true,heading:faceTree});
  still('pick-fruit',end,{basket:'ground',heading:faceTree,picking:true,tree});
  still('pick-up',end,{basket:'lifting',filled:true,heading:faceTree});
  carry(route.slice().reverse(),true);
  still('carry-stop',home,{basket:'held',filled:true,heading:0});
  still('pick-up',home,{basket:'lowering',reverse:true,filled:true,heading:0});
  still('open-lid',home,{basket:'ground',filled:true,heading:0,opening:true});
  still('pick-up',home,{basket:'ground',filled:true,heading:0,deposit:true});
  still('open-lid',home,{basket:'ground',heading:0,closing:true,reverse:true});
 }
 return {at(seconds){
  seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;while(endTime<=seconds)next();
  let lo=0,hi=segments.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(segments[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const seg=segments[lo],progress=(seconds-seg.t0)/(seg.t1-seg.t0),time=seconds-seg.t0;
  return {...seg,x:mix(seg.from[0],seg.to[0],progress),z:mix(seg.from[1],seg.to[1],progress),heading:seg.heading??Math.atan2(seg.to[0]-seg.from[0],seg.to[1]-seg.from[1]),progress,time:seg.reverse?CLIPS[seg.clip].duration-time:time,filled:seg.picking?progress>.72:seg.deposit?progress<.6:!!seg.filled,lid:seg.opening?lidAt(progress):seg.closing?lidAt(1-progress):seg.deposit?1:0};
 }};
}
