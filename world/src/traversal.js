import { trees, ROPE_LENGTH } from './world-state.js';

const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const radius=.95;

// Plan the hand's path, including the two pendulum arcs and the airborne
// transfer. The renderer uses this same point for Patch's animated grip.
export function makeTransfer(from,to) {
 const dx=to.grip[0]-from.grip[0],dz=to.grip[2]-from.grip[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const ropeOffset=.9, ropeRise=ROPE_LENGTH-Math.sqrt(ROPE_LENGTH**2-ropeOffset**2);
 function sample(t,plan) {
  const shifted=(hold,sign)=>[hold.grip[0]-uz*ropeOffset*sign,hold.grip[1]+ropeRise,hold.grip[2]+ux*ropeOffset*sign];
  const start=from.type==='rope'?shifted(from,plan.depart):from.grip;
  const end=to.type==='rope'?shifted(to,plan.arrive):to.grip;
  if(t<=.25){const f=smooth(t*4);return {grip:from.type==='rope'?from.grip.map((v,i)=>mix(v,start[i],f)):from.grip.slice(),hold:from};}
  if(t>=.75){const f=smooth((t-.75)*4);return {grip:to.type==='rope'?end.map((v,i)=>mix(v,to.grip[i],f)):to.grip.slice(),hold:to};}
  const u=(t-.25)*2,arc=Math.sin(Math.PI*u),grip=start.map((v,i)=>mix(v,end[i],u));
  grip[0]+=-uz*plan.bend*arc;grip[2]+=ux*plan.bend*arc;grip[1]+=arc*.65;
  return {grip,hold:null};
 }
 let best=null;
 for(const depart of [-1,1])for(const arrive of [-1,1])for(const bend of [1.5,-1.5,2,-2,2.5,-2.5,3,-3]){
  const plan={depart,arrive,bend};let clearance=Infinity;
  for(let j=0;j<=160;j++){const [x,,z]=sample(j/160,plan).grip;for(const tree of trees)clearance=Math.min(clearance,Math.hypot(x-tree[0],z-tree[1]));}
  if(!best||clearance>best.clearance)best={...plan,clearance};
 }
 if(best.clearance<radius)throw new Error(`No clear transfer between trees ${from.index} and ${to.index}`);
 return {from,to,...best,at:t=>sample(Math.max(0,Math.min(1,t)),best)};
}
