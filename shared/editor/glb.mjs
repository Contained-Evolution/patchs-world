import {MAX_UPLOAD} from './model.mjs';
// Reject external dependencies and unsupported compression before any model is loaded.
export function inspectGLB(bytes) {
  if(bytes.byteLength>MAX_UPLOAD) throw new Error('GLB must be 25 MiB or smaller.');
  const view=new DataView(bytes);
  if(bytes.byteLength<20 || view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==bytes.byteLength || view.getUint32(16,true)!==0x4e4f534a) throw new Error('Invalid GLB 2 model.');
  const len=view.getUint32(12,true); if(len>bytes.byteLength-20) throw new Error('Invalid GLB JSON.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,len)));
  if(json.asset?.version!=='2.0' || (json.extensionsRequired||[]).some(x=>!['KHR_materials_unlit','KHR_texture_transform'].includes(x))) throw new Error('Unsupported required GLB extension. Export an uncompressed GLB.');
  if((json.buffers||[]).some(b=>b.uri) || (json.images||[]).some(i=>i.uri)) throw new Error('Use a self-contained GLB with embedded textures.');
  const binHeader=20+len;
  if(binHeader+8>bytes.byteLength||view.getUint32(binHeader+4,true)!==0x004e4942||binHeader+8+view.getUint32(binHeader,true)>bytes.byteLength)throw new Error('GLB is missing its embedded binary data.');
  const binaryLength=view.getUint32(binHeader,true);
  if((json.buffers?.length||0)!==1||json.buffers[0].byteLength>binaryLength)throw new Error('Invalid embedded buffer.');
  for(const b of json.bufferViews||[]){if(b.buffer!==0||!Number.isSafeInteger(b.byteLength)||b.byteLength<0||!Number.isSafeInteger(b.byteOffset||0)||(b.byteOffset||0)<0||(b.byteOffset||0)+b.byteLength>binaryLength||(b.byteStride!==undefined&&(!Number.isSafeInteger(b.byteStride)||b.byteStride<4||b.byteStride>252)))throw new Error('Invalid buffer view.');}
  for(const image of json.images||[])if(!Number.isInteger(image.bufferView)||!json.bufferViews?.[image.bufferView])throw new Error('Textures must use embedded image data.');
  for(const mesh of json.meshes||[])for(const primitive of mesh.primitives||[]){
    const a=json.accessors?.[primitive.attributes?.POSITION], b=json.bufferViews?.[a?.bufferView];
    if(!a||!b||a.type!=='VEC3'||a.componentType!==5126||a.sparse||!Number.isSafeInteger(a.count)||a.count<1||a.count>1000000)throw new Error('Unsupported position data. Export static float32 positions.');
    const stride=b.byteStride||12,start=(b.byteOffset||0)+(a.byteOffset||0);
    if(!Number.isSafeInteger(a.byteOffset||0)||b.buffer!==0||stride<12||start<0||(a.byteOffset||0)+(a.count-1)*stride+12>b.byteLength||start+(a.count-1)*stride+12>binaryLength)throw new Error('Position data exceeds the embedded buffer.');
  }
  if(!json.meshes?.length || json.meshes.length>2000 || (json.nodes?.length||0)>10000) throw new Error('Model has no mesh or is too complex.');
  const vertices=(json.meshes||[]).reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+(json.accessors?.[p.attributes?.POSITION]?.count||0),0),0);
  if(vertices>1000000 || !vertices) throw new Error('Model must contain between 1 and 1,000,000 vertices.');
  return {vertices};
}
export function glbBounds(bytes) {
  inspectGLB(bytes);
  const v=new DataView(bytes), j=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,v.getUint32(12,true))));
  if(j.skins?.length) throw new Error('Upload static scenery without a skeleton.');
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const multiply=(a,b)=>Array.from({length:16},(_,i)=>{const r=i%4,c=Math.floor(i/4);return a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];});
  const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];let visited=0;
  const accessorBounds=new Map(),binaryOffset=20+v.getUint32(12,true)+8;
  function positions(index){
    if(accessorBounds.has(index))return accessorBounds.get(index);
    const a=j.accessors[index],b=j.bufferViews[a.bufferView],start=binaryOffset+(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||12;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const n=v.getFloat32(start+i*stride+k*4,true);if(!Number.isFinite(n))throw new Error('Nonfinite model geometry.');min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);}
    const result={min,max};accessorBounds.set(index,result);return result;
  }

  function walk(index,parent,ancestors=new Set()) {
    if(ancestors.has(index)||++visited>20000) throw new Error('Invalid model hierarchy.');
    const node=j.nodes?.[index];if(!node) throw new Error('Invalid model node.');
    const chain=new Set(ancestors);chain.add(index);
    let local=node.matrix;
    if(!local) {
      const [x,y,z,w]=node.rotation||[0,0,0,1], [sx,sy,sz]=node.scale||[1,1,1], [tx,ty,tz]=node.translation||[0,0,0];
      local=[(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,(2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,(2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,tx,ty,tz,1];
    }
    if(local.length!==16||local.some(n=>!Number.isFinite(n))) throw new Error('Invalid model transform.');
    const matrix=multiply(parent,local);
    if(node.mesh!==undefined) for(const p of j.meshes[node.mesh]?.primitives||[]) {
      const a=positions(p.attributes.POSITION);
      if(!a?.min||!a?.max||a.min.length!==3||a.max.length!==3) throw new Error('Model needs position bounds.');
      for(let i=0;i<8;i++){const q=[(i&1?a.max:a.min)[0],(i&2?a.max:a.min)[1],(i&4?a.max:a.min)[2]];for(let k=0;k<3;k++){const n=matrix[k]*q[0]+matrix[k+4]*q[1]+matrix[k+8]*q[2]+matrix[k+12];min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);}}
    }
    for(const child of node.children||[]) walk(child,matrix,chain);
  }
  for(const node of j.scenes?.[j.scene||0]?.nodes||[]) walk(node,identity());
  if([...min,...max].some(n=>!Number.isFinite(n)||Math.abs(n)>10000)) throw new Error('Invalid or excessive model bounds.');
  return [min,max];
}
