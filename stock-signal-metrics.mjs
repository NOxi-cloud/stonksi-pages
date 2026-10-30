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

const describeGroup=(label,entries,horizon)=>{
 const values=entries.filter(item=>validOutcome(item,horizon)).map(item=>item.outcomes[horizon]);
 return {label,count:values.length,mean:values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null,
  rose:values.filter(v=>v>0).length,unchanged:values.filter(v=>v===0).length,
  uniqueTickers:new Set(entries.filter(item=>validOutcome(item,horizon)).map(item=>item.ticker)).size,
  smallSample:values.length<10};
};
// Group returns by the stock's own technical conditions at observation time.
// These are not separate profitable strategies and do not establish a general market regime.
export function summarizeSignalSegments(observations,horizon=20){
 if(!HORIZONS.includes(horizon))return [];
 const items=Array.isArray(observations)?observations:[];
 const segment=(title,cases)=>({title,groups:cases.map(([label,accept])=>describeGroup(label,items.filter(accept),horizon))});
 return [
  segment("Pitkän aikavälin trendi",[
   ["Nouseva",x=>x?.trend==="nouseva"],
   ["Laskeva",x=>x?.trend==="laskeva"],
   ["Neutraali",x=>x?.trend==="neutraali"]
  ]),
  segment("MACD-tilanne",[
   ["Positiivinen",x=>x?.macd==="positiivinen"||x?.macd==="nouseva risteämä"],
   ["Negatiivinen",x=>x?.macd==="negatiivinen"||x?.macd==="laskeva risteämä"],
   ["Tieto puuttuu",x=>!["positiivinen","negatiivinen","nouseva risteämä","laskeva risteämä"].includes(x?.macd)]
  ]),
  segment("RSI(14)",[
   ["Alle 30",x=>typeof x?.rsi==="number"&&Number.isFinite(x.rsi)&&x.rsi<30],
   ["30–70",x=>typeof x?.rsi==="number"&&Number.isFinite(x.rsi)&&x.rsi>=30&&x.rsi<=70],
   ["Yli 70",x=>typeof x?.rsi==="number"&&Number.isFinite(x.rsi)&&x.rsi>70],
   ["Tieto puuttuu",x=>typeof x?.rsi!=="number"||!Number.isFinite(x.rsi)]
  ])
 ];
}
