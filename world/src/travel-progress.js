export function travelFraction(since,until,now,totalLength) {
  const start=Date.parse(since),end=Date.parse(until);
  const elapsed=Number.isFinite(start)?Math.max(0,(now-start)/1000):0;
  if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)return Math.max(0,Math.min(1,(now-start)/(end-start)));
  return (elapsed*3/Math.max(totalLength,1))%1;
}
