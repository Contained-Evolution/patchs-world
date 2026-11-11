// Where Patch can hang and which hanging moves each hold allows. A braced hang
// needs a flat, vertical face under his hands for his feet; anything without one
// (a branch, a rope) is a free hang. Drops need ground within reach of the clip.
import { groundHeight } from './terrain.js';
import { trees } from './world-state.js';
import { CLIPS, HANG_CLIPS, HOP_RISE, DROP_REACH } from './patch-clips.js';

const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

// A climbing rock on the lookout hill. Its face points away from the summit,
// with a lip low on the face and its top edge one hop higher.
function climbingRock(x,z,angle,width,depth){
 const normal=[Math.cos(angle),Math.sin(angle)],tangent=[-normal[1],normal[0]];
 const base=groundHeight(x+normal[0]*.43,z+normal[1]*.43);
 return {x,z,normal,tangent,width,depth,base,ledges:[base+1.5,base+1.5+HOP_RISE],top:base+1.5+HOP_RISE,bottom:base-1.2};
}
export const CLIMB_WALLS=[climbingRock(-142.6,-211.6,332*Math.PI/180,6,2.6)];

// Cast a level ray and return the flat face it meets, if any.
export function faceHit(x,y,z,dx,dz){
 let best=null;
 for(const w of CLIMB_WALLS){
  const facing=dx*w.normal[0]+dz*w.normal[1];if(facing>-1e-6)continue;
  const distance=((w.x-x)*w.normal[0]+(w.z-z)*w.normal[1])/facing;if(distance<0)continue;
  const hx=x+dx*distance,hz=z+dz*distance,side=(hx-w.x)*w.tangent[0]+(hz-w.z)*w.tangent[1];
  if(Math.abs(side)>w.width/2||y<w.bottom||y>w.top)continue;
  if(!best||distance<best.distance)best={distance,wall:w,side};
 }
 return best;
}
const forwardOf=heading=>[Math.sin(heading),Math.cos(heading)],leftOf=heading=>[Math.cos(heading),-Math.sin(heading)];
// Hands at `grip` facing `heading` can brace only if one flat face sits just
// beyond the hands at both hand and foot height, either side of his body.
export function braceable(grip,heading){
 const [fx,fz]=forwardOf(heading),[lx,lz]=leftOf(heading),hits=[];
 for(const side of [-.22,.22])for(const drop of [.25,1.05]){
  const hit=faceHit(grip[0]-fx*.8+lx*side,grip[1]-drop,grip[2]-fz*.8+lz*side,fx,fz);
  if(!hit||hit.distance<.7||hit.distance>1.05)return false;
  hits.push(hit);
 }
 return hits.every(h=>h.wall===hits[0].wall&&Math.abs(h.distance-hits[0].distance)<.03);
}

// A hold is a line his hands can move along: `point(s,level)` is where his hands
// are, `range` limits `s`, and `ground(s)` is the ground below.
export function wallHold(w){
 const heading=Math.atan2(-w.normal[0],-w.normal[1]),half=w.width/2-.45;
 // Facing the wall, his left is the wall's tangent, so `s` grows to his left.
 const point=(s,level=0)=>[w.x+w.tangent[0]*s,w.ledges[level],w.z+w.tangent[1]*s];
 const stand=s=>{const [x,,z]=point(s);return [x+w.normal[0]*.43,z+w.normal[1]*.43];};
 return {kind:'wall',wall:w,heading,point,range:[-half,half],levels:w.ledges,stand,ground:s=>groundHeight(...stand(s))};
}
export function branchHold(hold){
 const [tx,tz]=trees[hold.index],[gx,gy,gz]=hold.grip,length=Math.hypot(tx-gx,tz-gz),ux=(tx-gx)/length,uz=(tz-gz)/length;
 // Face across the branch so shimmying left heads toward the trunk.
 const heading=Math.atan2(-uz,ux);
 return {kind:'branch',index:hold.index,heading,point:s=>[gx+ux*s,gy,gz+uz*s],range:[0,Math.max(0,length-.55)],levels:[gy],ground:s=>groundHeight(gx+ux*s,gz+uz*s)};
}
export function ropeHold(hold,heading=0){
 const [gx,gy,gz]=hold.grip;
 return {kind:'rope',index:hold.index,heading,anchor:hold.anchor,point:()=>[gx,gy,gz],range:[0,0],levels:[gy],ground:()=>groundHeight(gx,gz)};
}
export const holdLine=(hold,heading)=>hold.type==='rope'?ropeHold(hold,heading):branchHold(hold);

