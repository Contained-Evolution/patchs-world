// Stable positions keep a refreshed thought from rearranging Patch's memories.
export function hash(value) {
  let n = 2166136261;
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}
export const feelingColors = { happy: '#ffd56a', proud: '#ffc17d', loved: '#ff9dbc', excited: '#ffad70', curious: '#8ce5da', calm: '#a2d9f5', peaceful: '#a2d9f5', sad: '#929fea', lonely: '#ac9bdb', scared: '#c2a0ef', worried: '#c2a0ef', grateful: '#ffb9cf' };
export function feelingColor(feeling) { return feelingColors[feeling] || `hsl(${Math.floor(hash(feeling) * 360)}, 65%, 75%)`; }
export function layoutMemories(memories, categories = {}) {
  const keys = [...new Set([...Object.keys(categories), ...memories.map(m => m.category)])].filter(k => k !== 'core').sort();
  const radius = Math.max(65, keys.length * 11);
  const galaxies = ['core', ...keys].map((key, i) => {
    const angle = (i - 1) / Math.max(1, keys.length) * Math.PI * 2;
    return { key, title: categories[key]?.title || key, position: key === 'core' ? [0, 0, 0] : [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] };
  });
  const clusters = [];
  for (const galaxy of galaxies) {
    const subs = [...new Set([...(categories[galaxy.key]?.subcategories || []), ...memories.filter(m => m.category === galaxy.key).map(m => m.subcategory || 'memories')])].sort();
    subs.forEach((sub, i) => {
      const a = i / subs.length * Math.PI * 2;
      const r = galaxy.key === 'core' ? 12 : 15;
      clusters.push({ category: galaxy.key, subcategory: sub, position: [galaxy.position[0] + Math.cos(a) * r, 0, galaxy.position[2] + Math.sin(a) * r] });
    });
  }
  const stars = memories.map(memory => {
    const cluster = clusters.find(c => c.category === memory.category && c.subcategory === (memory.subcategory || 'memories'));
    const angle = hash(memory.id) * Math.PI * 2, radius = 3 + hash(`${memory.id}:radius`) * 7;
    return { memory, center: cluster.position, angle, radius, height: (hash(`${memory.id}:height`) - .5) * 7, size: .45 + Math.min(5, Math.max(1, Number(memory.strength) || 1)) * .18 };
  });
  return { galaxies, clusters, stars, radius };
}
export function sharedTagLinks(memories) {
  const links = [];
  for (let i = 0; i < memories.length; i++) for (let j = i + 1; j < memories.length; j++) {
    const tags = [...new Set(memories[i].tags || [])].filter(t => (memories[j].tags || []).includes(t));
    if (tags.length) links.push({ from: i, to: j, count: tags.length, tags });
  }
  return links;
}
export function memoryLights(lit) {
  const values = lit?.memories || [], peak = Math.max(1, ...values.map(v => Number(v.light) || 0));
  return new Map(values.map(v => [v.id, Math.max(0, (Number(v.light) || 0) / peak)]));
}
