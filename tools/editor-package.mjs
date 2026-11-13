// The editor is vendored so both independently deployed worlds pin identical code.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['shared/editor/model.mjs','shared/editor/store.mjs','shared/editor/glb.mjs','shared/editor/collision.mjs','world/src/editor/editor.js','world/src/editor/registry.js','world/src/editor/assets.js','world/src/editor/published.js','world/editor.css','worker/editor-api.mjs'];
const digest=async base=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(resolve(base,p))).digest('hex')])));
export async function verifyEditorPackage(){const manifest=JSON.parse(await readFile(resolve(root,'shared/editor/package-lock.json'),'utf8'));const actual=await digest(root);for(const file of files)if(actual[file]!==manifest.files[file])throw new Error('Shared editor differs from pinned version: '+file+'. Sync the editor package before building.');}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourceIndex=process.argv.indexOf('--source');
 if(sourceIndex>=0){const source=resolve(process.argv[sourceIndex+1]);for(const file of files){await mkdir(dirname(resolve(root,file)),{recursive:true});await copyFile(resolve(source,file),resolve(root,file));}await copyFile(resolve(source,'shared/editor/package-lock.json'),resolve(root,'shared/editor/package-lock.json'));}
 if(process.argv.includes('--lock'))await writeFile(resolve(root,'shared/editor/package-lock.json'),JSON.stringify({name:'@contained-evolution/world-editor',version:'1.0.0',files:await digest(root)},null,2)+'\n');
 await verifyEditorPackage();console.log('Shared world editor 1.0.0 verified.');
}