export function hangStyle(line,s,level=0){
 if(line.kind==='rope')return'rope';
 return braceable(line.point(s,level),line.heading)?'braced':'free';
}
// The moves Patch can make from a hold at `s` without leaving it or meeting
// something solid. Each name is a key of HANG_CLIPS[style].
export function hangMoves(line,s,level=0){
 const style=hangStyle(line,s,level),clips=HANG_CLIPS[style],moves=['idle'];
 for(const side of ['left','right']){
  const clip=clips[side];if(!clip)continue;const next=s+CLIPS[clip].shift;
  if(next>=line.range[0]-1e-9&&next<=line.range[1]+1e-9&&hangStyle(line,next,level)===style)moves.push(side);
 }
 const above=line.levels[level+1];
 if(clips.up&&above!==undefined&&Math.abs(above-line.levels[level]-HOP_RISE)<.06&&hangStyle(line,s,level+1)==='braced')moves.push('up');
 if(clips.drop&&line.point(s,level)[1]-line.ground(s)<=DROP_REACH)moves.push('drop');
 return {style,moves};
}
// He can jump up into a braced hang only when the lowest ledge is about his reach.
export function canGrab(line,s){const reach=line.levels[0]-line.ground(s);return hangStyle(line,s,0)==='braced'&&reach>1.25&&reach<1.75;}

// A seeded climb: a list of timed segments every visitor plays the same way.
// From the ground he walks along the face, jumps up, hangs, shimmies, hops up
// and drops; on a branch or rope he only uses the moves that hold allows.
export function climbPlan(line,random,{duration,fromGround}){
 if(line.kind==='rope')return ropeClimbPlan(line,duration);
 const segments=[];let t=0,s=fromGround?mix(line.range[0],line.range[1],random()):0,level=0,hanging=!fromGround,lean=random()<.5?'left':'right',moves=0;
 const add=(mode,clip,length,extra={})=>{segments.push({mode,clip,t0:t,t1:t+length,s,level,...extra});t+=length;};
 const loops=clip=>CLIPS[clip].duration*(1+Math.floor(random()*2));
 const finish=duration-10;
 if(fromGround)add('ground','idle',2+random()*3);
 while(t<finish){
  if(!hanging){
   if(random()<.5){const to=mix(line.range[0],line.range[1],random()),length=Math.abs(to-s)/1.05;if(length>.5){add('walk','walk',length,{s0:s,s1:to});s=to;}}
   add('ground',random()<.5?'look-around':'idle',3+random()*4);
   if(!canGrab(line,s))continue;
   add('grab',HANG_CLIPS.braced.grab,CLIPS[HANG_CLIPS.braced.grab].duration);hanging=true;level=0;moves=0;continue;
  }
  const {style,moves:allowed}=hangMoves(line,s,level),clips=HANG_CLIPS[style];
  const weights={idle:1,left:lean==='left'?2:.6,right:lean==='right'?2:.6,up:.7,drop:.15+moves*.05};
  let roll=random()*allowed.reduce((sum,m)=>sum+weights[m],0),move=allowed[0];
  for(const m of allowed){roll-=weights[m];if(roll<=0){move=m;break;}}
  if((move==='left'||move==='right')&&!allowed.includes(lean))lean=move;
  if(!allowed.includes(lean))lean=lean==='left'?'right':'left';
  const clip=clips[move];moves++;
  if(move==='idle')add('hang',clip,loops(clip),{style});
  else if(move==='left'||move==='right'){add('hang',clip,CLIPS[clip].duration,{style,s0:s,s1:s+CLIPS[clip].shift});s+=CLIPS[clip].shift;}
  else if(move==='up'){add('hop',clip,CLIPS[clip].duration,{style,toLevel:level+1});level++;}
  else {add('drop',clip,CLIPS[clip].duration,{style});hanging=false;level=0;}
 }
 // He ends on his feet when the hold lets him drop, so the next activity starts on the ground.
 if(hanging&&hangMoves(line,s,level).moves.includes('drop')){const clip=HANG_CLIPS[hangStyle(line,s,level)].drop;add('drop',clip,CLIPS[clip].duration);hanging=false;}
 add(hanging?'hang':'ground',hanging?HANG_CLIPS[hangStyle(line,s,level)].idle:'idle',Math.max(1,duration-t)+3600,hanging?{style:hangStyle(line,s,level)}:{});
 return {line,segments,at(seconds){
  let lo=0,hi=segments.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(segments[mid].t0<=seconds)lo=mid;else hi=mid-1;}
  const seg=segments[lo],time=Math.max(0,seconds-seg.t0),length=seg.t1-seg.t0;
  return {...seg,time,progress:Math.min(1,time/length),index:lo};
 }};
}

