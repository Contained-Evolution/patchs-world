// A journey has one shared position, independent of when a visitor opens the page.
export function travelFraction(since,until,now) {
 const start=Date.parse(since),end=Date.parse(until);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
 return Math.max(0,Math.min(1,(now-start)/(end-start)));
}
export function loopFraction(since,now,totalLength){
 const start=Date.parse(since),elapsed=Number.isFinite(start)?Math.max(0,(now-start)/1000):0;
 return (elapsed*3/Math.max(totalLength,1))%1;
}
