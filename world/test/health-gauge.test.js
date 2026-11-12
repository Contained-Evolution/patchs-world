import test from 'node:test';
import assert from 'node:assert/strict';
import { overallHealth } from '../src/health-gauge.js';

test('overall health averages the needs Patch has', () => {
  assert.equal(overallHealth({ hunger: 1, energy: .5, fun: 0 }), .5);
  assert.equal(overallHealth({ hunger: .2, energy: .4, fun: .6, comfort: .8, social: 1 }), .6);
});

test('overall health ignores unknown needs and stays within 0 to 1', () => {
  assert.equal(overallHealth({ hunger: 2, energy: 'x' }), 1);
  assert.equal(overallHealth({ hunger: -1 }), 0);
  assert.equal(overallHealth(undefined), null);
  assert.equal(overallHealth({}), null);
});
