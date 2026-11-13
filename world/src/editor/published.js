// Apply only complete published revisions. A failed load keeps the last visible revision.
export function watchPublished(api,apply) {
 let revision=-1,busy=false;
 async function refresh(){if(busy||document.hidden)return;busy=true;try{const response=await fetch(api+'/published',{cache:'no-store'});if(!response.ok)throw new Error('Published layout unavailable.');const data=await response.json();if(data.revision!==revision){await apply(data.layout);revision=data.revision;}}catch(error){console.warn('World layout:',error.message);}finally{busy=false;}}
 void refresh();let timer=setInterval(refresh,15000);addEventListener('pagehide',()=>{clearInterval(timer);timer=null;});addEventListener('pageshow',()=>{if(timer===null){timer=setInterval(refresh,15000);void refresh();}});return refresh;
}
