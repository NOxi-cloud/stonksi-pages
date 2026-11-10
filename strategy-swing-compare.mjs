// Manual comparison helper: technical research only, no network, AI or trading.
import {swingRuleDistances} from "./strategy-swing.mjs";
const validSymbol=s=>typeof s==="string"&&/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(s);
export const MAX_SWING_COMPARE=5;
export function pickWatchlistSymbols(items,max=30){
 if(!Array.isArray(items))return [];
 const out=[],seen=new Set();
 for(const item of items){
  const symbol=String(item?.ticker||"").trim().toUpperCase();
  if(!validSymbol(symbol)||seen.has(symbol))continue;
  seen.add(symbol);
  out.push({symbol,name:String(item?.name||symbol).slice(0,100)});
  if(out.length>=max)break;
 }
 return out;
}
export function compareSwingCandidates(entries){
 if(!Array.isArray(entries))return [];
 const seen=new Set(),results=[];
 for(const entry of entries){
  const symbol=String(entry?.symbol||"").trim().toUpperCase();
  if(!validSymbol(symbol)||seen.has(symbol))continue;
  seen.add(symbol);
  const result=entry?.result,distances=swingRuleDistances(result);
  const comparable=Boolean(result&&distances&&(result.status==="no_action"||result.status==="watch_candidate"));
  const r=result?.rules||{};
  const missing=comparable?{
   sma200:r.aboveSma200?0:Math.max(0,distances.sma200.changePct),
   breakout20:r.breakout20?0:Math.max(0,distances.breakout20.changePct),
   volume:r.volumeAboveAverage?0:Math.max(0,distances.volume.increaseToAveragePct)
  }:null;
  const maxMissing=missing?Math.max(missing.sma200,missing.breakout20,missing.volume):Infinity;
  const sumMissing=missing?missing.sma200+missing.breakout20+missing.volume:Infinity;
  results.push({symbol,name:String(entry?.name||symbol).slice(0,100),result:result||null,
   error:typeof entry?.error==="string"?entry.error.slice(0,180):null,
   comparable,passed:comparable?Number(result.passed)||0:0,maxMissing,sumMissing,missing,
   marketAt:comparable?result.marketAt:null});
 }
 return results.sort((a,b)=>Number(b.comparable)-Number(a.comparable)||
  b.passed-a.passed||a.maxMissing-b.maxMissing||a.sumMissing-b.sumMissing||
  a.symbol.localeCompare(b.symbol));
}
