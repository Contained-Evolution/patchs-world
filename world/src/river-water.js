import * as THREE from 'three';
import { ISLAND, OCEAN_INNER_SHORE, RIVER, coastRadius, groundHeight, pondFraction, riverPoint } from './terrain.js';

export function oceanGeometry() {
 const vertices=[],indices=[],slices=256;
 for(let i=0;i<=slices;i++){
  const angle=i/slices*Math.PI*2,r=coastRadius(angle)*OCEAN_INNER_SHORE;
  vertices.push(Math.cos(angle)*ISLAND.radiusX*r,ISLAND.ocean,Math.sin(angle)*ISLAND.radiusZ*r,
   Math.cos(angle)*6000,ISLAND.ocean,Math.sin(angle)*6000);
  if(i<slices){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}

const splash=riverPoint(RIVER.foot+3);

export function addRiverWater(add, time, daylight) {
 const water=new THREE.MeshStandardMaterial({
  color:0x69baaa,roughness:.22,metalness:.1,transparent:true,side:THREE.DoubleSide,depthWrite:false
 });
 water.onBeforeCompile=shader=>{
  shader.uniforms.waterTime=time;
  shader.uniforms.waterLight=daylight;
  shader.uniforms.riverEnd={value:RIVER.length};
  shader.uniforms.splashCenter={value:new THREE.Vector2(splash.x,splash.z)};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>',`#include <common>
attribute vec4 waterData;
varying vec4 water;
varying vec2 waterPosition;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
water=waterData;
waterPosition=position.xz;`);
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
uniform float waterTime;
uniform float waterLight;
uniform vec2 splashCenter;
uniform float riverEnd;
varying vec4 water;
varying vec2 waterPosition;
float waterHash(vec2 p) {
 vec3 q=fract(vec3(p.xyx)*.1031);
 q+=dot(q,q.yzx+33.33);
 return fract((q.x+q.y)*q.z);
}
float waterNoise(vec2 p) {
 vec2 cell=floor(p), f=fract(p);
 f=f*f*(3.0-2.0*f);
 return mix(mix(waterHash(cell),waterHash(cell+vec2(1,0)),f.x),
            mix(waterHash(cell+vec2(0,1)),waterHash(cell+vec2(1,1)),f.x),f.y);
}`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
float along=water.x, across=water.y, depth=water.z, river=step(0.0,along);
float drop=water.w;
float detail=1.0-smoothstep(.15,1.9,length(fwidth(waterPosition)));
vec2 p=mix(waterPosition,vec2(across*9.0,along*.56),river);
p.y-=waterTime*mix(.35,2.1,river);
float eddy=waterNoise(p*.62);
float rippleA=sin(p.x*1.2+p.y*3.0+eddy*6.5);
float rippleB=sin(p.x*-2.7+p.y*1.3+waterNoise(p*1.1)*5.0);
normal=normalize(normal+vec3(rippleA,rippleB,0.0)*(.10-.045*drop)*detail);
float deep=smoothstep(.0,2.65,depth);
diffuseColor.rgb=mix(vec3(.25,.53,.39),vec3(.022,.24,.23),deep);
diffuseColor.rgb*=1.0+(rippleA+rippleB)*.028*detail;
diffuseColor.a=mix(.38,.91,smoothstep(0.0,1.7,depth));
float ribbons=waterNoise(vec2(across*27.0+eddy*.7,p.y*.39));
float whitewater=smoothstep(.62,.94,ribbons)*(.12+drop*.67)*river;
float veil=(.21+.61*ribbons)*drop;
float splashDist=length(waterPosition-splashCenter);
float spray=(1.0-smoothstep(1.0,10.0,splashDist))*(.20+.80*smoothstep(.37,.72,waterNoise(p*1.5)));
float foam=clamp(whitewater+veil+spray*.72,0.0,1.0);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.87,.81),foam);
diffuseColor.a=max(diffuseColor.a,foam*.94);
diffuseColor.a*=1.0-smoothstep(riverEnd-7.0,riverEnd,along);`)
   .replace('#include <opaque_fragment>',`float grazing=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),4.0);
outgoingLight=mix(outgoingLight,vec3(.36,.52,.54)*(.14+.86*waterLight),grazing*(1.0-foam)*.66);
outgoingLight+=vec3(.59,.73,.64)*foam*(.12+.18*waterLight);
outgoingLight+=vec3(.9,.85,.68)*smoothstep(.91,1.0,rippleA)*eddy*detail*waterLight*.09;
#include <opaque_fragment>`);
 };

 // Extend surfaces slightly under the bank so the visible terrain sets the shoreline.
 const vertices=[],data=[],indices=[],lanes=20,rows=Math.ceil(RIVER.length/.65);
 for(let row=0;row<=rows;row++){
  const s=RIVER.length*row/rows;
  const center=riverPoint(s),before=riverPoint(s-.65),after=riverPoint(s+.65);
  const dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz);
  const drop=THREE.MathUtils.smoothstep(s,RIVER.lip-1.7,RIVER.lip+.6)
    *(1-THREE.MathUtils.smoothstep(s,RIVER.foot,RIVER.foot+2.2));
  for(let lane=0;lane<=lanes;lane++){
   const across=(2*lane/lanes-1)*1.17;
   const x=center.x-dz/length*center.width*across,z=center.z+dx/length*center.width*across;
   const y=center.y+.024;
   vertices.push(x,y,z);
   data.push(s,across,y-groundHeight(x,z),drop);
  }
 }
 for(let row=0;row<rows;row++)for(let lane=0;lane<lanes;lane++){
  const a=row*(lanes+1)+lane,b=a+1,c=a+lanes+1,d=c+1;
  indices.push(a,b,c,b,d,c);
 }
 addSurface(add,water,vertices,data,indices);

 const poolVertices=[],poolData=[],poolIndices=[],steps=56;
 for(let row=0;row<=steps;row++)for(let column=0;column<=steps;column++){
  const x=ISLAND.pondX+(2*column/steps-1)*ISLAND.pondRX*1.16;
  const z=ISLAND.pondZ+(2*row/steps-1)*ISLAND.pondRZ*1.16;
  poolVertices.push(x,ISLAND.pondY,z);
  poolData.push(-1,0,ISLAND.pondY-groundHeight(x,z),0);
  if(row<steps&&column<steps&&pondFraction(x,z)<1.18){
   const a=row*(steps+1)+column,b=a+1,c=a+steps+1,d=c+1;
   poolIndices.push(a,c,b,b,c,d);
  }
 }
 addSurface(add,water,poolVertices,poolData,poolIndices);
}

function addSurface(add,material,vertices,data,indices) {
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('waterData',new THREE.Float32BufferAttribute(data,4));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 add(geometry,material);
}
