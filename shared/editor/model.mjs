// Shared caretaker editor format, version 1. Coordinates are metres, Y is up.
export const VERSION = 1;
export const MAX_UPLOAD = 25 * 1024 * 1024;
export const emptyLayout = () => ({ version: VERSION, objects: [], walkways: [] });
export function validateLayout(input) {
  if (input?.version !== VERSION || !Array.isArray(input.objects) || input.objects.length > 4000 || !Array.isArray(input.walkways) || input.walkways.length > 5000) throw new Error('Invalid or oversized layout.');
  const ids = new Set();
  const objects = input.objects.map(o => {
    if (!o || typeof o.id !== 'string' || !/^[a-zA-Z0-9:_-]{1,100}$/.test(o.id) || ids.has(o.id)) throw new Error('Invalid or duplicate object ID.');
    ids.add(o.id);
    if (o.deleted === true && o.id.startsWith('base:')) return { id: o.id, deleted: true };
    if (typeof o.asset !== 'string' || !/^(base:|catalog:|upload:|primitive:)[a-zA-Z0-9/_.:-]{1,180}$/.test(o.asset) || o.asset.includes('..')) throw new Error('Invalid asset reference.');
    const vector = (v, min, max) => {
      if (!Array.isArray(v) || v.length !== 3 || v.some(n => !Number.isFinite(n) || n < min || n > max)) throw new Error('Invalid transform.');
      return [...v];
    };
    return { id: o.id, asset: o.asset, name: String(o.name || 'Object').slice(0, 100), position: vector(o.position, -10000, 10000), rotation: vector(o.rotation, -Math.PI * 200, Math.PI * 200), scale: vector(o.scale, .01, 100) };
  });
  const walkways = input.walkways.map(w => {
    if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.z) || Math.abs(w.x)>10000 || Math.abs(w.z)>10000 || !['stone','wood','gravel'].includes(w.material)) throw new Error('Invalid walkway.');
    return { x:w.x, z:w.z, material:w.material };
  });
  return { version: VERSION, objects, walkways };
}
export function migrateScenery(layout, height, assets) {
  return { version: VERSION, objects: layout.scenery.map(o => ({ id:o.id, name:assets[o.type].name, asset:'catalog:'+assets[o.type].path, position:[o.x,height(o.x,o.z),o.z], rotation:[0,(o.x*.21+o.z*.35)%(Math.PI*2),0], scale:[1,1,1] })), walkways:layout.walkways || [] };
}
// A conservative transformed bounding box; shared by rendering collision and publish validation.
export function transformedBounds(bounds, item) {
  const [rx,ry,rz]=item.rotation, [sx,sy,sz]=item.scale;
  const a=Math.cos(rx), b=Math.sin(rx), c=Math.cos(ry), d=Math.sin(ry), e=Math.cos(rz), f=Math.sin(rz);
  const m=[c*e,-c*f,d,a*f+b*e*d,a*e-b*f*d,-b*c,b*f-a*e*d,b*e+a*f*d,a*c];
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<8;i++) { const p=[bounds[i&1?1:0][0]*sx,bounds[i&2?1:0][1]*sy,bounds[i&4?1:0][2]*sz]; for(let j=0;j<3;j++){const n=item.position[j]+m[j*3]*p[0]+m[j*3+1]*p[1]+m[j*3+2]*p[2];min[j]=Math.min(min[j],n);max[j]=Math.max(max[j],n);} }
  return [min,max];
}
