import { SWING_TREE, branchGrip, ropeAnchor } from './swing-tree.js';
import { ACTIONS } from '../../shared/state.js';
export { places, paths, groundHeight } from './terrain.js';
import { places, paths, groundHeight } from './terrain.js';
export const trees = [];
// Connected living trees supply the swing route; their trunks are rendered by the island.
for(let row=0;row<6;row++) for(let col=0;col<8;col++) {
 const x=85+col*4.4+(row%2)*.9+Math.sin(row*7+col*3)*.35, z=-119+row*4.5+Math.cos(row*4+col*8)*.35;
 trees.push([x,z,10+((row*8+col)%5)*.5]);
}
export const ROPE_TREES = new Set([1, 9, 8]);
export const ROPE_LENGTH = SWING_TREE.rope.length;
const loopIndices = [0, ...ROPE_TREES, 0];
const canopyHeight = Math.max(...trees.map(([x, z, h]) => groundHeight(x, z) + h + SWING_TREE.canopyExtension));

export function anchorFor([x, z, h]) {
 const variant = Math.abs(Math.round(x * 10 + z * 7)) % SWING_TREE.branchGrips.length;
 const [dx, y, dz] = branchGrip(groundHeight(x, z) + h, variant);
 return [x + dx, y, z + dz];
}

export function holdFor(index) {
 const branch = anchorFor(trees[index]);
 if (!ROPE_TREES.has(index)) return { index, type: 'branch', anchor: branch, grip: branch.slice() };
 const anchor = ropeAnchor(branch, canopyHeight);
 const [x, y, z] = anchor;
 return { index, type: 'rope', anchor, grip: [x, y - ROPE_LENGTH, z] };
}

export const traversalLoop = () => loopIndices.map(holdFor);
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
export function walkRoute(from,to) {
  const a=paths[from]||paths.hammock,b=paths[to]||paths.hammock;
  const route=[...a.slice(0,-1).reverse(), ...b.slice(1)];
  if (!route.length) route.push(places[to] || places.hammock);
  return route;
}
export function swingRoute(from,to) {
  const nearest = p => trees.reduce((best,t,i)=>distance(p,t)<distance(p,trees[best])?i:best,0);
  const start=nearest(from), end=nearest(to), costs=trees.map(()=>Infinity), prev=trees.map(()=>-1), seen=new Set(); costs[start]=0;
  while(seen.size<trees.length){let cur=-1; for(let i=0;i<trees.length;i++) if(!seen.has(i)&&(cur<0||costs[i]<costs[cur]))cur=i; if(cur===end||!Number.isFinite(costs[cur]))break;seen.add(cur);for(let i=0;i<trees.length;i++){let d=distance(trees[cur],trees[i]);if(i!==cur&&d<6.5&&costs[cur]+d<costs[i]){costs[i]=costs[cur]+d;prev[i]=cur;}}}
  const route=[];for(let i=end;i!==-1;i=prev[i]){route.unshift(anchorFor(trees[i]));if(i===start)break;} if(route.length===1){const i=start, neighbor=i%8<7?i+1:i-1;route.push(anchorFor(trees[neighbor]),anchorFor(trees[start]));}
  return route;
}
export function swingLoop() { return loopIndices.map(i=>anchorFor(trees[i])); }
const activity={idle:'looking around',think:'thinking',computer:'reading and answering letters',research:'looking things up on his tablet',write:'writing in his journal on his tablet',look:'looking around',wave:'waving',walk:'walking',run:'running',climb:'climbing',swing:'swinging through the trees',swim:'swimming',fish:'fishing',eat:'eating',sit:'sitting',sleep:'asleep',explore:'exploring','watch-sky':'watching the sky',archery:'practising with his bow',dance:'dancing'};
const location={hammock:'by his hammock',computer:'at his coconut computer',shelves:'by his rope shelves',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout','tide-pools':'at the tide pools',meadow:'in the meadow',cave:'in the cave'};
const destination={hammock:'his hammock',computer:'his coconut computer',shelves:'his rope shelves',pond:'the pond','banana-grove':'the banana grove','tall-trees':'the tall trees',beach:'the beach',lookout:'the lookout','tide-pools':'the tide pools',meadow:'the meadow',cave:'the cave'};
export function statusText(p){if(p.target&&destination[p.target])return `Patch is on his way to ${destination[p.target]}.`;if(p.place==='pond'&&p.action==='swing')return 'Patch is swinging into the swimming hole.';if(p.place==='hammock'&&p.action==='sleep')return 'Patch is asleep in his hammock.';if(p.action==='explore'&&p.place==='cave')return 'Patch is exploring the cave.';if(p.place==='computer'&&p.action==='research')return 'Patch is searching the web on his coconut computer.';if(p.place==='computer'&&p.action==='write')return 'Patch is writing in his journal on his coconut computer.';return `Patch is ${activity[p.action]||'looking around'} ${location[p.place]||'on the island'}.`;}
export const isLocalPreview = h => h==='localhost'||/^127(?:\.\d{1,3}){3}$/.test(h)||h==='[::1]'||h.endsWith('.localhost');

export function safePatch(patch) {
  if (!patch || !Object.hasOwn(places, patch.place) || !ACTIONS.includes(patch.action) || (patch.target && !Object.hasOwn(places,patch.target))) {
    return { ...(patch || {}), place:'hammock', action:'idle', target:null, says:null };
  }
  return patch;
}
