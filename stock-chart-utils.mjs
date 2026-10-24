// Pure helpers used by the private-source Stonksi stock detail PWA.
// Numbers are observed prices, not total returns, targets, or investment advice.
export const PERIODS = Object.freeze([["1h","1h"],["1d","1d"],["1w","1w"],["1y","1y"],["5y","5y"],["all","All time"]]);
export function validateHistory(raw) {
  if (!raw || !Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > 1000) return null;
  const points=[];
  for (const p of raw.points) {
    if (!p || typeof p.t !== "number" || !Number.isSafeInteger(p.t) || p.t < 946684800 ||
        typeof p.price !== "number" || !Number.isFinite(p.price) || p.price <= 0 || p.price > 1e9) return null;
    if (points.length && p.t <= points[points.length-1].t) return null;
    points.push({t:p.t,price:p.price});
  }
  return points;
}
export function priceStats(points){
  if (!Array.isArray(points) || points.length<2) return null;
  let low=points[0].price,high=low;
  for(const p of points){low=Math.min(low,p.price);high=Math.max(high,p.price)}
  const first=points[0],last=points[points.length-1];
  return {first,last,low,high,change:last.price-first.price,percent:(last.price/first.price-1)*100,count:points.length};
}
export function nearestIndex(points,ratio){
  if(!Array.isArray(points)||!points.length)return -1;
  const t=points[0].t+Math.min(1,Math.max(0,Number.isFinite(ratio)?ratio:0))*(points[points.length-1].t-points[0].t);
  let left=0,right=points.length-1;
  while(left<right){const middle=Math.floor((left+right)/2);if(points[middle].t<t)left=middle+1;else right=middle}
  if(left>0&&Math.abs(points[left-1].t-t)<Math.abs(points[left].t-t))left--;
  return left;
}
export function cacheLifetime(period){
  return ["1h","1d"].includes(period)?3*60_000:period==="1w"?10*60_000:60*60_000;
}
export function cacheIsFresh(entry,period,now=Date.now()){
  return Boolean(entry && Number.isFinite(entry.fetchedAt) && now>=entry.fetchedAt &&
    now-entry.fetchedAt<cacheLifetime(period) && validateHistory(entry.data));
}
export function quoteIsOld(utcSeconds,period,now=Date.now()){
  if(!Number.isFinite(utcSeconds))return true;
  // Heuristic only: markets close on weekends and holidays, so always give the exact timestamp too.
  const hours=(now-utcSeconds*1000)/3600000;
  return hours>(["1h","1d"].includes(period)?12:period==="1w"?120:period==="1y"?96:period==="5y"?14*24:45*24);
}
