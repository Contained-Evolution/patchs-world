import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export const primitives=[{id:'primitive:block',name:'Building block',bounds:[[-.5,0,-.5],[.5,1,.5]]},{id:'primitive:platform',name:'Platform',bounds:[[-2,0,-2],[2,.25,2]]}];
export function createAssetLoader(base,api) {
  const loader=new GLTFLoader(),cache=new Map();
  return async id=>{
    if(id.startsWith('primitive:')){const platform=id==='primitive:platform';const mesh=new THREE.Mesh(new THREE.BoxGeometry(platform?4:1,platform?.25:1,platform?4:1),new THREE.MeshStandardMaterial({color:0xb6a181,roughness:.85}));mesh.position.y=platform?.125:.5;const g=new THREE.Group();g.add(mesh);return g;}
    const url=id.startsWith('upload:')?api+'/assets/'+id.slice(7):base+'assets/'+id.slice(8).split('/').map(encodeURIComponent).join('/');
    if(!cache.has(url))cache.set(url,loader.loadAsync(url).then(g=>g.scene).catch(error=>{cache.delete(url);throw error;}));
    return (await cache.get(url)).clone(true);
  };
}
