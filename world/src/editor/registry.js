import * as THREE from 'three';
import {transformedBounds} from '../../../shared/editor/model.mjs';
export class WorldRegistry {
  constructor(scene) {this.scene=scene;this.entries=new Map();this.assetCache=new Map();this.added=new Map();}
  instance(id,name,mesh,index,origin,bounds) {
    let entry=this.entries.get(id);
    if(!entry){const root=new THREE.Group();root.position.fromArray(origin);root.userData.editorId=id;this.scene.add(root);entry={id,name,root,base:{id,asset:id,name,position:origin,rotation:[0,0,0],scale:[1,1,1]},bounds,parts:[]};this.entries.set(id,entry);}
    const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);
    entry.parts.push({mesh,index,matrix:matrix.clone()});
    if(/boulder/i.test(name)){mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix).translate(new THREE.Vector3(...origin).negate());entry.bounds=[box.min.toArray(),box.max.toArray()];}
    mesh.userData.editorIds??=[];mesh.userData.editorIds[index]=id;
    return entry;
  }
  cloneBuiltin(id) {
    const entry=this.entries.get(id);if(!entry)throw new Error('Unknown built-in scenery.');
    const root=new THREE.Group(),inverse=new THREE.Matrix4().makeTranslation(...entry.base.position.map(n=>-n));
    for(const part of entry.parts){const mesh=new THREE.Mesh(part.mesh.geometry,part.mesh.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(inverse.clone().multiply(part.matrix));root.add(mesh);}
    root.userData.collisionBounds=entry.bounds;return root;
  }
  updateEntry(entry,record) {
    const r=record||entry.base, root=entry.root;
    const key=JSON.stringify(r);if(entry.applied===key)return;
    if(!record&&!entry.applied){entry.applied=key;return;}entry.applied=key;
    root.position.fromArray(r.deleted?entry.base.position:r.position);root.rotation.fromArray(r.deleted?[0,0,0]:r.rotation);root.scale.fromArray(r.deleted?[1,1,1]:r.scale);root.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().makeTranslation(...entry.base.position.map(n=>-n));
    const delta=root.matrixWorld.clone().multiply(inverse),zero=new THREE.Matrix4().makeScale(0,0,0);
    for(const p of entry.parts){p.mesh.setMatrixAt(p.index,r.deleted?zero:delta.clone().multiply(p.matrix));p.mesh.instanceMatrix.needsUpdate=true;p.mesh.computeBoundingSphere();}
    entry.deleted=!!r.deleted;
  }
  record(entry) {return {...entry.base,position:entry.root.position.toArray(),rotation:entry.root.rotation.toArray().slice(0,3),scale:entry.root.scale.toArray()};}
  async apply(layout,loadAsset) {
    const overrides=new Map(layout.objects.map(o=>[o.id,o]));
    const next=new Map();
    try {
      await Promise.all(layout.objects.filter(o=>!o.id.startsWith('base:')&&!o.deleted).map(async o=>{
        const root=o.asset.startsWith('base:')?this.cloneBuiltin(o.asset):await loadAsset(o.asset);
        root.userData.asset=o.asset;root.userData.editorId=o.id;next.set(o.id,root);
      }));
    }catch(error){throw error;}
    for(const o of layout.objects){const root=next.get(o.id);if(root){root.position.fromArray(o.position);root.rotation.set(...o.rotation);root.scale.fromArray(o.scale);}}
    for(const entry of this.entries.values())this.updateEntry(entry,overrides.get(entry.id));
    for(const root of this.added.values())this.scene.remove(root);
    this.added=next;for(const root of next.values())this.scene.add(root);
    this.scene.updateMatrixWorld(true);
  }
  collisionBoxes(layout) {
    const records=new Map(layout.objects.map(o=>[o.id,o])),boxes=[];
    for(const entry of this.entries.values()) {const r=records.get(entry.id)||entry.base;if(!r.deleted)boxes.push(transformedBounds(entry.bounds,r));}
    for(const root of this.added.values()){if(root.userData.collisionBounds){const o=layout.objects.find(o=>o.id===root.userData.editorId);boxes.push(transformedBounds(root.userData.collisionBounds,o));continue;}const b=new THREE.Box3().setFromObject(root);boxes.push([b.min.toArray(),b.max.toArray()]);}
    return boxes;
  }
}
