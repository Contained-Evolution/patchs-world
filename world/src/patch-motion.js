// Where Patch's feet go. Every choice is seeded from the activity's start time,
// so each visitor sees the same Patch making the same choices.
import { CLIPS } from './patch-clips.js';
import { ISLAND, groundHeight, places } from './terrain.js';
import { clearGroundLine, nearestWalkable, walkable } from './island-collision.js';
import { COMPUTER_TENT, SEATS, insideComputerTent } from './furniture.js';
import { BEATS, TABLET_BEATS, pickBeat, walkClip } from './patch-beats.js';

export function seedFrom(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

// Route every ground segment through the same swept test used by the visitor.
export function patchRoute(from,to,seed,remembered=[],solids){
 const start=nearestWalkable(...from,solids),goal=nearestWalkable(...to,solids);
 if(!start||!goal)return [from];
 const clear=(a,b)=>clearGroundLine(a,b,solids);
 if(clear(start,goal))return [start,goal];

 const startInside=insideComputerTent(...start),goalInside=insideComputerTent(...goal);
 if(startInside!==goalInside){
  const tent=COMPUTER_TENT, outside=startInside?goal:start;
  const preferred=outside[0]>=tent.x?1:-1;
  for(const side of [preferred,-preferred]){
   const door=[tent.x+side*(tent.halfLength-.65),tent.z];
   const entry=[tent.x+side*(tent.halfLength+.65),tent.z];
   const inside=startInside?start:goal;
   const inner=clear(inside,door)?[inside,door]:searchRoute(inside,door,solids,seed);
   if(!inner||!clear(door,entry))continue;
   const outer=startInside?routeGround(entry,goal,seed,remembered,solids):routeGround(start,entry,seed,remembered,solids);
   if(startInside&&outer.at(-1)===goal)return [...inner,...outer];
   if(goalInside&&outer.at(-1)===entry)return [...outer,...inner.reverse()];
  }
 }

 return routeGround(start,goal,seed,remembered,solids);
}

function routeGround(start,goal,seed,remembered,solids){
 const clear=(a,b)=>clearGroundLine(a,b,solids);
 if(clear(start,goal))return [start,goal];
 const direct=searchRoute(start,goal,solids,seed);
 if(direct)return direct;

 // A remembered route can take him well outside the local search corridor.
 const route=[start];
 for(const point of [...remembered.slice(1,-1),goal]){
  const next=point===goal?goal:nearestWalkable(...point,solids);
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
 explore:{radius:{'tall-trees':45,cave:9,'tide-pools':22,lookout:9,beach:28,meadow:30,'banana-grove':14,pond:10},legs:[6,22],pauses:[2,9],run:.12},
};
// On his tablet he wanders a few steps now and then, reading or writing as he goes. At the computer he sits.
const TABLET=Object.fromEntries(Object.keys(places).filter(place=>place!=='computer').map(place=>[place,place==='pond'?4:6]));
for(const action of ['research','write'])ROAM[action]={radius:TABLET,legs:[2,5],pauses:[12,30],run:0,device:true};
const WALK_SPEED=1.05,TABLET_SPEED=.55,RUN_SPEED=2.8;
export function hasAnimationRoom(x,z,solids) {
 const height=groundHeight(x,z);
 return [[-1.6,0],[1.6,0],[0,-1.6],[0,1.6]].every(([dx,dz])=>
  Math.abs(groundHeight(x+dx,z+dz)-height)<.3&&clearGroundLine([x,z],[x+dx,z+dz],solids));
}

// The stroke moves him around the pond. A tread break holds the same point and heading.
export function swimPlan(random,spirit,weather) {
 const strokes={happy:[40,65],okay:[30,52],tired:[18,32],grumpy:[24,40]}[spirit]||[30,52];
 const scale=weather==='storm'?.65:weather==='rain'?.85:1;
 const legs=[];
 let end=0,swum=0;
 return {at(seconds){
  seconds=Number.isFinite(seconds)?Math.max(0,seconds):0;
  while(end<=seconds){
   const stroke=(strokes[0]+random()*(strokes[1]-strokes[0]))*scale;
   const rest=9+random()*14+(spirit==='tired'?10:0);
   legs.push({start:end,stroke,swum});
   end+=stroke+rest;swum+=stroke;
  }
  let lo=0,hi=legs.length-1;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(legs[mid].start<=seconds)lo=mid;else hi=mid-1;}
  const leg=legs[lo],time=seconds-leg.start,stroke=time<leg.stroke,a=(leg.swum+Math.min(time,leg.stroke))*.034;
  return {x:ISLAND.pondX+Math.cos(a)*8,z:ISLAND.pondZ+Math.sin(a)*5.6,heading:Math.atan2(-8*Math.sin(a),5.6*Math.cos(a)),stroke};
 }};
}
// A roam is a list of legs: walk from one spot to the next, then stop and do something there.
// What he does at each stop comes from the activity's table in patch-beats.js, in the spirit he set out in.
export function roamPlan(action,place,seed,solids,spirit='okay',weather='clear'){
 // With his tablet he stands clear of any seat at the place, in front of it.
 const kind=ROAM[action],seat=kind.device&&SEATS[place],near=seat&&Math.hypot(seat.x-places[place][0],seat.z-places[place][1])<1.5,origin=near?[seat.x+Math.sin(seat.heading)*1.6,seat.z+Math.cos(seat.heading)*1.6]:places[place],center=nearestWalkable(...origin,solids)||origin,radius=kind.radius[place]||12,random=rng(seed),legs=[];
 let x=center[0],z=center[1],time=0,last=null;
 const span=([a,b])=>a+random()*(b-a),table=kind.device?TABLET_BEATS[action]:BEATS.explore,played=new Map();
 const cautious=['cave','tide-pools','pond','lookout'].includes(place)||['rain','storm'].includes(weather);
 function rest(walkEnd,x,z){
  const pause=span(kind.pauses)*(kind.device&&action==='write'?1.4:spirit==='tired'?1.3:1),end=walkEnd+pause;
  // The first tablet stop includes the take-out animation.
  const row=kind.device&&walkEnd===0?null:pickBeat(table,spirit,random,{
   last,played,at:walkEnd,span:pause,weather,room:!cautious&&hasAnimationRoom(x,z,solids)
  }),clip=row?.clip||table.base;
  last=clip;played.set(clip,end);
  return{end,clip};}
 legs.push({x0:x,z0:z,x1:x,z1:z,t0:0,t1:0,...rest(0,x,z),speed:0});time=legs[0].end;
 function addLeg(){
  let goal=null;
  for(let tries=0;tries<10&&!goal;tries++){
   const away=Math.hypot(x-center[0],z-center[1]),home=Math.atan2(center[1]-z,center[0]-x),angle=away>radius*.6?home+(random()*2-1)*1.1:random()*Math.PI*2,distance=Math.min(span(kind.legs),radius*1.4);
   const gx=x+Math.cos(angle)*distance,gz=z+Math.sin(angle)*distance;
   if(walkable(gx,gz,undefined,undefined,solids)&&clearGroundLine([x,z],[gx,gz],solids)&&!(near&&Math.hypot(gx-seat.x,gz-seat.z)<1.1))goal=[gx,gz];
  }
  const running=goal&&!cautious&&random()<kind.run*(spirit==='happy'?1.8:spirit==='tired'?0:1),speed=running?RUN_SPEED:kind.device?TABLET_SPEED:WALK_SPEED,[gx,gz]=goal||[x,z],walk=Math.hypot(gx-x,gz-z)/speed;
  legs.push({x0:x,z0:z,x1:gx,z1:gz,t0:time,t1:time+walk,speed:goal?speed:0,...rest(time+walk,gx,gz)});
  x=gx;z=gz;time=legs.at(-1).end;
 }
 return{at(seconds){
  while(time<=seconds)addLeg();
  let lo=0,hi=legs.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(legs[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const leg=legs[lo];
  if(seconds<leg.t1){const p=(seconds-leg.t0)/(leg.t1-leg.t0);return{x:leg.x0+(leg.x1-leg.x0)*p,z:leg.z0+(leg.z1-leg.z0)*p,heading:Math.atan2(leg.x1-leg.x0,leg.z1-leg.z0),clip:leg.speed>=RUN_SPEED?'run':kind.device?'walk-texting':walkClip(cautious?'okay':spirit,weather),moving:true};}
  // He pulls his tablet out once, at the start; after that each stop picks up the two-handed part of the clip.
  if(leg.clip==='tablet-stand'||leg.clip==='texting'&&seconds-leg.t1>=CLIPS.texting.duration){
   const c=CLIPS['tablet-stand'],k=seconds-leg.t1,loop=c.duration-c.held,offset=leg.clip==='texting'?k-CLIPS.texting.duration:k;
   return{x:leg.x1,z:leg.z1,heading:null,clip:'tablet-stand',moving:false,time:lo===0&&k<c.duration?k:c.held+(lo===0?k-c.duration:offset)%loop};
  }
  const pauseTime=seconds-leg.t1,length=CLIPS[leg.clip].duration;
  // A clip that plays once hands back to his idle; the others loop.
  if(CLIPS[leg.clip].once&&pauseTime>=length)return{x:leg.x1,z:leg.z1,heading:leg.facing??null,clip:'idle',moving:false,time:(pauseTime-length)%CLIPS.idle.duration};
  return{x:leg.x1,z:leg.z1,heading:leg.facing??null,clip:leg.clip,moving:false,time:pauseTime%length};
 }};
}
