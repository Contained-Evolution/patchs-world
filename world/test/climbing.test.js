import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIPS, HANG_CLIPS } from '../src/patch-clips.js';
import { CLIMB_WALLS, wallHold, holdLine, hangStyle, hangMoves, canGrab, climbPlan, ropeExitPlan, placement } from '../src/climbing.js';
import { holdFor, trees, ROPE_TREES } from '../src/world-state.js';
import { rng } from '../src/patch-motion.js';
import { walkable } from '../src/visitor-controls.js';
import { groundHeight } from '../src/terrain.js';

function glbClips(){
 const bytes=readFileSync(new URL('../assets/patch.glb',import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length).toString('utf8'));
 return Object.fromEntries(gltf.animations.map(a=>[a.name,Math.max(...a.samplers.map(s=>gltf.accessors[s.input].max[0]))]));
}

test('every clip in patch.glb is registered with its real length',()=>{
 const found=glbClips();
 assert.deepEqual(Object.keys(found).sort(),Object.keys(CLIPS).sort());
 for(const [name,duration] of Object.entries(found))assert.ok(Math.abs(duration-CLIPS[name].duration)<.05,`${name}: ${duration}`);
 for(const style of Object.values(HANG_CLIPS))for(const clip of Object.values(style))assert.ok(CLIPS[clip],clip);
});

test('braced hangs only happen on the flat climbing face',()=>{
 const line=wallHold(CLIMB_WALLS[0]);
 for(let s=line.range[0];s<=line.range[1];s+=.05)for(const level of [0,1])assert.equal(hangStyle(line,s,level),'braced');
 for(let i=0;i<trees.length;i++){
  const hold=holdFor(i),line=holdLine(hold),expected=ROPE_TREES.has(i)?'rope':'free';
  for(let s=line.range[0];s<=line.range[1];s+=.05){
   const {style,moves}=hangMoves(line,s);assert.equal(style,expected,`tree ${i}`);
   assert.ok(!moves.includes('up'));
   // Every tall-tree hold is far above the ground, so no drop clip can land.
   assert.ok(!moves.includes('drop'));
   if(style==='rope')assert.deepEqual(moves,['idle']);
  }
 }
});

test('branch shimmies stay on the branch and clear of the trunk',()=>{
 for(let i=0;i<trees.length;i++){
  if(ROPE_TREES.has(i))continue;
  const line=holdLine(holdFor(i));
  for(let s=line.range[0];s<=line.range[1];s+=.05){const [x,,z]=line.point(s);assert.ok(Math.hypot(x-trees[i][0],z-trees[i][1])>=.5);}
 }
});

test('a lookout climb only plays moves its hold allows and ends on his feet',()=>{
 const line=wallHold(CLIMB_WALLS[0]);
 for(const seed of [1,2,3,4,5,6,7,8]){
  const plan=climbPlan(line,rng(seed),{duration:900,fromGround:true}),used=new Set();
  let hanging=false;
  for(const seg of plan.segments){
   used.add(seg.clip);
   assert.ok(seg.s>=line.range[0]-1e-6&&seg.s<=line.range[1]+1e-6);
   if(seg.mode==='grab'){assert.ok(!hanging);assert.ok(canGrab(line,seg.s));hanging=true;}
   else if(seg.mode==='hang'||seg.mode==='hop'||seg.mode==='drop'){
    assert.ok(hanging,`${seg.clip} needs a hold`);
    const {style,moves}=hangMoves(line,seg.s,seg.level),move=Object.entries(HANG_CLIPS[style]).find(([,clip])=>clip===seg.clip)?.[0];
    assert.equal(style,'braced');assert.ok(moves.includes(move),`${seg.clip} at ${seg.s}`);
    if(seg.mode==='drop')hanging=false;
   } else {
    assert.ok(!hanging);
    for(const s of seg.mode==='walk'?[seg.s0,seg.s1]:[seg.s]){const [x,z]=line.stand(s);assert.ok(walkable(x,z));}
   }
  }
  assert.ok(!hanging);assert.equal(plan.segments.at(-1).mode,'ground');
  for(const clip of Object.values(HANG_CLIPS.braced))assert.ok(used.has(clip)||seed>1,clip);
 }
});

