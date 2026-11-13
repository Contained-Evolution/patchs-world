import test from 'node:test';
import assert from 'node:assert/strict';
import {editorStore} from '../editor-world.mjs';
import {emptyLayout} from '../../shared/editor/model.mjs';
const storage={get:async()=>undefined};
const store=editorStore(storage,async()=>({scenery:[],walkways:[]}));
const record={id:'test',asset:'upload:00000000-0000-4000-8000-000000000000',name:'Missing asset',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
test('publish validation rejects missing uploads and edits to protected fixtures',async()=>{await assert.rejects(()=>store.validate({...emptyLayout(),objects:[record]}),/library/);await assert.rejects(()=>store.validate({...emptyLayout(),objects:[{id:'base:unknown',deleted:true}]}),/protected|fixture/i);});
test('empty scenery layout is valid',async()=>{await store.validate(emptyLayout());});
test('functional fixtures can be moved independently and published at grounded positions',async()=>{
 const {campDefaults,fixtureHeight}=await import('../../shared/editor/camp.mjs');const {places,groundHeight}=await import('../../world/src/terrain.js');
 const [tent,pc]=campDefaults(places,groundHeight);
 await store.validate({...emptyLayout(),objects:[{...pc,position:[-24,fixtureHeight(pc.id,-24,-18,Math.PI/2,groundHeight),-18],rotation:[0,Math.PI/2,0]}]});
 await store.validate({...emptyLayout(),objects:[{...tent,position:[-24,fixtureHeight(tent.id,-24,-18,.6,groundHeight),-18],rotation:[0,.6,0]}]});
 await assert.rejects(()=>store.validate({...emptyLayout(),objects:[{id:tent.id,deleted:true}]}),/delet/i);
 await assert.rejects(()=>store.validate({...emptyLayout(),objects:[{...pc,scale:[2,2,2]}]}),/original size/);
});
test('sign and connected GLB structures can publish, while swings aimed away from water are rejected',async()=>{
 const {POND_SWING_DEFINITIONS}=await import('../../world/src/pond-swings.js');const {HAMMOCK_DEFINITION}=await import('../../world/src/hammock.js');const baseline=(await import('../../shared/editor/baseline.json',{with:{type:'json'}})).default;
 await store.validate({...emptyLayout(),objects:[baseline.find(b=>b.id==='base:camp-sign')]});
 await store.validate({...emptyLayout(),objects:[HAMMOCK_DEFINITION]});
 for(const definition of POND_SWING_DEFINITIONS)await store.validate({...emptyLayout(),objects:[definition]});
 const wrong={...POND_SWING_DEFINITIONS[0],rotation:[0,POND_SWING_DEFINITIONS[0].rotation[1]+Math.PI,0]};await assert.rejects(()=>store.validate({...emptyLayout(),objects:[wrong]}),/bank|aim|pond/i);
});
