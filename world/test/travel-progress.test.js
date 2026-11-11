import test from 'node:test';
import assert from 'node:assert/strict';
import { travelFraction } from '../src/travel-progress.js';
test('journey progress comes from shared activity times and is clamped',()=>{
  const start='2026-11-11T12:00:00Z',end='2026-11-11T12:10:00Z';
  assert.equal(travelFraction(start,end,Date.parse('2026-11-11T12:05:00Z')),.5);
  assert.equal(travelFraction(start,end,Date.parse('2026-11-11T11:59:00Z')),0);
  assert.equal(travelFraction(start,end,Date.parse('2026-11-11T12:11:00Z')),1);
  assert.equal(travelFraction(start,null,Date.now()),0);
});
