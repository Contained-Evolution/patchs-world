import test from 'node:test';
import assert from 'node:assert/strict';
import {speechMouth,createPatchMouth} from '../src/patch-mouth.js';
import {createPatchEyes} from '../src/patch-eyes.js';
import {estimateTiming,mouthAt,captionAt,timingFromAlignment} from '../../shared/speech.js';
const line=(text,from=0,ms=8000)=>({text,at:new Date(from).toISOString(),until:new Date(from+ms).toISOString()});

test('the mouth moves only inside the speech window',()=>{
  for(const now of [-1,8000,9000])assert.equal(speechMouth(line('Hello'),null,now).open,0);
  for(const text of ['',null,'   '])assert.equal(speechMouth(line(text),null,500).open,0);
  assert.equal(speechMouth({...line('Hello'),until:'invalid'},null,500).open,0);
  assert.equal(speechMouth(line('Hello'),null,500,true).open,0);
  const samples=Array.from({length:480},(_,i)=>speechMouth(line('Hello there!'),null,i*1000/60).open);
  assert.ok(samples.every(v=>v>=0&&v<=1));
  assert.ok(samples.some(v=>v>.4));
  assert.ok(samples.filter(v=>v===0).length>60);
});
test('lips meet for m, b and p, round for o and u and spread for e',()=>{
  const timing={chars:'mobee',starts:[0,100,200,300,400],ends:[100,200,300,400,500]};
  assert.equal(mouthAt(timing,20).open,0);
  assert.ok(mouthAt(timing,120).round>.8);
  assert.equal(mouthAt(timing,220).open,0);
  assert.ok(mouthAt(timing,320).wide>.9);
  assert.equal(mouthAt(timing,600).open,0);
});
test('a recording\'s timing drives the mouth instead of the estimate',()=>{
  const timing=timingFromAlignment({characters:['a','m'],character_start_times_seconds:[0,.5],character_end_times_seconds:[.5,1]});
  assert.ok(speechMouth(line('am',0,1000),timing,200).open>.9);
  assert.equal(speechMouth(line('am',0,1000),timing,700).open,0);
});
test('pauses and late visitors',()=>{
  const timing=estimateTiming('Hi, there.',2000);
  const comma=timing.chars.indexOf(',');
  assert.ok(timing.ends[comma]-timing.starts[comma]>timing.ends[0]-timing.starts[0],'a comma is a pause');
  assert.deepEqual(speechMouth(line('A nice day'),null,3200),speechMouth(line('A nice day',100000),null,103200));
});
test('long readings caption one sentence at a time',()=>{
  const text='Hello friend! '+'I found a shiny shell by the tide pools today and it was the best thing. '.repeat(2)+'Bye!';
  const timing=estimateTiming(text,10000);
  assert.equal(captionAt(text,timing,10),'Hello friend!');
  assert.equal(captionAt(text,timing,9990),'Bye!');
  assert.equal(captionAt('Short one.',null,0),'Short one.');
});
test('mouth shader composes with eyelids and settles after the line',()=>{
  const material={},model={traverse(fn){fn({isSkinnedMesh:true,material});}};
  const eyes=createPatchEyes(model),mouth=createPatchMouth(model);
  const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.patchEyeClosure&&shader.uniforms.patchMouthOpening&&shader.uniforms.patchMouthRound&&shader.uniforms.patchMouthWide);
  assert.match(shader.vertexShader,/patchRestPosition = position/);
  assert.match(shader.vertexShader,/transformed.y -=/);
  eyes.update(1,true);
  mouth.update(line('aaa'),null,3000,false,1);
  assert.ok(shader.uniforms.patchEyeClosure.value>.99);
  assert.ok(shader.uniforms.patchMouthOpening.value>.5);
  mouth.update(line('aaa'),null,9000,false,1);
  assert.ok(shader.uniforms.patchMouthOpening.value<.001);
});
