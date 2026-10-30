// Session-only shared daily history; no localStorage, credentials or cross-user reuse.
import {cacheIsFresh,validateHistory} from "./stock-chart-utils.mjs";
const entries=new Map();
const key=(uid,symbol)=>uid+"|"+symbol+"|1y";
export function getCachedDaily(uid,symbol){
 const value=entries.get(key(uid,symbol));
 return cacheIsFresh(value,"1y")?value.data:null;
}
export function storeCachedDaily(uid,symbol,data,at=Date.now()){
 if(!uid||!symbol||data?.period!=="1y"||data?.symbol!==symbol||!validateHistory(data))return false;
 entries.set(key(uid,symbol),{data,fetchedAt:at});
 if(entries.size>30)entries.delete(entries.keys().next().value);
 return true;
}
export function clearDailyHistory(){entries.clear()}