// Reserve time to return to the rope and climb all the way to the ground.
const canopyClip=()=>CLIPS['climb-top']?'climb-top':'swing-land';
function timedPlan(line,segments){
 return {line,segments,at(seconds){let index=segments.findIndex(s=>seconds<s.t1);if(index<0)index=segments.length-1;const seg=segments[index],time=Math.max(0,seconds-seg.t0);return {...seg,index,time,progress:Math.min(1,time/(seg.t1-seg.t0))};}};
}
export function ropeClimbPlan(line,duration){
 const landing=CLIPS[canopyClip()].duration,hand=CLIPS['rope-climb'].hands[0];
 const rise=line.anchor[1]-line.point(0)[1],up=rise/.3*CLIPS['rope-climb'].duration;
 const down=(line.anchor[1]-hand[1]-line.ground(0))/.55;
 const scale=Math.min(1,Math.max(2,duration-4-landing*2-10)/(up+down));
 const ascent=up*scale,descent=down*scale,leave=Math.max(ascent+landing+1,duration-4-landing-descent);
 return timedPlan(line,[
  {mode:'rope-climb',clip:'rope-climb',t0:0,t1:ascent},
  {mode:'canopy-land',clip:canopyClip(),t0:ascent,t1:ascent+landing},
  {mode:'canopy-rest',clip:'sleep-lay',t0:ascent+landing,t1:leave},
  {mode:'canopy-leave',clip:canopyClip(),t0:leave,t1:leave+landing},
  {mode:'rope-down',clip:'rope-climb',t0:leave+landing,t1:leave+landing+descent},
  {mode:'rope-ground',clip:'idle',t0:leave+landing+descent,t1:Infinity},
 ]);
}
// An early activity change also takes the rope down, starting at his current pose.
export function ropeExitPlan(line,from,resting){
 const hand=CLIPS['rope-climb'].hands[0],landing=resting?CLIPS[canopyClip()].duration:0;
 const startY=resting?line.anchor[1]-hand[1]:from.y;
 const descent=Math.max(.5,(startY-line.ground(0))/.55),segments=[];
 if(resting)segments.push({mode:'canopy-leave',clip:canopyClip(),t0:0,t1:landing,from});
 segments.push({mode:'rope-down',clip:'rope-climb',t0:landing,t1:landing+descent,startY,...(!resting?{from}:{})},
  {mode:'rope-ground',clip:'idle',t0:landing+descent,t1:Infinity});
 return timedPlan(line,segments);
}

