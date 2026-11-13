import {readdir,readFile,writeFile} from 'node:fs/promises';
import {glbBounds} from '../shared/editor/glb.mjs';
const assets=[];
for(const path of await readdir('world/assets',{recursive:true})) {
 if(!path.endsWith('.glb'))continue;
 try{const b=await readFile('world/assets/'+path);const bounds=glbBounds(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assets.push({id:'catalog:'+path,name:path.split('/').at(-1).replace('.glb','').replaceAll('-',' '),bounds});}catch{}
}
await writeFile('shared/editor/catalog.json',JSON.stringify(assets,null,2)+'\n');
