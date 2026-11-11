import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityDecision} from '../src/render-quality.js';
test('resolution adapts within bounds and recovers on faster devices',()=>{assert.equal(qualityDecision(1,1.5,10),.75);assert.equal(qualityDecision(.5,1.5,10),.5);assert.equal(qualityDecision(.5,1.5,50),.56);assert.equal(qualityDecision(1.5,1.5,60),1.5);assert.equal(qualityDecision(1,1.5,30),1);});
