import test from 'node:test';
import assert from 'node:assert/strict';
import { traversalLoop, trees, ROPE_LENGTH } from '../src/world-state.js';
import { makeTransfer, swingRhythm } from '../src/traversal.js';

test('swing breaks occur at a hold and tired Patch rests longer',()=>{
 assert.deepEqual(swingRhythm(4,[6,9],'tired','clear'),{distance:6,resting:true});
 assert.deepEqual(swingRhythm(6,[6,9],'tired','clear'),{distance:6,resting:true});
 assert.ok(swingRhythm(4,[6,9],'happy','clear').distance>6);
});

test('each branch and rope transfer clears every tall-tree trunk and joins continuously',()=>{
 const holds=traversalLoop(),types=new Set();
 for(let i=1;i<holds.length;i++){
  const from=holds[i-1],to=holds[i],plan=makeTransfer(from,to);types.add(`${from.type}-${to.type}`);
  for(let j=0;j<=1000;j++){
   const t=j/1000,{grip,hold}=plan.at(t);
   for(const tree of trees)assert.ok(Math.hypot(grip[0]-tree[0],grip[2]-tree[1])>=.94,`${from.index} to ${to.index} at ${t}`);
   if(hold?.type==='rope'){const d=Math.hypot(...grip.map((v,k)=>v-hold.anchor[k]));assert.ok(Math.abs(d-ROPE_LENGTH)<.1);}
   if(j){const previous=plan.at((j-1)/1000).grip;assert.ok(Math.hypot(...grip.map((v,k)=>v-previous[k]))<.15);}
  }
  assert.deepEqual(plan.at(0).grip,from.grip);assert.deepEqual(plan.at(1).grip,to.grip);
 }
 assert.ok(types.has('branch-rope'));assert.ok(types.has('rope-rope'));assert.ok(types.has('rope-branch'));
});
