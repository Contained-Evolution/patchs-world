import {MAX_UPLOAD} from '../shared/editor/model.mjs';
import {glbBounds} from '../shared/editor/glb.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function editorAPI(request, env, path, patch, allowed, owner='patch', publicRead=true) {
  const suffix=path.slice('/api/editor'.length), method=request.method;
  if(suffix==='/published' && method==='GET') return publicRead||allowed ? json(await patch.editorPublished()) : json({error:'Sign in first.'},401);
  // Published upload URLs are immutable and only reachable when referenced by a published layout.
  const media=/^\/assets\/([a-f0-9-]{36})$/.exec(suffix);
  if(media&&method==='GET') {
    const published=await patch.editorPublished();
    if(!allowed&&!published.layout.objects.some(o=>o.asset==='upload:'+media[1])) return json({error:'Not found.'},404);
    if(!publicRead&&!allowed) return json({error:'Not found.'},404);
    const asset=await env.EDITOR_ASSETS?.get(owner+'/'+media[1]);
    return asset ? new Response(asset.body,{headers:{'content-type':'model/gltf-binary','cache-control':allowed?'private, no-store':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'}}) : json({error:'Asset unavailable.'},404);
  }
  if(!allowed) return json({error:'World owner access required.'},403);
  if(method!=='GET' && request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Invalid origin.'},403);
  try {
    if(suffix==='/draft'&&method==='GET') return json(await patch.editorDraft());
    if(suffix==='/uploads'&&method==='GET') return json(await patch.editorUploads());
    if(suffix==='/uploads'&&method==='POST') {
      if(!env.EDITOR_ASSETS) return json({error:'Asset storage is not configured.'},503);
      if(Number(request.headers.get('content-length'))>MAX_UPLOAD) return json({error:'GLB must be 25 MiB or smaller.'},413);
      const chunks=[];let size=0; const reader=request.body?.getReader();if(!reader) throw new Error('Choose a GLB.');
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_UPLOAD){await reader.cancel();return json({error:'GLB must be 25 MiB or smaller.'},413);}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      const bounds=glbBounds(bytes.buffer), id=crypto.randomUUID();
      const name=decodeURIComponent(request.headers.get('x-asset-name')||'Uploaded model').slice(0,100);
      const unitScale=Number(request.headers.get('x-asset-units')||1);if(![1,.01,.001].includes(unitScale))throw new Error('Invalid source units.');
      await env.EDITOR_ASSETS.put(owner+'/'+id,bytes,{httpMetadata:{contentType:'model/gltf-binary'}});
      const metadata={id,name,bounds,unitScale};
      try {await patch.editorAddUpload(metadata);}catch(error){await env.EDITOR_ASSETS.delete(owner+'/'+id);throw error;}
      return json(metadata,201);
    }
    if(!['PUT','POST'].includes(method)) return json({error:'Method not allowed.'},405);
    if(Number(request.headers.get('content-length'))>2000000) return json({error:'Layout is too large.'},413);
    const reader=request.body?.getReader();let text='',count=0;const decoder=new TextDecoder();
    if(!reader) throw new Error('Missing layout.');
    for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>2000000){await reader.cancel();return json({error:'Layout is too large.'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
    const data=JSON.parse(text);
    let result;
    if(suffix==='/draft'&&method==='PUT')result=await patch.editorSave(data);
    else if(suffix==='/publish'&&method==='POST')result=await patch.editorPublish(data);
    else if(suffix==='/rollback'&&method==='POST')result=await patch.editorRollback(data);
    else return json({error:'Not found.'},404);
    const {status=200,...body}=result;return json(body,status);
  } catch(error) {return json({error:error.message||'Could not save layout.'},400);}
}
