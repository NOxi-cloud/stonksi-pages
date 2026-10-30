import {getCachedDaily,storeCachedDaily,clearDailyHistory} from "./stock-history-cache.mjs";
import {calculateTechnicalSignals,SIGNAL_DESCRIPTIONS} from "./stock-signals.mjs";
import {PERIODS,validateHistory,priceStats,nearestIndex,cacheIsFresh,quoteIsOld} from "./stock-chart-utils.mjs";
// On-demand chart only. No automatic polling, no fabricated series, no third-party scripts.
const host=document.getElementById("stock-chart-detail");
const api="https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/stock-quotes";
const publicKey="sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE";
const periods=PERIODS;
let opened=null,chosen="1d",generation=0;
const cache=new Map();
const now=()=>Date.now();
let activeController=null;
const cancel=()=>{if(activeController){activeController.abort();activeController=null}};
const fmt=n=>new Intl.NumberFormat("fi-FI",{maximumFractionDigits:4}).format(n);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function render(){
 host.replaceChildren();
 if(!opened){host.hidden=true;return}
 const item=(window.agentStockBridge?.get()||[]).find(x=>x.id===opened);
 if(!item){opened=null;host.hidden=true;return}
 host.hidden=false;
 const header=el("div","stock-chart-heading");
 header.append(el("h3","",item.name+" · "+item.ticker));
 const close=el("button","secondary-btn","Sulje");close.type="button";close.addEventListener("click",()=>{opened=null;generation++;cancel();render()});
 header.append(close);host.append(header);
 const tabs=el("div","stock-chart-tabs");tabs.setAttribute("role","group");tabs.setAttribute("aria-label","Kurssihistorian aikaväli");
 for(const [key,title]of periods){
  const btn=el("button","stock-period"+(key===chosen?" active":""),title);
  btn.type="button";btn.setAttribute("aria-pressed",String(key===chosen));
  btn.addEventListener("click",()=>{if(chosen===key)return;chosen=key;generation++;cancel();render();load()});
  tabs.append(btn);
 }
 host.append(tabs);
 const signals=el("section","stock-signals");
 const title=el("h4","","Tekniset signaalit");signals.append(title);
 const btn=el("button","secondary-btn","Laske signaalit");btn.type="button";
 const output=el("div","stock-signals-results");signals.append(btn,output);
 btn.addEventListener("click",()=>loadSignals(item.ticker,output,btn));
 host.append(signals);
 const status=el("p","muted");status.id="stock-chart-status";status.setAttribute("role","status");host.append(status);
 const chart=el("div","stock-chart-body");host.append(chart);
 const current=cache.get(item.ticker+"|"+chosen);
 if(current&&cacheIsFresh(current,chosen)){draw(chart,status,current.data);return}
 status.textContent="Haetaan kurssihistoriaa…";
}
function draw(chart,status,data){
 const points=validateHistory(data);
 if(!points||points.length<2){status.textContent="Aikavälille ei ole riittävästi kurssihavaintoja.";return}
 const metrics=priceStats(points),{first,last,low:periodLow,high:periodHigh,percent:change}=metrics;
 const unit=data.currency||"";
 status.textContent=fmt(first.price)+" → "+fmt(last.price)+" "+unit+" · "+(change>=0?"+":"")+fmt(change)+" %";
 const ns="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox","0 0 720 290");
 svg.setAttribute("role","img");svg.setAttribute("aria-label","Kurssihistoria "+data.period+": "+points.length+" havaintoa. Ensimmäinen "+fmt(first.price)+", viimeisin "+fmt(last.price)+" "+unit);
 const min=periodLow,max=periodHigh,spread=Math.max(max-min,max*0.002,0.0001);
 const low=min-spread*.1,high=max+spread*.1;
 const times=points.map(p=>p.t),start=Math.min(...times),end=Math.max(...times);
 const x=t=>48+624*(t-start)/Math.max(end-start,1);
 const y=p=>252-211*(p-low)/(high-low);
 const grid=(yValue,label)=>{
  const yy=y(yValue),line=document.createElementNS(ns,"line");line.setAttribute("x1","48");line.setAttribute("x2","672");line.setAttribute("y1",String(yy));line.setAttribute("y2",String(yy));line.setAttribute("stroke","currentColor");line.setAttribute("stroke-opacity",".15");svg.append(line);
  const t=document.createElementNS(ns,"text");t.setAttribute("x","43");t.setAttribute("y",String(yy-5));t.setAttribute("text-anchor","end");t.setAttribute("fill","currentColor");t.setAttribute("font-size","11");t.textContent=label;svg.append(t);
 };
 grid(low,fmt(low));grid((low+high)/2,fmt((low+high)/2));grid(high,fmt(high));
 // Date/time labels are derived from the actual first/last observation timestamps.
 // Short ranges display times; longer ranges show calendar dates in the local timezone.
 const axisFormat=(timestamp)=>{
  const date=new Date(timestamp*1000);
  const opt=["1h","1d"].includes(data.period)?{hour:"2-digit",minute:"2-digit"}:
   data.period==="1w"?{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"}:
   data.period==="1y"?{day:"numeric",month:"numeric"}:{month:"numeric",year:"2-digit"};
  return new Intl.DateTimeFormat("fi-FI",opt).format(date);
 };
 const ticks=4;
 for(let i=0;i<=ticks;i++){
  const timestamp=start+(end-start)*i/ticks,xx=x(timestamp);
  const vertical=document.createElementNS(ns,"line");
  vertical.setAttribute("x1",String(xx));vertical.setAttribute("x2",String(xx));
  vertical.setAttribute("y1","252");vertical.setAttribute("y2","258");
  vertical.setAttribute("stroke","currentColor");vertical.setAttribute("stroke-opacity",".65");svg.append(vertical);
  const label=document.createElementNS(ns,"text");
  label.setAttribute("x",String(xx));label.setAttribute("y","276");
  label.setAttribute("text-anchor",i===0?"start":i===ticks?"end":"middle");
  label.setAttribute("font-size",data.period==="1w"?"10":"12");
  label.setAttribute("fill","currentColor");label.textContent=axisFormat(timestamp);
  svg.append(label);
 }
 const line=document.createElementNS(ns,"polyline");
 line.setAttribute("fill","none");line.setAttribute("stroke",change>=0?"#48c995":"#f08383");line.setAttribute("stroke-width","2.7");line.setAttribute("stroke-linejoin","round");
 line.setAttribute("points",points.map(p=>x(p.t).toFixed(2)+","+y(p.price).toFixed(2)).join(" "));
 svg.append(line);chart.append(svg);
 const inspect=el("p","stock-chart-inspect muted","Pidä sormea graafilla ja vedä nähdäksesi hinnat.");
 chart.append(inspect);
 const guide=document.createElementNS(ns,"line");
 guide.setAttribute("stroke","#c4b5fd");guide.setAttribute("stroke-width","1.4");guide.setAttribute("stroke-dasharray","4 4");guide.setAttribute("y1","36");guide.setAttribute("y2","255");guide.style.display="none";svg.append(guide);
 // Capture the active touch/pointer so mobile scroll gestures do not interrupt scrubbing.
 // Update only once per frame, even if Android produces many pointermove events.
 svg.classList.add("stock-chart-touch-surface");
 const hit=document.createElementNS(ns,"rect");
 hit.setAttribute("x","0");hit.setAttribute("y","0");hit.setAttribute("width","720");hit.setAttribute("height","290");
 hit.setAttribute("fill","transparent");hit.setAttribute("pointer-events","all");svg.append(hit);
 let trackedPointer=null,pendingClientX=null,frame=0;
 const showAt=(clientX)=>{
  const rect=svg.getBoundingClientRect();if(!rect.width)return;
  const ratio=Math.max(0,Math.min(1,((clientX-rect.left)/rect.width*720-48)/624));
  const index=nearestIndex(points,ratio);if(index<0)return;
  const point=points[index],label=new Date(point.t*1000).toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"});
  guide.setAttribute("x1",String(x(point.t)));guide.setAttribute("x2",String(x(point.t)));guide.style.display="";
  inspect.textContent=label+" · "+fmt(point.price)+" "+unit;
 };
 const schedule=(clientX)=>{
  pendingClientX=clientX;
  if(frame)return;
  frame=requestAnimationFrame(()=>{frame=0;if(pendingClientX!==null)showAt(pendingClientX)});
 };
 const startScrub=(event)=>{
  if(!event.isPrimary||event.button>0)return;
  trackedPointer=event.pointerId;
  try{svg.setPointerCapture(event.pointerId)}catch{}
  schedule(event.clientX);
  if(event.cancelable)event.preventDefault();
 };
 svg.addEventListener("pointerdown",startScrub);
 svg.addEventListener("pointermove",event=>{
  if(trackedPointer!==null&&event.pointerId!==trackedPointer)return;
  if(event.pointerType==="touch"&&trackedPointer===null)return;
  schedule(event.clientX);
  if(trackedPointer!==null&&event.cancelable)event.preventDefault();
 });
 const stopScrub=event=>{
  if(event.pointerId!==trackedPointer)return;
  trackedPointer=null;
  try{if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId)}catch{}
  // Keep the last selected observation visible after releasing the finger.
 };
 svg.addEventListener("pointerup",stopScrub);
 svg.addEventListener("pointercancel",stopScrub);
 svg.addEventListener("lostpointercapture",()=>{trackedPointer=null});
 svg.addEventListener("pointerleave",event=>{
  if(trackedPointer!==null||event.pointerType==="touch")return;
  guide.style.display="none";
  inspect.textContent="Pidä sormea graafilla ja vedä nähdäksesi hinnat.";
 });
 const metricsBox=el("div","stock-chart-metrics");
 for(const [label,value] of [["Jakson alin",fmt(periodLow)+" "+unit],["Jakson ylin",fmt(periodHigh)+" "+unit],["Muutos",(metrics.change>=0?"+":"")+fmt(metrics.change)+" "+unit],["Havaintoja",String(points.length)]]){
  const cell=el("div","stock-metric");cell.append(el("span","muted",label),el("strong","",value));metricsBox.append(cell)
 }
 chart.append(metricsBox);
 if(quoteIsOld(last.t,data.period))chart.append(el("p","muted stock-chart-stale","Huomio: viimeisin havainto voi olla vanhentunut. Tarkista alla oleva tarkka aikaleima."));
 const foot=el("p","muted stock-chart-foot");
 const when=t=>new Date(t*1000).toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"});
 foot.textContent="Havainnot "+when(first.t)+" – "+when(last.t)+" · "+points.length+" pistettä · Yahoo Finance (epävirallinen, mahdollisesti viivästetty). "+(data.period==="1h"?"1h = viimeisimmän saatavilla olevan kaupankäyntijakson tunti. ":"")+"Hinnat ovat oikaisemattomia.";
 chart.append(foot);
}
async function load(){
 if(!opened)return;
 const item=(window.agentStockBridge?.get()||[]).find(x=>x.id===opened);
 if(!item)return;
 const myGen=++generation,symbol=item.ticker,period=chosen;
 const cached=cache.get(symbol+"|"+period);
 if(cacheIsFresh(cached,period)){render();return}
 const status=host.querySelector("#stock-chart-status");
 if(status)status.textContent="Haetaan "+period+" kurssihistoriaa…";
 try{
  if(!navigator.onLine)throw Error("Verkkoyhteys puuttuu.");
  const db=window.agentSupabaseClient;const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error("Kirjaudu ensin sisään.");
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);activeController=ctrl;
  let response;
  try{response=await fetch(api,{method:"POST",signal:ctrl.signal,headers:{"Authorization":"Bearer "+session.access_token,"apikey":publicKey,"Content-Type":"application/json"},body:JSON.stringify({action:"history",symbol,period})})}
  finally{clearTimeout(timer);if(activeController===ctrl)activeController=null}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||"Historian hakeminen epäonnistui.");
  if(myGen!==generation||opened!==item.id||chosen!==period)return;
  if(!validateHistory(payload))throw Error("Kurssihavaintojen tarkistus epäonnistui.");
  cache.set(symbol+"|"+period,{data:payload,fetchedAt:now()});if(period==="1y")storeCachedDaily(session.user.id,symbol,payload);render();
 }catch(e){
  if(myGen!==generation)return;
  const target=host.querySelector("#stock-chart-status");
  if(target)target.textContent="Kurssihistoriaa ei voitu hakea: "+(e?.name==="AbortError"?"Aikakatkaisu":e.message);
 }
}

