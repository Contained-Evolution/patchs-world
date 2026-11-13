import baseline from '../shared/editor/baseline.json' with {type:'json'};
import {EditorStore} from '../shared/editor/store.mjs';
import {emptyLayout,transformedBounds} from '../shared/editor/model.mjs';
import catalog from '../shared/editor/catalog.json' with {type:'json'};
import {groundHeight,places,shoreFraction} from '../world/src/terrain.js';
const primitives={'primitive:block':[[-.5,0,-.5],[.5,1,.5]],'primitive:platform':[[-2,0,-2],[2,.25,2]]};
export function editorStore(storage) {
 return new EditorStore(storage,async()=>emptyLayout(),async layout=>{
  const uploads=await storage.get('editor:uploads')||[];
  for(const o of layout.objects){
   let bounds;
   if(o.id.startsWith('base:')){const original=baseline.find(b=>b.id===o.id);if(!original)throw new Error('Unknown scenery or protected activity fixture.');bounds=original.bounds;}
   if(o.deleted)continue;
   if(o.id.startsWith('base:')&&o.asset!==o.id)throw new Error('Invalid built-in asset.');
   if(o.asset.startsWith('base:'))bounds??=baseline.find(b=>b.id===o.asset)?.bounds;
   bounds??=primitives[o.asset]||catalog.find(a=>a.id===o.asset)?.bounds||uploads.find(a=>'upload:'+a.id===o.asset)?.bounds;
   if(!bounds)throw new Error('Asset is not in this world’s library.');
   const [min,max]=transformedBounds(bounds,o), x=o.position[0],z=o.position[2];
   if(max[0]-min[0]>200||max[1]-min[1]>250||max[2]-min[2]>200)throw new Error('Object is too large. Reduce its scale.');
   if(shoreFraction(x,z)>1.08)throw new Error('Keep scenery within the island.');
   for(const [name,[px,pz]] of Object.entries(places)){
    const radius=name==='hammock'?9:name==='tall-trees'?14:5;
    if(Math.hypot(Math.max(min[0]-px,0,px-max[0]),Math.max(min[2]-pz,0,pz-max[2]))<radius&&max[1]>groundHeight(px,pz)-1&&min[1]<groundHeight(px,pz)+12)throw new Error('Keep the '+name+' activity space clear.');
   }
  }
 });
}
