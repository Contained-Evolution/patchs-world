// Where Patch's feet go. Every choice is seeded from the activity's start time,
// so each visitor sees the same Patch making the same choices.
import { places, pondFraction, ISLAND } from './terrain.js';
import { treesNear } from './forest.js';
import { walkable } from './visitor-controls.js';

export function seedFrom(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

const TRUNK_CLEARANCE=1.2;
export function trunkClearance(x,z){let d=Infinity;for(const tree of treesNear(x,z))d=Math.min(d,Math.hypot(x-tree.x,z-tree.z)-(tree.grove?.3:0));return d;}
// A step is open when a visitor could take it and no trunk stands in the way.
function stepOpen(x,z,fromX,fromZ,clearance){return walkable(x,z,fromX,fromZ)&&trunkClearance(x,z)>=clearance;}
function lineOpen(ax,az,bx,bz,clearance){const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)));let px=ax,pz=az;for(let i=1;i<=n;i++){const x=ax+(bx-ax)*i/n,z=az+(bz-az)*i/n;if(!stepOpen(x,z,px,pz,clearance))return false;px=x;pz=z;}return true;}

function densify(route,step=1.5){const out=[route[0]];for(let i=1;i<route.length;i++){const [ax,az]=route[i-1],[bx,bz]=route[i],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/step));for(let k=1;k<n;k++)out.push([ax+(bx-ax)*k/n,az+(bz-az)*k/n]);out.push(route[i]);}return out;}
// Push points around trunks and the pond, then round the corners. Endpoints stay put.
function relax(route){
 let points=densify(route);
 const push=()=>{for(let i=1;i<points.length-1;i++){let [x,z]=points[i];for(const tree of treesNear(x,z)){const dx=x-tree.x,dz=z-tree.z,d=Math.hypot(dx,dz)||.01,want=TRUNK_CLEARANCE+(tree.grove?0:.2);if(d<want){x=tree.x+dx/d*want;z=tree.z+dz/d*want;}}const f=pondFraction(x,z);if(f<1.1){const dx=x-ISLAND.pondX,dz=z-ISLAND.pondZ,k=1.1/Math.max(f,.01);x=ISLAND.pondX+dx*k;z=ISLAND.pondZ+dz*k;}points[i]=[x,z];}};
 for(let pass=0;pass<5;pass++)push();
 for(let pass=0;pass<2;pass++){const out=[points[0]];for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i];out.push([ax*.75+bx*.25,az*.75+bz*.25],[ax*.25+bx*.75,az*.25+bz*.75]);}out.push(points.at(-1));points=out;push();push();}
 return points;
}
const routeOpen=route=>route.every(([x,z],i)=>!i||walkable(x,z,...route[i-1]));
// He heads more or less straight for where he wants to go, wandering a little, and
// falls back to his remembered route through camp when the direct way is blocked.
export function patchRoute(from,to,seed,remembered=[from,to]){
 const length=Math.hypot(to[0]-from[0],to[1]-from[1]);
 for(let attempt=0;attempt<4&&length>.5;attempt++){
  const random=rng(seed+attempt*977),nx=-(to[1]-from[1])/length,nz=(to[0]-from[0])/length,controls=[from],swing=Math.min(30,length*(.08+attempt*.04));
  for(const t of [.2,.4,.6,.8]){const offset=(random()*2-1)*swing;controls.push([from[0]+(to[0]-from[0])*t+nx*offset,from[1]+(to[1]-from[1])*t+nz*offset]);}
  controls.push(to);const route=relax(controls);if(routeOpen(route))return route;
 }
 return relax([from,...remembered.slice(1)]);
}

// How far he roams for an activity, and how restless he is while doing it.
export const ROAM={
 explore:{radius:{'tall-trees':45,cave:9,'tide-pools':22},legs:[6,22],pauses:[2,9],run:.12},
 look:{radius:{lookout:9},legs:[3,8],pauses:[6,16],run:0},
 eat:{radius:{'banana-grove':10},legs:[2,6],pauses:[8,20],run:0,pick:true},
};
const WALK_SPEED=1.05,RUN_SPEED=2.8,PICK=192/24;
// A roam is a list of legs: walk from one spot to the next, then stop and do something there.
export function roamPlan(action,place,seed){
 const kind=ROAM[action],center=places[place],radius=kind.radius[place]||12,random=rng(seed),legs=[];
 let x=center[0],z=center[1],time=0;
 const span=([a,b])=>a+random()*(b-a);
 function rest(walkEnd,tree){const pause=span(kind.pauses),roll=random();
  // Beside a banana tree he faces it and picks fruit for one or two reaches.
  if(tree)return{end:walkEnd+PICK*(pause>14?2:1),clip:'pick-fruit',facing:Math.atan2(tree.x-tree.fromX,tree.z-tree.fromZ)};
  return{end:walkEnd+pause,clip:roll<.15&&pause>7?'sit':roll<.6?'look-around':'idle'};}
 legs.push({x0:x,z0:z,x1:x,z1:z,t0:0,t1:0,...rest(0),speed:0});time=legs[0].end;
 function addLeg(){
  let goal=null,tree=null;
  // When he is eating he walks up to a fruit tree, stopping an arm's length from its trunk.
  if(kind.pick)for(let tries=0;tries<6&&!goal;tries++){
   const near=treesNear(center[0],center[1]).filter(t=>t.grove&&Math.hypot(t.x-center[0],t.z-center[1])<radius*1.8),pick=near[Math.floor(random()*near.length)];
   if(!pick)break;const away=Math.atan2(z-pick.z,x-pick.x)+(random()*2-1)*.8,gx=pick.x+Math.cos(away)*1.05,gz=pick.z+Math.sin(away)*1.05;
   if(lineOpen(x,z,gx,gz,.7)){goal=[gx,gz];tree={x:pick.x,z:pick.z,fromX:gx,fromZ:gz};}
  }
  for(let tries=0;tries<10&&!goal;tries++){
   const away=Math.hypot(x-center[0],z-center[1]),home=Math.atan2(center[1]-z,center[0]-x),angle=away>radius*.6?home+(random()*2-1)*1.1:random()*Math.PI*2,distance=Math.min(span(kind.legs),radius*1.4);
   const gx=x+Math.cos(angle)*distance,gz=z+Math.sin(angle)*distance;
   if(lineOpen(x,z,gx,gz,.8))goal=[gx,gz];
  }
  const running=goal&&random()<kind.run,speed=running?RUN_SPEED:WALK_SPEED,[gx,gz]=goal||[x,z],walk=Math.hypot(gx-x,gz-z)/speed;
  legs.push({x0:x,z0:z,x1:gx,z1:gz,t0:time,t1:time+walk,speed:goal?speed:0,...rest(time+walk,tree)});
  x=gx;z=gz;time=legs.at(-1).end;
 }
 return{at(seconds){
  while(time<=seconds)addLeg();
  let lo=0,hi=legs.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(legs[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const leg=legs[lo];
  if(seconds<leg.t1){const p=(seconds-leg.t0)/(leg.t1-leg.t0);return{x:leg.x0+(leg.x1-leg.x0)*p,z:leg.z0+(leg.z1-leg.z0)*p,heading:Math.atan2(leg.x1-leg.x0,leg.z1-leg.z0),clip:leg.speed>=RUN_SPEED?'run':'walk',moving:true};}
  return{x:leg.x1,z:leg.z1,heading:leg.facing??null,clip:leg.clip,moving:false,time:seconds-leg.t1};
 }};
}
