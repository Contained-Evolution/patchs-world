// Broad phase for transformed scenery, shared by visitors and companion planning.
export function boundsCollision(boxes,height,radius=.3) {
 const cells=new Map(),size=8;
 for(const box of boxes){const [min,max]=box;if([...min,...max].some(n=>!Number.isFinite(n)))continue;
  for(let x=Math.floor((min[0]-radius)/size);x<=Math.floor((max[0]+radius)/size);x++)for(let z=Math.floor((min[2]-radius)/size);z<=Math.floor((max[2]+radius)/size);z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(box);}
 }
 return (x,z,fromX,fromZ)=>{
  const y=height(x,z);
  return (cells.get(Math.floor(x/size)+','+Math.floor(z/size))||[]).some(([min,max])=>{
   if(max[1]<y+.15||min[1]>y+1.8)return false;
   const depth=(px,pz)=>radius+Math.min(px-min[0],max[0]-px,pz-min[2],max[2]-pz);
   return depth(x,z)>0&&(fromX===undefined||depth(x,z)>depth(fromX,fromZ)+1e-9);
  });
 };
}
