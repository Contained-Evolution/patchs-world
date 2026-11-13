import * as THREE from 'three';
import {createIsland} from '../island.js';
import {groundHeight} from '../terrain.js';
import {createAssetLoader} from './assets.js';
import {startEditor} from './editor.js';
import catalog from '../../../shared/editor/catalog.json' with {type:'json'};
const scene=new THREE.Scene();scene.background=new THREE.Color(0xadd9d4);scene.add(new THREE.HemisphereLight(0xfff5d7,0x556747,2.8));const sun=new THREE.DirectionalLight(0xfff1d8,2);sun.position.set(100,250,80);scene.add(sun);
const island=createIsland(scene),loadAsset=createAssetLoader('./','/api/editor');
await startEditor({scene,registry:island.registry,catalog,loadAsset,api:'/api/editor',back:'/',center:[0,groundHeight(0,0),0],height:groundHeight,protected:['Patch','Terrain and water','Grove and climbing trees','Other camp furniture','Climbing structures','Activity landmarks'],async apply(layout){await island.registry.apply(layout,loadAsset);island.setEditorLayout(layout);},update(layout){island.setEditorLayout(layout);},cutaway(value){scene.traverse(o=>{if(o.userData.editorTerrain)o.visible=!value;});},tick(dt){island.update(dt,1);}});