let signalController=null,signalGeneration=0;
async function loadSignals(symbol,output,button){
 const current=++signalGeneration;
 if(signalController)signalController.abort();
 const ctrl=new AbortController();signalController=ctrl;
 output.replaceChildren();button.disabled=true;
 output.append(el("p","muted","Haetaan yhden vuoden päivähavaintoja…"));
 try{
  const db=window.agentSupabaseClient,{data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error("Kirjaudu ensin sisään.");
  const uid=session.user.id;
  const shared=getCachedDaily(uid,symbol);
  let info=shared?{data:shared,fetchedAt:now()}:cache.get(symbol+"|1y");
  if(!cacheIsFresh(info,"1y")){
   const timeout=setTimeout(()=>ctrl.abort(),14000);
   let res;try{res=await fetch(api,{method:"POST",signal:ctrl.signal,headers:{"Authorization":"Bearer "+session.access_token,"apikey":publicKey,"Content-Type":"application/json"},body:JSON.stringify({action:"history",symbol,period:"1y"})})}finally{clearTimeout(timeout)}
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||"Kurssihistorian haku epäonnistui.");
   info={data,fetchedAt:now()};cache.set(symbol+"|1y",info);storeCachedDaily(uid,symbol,data);
  }
  if(current!==signalGeneration||ctrl.signal.aborted)return;
  const result=calculateTechnicalSignals(info.data);
  output.replaceChildren();
  if(!result){output.append(el("p","muted","Riittävän tuoreita päivähavaintoja ei ole saatavilla (RSI14, SMA50/SMA200). Signaalia ei arvioida."));return}
  output.append(el("p","muted","Havainto "+new Date(result.asOf).toLocaleDateString("fi-FI")+" · "+result.observationCount+" päivähintaa · epävirallinen lähde."));
  const signals=[
   ["RSI(14)",result.rsi14.toLocaleString("fi-FI"),result.overbought?"Yliostettu":result.oversold?"Ylimyyty":"Neutraali"],
   ["Liukuvat keskiarvot",result.sma50.toLocaleString("fi-FI")+" / "+result.sma200.toLocaleString("fi-FI"),result.trend],
   ["Risteämä",null,result.goldenCross?"Kultainen risti":result.deathCross?"Kuolonristi":"Ei uutta risteämää viimeisen kahden pörssipäivän aikana"],
   ["MACD(12,26,9)",result.macd?result.macd.macd.toLocaleString("fi-FI")+" / signaali "+result.macd.signal.toLocaleString("fi-FI"):null,result.macd?(result.macd.bullishCross?"Nouseva risteämä":result.macd.bearishCross?"Laskeva risteämä":result.macd.histogram>=0?"MACD signaalilinjan yläpuolella":"MACD signaalilinjan alapuolella"):"Ei laskettavissa"],
   ["Vaihtomäärä",result.volume?result.volume.ratio.toLocaleString("fi-FI")+"× 20 päivän keskiarvosta":null,result.volume?(result.volume.unusuallyHigh?"Poikkeuksellisen suuri":result.volume.unusuallyLow?"Poikkeuksellisen pieni":"Tavanomainen"):"Puuttuva volyymidata"]
  ];
  for(const [name,value,state] of signals){
   const row=el("div","stock-signal-row");
   row.append(el("strong","",name),el("span","",value?value+" · "+state:state));
   output.append(row);
  }
  for(const [label,key] of [["Yliostettu","overbought"],["Ylimyyty","oversold"],["Kultainen risti","goldenCross"],["Kuolonristi","deathCross"]]){
   const details=el("details","stock-signal-help"),summary=el("summary","",label);
   details.append(summary,el("p","muted",SIGNAL_DESCRIPTIONS[key]));output.append(details);
  }
  output.append(el("p","muted","MACD on trendiä seuraava viiveellinen mittari. Volyymitieto ei yksin kerro osto- tai myyntipainetta."));
  output.append(el("p","muted","Pörssin tarkkailulista: ei tarkistettu. "+SIGNAL_DESCRIPTIONS.exchangeWatch));
  output.append(el("p","muted",result.disclaimer));
 }catch(e){if(current===signalGeneration){output.replaceChildren();output.append(el("p","muted","Signaalien laskenta epäonnistui: "+(e?.name==="AbortError"?"Aikakatkaisu":e.message)))}}
 finally{if(current===signalGeneration){button.disabled=false;signalController=null}}
}

document.addEventListener("agent:open-stock-chart",e=>{
 const id=e.detail?.id;if(!id)return;
 if(opened===id){opened=null;generation++;cancel();render();return}
 opened=id;chosen="1d";generation++;cancel();render();load();
 host.scrollIntoView({behavior:"smooth",block:"nearest"});
});
document.addEventListener("agent:stocks-loaded",()=>{if(opened)render()});
document.addEventListener("agent:stock-change",()=>{if(opened)setTimeout(render,0)});
window.addEventListener("online",()=>{if(opened&&!cacheIsFresh(cache.get((window.agentStockBridge?.get()||[]).find(x=>x.id===opened)?.ticker+"|"+chosen),chosen))load()});
render();

window.agentSupabaseClient.auth.onAuthStateChange(()=>{clearDailyHistory();cache.clear()});
