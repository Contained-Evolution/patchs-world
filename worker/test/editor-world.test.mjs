import test from 'node:test';
import assert from 'node:assert/strict';
import {editorStore} from '../editor-world.mjs';
import {emptyLayout} from '../../shared/editor/model.mjs';
const storage={get:async()=>undefined};
const store=editorStore(storage,async()=>({scenery:[],walkways:[]}));
const record={id:'test',asset:'upload:00000000-0000-4000-8000-000000000000',name:'Missing asset',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
test('publish validation rejects missing uploads and edits to protected fixtures',async()=>{await assert.rejects(()=>store.validate({...emptyLayout(),objects:[record]}),/library/);await assert.rejects(()=>store.validate({...emptyLayout(),objects:[{id:'base:unknown',deleted:true}]}),/protected|fixture/i);});
test('empty scenery layout is valid',async()=>{await store.validate(emptyLayout());});
