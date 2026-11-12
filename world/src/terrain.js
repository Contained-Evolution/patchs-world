export const TERRAIN_RINGS=160, TERRAIN_SLICES=256;
export const ISLAND = { radiusX: 320, radiusZ: 360, ocean: 0, pondX: 105, pondZ: 66, pondY: -5.8, pondRX: 39, pondRZ: 27 };
export const OCEAN_INNER_SHORE = .88;
export const places = { hammock:[0,0], shelves:[5,2], computer:[-7,-6], 'banana-grove':[-92,55], 'tall-trees':[72,-104], pond:[65,66], beach:[280,22], 'tide-pools':[220,-190], lookout:[-155,-205], meadow:[-176,48], cave:[-58,-244] };
const routeControls = {
 hammock:[[0,0]], shelves:[[0,0],[5,2]], computer:[[0,0],[-7,-6]],
 'banana-grove':[[0,0],[-28,12],[-60,35],[-92,55]],
 'tall-trees':[[0,0],[25,-30],[48,-65],[72,-104]],
 pond:[[0,0],[30,20],[55,45],places.pond],
 beach:[[0,0],[50,2],[110,4],[170,13],[230,18],[280,22]],
 'tide-pools':[[0,0],[45,-28],[90,-65],[140,-110],[184,-160],[220,-190]],
 lookout:[[0,0],[-30,-42],[-70,-90],[-115,-150],[-155,-205]],
 meadow:[[0,0],[-45,15],[-110,35],[-176,48]],
 cave:[[0,0],[-12,-55],[-28,-130],[-45,-195],[-58,-244]],
};
// Patch's remembered routes from camp. Nothing is drawn or cleared along them; the island has no trails.
// Subdivide and bend each route gently, keeping the canonical endpoints unchanged.
function naturalRoute(route,seed){const out=[route[0]];for(let k=1;k<route.length;k++){const a=route[k-1],b=route[k],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),bend=(Math.sin(seed*13+k*8)*.5+.5)*7-3.5;for(let i=1;i<=5;i++){const t=i/5,offset=Math.sin(Math.PI*t)*bend;out.push([a[0]+dx*t-dz/len*offset,a[1]+dz*t+dx/len*offset]);}}return out;}
export const paths=Object.fromEntries(Object.entries(routeControls).map(([key,route],i)=>[key,naturalRoute(route,i+1)]));
export function coastRadius(a) {
 const angle=(x)=>Math.atan2(Math.sin(x),Math.cos(x));
 return 1+.075*Math.sin(3*a+.6)+.045*Math.sin(5*a-1.3)+.035*Math.cos(7*a+.4)+.025*Math.sin(11*a-.7)-.12*Math.exp(-((angle(a-.08)/.23)**2))-.08*Math.exp(-((angle(a+2.3)/.3)**2));
}
export function shoreFraction(x,z) { const a=Math.atan2(z/ISLAND.radiusZ,x/ISLAND.radiusX); return Math.hypot(x/ISLAND.radiusX,z/ISLAND.radiusZ)/coastRadius(a); }
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const gaussian=(x,z,cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
const mix=(a,b,t)=>a+(b-a)*t;
export const pondOutline = angle => 1+.085*Math.sin(angle*3+.5)+.05*Math.cos(angle*5-1.4);
export function pondFraction(x,z) {
 const dx=(x-ISLAND.pondX)/ISLAND.pondRX,dz=(z-ISLAND.pondZ)/ISLAND.pondRZ;
 return Math.hypot(dx,dz)/pondOutline(Math.atan2(dz,dx));
}

// Downstream control points: x, z, surface elevation, half-width.
const inlet=[331,141,0,16], entry=[202,135,-.92,8], lip=[154,81,-1.75,7.3], foot=[149,78,ISLAND.pondY,8.3];
const controls=[inlet,[307,147,0,14],[280,154,0,12],[254,154,0,10],
 [234,166,-.45,10],[215,157,-.75,9],entry,[188,116,-1.2,8],
 [174,109,-1.4,8.5],[164,96,-1.62,7.4],lip,foot,[136,73,ISLAND.pondY,9],[125,70,ISLAND.pondY,9.5]];

// Curve the plan view while keeping the water profile downhill at every station.
function curve(a,b,c,d,t) {
 return b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*b-a-3*c+d)));
}
export const STREAM=[inlet];
let entryIndex, lipIndex, footIndex;
for(let i=1;i<controls.length;i++){
 const a=controls[i-2]??controls[i-1],b=controls[i-1],c=controls[i],d=controls[i+1]??c;
 const steps=Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/3);
 for(let j=1;j<=steps;j++){
  const t=j/steps;
  STREAM.push(j===steps?c:[curve(a[0],b[0],c[0],d[0],t),curve(a[1],b[1],c[1],d[1],t),mix(b[2],c[2],t),mix(b[3],c[3],t)]);
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
export const RIVER={length:riverLength,entry:segments[entryIndex].start,lip:segments[lipIndex].start,foot:segments[footIndex].start};
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
 if(x<110||z<44||z>204)return {distance:Infinity,width:0};
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
function baseGroundHeight(x,z) {
 const shore=shoreFraction(x,z);
 const base=4 + 1.8*Math.sin(x*.013)*Math.cos(z*.014)+.7*Math.sin((x+z)*.029);
 const lookout=32*gaussian(x,z,-155,-205,62,65);
 const ridges=7*gaussian(x,z,10,-195,170,70)+5*gaussian(x,z,-135,115,90,110)+20*gaussian(x,z,-220,150,85,85)+16*gaussian(x,z,185,-100,65,110)+12*gaussian(x,z,15,-275,85,75);
 const home=gaussian(x,z,0,0,22,20), pond=pondFraction(x,z);
 const inland=(base+ridges+lookout)*(1-home)+4*home;
 const coast=smooth(OCEAN_INNER_SHORE,1.035,shore);
 let basin=mix(inland,-1.2,coast);
 const poolBed=ISLAND.pondY+mix(-3.1,1.4,smooth(.35,1.08,pond));
 basin=mix(basin,poolBed,1-smooth(1.01,1.49,pond));
 const stream=streamInfo(x,z);
 if(stream.distance<stream.width+12){
  const across=stream.distance/stream.width;
  // Sink the bed below the visible surface, including through the rocky drop.
  const bed=stream.level+mix(-2.7,.9,smooth(.40,1.12,across));
  const insidePond=stream.station>=RIVER.foot ? smooth(.72,1.03,pond) : 1;
  basin=mix(basin,bed,(1-smooth(stream.width,stream.width+12,stream.distance))*insidePond);
 }
 return basin;
}
export const TIDE_POOLS=[[227,-190,6.8,5.0],[212,-204,5.8,4.3],[243,-177,6.0,4.2]];
export function tideWaterHeight(pool){return baseGroundHeight(pool[0],pool[1])-.24;}
export function terrainElevation(x,z){let h=baseGroundHeight(x,z);for(const pool of TIDE_POOLS){const d=Math.hypot((x-pool[0])/pool[2],(z-pool[1])/pool[3]),mask=1-smooth(.65,1.25,d);h-=2.5*mask;}return h;}
export function terrainVertex(ring,slice){const a=slice/TERRAIN_SLICES*Math.PI*2,q=ring/TERRAIN_RINGS,r=coastRadius(a)*q,x=Math.cos(a)*ISLAND.radiusX*r,z=Math.sin(a)*ISLAND.radiusZ*r;return [x,terrainElevation(x,z),z];}
const heightVertices = Array.from({length:TERRAIN_RINGS+1},()=>[]);
function heightVertex(ring,slice){
 return heightVertices[ring][slice] ??= terrainVertex(ring,slice);
}
function triangleHeight(x,z,a,b,c){const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-10)return null;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;return u>=-1e-7&&v>=-1e-7&&w>=-1e-7?u*a[1]+v*b[1]+w*c[1]:null;}
// This samples the exact triangles sent to WebGL, so feet, water and camera meet the visible surface.
export function groundHeight(x,z){
 const q=shoreFraction(x,z);if(q>=1||q<1e-8)return terrainElevation(x,z);
 let angle=Math.atan2(z/ISLAND.radiusZ,x/ISLAND.radiusX);if(angle<0)angle+=Math.PI*2;
 const i=Math.min(TERRAIN_SLICES-1,Math.floor(angle/(Math.PI*2)*TERRAIN_SLICES)),guess=Math.floor(q*TERRAIN_RINGS);
 for(const delta of [0,-1,1,-2,2]){const j=guess+delta;if(j<0||j>=TERRAIN_RINGS)continue;const a=heightVertex(j,i),b=heightVertex(j,i+1),c=heightVertex(j+1,i),d=heightVertex(j+1,i+1);let h=triangleHeight(x,z,a,b,c);if(h!==null)return h;h=triangleHeight(x,z,b,d,c);if(h!==null)return h;}
 return terrainElevation(x,z);
}
export const walkShoreLimit=.985;
