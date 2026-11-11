// Where Patch's feet go. Every choice is seeded from the activity's start time,
// so each visitor sees the same Patch making the same choices.
import { CLIPS } from './patch-clips.js';
import { places } from './terrain.js';
import { clearGroundLine, nearestWalkable, walkable } from './island-collision.js';
import { SEATS } from './furniture.js';

export function seedFrom(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

// Route every ground segment through the same swept test used by the visitor.
export function patchRoute(from,to,seed,remembered=[],solids){
 const start=nearestWalkable(...from,solids),goal=nearestWalkable(...to,solids);
 if(!start||!goal)return [from];
 const clear=(a,b)=>clearGroundLine(a,b,solids);
 if(clear(start,goal))return [start,goal];

 const direct=searchRoute(start,goal,solids,seed);
 if(direct)return direct;

 // A remembered route can take him well outside the local search corridor.
 const route=[start];
 for(const point of [...remembered.slice(1,-1),goal]){
  const next=nearestWalkable(...point,solids);
  if(!next)continue;
  const last=route.at(-1),leg=clear(last,next)?[last,next]:searchRoute(last,next,solids,seed);
  if(leg)route.push(...leg.slice(1));
 }
 return route;
}

const GRID=1.2;
const DIRECTIONS=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
function searchRoute(from,to,solids,seed){
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const heuristic=point=>1.65*distance(point,to)/GRID;
 const initial=Math.ceil(heuristic(from));
 // Use integer costs as priority buckets, with a small allowance for detours.
 const limit=initial+Math.max(32,Math.ceil(initial*.25)),buckets=Array.from({length:limit+1},()=>[]);
 const start={x:0,z:0,point:from,cost:0,parent:null},visited=new Map([['0,0',start]]);
 buckets[initial].push(start);
 let expanded=0;
 for(let priority=initial;priority<=limit;priority++){
  const bucket=buckets[priority];
  while(bucket.length){
   const node=bucket.pop();
   if(visited.get(node.x+','+node.z)!==node)continue;
   if(++expanded>8000)return null;
   if(distance(node.point,to)<GRID*2&&clearGroundLine(node.point,to,solids)){
    const path=[to];
    for(let n=node;n;n=n.parent)path.push(n.point);
    path.reverse();
    const smooth=[path[0]];
    for(let i=0;i<path.length-1;){
     let next=Math.min(i+12,path.length-1);
     while(next>i+1&&!clearGroundLine(path[i],path[next],solids))next--;
     smooth.push(path[next]);
     i=next;
    }
    return smooth;
   }
   for(let i=0;i<DIRECTIONS.length;i++){
    const [dx,dz]=DIRECTIONS[(i+seed%8)%8],x=node.x+dx,z=node.z+dz,key=x+','+z;
    const cost=node.cost+Math.hypot(dx,dz),point=[from[0]+x*GRID,from[1]+z*GRID];
    const estimate=Math.max(priority,Math.ceil(cost+heuristic(point)));
    if(estimate>limit||visited.get(key)?.cost<=cost||!walkable(...point,undefined,undefined,solids)||!clearGroundLine(node.point,point,solids))continue;
    const next={x,z,point,cost,parent:node};
    visited.set(key,next);
    buckets[estimate].push(next);
   }
  }
 }
 return null;
}

// How far he roams for an activity, and how restless he is while doing it.
export const ROAM={
 explore:{radius:{'tall-trees':45,cave:9,'tide-pools':22,lookout:9},legs:[6,22],pauses:[2,9],run:.12},
 look:{radius:{lookout:9},legs:[3,8],pauses:[6,16],run:0},
};
// On his tablet he wanders a few steps now and then, reading or writing as he goes. At the computer he sits.
const TABLET=Object.fromEntries(Object.keys(places).filter(place=>place!=='computer').map(place=>[place,place==='pond'?4:6]));
for(const action of ['research','write'])ROAM[action]={radius:TABLET,legs:[2,5],pauses:[12,30],run:0,device:true};
const WALK_SPEED=1.05,TABLET_SPEED=.55,RUN_SPEED=2.8;
// A roam is a list of legs: walk from one spot to the next, then stop and do something there.
export function roamPlan(action,place,seed,solids){
 // With his tablet he stands clear of any seat at the place, in front of it.
 const kind=ROAM[action],seat=kind.device&&SEATS[place],near=seat&&Math.hypot(seat.x-places[place][0],seat.z-places[place][1])<1.5,origin=near?[seat.x+Math.sin(seat.heading)*1.6,seat.z+Math.cos(seat.heading)*1.6]:places[place],center=nearestWalkable(...origin,solids)||origin,radius=kind.radius[place]||12,random=rng(seed),legs=[];
 let x=center[0],z=center[1],time=0;
 const span=([a,b])=>a+random()*(b-a);
 function rest(walkEnd){const pause=span(kind.pauses),roll=random();
  if(kind.device)return{end:walkEnd+pause,clip:'tablet-stand'};
  return{end:walkEnd+pause,clip:action==='explore'&&roll<.08?'jump':roll<.15&&pause>7?'sit-ground':roll<.6?'look-around':'idle'};}
 legs.push({x0:x,z0:z,x1:x,z1:z,t0:0,t1:0,...rest(0),speed:0});time=legs[0].end;
 function addLeg(){
  let goal=null;
  for(let tries=0;tries<10&&!goal;tries++){
   const away=Math.hypot(x-center[0],z-center[1]),home=Math.atan2(center[1]-z,center[0]-x),angle=away>radius*.6?home+(random()*2-1)*1.1:random()*Math.PI*2,distance=Math.min(span(kind.legs),radius*1.4);
   const gx=x+Math.cos(angle)*distance,gz=z+Math.sin(angle)*distance;
   if(walkable(gx,gz,undefined,undefined,solids)&&clearGroundLine([x,z],[gx,gz],solids)&&!(near&&Math.hypot(gx-seat.x,gz-seat.z)<1.1))goal=[gx,gz];
  }
  const running=goal&&random()<kind.run,speed=running?RUN_SPEED:kind.device?TABLET_SPEED:WALK_SPEED,[gx,gz]=goal||[x,z],walk=Math.hypot(gx-x,gz-z)/speed;
  legs.push({x0:x,z0:z,x1:gx,z1:gz,t0:time,t1:time+walk,speed:goal?speed:0,...rest(time+walk)});
  x=gx;z=gz;time=legs.at(-1).end;
 }
 return{at(seconds){
  while(time<=seconds)addLeg();
  let lo=0,hi=legs.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(legs[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const leg=legs[lo];
  if(seconds<leg.t1){const p=(seconds-leg.t0)/(leg.t1-leg.t0);return{x:leg.x0+(leg.x1-leg.x0)*p,z:leg.z0+(leg.z1-leg.z0)*p,heading:Math.atan2(leg.x1-leg.x0,leg.z1-leg.z0),clip:leg.speed>=RUN_SPEED?'run':kind.device?'walk-texting':'walk',moving:true};}
  // He pulls his tablet out once, at the start; after that each stop picks up the two-handed part of the clip.
  if(leg.clip==='tablet-stand'){const c=CLIPS['tablet-stand'],k=seconds-leg.t1,loop=c.duration-c.held;return{x:leg.x1,z:leg.z1,heading:null,clip:leg.clip,moving:false,time:lo===0&&k<c.duration?k:c.held+(lo===0?k-c.duration:k)%loop};}
  const pauseTime=seconds-leg.t1;
  const once=leg.clip==='jump'||leg.clip==='look-around';
  return{x:leg.x1,z:leg.z1,heading:leg.facing??null,clip:once&&pauseTime>=CLIPS[leg.clip].duration?'idle':leg.clip,moving:false,time:pauseTime};
 }};
}
