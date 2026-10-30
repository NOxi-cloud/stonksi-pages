// Pure, deterministic historical summary; no requests, no AI and no trading actions.
// 0% changes are not counted as directional hits. Missing outcomes are excluded.
export const HORIZONS=Object.freeze([5,10,20]);
const validOutcome=(o,h)=>o&&typeof o.outcomes==="object"&&o.outcomes!==null&&Number.isFinite(o.outcomes[h]);
export function summarizeSignalHistory(observations){
 const items=Array.isArray(observations)?observations:[];
 return HORIZONS.map(days=>{
  const completed=items.filter(x=>validOutcome(x,days));
  const directional=completed.filter(x=>x.trend==="nouseva"||x.trend==="laskeva");
  const hits=directional.filter(x=>(x.trend==="nouseva"&&x.outcomes[days]>0)||(x.trend==="laskeva"&&x.outcomes[days]<0)).length;
  const average=completed.length?completed.reduce((sum,x)=>sum+x.outcomes[days],0)/completed.length:null;
  const avgRising=completed.filter(x=>x.trend==="nouseva");
  const avgFalling=completed.filter(x=>x.trend==="laskeva");
  const mean=a=>a.length?a.reduce((sum,x)=>sum+x.outcomes[days],0)/a.length:null;
  return {days,total:items.length,completed:completed.length,pending:items.length-completed.length,directional:directional.length,hits,
   hitRate:directional.length?100*hits/directional.length:null,
   average,upAverage:mean(avgRising),upCount:avgRising.length,downAverage:mean(avgFalling),downCount:avgFalling.length,
   sufficientSample:directional.length>=10};
 });
}