test('branch climbs stay free hangs',()=>{
 for(const index of [0]){
  const line=holdLine(holdFor(index));
  const plan=climbPlan(line,rng(index+3),{duration:600,fromGround:false}),allowed=new Set(Object.values(HANG_CLIPS[index===0?'free':'rope']));
  for(const seg of plan.segments)assert.ok(allowed.has(seg.clip),seg.clip);
 }
});

test('placement keeps his hands on the ledge and his feet on the ground',()=>{
 const line=wallHold(CLIMB_WALLS[0]),plan=climbPlan(line,rng(9),{duration:600,fromGround:true});
 for(let t=0;t<590;t+=.25){
  const seg=plan.at(t),p=placement(line,seg);
  if(seg.mode==='ground'||seg.mode==='walk')assert.ok(Math.abs(p.y-groundHeight(p.x,p.z))<1e-6);
  if(seg.mode==='hang'){const hands=CLIPS[seg.clip].hands[0];assert.ok(Math.abs(p.y+hands[1]-line.levels[seg.level])<1e-6);}
  if(seg.mode==='ground'||seg.mode==='walk')assert.ok(walkable(p.x,p.z));
 }
});

test('visitors cannot walk into the climbing rock',()=>{
 const w=CLIMB_WALLS[0],x=w.x-w.normal[0]*1.2,z=w.z-w.normal[1]*1.2;
 assert.ok(!walkable(x,z));
 assert.ok(!walkable(x,z,w.x+w.normal[0]*2,w.z+w.normal[1]*2));
});


test('every rope climbs to its anchor, lands once, and rests on the canopy',()=>{
 for(const index of ROPE_TREES){
  const line=holdLine(holdFor(index)),plan=climbPlan(line,rng(3),{duration:600,fromGround:false});
  assert.deepEqual(plan.segments.map(s=>s.clip),['rope-climb',CLIPS['climb-top']?'climb-top':'swing-land','sleep-lay',CLIPS['climb-top']?'climb-top':'swing-land','rope-climb','idle']);
  const climb=plan.segments[0],end=placement(line,plan.at(climb.t1-1e-6));
  assert.ok(Math.abs(end.y+CLIPS['rope-climb'].hands[0][1]-line.anchor[1])<1e-5);
  let previous=-Infinity;
  for(let t=0;t<climb.t1;t+=.1){const p=placement(line,plan.at(t));assert.ok(p.y>=previous);previous=p.y;assert.ok(Number.isFinite(p.x+p.y+p.z));}
  const rest=placement(line,plan.at(300));assert.equal(rest.clip,'sleep-lay');assert.equal(rest.y,line.anchor[1]-.5);
  assert.deepEqual(plan.at(300),climbPlan(line,rng(3),{duration:600,fromGround:false}).at(300));
 }
});


test('rope descent follows rest and reaches the ground before the activity ends',()=>{
 for(const index of ROPE_TREES)for(const duration of [60,120,600]){
  const line=holdLine(holdFor(index)),plan=climbPlan(line,rng(2),{duration,fromGround:false});
  const down=plan.segments.find(s=>s.mode==='rope-down');let previous=Infinity;
  for(let t=down.t0;t<down.t1;t+=.1){const p=placement(line,plan.at(t));assert.ok(p.y<=previous);previous=p.y;assert.ok(p.y>=line.ground(0));}
  assert.ok(plan.segments.at(-1).t0<=duration-4+1e-6);
  const end=placement(line,plan.at(duration));assert.equal(end.y,line.ground(0));assert.equal(end.clip,'idle');
 }
});
test('leaving early descends from the current position and ends on the ground',()=>{
 const line=holdLine(holdFor(1));
 for(const resting of [true,false]){
  const from={x:line.anchor[0],y:line.anchor[1]-(resting?.5:4),z:line.anchor[2]};
  const plan=ropeExitPlan(line,from,resting),start=placement(line,plan.at(0));
  assert.equal(start.y,from.y);assert.equal(start.x,from.x);assert.equal(start.z,from.z);
  const end=placement(line,plan.at(999));assert.equal(end.y,line.ground(0));assert.equal(end.clip,'idle');
 }
});
