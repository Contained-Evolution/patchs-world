export const TERRAIN_RINGS=160, TERRAIN_SLICES=256;
export const ISLAND = { radiusX: 320, radiusZ: 360, ocean: 0, pondX: 105, pondZ: 66, pondY: 3.0, pondRX: 25, pondRZ: 17 };
export const places = { hammock:[0,0], shelves:[5,2], computer:[-7,-6], 'banana-grove':[-92,55], 'tall-trees':[72,-104], pond:[77,66], beach:[280,22], 'tide-pools':[220,-190], lookout:[-155,-205], meadow:[-176,48], cave:[-58,-244] };
const routeControls = {
 hammock:[[0,0]], shelves:[[0,0],[5,2]], computer:[[0,0],[-7,-6]],
 'banana-grove':[[0,0],[-28,12],[-60,35],[-92,55]],
 'tall-trees':[[0,0],[25,-30],[48,-65],[72,-104]],
 pond:[[0,0],[30,20],[58,45],[77,66]],
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
export function pondFraction(x,z) {return Math.hypot((x-ISLAND.pondX)/ISLAND.pondRX,(z-ISLAND.pondZ)/ISLAND.pondRZ);}
export const STREAM = [[128,68,3.02],[135,72,3.25],[145,78,3.7],[155,88,4.1],[165,98,4.6]];
export function streamInfo(x,z){let best={distance:Infinity,level:3,segment:0,t:0};for(let i=1;i<STREAM.length;i++){const a=STREAM[i-1],b=STREAM[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);if(d<best.distance)best={distance:d,level:a[2]+(b[2]-a[2])*t,segment:i,t};}return best;}
export const streamHalfWidth = (segment,t) => 2+.25*Math.sin(segment*4+t*5);
function baseGroundHeight(x,z) {
 const shore=shoreFraction(x,z);
 const base=4 + 1.8*Math.sin(x*.013)*Math.cos(z*.014)+.7*Math.sin((x+z)*.029);
 const lookout=32*gaussian(x,z,-155,-205,62,65);
 const ridges=7*gaussian(x,z,10,-195,170,70)+5*gaussian(x,z,-135,115,90,110)+20*gaussian(x,z,-220,150,85,85)+16*gaussian(x,z,185,-100,65,110)+12*gaussian(x,z,15,-275,85,75);
 const home=gaussian(x,z,0,0,22,20), pond=1-smooth(.7,1.35,pondFraction(x,z));
 const inland=(base+ridges+lookout)*(1-home)+4*home;
 let basin=inland*(1-pond)+(ISLAND.pondY-1.1)*pond;
 const stream=streamInfo(x,z),bank=1-smooth(8,15,stream.distance),channel=1-smooth(5,9,stream.distance);
 const raised=basin*(1-bank)+Math.max(basin,stream.level+.5)*bank,cut=raised*(1-channel)+(stream.level-.7)*channel,join=smooth(.92,1.08,pondFraction(x,z));
 basin=basin*(1-join)+cut*join;
 return basin*(1-smooth(.88,1.035,shore)) - 1.2*smooth(.88,1.035,shore);
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
