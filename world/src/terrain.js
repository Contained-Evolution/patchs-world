export const places = { hammock:[0,0], shelves:[2,0], 'banana-grove':[-12,8], 'tall-trees':[8,-14], pond:[14,10], beach:[26,-2], 'tide-pools':[22,-20], lookout:[-16,-22], meadow:[-20,2], cave:[-6,-30] };
// Footpaths meet at the camp, following the body's relative island layout.
export const paths = {
  hammock:[[0,0]], shelves:[[0,0],[2,0]],
  'banana-grove':[[0,0],[-5,3],[-12,8]], 'tall-trees':[[0,0],[4,-6],[8,-14]],
  pond:[[0,0],[6,5],[14,10]], beach:[[0,0],[9,0],[18,-1],[26,-2]],
  'tide-pools':[[0,0],[7,-5],[14,-12],[22,-20]],
  lookout:[[0,0],[-4,-6],[-10,-14],[-16,-22]],
  meadow:[[0,0],[-9,1],[-20,2]], cave:[[0,0],[-3,-9],[-5,-20],[-6,-30]],
};
// Smooth, deterministic coastline in elliptical polar coordinates.
export function coastRadius(angle) {
  return 1 + .065*Math.sin(3*angle+.6) + .035*Math.sin(5*angle-1.3) + .025*Math.cos(7*angle+.4);
}
export function shoreFraction(x,z) {
  const angle=Math.atan2(z/36,x/45);
  return Math.hypot(x/45,z/36)/coastRadius(angle);
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function segmentDistance(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
}
const segments=Object.values(paths).flatMap(route=>route.slice(1).map((point,i)=>[route[i],point]));
const clearings=[...Object.values(places),[18,10],[21,3]];
export function groundHeight(x,z) {
  const hill=5.2*Math.exp(-(((x+16)/6.5)**2+((z+22)/7)**2));
  let anchorDistance=Infinity,trailDistance=Infinity;
  for(const [px,pz] of clearings) anchorDistance=Math.min(anchorDistance,Math.hypot(x-px,z-pz));
  for(const [a,b] of segments) trailDistance=Math.min(trailDistance,segmentDistance(x,z,a,b));
  const detailMask=smooth(2.8,7,anchorDistance)*smooth(1.5,5,trailDistance);
  const rolling=(.42*Math.sin(x*.16+z*.07)*Math.cos(z*.13-x*.035)+.22*Math.sin(x*.085-z*.17))*detailMask;
  const inland=.9+hill+rolling;
  return inland*(1-smooth(.88,1,shoreFraction(x,z))) + .04*smooth(.88,1,shoreFraction(x,z));
}
export const walkShoreLimit=.965;
