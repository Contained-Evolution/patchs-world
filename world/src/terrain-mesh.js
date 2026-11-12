import * as THREE from 'three';
import { ISLAND, TERRAIN_RINGS, TERRAIN_SLICES, coastRadius, terrainElevation, places, pondFraction, streamInfo } from './terrain.js';
export function createTerrainTiles(){
 const rings=TERRAIN_RINGS,slices=TERRAIN_SLICES,ringChunk=40,sliceChunk=64,color=new THREE.Color(),grassC=new THREE.Color(0x6d9b5b),sandC=new THREE.Color(0xe0c889),ridgeC=new THREE.Color(0x8b9381),result=[];
 for(let jr=0;jr<rings;jr+=ringChunk)for(let ir=0;ir<slices;ir+=sliceChunk){const v=[],uv=[],colors=[],normals=[],banks=[],indices=[],columns=sliceChunk+1;
  for(let j=0;j<=ringChunk;j++)for(let i=0;i<=sliceChunk;i++){const a=(ir+i)/slices*Math.PI*2,q=(jr+j)/rings,r=coastRadius(a)*q,x=Math.cos(a)*ISLAND.radiusX*r,z=Math.sin(a)*ISLAND.radiusZ*r,y=terrainElevation(x,z);v.push(x,y,z);uv.push(x/640+.5,z/720+.5);const nx=terrainElevation(x-.25,z)-terrainElevation(x+.25,z),nz=terrainElevation(x,z-.25)-terrainElevation(x,z+.25),nl=Math.hypot(nx,.5,nz);normals.push(nx/nl,.5/nl,nz/nl);const beach=THREE.MathUtils.smoothstep(q,.83,1),high=THREE.MathUtils.smoothstep(y,19,35);color.copy(grassC).lerp(ridgeC,high*.6).lerp(sandC,beach);const tidal=Math.max(0,1-Math.hypot((x-places['tide-pools'][0])/55,(z-places['tide-pools'][1])/48));color.lerp(ridgeC,tidal*.75);colors.push(color.r,color.g,color.b);
   const stream=streamInfo(x,z);
   const pool=1-THREE.MathUtils.smoothstep(pondFraction(x,z),1.47,1.72);
   const bank=Number.isFinite(stream.distance)?1-THREE.MathUtils.smoothstep(stream.distance,stream.width+5,stream.width+17):0;
   const wet=stream.distance<stream.width+5 ? stream.level : ISLAND.pondY;
   banks.push(Math.max(pool,bank),THREE.MathUtils.smoothstep(y-wet,.25,2.2));}
  for(let j=0;j<ringChunk;j++)for(let i=0;i<sliceChunk;i++){const a=j*columns+i,b=a+1,c=a+columns,d=c+1;indices.push(a,b,c,b,d,c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('bank',new THREE.Float32BufferAttribute(banks,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingSphere();result.push(g);
 }
 return result;
}
