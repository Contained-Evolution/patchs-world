// Export the stable built-in object registry for server-side authorization/validation.
import * as THREE from '../world/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../world/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {writeFile} from 'node:fs/promises';
import {createIsland} from '../world/src/island.js';
const gradient={addColorStop(){}};const canvas={};const context=new Proxy({canvas},{get:(target,name)=>name in target?target[name]:name==='createPattern'?()=>({setTransform(){}}):name==='measureText'?text=>({width:text.length*23}):name==='getImageData'?()=>({data:new Uint8ClampedArray(512*512*4)}):String(name).endsWith('Gradient')?()=>gradient:()=>{}});canvas.getContext=()=>context;
globalThis.DOMMatrix=class {scale(){return this;}};
globalThis.document={baseURI:'http://localhost/',createElement:()=>canvas,querySelector:()=>({textContent:'Patch’s World'}),querySelectorAll:()=>[],fonts:{ready:Promise.resolve(),load:()=>Promise.resolve()}};
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();GLTFLoader.prototype.load=()=>{};
const {registry}=createIsland(new THREE.Scene(),true);
const entries=[...registry.entries.values()].map(e=>({...e.base,bounds:e.bounds}));
await writeFile('shared/editor/baseline.json',JSON.stringify(entries)+'\n');