const handsOf=(clip,end=false)=>{const h=CLIPS[clip].hands;return h&&(h[end?h.length-1:0]||null);};
// Where his feet go for a segment, which way he faces and what plays.
export function placement(line,seg){
 const {mode,clip,progress,time}=seg,f=forwardOf(line.heading);
 const at=(s,back,y)=>{const [x,,z]=line.point(s,seg.level);return {x:x-f[0]*back,y,z:z-f[1]*back};};
 const loopTime=CLIPS[clip].duration?time%CLIPS[clip].duration:0;
 if(['canopy-leave','rope-down','rope-ground'].includes(mode)){
  const [x,top,z]=line.anchor,hand=CLIPS['rope-climb'].hands[0],ground=line.ground(0);
  const back=hand[0],start=seg.from||{x:x-(mode==='rope-down'?f[0]*back:0),y:top-.5,z:z-(mode==='rope-down'?f[1]*back:0)};
  const hanging={x:x-f[0]*back,z:z-f[1]*back};
  const y=mode==='canopy-leave'?mix(start.y,top-hand[1],smooth(0,1,progress)):mode==='rope-down'?mix(seg.startY??top-hand[1],ground,progress):ground;
  const join=mode==='rope-ground'?1:mode==='canopy-leave'?smooth(0,1,progress):smooth(0,.1,progress);
  return {x:mix(start.x,hanging.x,join),y,z:mix(start.z,hanging.z,join),heading:line.heading,clip,
   time:mode==='canopy-leave'?Math.max(0,CLIPS[clip].duration-time):mode==='rope-down'?CLIPS[clip].duration-loopTime:loopTime};
 }

 if(mode==='rope-climb'||mode==='canopy-land'||mode==='canopy-rest'){
  const [x,top,z]=line.anchor,hand=CLIPS['rope-climb'].hands[0];
  const back=mode==='rope-climb'?hand[0]:mix(hand[0],0,mode==='canopy-rest'?1:smooth(.15,.85,progress));
  const y=mode==='rope-climb'?mix(line.point(0)[1],top,progress)-hand[1]:mode==='canopy-land'?mix(top-hand[1],top,smooth(.15,.85,progress)):top-.5;
  return {x:x-f[0]*back,y,z:z-f[1]*back,heading:line.heading,clip,time:mode==='canopy-land'?time:loopTime};
 }
 if(mode==='walk'){const s=mix(seg.s0,seg.s1,progress),[x,z]=line.stand(s),side=leftOf(line.heading),dir=Math.sign(seg.s1-seg.s0)||1;return {x,z,y:groundHeight(x,z),heading:Math.atan2(side[0]*dir,side[1]*dir),clip,time:loopTime,moving:true};}
 if(mode==='ground'){const [x,z]=line.stand(seg.s);return {x,z,y:groundHeight(x,z),heading:line.heading,clip,time:loopTime};}
 const hand=handsOf(clip),end=handsOf(clip,true),ledge=line.point(seg.s,seg.level)[1];
 if(mode==='grab'){const [x,z]=line.stand(seg.s),ground=groundHeight(x,z);return {x,z,y:mix(ground,ledge-end[1],smooth(.35,.6,progress)),heading:line.heading,clip,time};}
 if(mode==='hop'){const above=line.levels[seg.toLevel];return {...at(seg.s,hand[0],mix(ledge-hand[1],above-end[1],smooth(.2,.7,progress))),heading:line.heading,clip,time};}
 if(mode==='drop')return {...at(seg.s,hand[0],mix(ledge-hand[1],line.ground(seg.s),smooth(.15,.6,progress))),heading:line.heading,clip,time};
 const looping=seg.s0===undefined;
 return {...at(seg.s,hand[0],ledge-hand[1]),heading:line.heading,clip,time:looping?loopTime:time,hanging:true};
}
