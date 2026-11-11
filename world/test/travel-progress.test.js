import test from 'node:test';
import assert from 'node:assert/strict';
import {travelFraction} from '../src/travel-progress.js';
test('travel follows server activity time and clamps at both ends',()=>{const start='2026-01-01T12:00:00Z',end='2026-01-01T12:10:00Z',a=Date.parse(start),b=Date.parse(end);assert.equal(travelFraction(start,end,a-1,500),0);assert.equal(travelFraction(start,end,(a+b)/2,500),.5);assert.equal(travelFraction(start,end,b+1,500),1);});
test('legacy or in-place movement continues to loop',()=>{const start='2026-01-01T12:00:00Z',a=Date.parse(start);assert.equal(travelFraction(start,null,a+1000,12),.25);assert.equal(travelFraction(start,null,a+5000,12),.25);});
