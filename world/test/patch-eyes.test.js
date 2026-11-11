import test from 'node:test';
import assert from 'node:assert/strict';
import {eyeClosure,createPatchEyes} from '../src/patch-eyes.js';

test('awake blinks close fully, reopen, and vary their timing',()=>{
  assert.equal(eyeClosure(0,false),0);
  assert.equal(eyeClosure(2.18,false),1);
  assert.equal(eyeClosure(2.5,false),0);
  const values=Array.from({length:6000},(_,i)=>eyeClosure(i/60,false));
  assert.ok(values.every(v=>v>=0&&v<=1));
  assert.ok(values.filter(v=>v===0).length>5500);
  assert.ok(values.filter(v=>v===1).length>30);
});
test('sleep stays closed independently of blink time and eases open on waking',()=>{
  const material={},model={traverse(fn){fn({isSkinnedMesh:true,material});}};
  const eyes=createPatchEyes(model);
  const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader);
  for(let i=0;i<180;i++)eyes.update(i/60,true,1/60);
  const value=()=>shader.uniforms.patchEyeClosure.value;
  assert.ok(value()>.999);
  for(let t=0;t<30;t+=.1)assert.equal(eyeClosure(t,true),1);
  eyes.update(0,false,1/60);assert.ok(value()>0&&value()<1);
  for(let i=0;i<60;i++)eyes.update(0,false,1/60);
  assert.ok(value()<.001);
  eyes.update(2.18,false,1/60);assert.equal(value(),1);
});
