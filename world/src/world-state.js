export const places = { hammock:[1,4], shelves:[4,1], pond:[-9,6], 'banana-grove':[-24,-10], 'tall-trees':[-8,-21], beach:[8,25], lookout:[28,-8], 'tide-pools':[29,15], meadow:[9,-15], cave:[22,-15] };
// Each path leads from camp to its destination. Shared sections are intentional junctions.
export const paths = {
  hammock:[[0,0],[1,4]], shelves:[[0,0],[4,1]], pond:[[0,0],[-5,3],[-9,6]],
  'banana-grove':[[0,0],[-7,-4],[-15,-8],[-24,-10]],
  'tall-trees':[[0,0],[-5,-6],[-8,-13],[-8,-21]],
  beach:[[0,0],[2,8],[5,17],[8,25]],
  'tide-pools':[[0,0],[8,5],[18,10],[29,15]],
  meadow:[[0,0],[5,-6],[9,-15]],
  cave:[[0,0],[5,-6],[12,-12],[22,-15]],
  lookout:[[0,0],[8,0],[18,-2],[24,-5],[28,-8]],
};
export const groundHeight = (x,z) => .9 + 5.2 * Math.exp(-(((x-28)/6.5)**2 + ((z+8)/7)**2));
export const trees = [];
for(let row=0;row<5;row++) for(let col=0;col<7;col++) {
  const x=-20+col*4.2+(row%2)*1.2, z=-30+row*4.3;
  trees.push([x,z,8.5+((row*7+col)%4)*.65]);
}
export const anchorFor = ([x,z,h]) => [x+1.4,groundHeight(x,z)+h-1,z];
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function walkRoute(from,to) {
  const a=paths[from]||paths.hammock,b=paths[to]||paths.hammock;
  return [...a.slice(0,-1).reverse(), ...b.slice(1)];
}
export function swingRoute(from,to) {
  const nearest = p => trees.reduce((best,t,i)=>distance(p,t)<distance(p,trees[best])?i:best,0);
  const start=nearest(from), end=nearest(to), costs=trees.map(()=>Infinity), prev=trees.map(()=>-1), seen=new Set(); costs[start]=0;
  while(seen.size<trees.length){let cur=-1; for(let i=0;i<trees.length;i++) if(!seen.has(i)&&(cur<0||costs[i]<costs[cur]))cur=i; if(cur===end||!Number.isFinite(costs[cur]))break;seen.add(cur);for(let i=0;i<trees.length;i++){let d=distance(trees[cur],trees[i]);if(i!==cur&&d<6.5&&costs[cur]+d<costs[i]){costs[i]=costs[cur]+d;prev[i]=cur;}}}
  const route=[];for(let i=end;i!==-1;i=prev[i]){route.unshift(anchorFor(trees[i]));if(i===start)break;} if(route.length===1){const i=start, neighbor=i%7<6?i+1:i-1;route.push(anchorFor(trees[neighbor]),anchorFor(trees[start]));}
  return route;
}
export function swingLoop() { return [15,16,23,22,15].map(i=>anchorFor(trees[i])); }
const activity={idle:'looking around',think:'thinking',phone:'checking his phone',write:'writing',look:'looking around',wave:'waving',walk:'walking',run:'running',climb:'climbing',swing:'swinging through the trees',swim:'swimming',fish:'fishing',eat:'eating',sit:'sitting',sleep:'asleep',explore:'exploring','watch-sky':'watching the sky'};
const location={hammock:'in his hammock',shelves:'by his rope shelves',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout','tide-pools':'at the tide pools',meadow:'in the meadow',cave:'in the cave'};
const destination={hammock:'his hammock',shelves:'his rope shelves',pond:'the pond','banana-grove':'the banana grove','tall-trees':'the tall trees',beach:'the beach',lookout:'the lookout','tide-pools':'the tide pools',meadow:'the meadow',cave:'the cave'};
export function statusText(p){if(p.target&&destination[p.target])return `Patch is on his way to ${destination[p.target]}.`;if(p.action==='explore'&&p.place==='cave')return 'Patch is exploring the cave.';return `Patch is ${activity[p.action]||'looking around'} ${location[p.place]||'on the island'}.`;}
export const isLocalPreview = h => h==='localhost'||/^127(?:\.\d{1,3}){3}$/.test(h)||h==='[::1]'||h.endsWith('.localhost');
