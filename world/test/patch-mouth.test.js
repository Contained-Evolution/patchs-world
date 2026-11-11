import test from 'node:test';
import assert from 'node:assert/strict';
import {speechMouth,createPatchMouth} from '../src/patch-mouth.js';
import {createPatchEyes} from '../src/patch-eyes.js';
const until=new Date(8000).toISOString();

test('speech movement stays inside the server speech window',()=>{
  for(const now of [-1,8000,9000])assert.equal(speechMouth('Hello',until,now),0);
  for(const line of ['',null,'   '])assert.equal(speechMouth(line,until,500),0);
  assert.equal(speechMouth('Hello','invalid',500),0);
  assert.equal(speechMouth('Hello',until,500,true),0);
  const samples=Array.from({length:480},(_,i)=>speechMouth('Hello there!',until,i*1000/60));
  assert.ok(samples.every(v=>v>=0&&v<=1));
  assert.ok(samples.some(v=>v>.8));
  assert.ok(samples.filter(v=>v===0).length>100);
});
test('spaces and punctuation pause the mouth',()=>{
  assert.ok(speechMouth('aaa',until,2900)>0);
  assert.equal(speechMouth('a a',until,2900),0);
  assert.equal(speechMouth('a,a',until,2900),0);
});
test('a late visitor samples the same speech phase without restarting',()=>{
  assert.equal(speechMouth('A nice day',until,3200),speechMouth('A nice day',new Date(108000).toISOString(),103200));
});
test('mouth shader composes with eyelids and settles after expiry',()=>{
  const material={},model={traverse(fn){fn({isSkinnedMesh:true,material});}};
  const eyes=createPatchEyes(model),mouth=createPatchMouth(model);
  const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.patchEyeClosure);
  assert.ok(shader.uniforms.patchMouthOpening);
  assert.match(shader.vertexShader,/patchRestPosition = position/);
  assert.match(shader.vertexShader,/transformed.y -=/);
  eyes.update(0,true,1);
  mouth.update('aaa',until,350,false,1);
  assert.ok(shader.uniforms.patchEyeClosure.value>.99);
  assert.ok(shader.uniforms.patchMouthOpening.value>.5);
  mouth.update('aaa',until,9000,false,1);
  assert.ok(shader.uniforms.patchMouthOpening.value<.001);
});
