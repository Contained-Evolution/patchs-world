import test from 'node:test';
import assert from 'node:assert/strict';
import {walkable} from '../src/visitor-controls.js';
import {places} from '../src/world-state.js';

test('landmarks are reachable on the walking surface',()=>{
  const step=.5, key=(x,z)=>`${x},${z}`, queue=[[0,0]], seen=new Set([key(0,0)]);
  for(let i=0;i<queue.length;i++){
    const [x,z]=queue[i];
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,k=key(nx,nz);
      if(!seen.has(k)&&walkable(nx*step,nz*step,x*step,z*step)){seen.add(k);queue.push([nx,nz]);}
    }
  }
  for(const [name,[x,z]] of Object.entries(places)) assert.ok(queue.some(([a,b])=>Math.hypot(a*step-x,b*step-z)<1.5),`${name} is unreachable`);
  assert.equal(walkable(46,0),false);
});
