import { terrainHeight } from './valley/heightfield.js';
import { LAKE, RIVER as VALLEY_RIVER } from './valley/valley-water-layout.js';
export const ISLAND = { radiusX: 320, radiusZ: 360, ocean: 0, pondX: LAKE.x, pondZ: LAKE.z, pondY: LAKE.surface, pondRX: LAKE.radiusX, pondRZ: LAKE.radiusZ };
export const places = {
 hammock:[0,0], shelves:[5,2], computer:[-7,-6], 'banana-grove':[18,116],
 'tall-trees':[72,-68], pond:[11,83], beach:[-18,140], 'tide-pools':[-86,172],
 lookout:[146,-86], meadow:[64,80], cave:[-120,-70]
};
const routeControls = {
 hammock:[[0,0]], shelves:[[0,0],places.shelves], computer:[[0,0],places.computer],
 'banana-grove':[[0,0],[25,48],places['banana-grove']],
 'tall-trees':[[0,0],[45,-48],places['tall-trees']],
 pond:[[0,0],[23,48],places.pond],
 beach:[[0,0],[24,52],[24,132],places.beach],
 'tide-pools':[[0,0],[24,52],[24,144],[-60,175],places['tide-pools']],
 lookout:[[0,0],[75,-43],places.lookout],
 meadow:[[0,0],[29,43],places.meadow],
 cave:[[0,0],[-60,-31],places.cave],
};
// Remembered ground routes give Patch waypoints around the lake.
// Subdivide and bend each route gently, keeping the canonical endpoints unchanged.
function naturalRoute(route,seed){const out=[route[0]];for(let k=1;k<route.length;k++){const a=route[k-1],b=route[k],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),bend=(Math.sin(seed*13+k*8)*.5+.5)*7-3.5;for(let i=1;i<=5;i++){const t=i/5,offset=Math.sin(Math.PI*t)*bend;out.push([a[0]+dx*t-dz/len*offset,a[1]+dz*t+dx/len*offset]);}}return out;}
export const paths=Object.fromEntries(Object.entries(routeControls).map(([key,route],i)=>[key,naturalRoute(route,i+1)]));
export function coastRadius(a) {
 const angle=(x)=>Math.atan2(Math.sin(x),Math.cos(x));
 return 1+.075*Math.sin(3*a+.6)+.045*Math.sin(5*a-1.3)+.035*Math.cos(7*a+.4)+.025*Math.sin(11*a-.7)-.12*Math.exp(-((angle(a-.08)/.23)**2))-.08*Math.exp(-((angle(a+2.3)/.3)**2));
}
export function shoreFraction(x,z) { const a=Math.atan2(z/ISLAND.radiusZ,x/ISLAND.radiusX); return Math.hypot(x/ISLAND.radiusX,z/ISLAND.radiusZ)/coastRadius(a); }
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const pondOutline = () => 1;
export function pondFraction(x,z) {
 const dx=(x-ISLAND.pondX)/ISLAND.pondRX,dz=(z-ISLAND.pondZ)/ISLAND.pondRZ;
 return Math.hypot(dx,dz)/pondOutline(Math.atan2(dz,dx));
}

// Downstream control points: x, z, surface elevation, half-width.
const controls = VALLEY_RIVER.map(({x, z, width}) => [x,z,LAKE.surface,width]);
const [inlet, , , entry, lip, foot] = controls;

export const STREAM=[inlet];
let entryIndex, lipIndex, footIndex;
for(let i=1;i<controls.length;i++){
 const b=controls[i-1],c=controls[i];
 const steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/3);
 for(let j=1;j<=steps;j++){
  const t=j/steps;
  STREAM.push(j===steps?c:[mix(b[0],c[0],t),mix(b[1],c[1],t),mix(b[2],c[2],t),mix(b[3],c[3],t)]);
 }
 if(c===entry)entryIndex=STREAM.length-1;
 if(c===lip)lipIndex=STREAM.length-1;
 if(c===foot)footIndex=STREAM.length-1;
}
const segments=[];
let riverLength=0;
for(let i=1;i<STREAM.length;i++){
 const a=STREAM[i-1],b=STREAM[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 segments.push({a,b,dx,dz,length,start:riverLength});
 riverLength+=length;
}
export const RIVER={length:riverLength,entry:segments[entryIndex].start,lip:segments[lipIndex].start,foot:segments[footIndex]?.start ?? riverLength};
export function riverSpeed(station) {
 return 2.4+1.3*smooth(RIVER.entry,RIVER.lip-8,station)
  +3.6*smooth(RIVER.lip-4,RIVER.lip+1,station)
  -5*smooth(RIVER.foot,RIVER.length,station);
}
export function riverPoint(distance, across=0) {
 const s=Math.max(0,Math.min(RIVER.length,distance));
 const i=segments.findIndex(segment=>s<=segment.start+segment.length);
 const {a,b,dx,dz,length,start}=segments[i];
 const t=(s-start)/length,width=mix(a[3],b[3],t),offset=width*across;
 return {x:a[0]+dx*t-dz/length*offset,z:a[1]+dz*t+dx/length*offset,
  y:mix(a[2],b[2],t),width,heading:Math.atan2(dx,dz)};
}
export function streamInfo(x,z) {
 if(x>-90||z<90||z>550)return {distance:Infinity,width:0};
 let best=Infinity,index=0,fraction=0;
 for(let i=0;i<segments.length;i++){
  const {a,dx,dz,length}=segments[i],px=x-a[0],pz=z-a[1];
  const t=Math.max(0,Math.min(1,(px*dx+pz*dz)/(length*length)));
  const distance=(px-dx*t)**2+(pz-dz*t)**2;
  if(distance<best){best=distance;index=i;fraction=t;}
 }
 const {a,b,start,length}=segments[index];
 return {distance:Math.sqrt(best),level:mix(a[2],b[2],fraction),width:mix(a[3],b[3],fraction),station:start+length*fraction};
}
export const groundHeight = terrainHeight;
