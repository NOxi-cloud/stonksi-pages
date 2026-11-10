// Explicitly saved, per-user swing research snapshots. No API, AI or trading.
const KEY_PREFIX="stonksi-swing-progress-v1-";
const TICKER=/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/;
const MAX_TOTAL=300;
const MAX_PER_SYMBOL=40;
const HORIZON_KEYS=["sma200","breakout20","volume"];
const RULE_KEYS=["aboveSma200","breakout20","volumeAboveAverage"];
const nowISO=ms=>new Date(ms).toISOString();
const finiteNonNegative=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<100000;
const validSnapshot=x=>Boolean(x&&TICKER.test(x.symbol)&&Number.isFinite(Date.parse(x.marketAt))&&
 Number.isFinite(Date.parse(x.savedAt))&&Number.isInteger(x.passed)&&x.passed>=0&&x.passed<=3&&
 RULE_KEYS.every(k=>typeof x.rules?.[k]==="boolean")&&
 HORIZON_KEYS.every(k=>finiteNonNegative(x.missing?.[k])));
export function createSwingSnapshot(row,now=Date.now()){
 if(!row?.comparable||!row.result?.rules||!row.missing||!TICKER.test(row.symbol)||!Number.isFinite(now))return null;
 const market=Date.parse(row.marketAt);
 if(!Number.isFinite(market)||market>now+5*60000)return null;
 const x={symbol:row.symbol,name:String(row.name||row.symbol).slice(0,100),marketAt:nowISO(market),savedAt:nowISO(now),
  passed:row.passed,rules:Object.fromEntries(RULE_KEYS.map(k=>[k,row.result.rules[k]])),
  missing:Object.fromEntries(HORIZON_KEYS.map(k=>[k,row.missing[k]])),
  close:typeof row.result.close==="number"&&Number.isFinite(row.result.close)?row.result.close:null,
  currency:typeof row.result.currency==="string"?row.result.currency.slice(0,3):""};
 return validSnapshot(x)?x:null;
}
export function readSwingProgress(userId,storage=globalThis.localStorage){
 if(!userId||!storage)return [];
 try{
  const raw=JSON.parse(storage.getItem(KEY_PREFIX+userId)||"[]");
  if(!Array.isArray(raw))return [];
  return raw.filter(validSnapshot).sort((a,b)=>Date.parse(a.marketAt)-Date.parse(b.marketAt)).slice(-MAX_TOTAL);
 }catch{return []}
}
export function saveSwingProgress(userId,newItems,storage=globalThis.localStorage){
 if(!userId||!storage)return {saved:0,skipped:0,error:"Kirjautuminen tai tallennustila puuttuu."};
 const current=readSwingProgress(userId,storage),bySymbol=new Map();
 for(const x of current){
  const arr=bySymbol.get(x.symbol)||[];arr.push(x);bySymbol.set(x.symbol,arr);
 }
 let saved=0,skipped=0;
 for(const candidate of Array.isArray(newItems)?newItems:[]){
  if(!validSnapshot(candidate)){skipped++;continue}
  const arr=bySymbol.get(candidate.symbol)||[],latest=arr.at(-1);
  if(latest&&Date.parse(candidate.marketAt)<=Date.parse(latest.marketAt)){skipped++;continue}
  arr.push(candidate);
  bySymbol.set(candidate.symbol,arr.slice(-MAX_PER_SYMBOL));saved++;
 }
 const result=[...bySymbol.values()].flat().sort((a,b)=>Date.parse(a.marketAt)-Date.parse(b.marketAt)).slice(-MAX_TOTAL);
 try{storage.setItem(KEY_PREFIX+userId,JSON.stringify(result));return {saved,skipped,total:result.length}}
 catch{return {saved:0,skipped:newItems?.length||0,error:"Paikallinen tallennus epäonnistui; tarkista selaimen tallennustila."}}
}
export function compareSwingProgress(current,saved){
 if(!validSnapshot(current))return {state:"unavailable",label:"Ei vertailukelpoista havaintoa"};
 const previous=(Array.isArray(saved)?saved:[]).filter(x=>x.symbol===current.symbol&&validSnapshot(x))
  .sort((a,b)=>Date.parse(b.marketAt)-Date.parse(a.marketAt))[0];
 if(!previous)return {state:"first",label:"Ensimmäinen vertailu – tallenna lähtötilanne"};
 const a=Date.parse(current.marketAt),b=Date.parse(previous.marketAt);
 if(a===b)return {state:"same",label:"Sama markkinahavainto – ei uutta muutosta",previous};
 if(a<b)return {state:"older",label:"Tarkistus vanhempi kuin tallennettu havainto",previous};
 const diff=current.passed-previous.passed;
 let closer=0,further=0;
 for(const k of HORIZON_KEYS){
  const old=previous.missing[k],next=current.missing[k];
  if(next<old-0.01)closer++;
  if(next>old+0.01)further++;
 }
 let state="unchanged",label="Ehtojen tilanne ennallaan";
 if(diff>0){state="improved";label="Parantunut: "+diff+" ehtoa enemmän täyttyy"}
 else if(diff<0){state="weakened";label="Heikentynyt: "+Math.abs(diff)+" ehtoa vähemmän täyttyy"}
 else if(closer&&!further){state="closer";label="Lähestynyt swing-ehtoja"}
 else if(further&&!closer){state="further";label="Etääntynyt swing-ehdoista"}
 else if(closer&&further){state="mixed";label="Sekalainen muutos: osa ehdoista lähestyy, osa etääntyy"}
 return {state,label,previous,deltaPassed:diff,closer,further,
  gaps:Object.fromEntries(HORIZON_KEYS.map(k=>[k,current.missing[k]-previous.missing[k]]))};
}
