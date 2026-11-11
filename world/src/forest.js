import { places, shoreFraction, pondFraction, streamInfo } from './terrain.js';
import { trees } from './world-state.js';
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453123;return v-Math.floor(v);};
export const isReserved=(x,z)=>Object.entries(places).some(([id,[a,b]])=>Math.hypot(x-a,z-b)<({hammock:20,meadow:48,beach:32,lookout:20,cave:18}[id]||11))||pondFraction(x,z)<1.25||streamInfo(x,z).distance<7;
export function forestTrees(){
 const result=[];
 for(let i=0;i<11000;i++){
  let x=(rand(i+1)*2-1)*300,z=(rand(i+4000)*2-1)*335;
  if(shoreFraction(x,z)>.91||isReserved(x,z)||trees.some(([tx,tz])=>Math.hypot(x-tx,z-tz)<7))continue;
  let grove=Math.hypot((x+92)/65,(z-55)/52)<1,forest=Math.hypot((x-72)/100,(z+104)/95)<1;
  if(rand(i+7000)>(grove?.75:forest?.7:.12))continue;
  let h=(grove?5.7:forest?12:8)+rand(i+9000)*7;result.push({x,z,h,angle:rand(i+6000)*6,grove,broad:!grove&&(forest||rand(i+13000)<.5)});
 }
 for(const [x,z] of [[245,-8],[245,58],[244,75],[251,-27]])if(shoreFraction(x,z)<.96&&!isReserved(x,z))result.push({x,z,h:11+rand(x+z)*3,angle:rand(x-z)*6,grove:false,broad:false});
 for(const [x,z,h] of trees)result.push({x,z,h,angle:rand(x+z)*6,swing:true,broad:true});
 return result;
}
export const forest=forestTrees();
