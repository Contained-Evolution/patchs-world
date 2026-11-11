import test from 'node:test';
import assert from 'node:assert/strict';
import {forest,forestTrees,isReserved} from '../src/forest.js';
import {trees} from '../src/world-state.js';
test('forest positions are deterministic and preserve activity and trail clearances',()=>{
 assert.deepEqual(forest,forestTrees());assert.ok(forest.length>500);
 for(const tree of forest)if(!tree.swing){assert.equal(isReserved(tree.x,tree.z),false);for(const [x,z] of trees)assert.ok(Math.hypot(tree.x-x,tree.z-z)>=7);}
 assert.equal(forest.filter(t=>t.swing).length,trees.length);
});
