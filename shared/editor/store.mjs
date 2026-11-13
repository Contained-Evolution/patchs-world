import { emptyLayout, validateLayout } from './model.mjs';
export class EditorStore {
  constructor(storage, seed = async()=>emptyLayout(), validate = async()=>{}) { Object.assign(this,{storage,seed,validate}); }
  async published() { return await this.storage.get('editor:published') || {revision:0,layout:await this.seed()}; }
  async draft() { return await this.storage.get('editor:draft') || {revision:0,baseRevision:(await this.published()).revision,layout:(await this.published()).layout}; }
  async save(data) {
    const layout=validateLayout(data.layout);
    return this.storage.transaction(async tx=>{
      const current=await tx.get('editor:draft');
      if(data.revision!==(current?.revision||0)) return {status:409,error:'Draft changed in another window. Export your edits and reload.'};
      const published=await tx.get('editor:published');
      const draft={revision:(current?.revision||0)+1,baseRevision:current?.baseRevision??published?.revision??0,layout};
      await tx.put('editor:draft',draft);return {status:200,...draft};
    });
  }
  async publish(data) {
    return this.storage.transaction(async tx=>{
      const draft=await tx.get('editor:draft'), old=await tx.get('editor:published') || {revision:0,layout:await this.seed()};
      if(!draft || data.revision!==draft.revision || draft.baseRevision!==old.revision) return {status:409,error:'Layout changed. Reload before publishing.'};
      await this.validate(draft.layout);
      const published={revision:old.revision+1,layout:draft.layout};
      await tx.put({'editor:previous':old,'editor:published':published,'editor:draft':{...draft,revision:draft.revision+1,baseRevision:published.revision}});
      return {status:200,...published};
    });
  }
  async rollback(data) {
    return this.storage.transaction(async tx=>{
      const previous=await tx.get('editor:previous'), current=await tx.get('editor:published');
      if(!previous) return {status:404,error:'No previous published layout.'};
      if(data.revision!==current?.revision) return {status:409,error:'Published layout changed. Reload first.'};
      const draft=await tx.get('editor:draft');
      const published={revision:current.revision+1,layout:previous.layout};
      await tx.put({'editor:previous':current,'editor:published':published,'editor:draft':{revision:(draft?.revision||0)+1,baseRevision:published.revision,layout:previous.layout}});
      return {status:200,...published};
    });
  }
}
