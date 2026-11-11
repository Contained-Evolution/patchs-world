// Patch's associative memory. Memories link through the things they share (their tags).
// Seeing or thinking of something lights its tag; the light spreads to linked tags and to every
// memory that carries them, brighter for strong feelings and for memories used recently.

const HOUR = 3600000;
const MAX_TAGS = 10;

export function normalTags(list) {
  if (!Array.isArray(list)) return [];
  const tags = list.map(tag => typeof tag === 'string' ? tag.toLowerCase().replace(/^#/, '').replace(/[-_]+/g, ' ').replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30) : '').filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

export const strengthOf = value => Math.max(1, Math.min(5, Math.round(Number(value)) || 3));

// Tags are linked by how many memories they share. A new memory strengthens its links.
export function conceptGraph(memories) {
  const graph = new Map();
  for (const memory of memories) {
    const tags = normalTags(memory.tags);
    for (const tag of tags) {
      const node = graph.get(tag) || graph.set(tag, { count: 0, links: new Map() }).get(tag);
      node.count++;
      for (const other of tags) if (other !== tag) node.links.set(other, (node.links.get(other) || 0) + 1);
    }
  }
  return graph;
}

// Tags he already knows that appear in some text, such as a letter.
export function tagsIn(text, graph) {
  const words = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ')} `;
  return [...graph.keys()].filter(tag => words.includes(` ${tag} `) || words.includes(` ${tag}s `));
}

// Recently used memories glow more; the glow fades with time but never reaches zero.
function recency(memory, recalls, now) {
  const uses = [...(memory.at ? [memory.at] : []), ...(recalls[memory.id] || [])];
  return uses.reduce((sum, at) => sum + (1 + Math.max(0, now - at) / HOUR) ** -0.5, 0);
}

// What lights up for these cues. Returns the brightest memories and every lit tag.
export function lightUp(memories, cues, recalls = {}, now = Date.now(), limit = 8) {
  const graph = conceptGraph(memories), light = new Map();
  for (const cue of normalTags(cues)) {
    const tag = graph.has(cue) ? cue : cue.endsWith('s') && graph.has(cue.slice(0, -1)) ? cue.slice(0, -1) : null;
    if (tag) light.set(tag, 1);
  }
  for (const [cue] of [...light]) {
    const node = graph.get(cue);
    for (const [other, shared] of node.links) light.set(other, Math.min(1, (light.get(other) || 0) + 0.5 * shared / node.count));
  }
  const lit = [];
  for (const memory of memories) {
    const spread = normalTags(memory.tags).reduce((sum, tag) => sum + (light.get(tag) || 0), 0);
    if (!spread) continue;
    const feeling = 0.6 + strengthOf(memory.strength) * 0.1, glow = 1 + 0.5 * Math.min(2, recency(memory, recalls, now));
    lit.push({ memory, light: spread * feeling * glow });
  }
  lit.sort((a, b) => b.light - a.light);
  return { memories: lit.slice(0, limit), tags: [...light].sort((a, b) => b[1] - a[1]).map(([tag, value]) => ({ tag, light: Math.round(value * 100) / 100 })) };
}

// Remembering something makes it easier to remember next time.
export function recordRecall(recalls, ids, now) {
  for (const id of ids) recalls[id] = [...(recalls[id] || []), now].slice(-10);
  return recalls;
}

// The galaxy's view of his concepts: each tag, how many memories hold it, and its strongest links.
export function concepts(memories) {
  return [...conceptGraph(memories)].map(([tag, node]) => ({
    tag, count: node.count, links: [...node.links].sort((a, b) => b[1] - a[1]).slice(0, 8),
  })).sort((a, b) => b.count - a.count);
}
