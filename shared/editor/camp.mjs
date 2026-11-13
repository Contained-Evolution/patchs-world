// Functional camp fixtures use metres and stay upright at their authored size.
export const TENT_ID='base:camp-tent';
export const COMPUTER_ID='base:coconut-computer';
export const isCampFixture=id=>id===TENT_ID||id===COMPUTER_ID;
export const TENT={halfLength:3.45,halfWidth:3.05,halfDoor:.72};
export function worldPoint(record,x,z){const c=Math.cos(record.rotation[1]),s=Math.sin(record.rotation[1]);return [record.position[0]+c*x+s*z,record.position[2]-s*x+c*z];}
export function localPoint(record,x,z){const dx=x-record.position[0],dz=z-record.position[2],c=Math.cos(record.rotation[1]),s=Math.sin(record.rotation[1]);return [c*dx-s*dz,s*dx+c*dz];}
export function fixtureHeight(id,x,z,yaw,height){
 if(id!==TENT_ID)return height(x,z);
 const record={position:[x,0,z],rotation:[0,yaw,0]};
 return Math.min(...[-1,1].flatMap(a=>[-1,1].map(b=>height(...worldPoint(record,a*TENT.halfLength,b*TENT.halfWidth)))));
}
export function campDefaults(places,height){
 const [x,z]=places.computer;
 const make=(id,name,px,pz,yaw,bounds,colliders)=>({id,asset:id,name,position:[px,fixtureHeight(id,px,pz,yaw,height),pz],rotation:[0,yaw,0],scale:[1,1,1],bounds,colliders});
 const {halfLength:l,halfWidth:w,halfDoor:d}=TENT,e=.12;
 const walls=[...[-1,1].map(side=>[[-l,0,side*w-e],[l,4.6,side*w+e]]),...[-1,1].flatMap(side=>[[[side*l-e,0,-w],[side*l+e,4.6,-d]],[[side*l-e,0,d],[side*l+e,4.6,w]]])];
 return [make(TENT_ID,'Computer tent',x,z+.8,0,[[-3.54,0,-3.35],[3.54,4.58,3.35]],walls),make(COMPUTER_ID,'Coconut computer and chair',x,z,Math.PI,[[-.48,0,-.35],[.48,.92,.93]],[[[-.48,0,.28],[.48,.92,.93]],[[-.22,0,-.29],[.22,.82,.07]]])];
}
export function campRecords(layout,defaults){return defaults.map(base=>layout.objects.find(o=>o.id===base.id)||base);}
export function validateFixture(record,height){
 if(record.deleted)throw new Error('Move this working fixture instead of deleting it.');
 if(record.asset!==record.id||record.scale.some(n=>Math.abs(n-1)>.00001)||Math.abs(record.rotation[0])>.00001||Math.abs(record.rotation[2])>.00001)throw new Error('Keep working fixtures upright at their original size.');
 const [x,y,z]=record.position,ground=fixtureHeight(record.id,x,z,record.rotation[1],height);
 if(Math.abs(y-ground)>.05)throw new Error('Working fixtures must rest on the ground.');
 const radius=record.id===TENT_ID?4.6:1;
 const samples=[height(x,z),height(x+radius,z),height(x-radius,z),height(x,z+radius),height(x,z-radius)];
 if(Math.max(...samples)-Math.min(...samples)>1.1)throw new Error('Choose flatter ground for the tent or computer.');
}
export function fixtureBlocks(record,colliders,height,radius=.3){
 return (x,z,fromX,fromZ)=>{
  const ground=height(x,z),[px,pz]=localPoint(record,x,z),from=fromX===undefined?null:localPoint(record,fromX,fromZ);
  return colliders.some(([min,max])=>{
   if(record.position[1]+max[1]<ground+.15||record.position[1]+min[1]>ground+1.8)return false;
   const depth=(a,b)=>radius+Math.min(a-min[0],max[0]-a,b-min[2],max[2]-b);
   return depth(px,pz)>0&&(!from||depth(px,pz)>depth(...from)+1e-9);
  });
 };
}
