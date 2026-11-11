import test from 'node:test';
import assert from 'node:assert/strict';
import {blinkShape,createBlinker,blinkRate,drowsiness,createPatchEyes} from '../src/patch-eyes.js';

const seeded=(seed=7)=>()=>((seed=(seed*16807)%2147483647)-1)/2147483646;
const blinks=(blinker,seconds,options)=>{let count=0,closed=false;for(let i=0;i<seconds*60;i++){const v=blinker.update(1/60,options);if(v>.5&&!closed)count++;closed=v>.5;}return count;};

test('a blink closes fast, holds and reopens',()=>{
  assert.equal(blinkShape(-.01),0);
  assert.equal(blinkShape(.08),1);
  assert.ok(blinkShape(.2)>0&&blinkShape(.2)<1);
  assert.equal(blinkShape(.3),0);
});
test('blinks come every few seconds, slower while reading and faster while talking',()=>{
  const normal=blinks(createBlinker(seeded()),120),reading=blinks(createBlinker(seeded()),120,{rate:blinkRate('computer',false)}),talking=blinks(createBlinker(seeded()),120,{rate:blinkRate('walk',true)});
  assert.ok(normal>=18&&normal<=45,`normal ${normal}`);
  assert.ok(reading<normal&&talking>normal,`${reading} < ${normal} < ${talking}`);
  const values=Array.from({length:6000},()=>createBlinker(seeded(3)).update(1/60));
  assert.ok(values.every(v=>v>=0&&v<=1));
});
test('shifting what he does often brings a blink',()=>{
  let hits=0;
  for(let seed=1;seed<40;seed++){const b=createBlinker(seeded(seed));for(let i=0;i<60;i++)b.update(1/60);let v=0;b.update(1/60,{shift:true});for(let i=0;i<6;i++)v=Math.max(v,b.update(1/60));if(v>.5)hits++;}
  assert.ok(hits>20,`${hits}`);
});
test('tired lids droop',()=>{
  assert.equal(drowsiness(.8),0);
  assert.ok(drowsiness(.2)>0&&drowsiness(0)===.35);
});
test('sleep stays closed and eases open on waking',()=>{
  const material={},model={traverse(fn){fn({isSkinnedMesh:true,material});}};
  const eyes=createPatchEyes(model);
  const shader={uniforms:{},vertexShader:'#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
  material.onBeforeCompile(shader);
  for(let i=0;i<180;i++)eyes.update(1/60,true);
  const value=()=>shader.uniforms.patchEyeClosure.value;
  assert.ok(value()>.999);
  eyes.update(1/60,false);assert.ok(value()>0&&value()<1);
  for(let i=0;i<60;i++)eyes.update(1/60,false,{rate:0});
  assert.ok(value()<.001);
  for(let i=0;i<600;i++)eyes.update(1/60,false,{rate:0,drowsy:.35});
  assert.ok(value()>.3);
});
