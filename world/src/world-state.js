export const places = { hammock:[7,4], shelves:[10,1], pond:[-3,4], 'banana-grove':[-8,-3], 'tall-trees':[1,-8], beach:[0,12], lookout:[12,-3] };
export const trees = [[-12,-5,8],[-9,-9,9],[-4,-10,8],[1,-10,10],[6,-9,8],[11,-7,9],[13,-2,8],[-14,1,8],[-12,7,8],[-7,9,9],[1,10,8],[8,8,8],[13,5,8]];
export const anchorFor = ([x,z,h]) => { const d = Math.hypot(x,z) || 1; return [x - x/d * 1.3, h - .8, z - z/d * 1.3]; };
const distance = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const closest = point => trees.reduce((best, tree, i) => distance(point, tree) < distance(point, trees[best]) ? i : best, 0);

// Follow nearby trees from the starting place to the destination, rather than
// selecting the same branch for every journey.
export function swingRoute(from, to) {
  const start = closest(from), end = closest(to);
  const costs = trees.map(() => Infinity), previous = trees.map(() => -1), visited = new Set(); costs[start] = 0;
  while (visited.size < trees.length) {
    let current = -1;
    for (let i=0;i<trees.length;i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current=i;
    if (current === end || !Number.isFinite(costs[current])) break;
    visited.add(current);
    for (let i=0;i<trees.length;i++) {
      const step=distance(trees[current],trees[i]);
      if (i !== current && step <= 9 && costs[current]+step < costs[i]) { costs[i]=costs[current]+step; previous[i]=current; }
    }
  }
  const result=[];
  for (let i=end;i!==-1;i=previous[i]) { result.unshift(anchorFor(trees[i])); if (i===start) break; }
  return result;
}

const activity = {idle:'looking around',think:'thinking',phone:'checking his phone',write:'writing',look:'looking out over the water',wave:'waving',walk:'walking',run:'running',climb:'climbing',swing:'swinging through the trees',swim:'swimming',fish:'fishing',eat:'eating',sit:'sitting',sleep:'asleep'};
const location = {hammock:'in his hammock',shelves:'by his rope shelves',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout'};
const destination = {hammock:'his hammock',shelves:'his rope shelves',pond:'the pond','banana-grove':'the banana grove','tall-trees':'the tall trees',beach:'the beach',lookout:'the lookout'};
export function statusText(patch) {
  if (patch.target && destination[patch.target]) return `Patch is on his way to ${destination[patch.target]}.`;
  return `Patch is ${activity[patch.action] || 'looking around'} ${location[patch.place] || 'on the island'}.`;
}
export const isLocalPreview = hostname => hostname === 'localhost' || /^127(?:\.\d{1,3}){3}$/.test(hostname) || hostname === '[::1]' || hostname.endsWith('.localhost');
