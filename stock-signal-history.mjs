import {summarizeSignalHistory} from "./stock-signal-metrics.mjs";
// User-initiated observations; kept on this device and scoped to signed-in user.
// No network traffic, AI calls, automated price checks or trade execution.
const MAX_RECORDS=250;
export function makeSignalObservation(item,result,now=Date.now(),raw=null){
 if(!item||!result||typeof item.ticker!=="string")return null;
 const ticker=item.ticker.trim().toUpperCase(),asOf=Date.parse(result.asOf);
 if(!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(ticker)||!Number.isFinite(asOf)||asOf>now+300000)return null;
 const start=Array.isArray(raw?.points)?raw.points.find(p=>Number(p.t)*1000===asOf):null;
 const close=Number(start?.price);
 return {close:Number.isFinite(close)&&close>0?close:null,outcomes:{},ticker,name:String(item.name||ticker).slice(0,100),recordedAt:new Date(now).toISOString(),asOf:result.asOf,
 rsi:Number.isFinite(result.rsi14)?result.rsi14:null,trend:result.sma50>result.sma200?"nouseva":result.sma50<result.sma200?"laskeva":"neutraali",
 macd:result.macd?.bullishCross?"nouseva risteämä":result.macd?.bearishCross?"laskeva risteämä":result.macd?.histogram>0?"positiivinen":result.macd?.histogram<0?"negatiivinen":"puuttuu"};
}
export function loadSignalHistory(uid){
 if(!uid)return [];
 try{const raw=JSON.parse(localStorage.getItem("stonksi-signal-history-v1-"+uid)||"[]");
  if(!Array.isArray(raw))return [];
  return raw.filter(x=>x&&typeof x.ticker==="string"&&typeof x.recordedAt==="string"&&typeof x.asOf==="string"&&["nouseva","laskeva","neutraali"].includes(x.trend)).slice(-MAX_RECORDS);
 }catch{return []}
}
export function saveSignalHistory(uid,observations){
 if(!uid)return false;
 try{
  const history=loadSignalHistory(uid);
  for(const x of observations){
   if(!x)continue;
   // Prevent duplicates for the same completed trading session.
   const previous=history.find(prev=>prev.ticker===x.ticker&&prev.asOf===x.asOf);
   if(previous){
    // Backfill the original close from the same session; preserve previously computed outcomes.
    if((!Number.isFinite(previous.close)||previous.close<=0)&&Number.isFinite(x.close)&&x.close>0)previous.close=x.close;
    continue;
   }
   history.push(x);
  }
  localStorage.setItem("stonksi-signal-history-v1-"+uid,JSON.stringify(history.slice(-MAX_RECORDS)));
  return true;
 }catch{return false}
}
export function updateSignalOutcomes(uid,ticker,raw){
 const series=Array.isArray(raw?.points)?raw.points.filter(p=>Number.isFinite(Number(p.t))&&Number.isFinite(Number(p.price))&&Number(p.price)>0).sort((a,b)=>a.t-b.t):[];
 if(series.length<21)return false;
 const history=loadSignalHistory(uid);let changed=false;
 for(const item of history){
  if(item.ticker!==ticker||!Number.isFinite(item.close)||item.close<=0)continue;
  const i=series.findIndex(p=>Number(p.t)*1000===Date.parse(item.asOf));
  if(i<0)continue;
  item.outcomes=item.outcomes||{};
  for(const days of [5,10,20]){
   if(item.outcomes[days]!==undefined||i+days>=series.length)continue;
   item.outcomes[days]=Math.round(10000*(Number(series[i+days].price)/item.close-1))/100;
   changed=true;
  }
 }
 if(changed){try{localStorage.setItem("stonksi-signal-history-v1-"+uid,JSON.stringify(history));return true}catch{return false}}
 return false;
}
export function renderSignalHistory(host,items){
 host.replaceChildren();
 const heading=document.createElement("h4");heading.textContent="Signaalien historia";host.append(heading);
 const note=document.createElement("p");note.className="muted";note.textContent="Tallennetaan tämän laitteen selaimeen vain käynnistämiesi laskentojen havainnot. 5/10/20 kaupankäyntipäivän kurssimuutokset täyttyvät seuraavan käyttäjän käynnistämän historiahaun yhteydessä. Ei sisällä osinkoja eikä kuluja.";host.append(note);
 if(!items.length){const p=document.createElement("p");p.className="muted";p.textContent="Ei havaintoja vielä.";host.append(p);return}
 const metrics=summarizeSignalHistory(items);
 const summary=document.createElement("div");summary.className="signal-summary-stats signal-performance-grid";
 const fmt=n=>n===null?"—":(n>0?"+":"")+n.toLocaleString("fi-FI",{maximumFractionDigits:2})+" %";
 for(const m of metrics){
  const card=document.createElement("section");card.className="signal-summary-stat signal-performance-card";
  const head=document.createElement("strong");head.textContent=m.days+" kaupankäyntipäivää";
  const sample=document.createElement("span");sample.textContent="Valmiita "+m.completed+"/"+m.total+" · odottaa "+m.pending;
  const hits=document.createElement("span");hits.textContent="Suuntaosumat "+m.hits+"/"+m.directional+" · "+(m.hitRate===null?"ei vielä laskettavissa":m.hitRate.toLocaleString("fi-FI",{maximumFractionDigits:1})+" %");
  const average=document.createElement("span");average.textContent="Keskimääräinen kurssimuutos "+fmt(m.average);
  const reliability=document.createElement("small");reliability.className="muted";
  reliability.textContent=m.sufficientSample?"Historiallinen otos, ei ennuste":"Pieni otos: alle 10 valmistunutta suuntahavaintoa";
  card.append(head,sample,hits,average,reliability);summary.append(card);
 }
 host.append(summary);
 const explanation=document.createElement("p");explanation.className="muted";
 explanation.textContent="Suuntaosuma: nousevan trendin jälkeen kurssi nousi tai laskevan trendin jälkeen laski. Neutraalit trendit ja keskeneräiset havainnot eivät vaikuta osumaprosenttiin. Keskiarvo sisältää kaikki valmiit havainnot. Ei osinkoja, veroja tai kuluja.";
 host.append(explanation);
 const list=document.createElement("div");list.className="signal-summary-ranking";
 const ordered=[...items].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt)).slice(0,30);
 for(const x of ordered){
  const row=document.createElement("article");row.className="signal-summary-entry";
  const title=document.createElement("strong");title.textContent=x.name+" · "+x.ticker;
  const status=document.createElement("span");status.textContent="Trendi "+x.trend+" · MACD "+x.macd;
  const stamp=document.createElement("small");stamp.className="muted";stamp.textContent="Havainto "+new Date(x.asOf).toLocaleDateString("fi-FI")+" · tallennettu "+new Date(x.recordedAt).toLocaleString("fi-FI");
  const outcome=document.createElement("small");outcome.className="muted";outcome.textContent=[5,10,20].map(n=>n+" pv: "+(Number.isFinite(x.outcomes?.[n])?(x.outcomes[n]>0?"+":"")+x.outcomes[n].toLocaleString("fi-FI")+" %":"odottaa")).join(" · ");
  row.append(title,status,stamp,outcome);list.append(row);
 }
 host.append(list);
}
