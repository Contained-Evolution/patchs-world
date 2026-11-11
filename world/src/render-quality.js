// Preserve native detail on capable devices while keeping navigation responsive on slower GPUs.
export function qualityDecision(ratio,base,fps){
 if(fps<18)return Math.max(.5,Math.round(ratio*.75*100)/100);
 if(fps>42)return Math.min(base,Math.round(ratio*1.12*100)/100);
 return ratio;
}
export function adaptiveQuality(renderer,base){
 let ratio=base,start=null,frames=0;
 return function tick(now){if(document.hidden){start=null;frames=0;return;}if(start===null){start=now;return;}frames++;const elapsed=now-start;if(elapsed<6000)return;const next=qualityDecision(ratio,base,frames*1000/elapsed);if(next!==ratio){ratio=next;renderer.setPixelRatio(ratio);}start=now;frames=0;};
}
