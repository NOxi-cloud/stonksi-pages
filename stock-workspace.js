import {calculateTechnicalSignals} from "./stock-signals.mjs";
import {makeSignalObservation,loadSignalHistory,saveSignalHistory,updateSignalOutcomes,renderSignalHistory} from "./stock-signal-history.mjs";
import {renderResearchPriorities} from "./stock-research-priorities.mjs";
import {renderSignalSummary} from "./stock-signal-summary.mjs";
import {getCachedDaily,storeCachedDaily} from "./stock-history-cache.mjs";
// User-initiated stock discovery, quote updates and cloud-synced positions. No trades.
const db=window.agentSupabaseClient;
const panel=document.getElementById("stock-workspace");
const api="https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/stock-quotes";
const publicKey="sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE";
const money=(n,c="EUR")=>new Intl.NumberFormat("fi-FI",{style:"currency",currency:c||"EUR"}).format(n);
const number=v=>{const text=String(v).trim();return text?Number(text.replace(",",".")):NaN};
const stocks=()=>window.agentStockBridge?.get()||[];
const validSymbol=s=>/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(s);
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
const status=make("p","", "muted");status.setAttribute("role","status");
const searchForm=make("form");searchForm.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0";
const query=make("input");query.placeholder="Yhtiön nimi tai ticker, esim. Nokia";query.required=true;query.maxLength=80;query.style.cssText="flex:1;min-width:160px;padding:12px";
const searchButton=make("button","Etsi yhtiö","secondary-btn");searchButton.type="submit";
const clearButton=make("button","Tyhjennä haku","secondary-btn");clearButton.type="button";
searchForm.append(query,searchButton,clearButton);
const matches=make("div");
let searchGeneration=0;
function clearSearch(){
 searchGeneration++;
 query.value="";
 matches.replaceChildren();
 status.textContent="";
 searchButton.disabled=false;
}
clearButton.addEventListener("click",clearSearch);
query.addEventListener("input",()=>{searchGeneration++;matches.replaceChildren()});const actions=make("div");actions.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0";
const updateButton=make("button","Päivitä kaikkien kurssit","secondary-btn");updateButton.type="button";actions.append(updateButton);
const watchlistRefresh=document.getElementById("watchlist-refresh");
if(watchlistRefresh)watchlistRefresh.addEventListener("click",()=>updateButton.click());
const signalPanel=make("section",undefined,"watchlist-signals");
const signalTitle=make("h3","Seurantalistan tekniset signaalit");
const signalHelp=make("p","Haetaan pyynnöstä enintään 5 osaketta kerrallaan. RSI, MACD ja 50/200 päivän trendi. Jokainen uusi osakehistoria kuluttaa yhden kurssihaun. Tiedot ovat epävirallisia, eivät kaupankäyntisuosituksia.","muted");
const signalActions=make("div",undefined,"watchlist-signal-actions");
const signalButton=make("button","Laske 5 seuraavan osakkeen signaalit","secondary-btn");signalButton.type="button";
const signalReset=make("button","Aloita alusta","secondary-btn");signalReset.type="button";
const signalStatus=make("p","", "muted");signalStatus.setAttribute("role","status");
const signalRows=make("div",undefined,"watchlist-signal-grid");
const historyHost=make("section",undefined,"watchlist-signal-summary");
historyHost.hidden=true;
const historyButton=make("button","Näytä signaalihistoria","secondary-btn");historyButton.type="button";
historyButton.addEventListener("click",async()=>{const {data:{session}}=await db.auth.getSession();if(!session?.user?.id){signalStatus.textContent="Kirjaudu sisään.";return}historyHost.hidden=!historyHost.hidden;if(!historyHost.hidden)renderSignalHistory(historyHost,loadSignalHistory(session.user.id));historyButton.textContent=historyHost.hidden?"Näytä signaalihistoria":"Piilota signaalihistoria"});
const valuationButton=make("button","Näytä tallennetut arvostukset","secondary-btn");valuationButton.type="button";
const valuationStatus=make("p","","muted");
const valuationRows=make("div",undefined,"signal-summary-ranking");
valuationRows.hidden=true;
const valuationLookup=new Map();
const priorityHost=make("section",undefined,"watchlist-signal-summary");
const refreshPriorities=()=>renderResearchPriorities(priorityHost,signalResults,valuationLookup,stocks());
valuationButton.addEventListener("click",async()=>{
 valuationButton.disabled=true;valuationRows.replaceChildren();
 valuationStatus.textContent="Haetaan vain aiemmin tallennetut yritysanalyysit. Ei AI-kutsuja.";
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.user?.id)throw Error("Kirjautuminen vaaditaan.");
  const {data,error}=await db.from("ai_research_reports").select("analysis_snapshot,generated_at").eq("user_id",session.user.id).order("generated_at",{ascending:false}).limit(100);
  if(error)throw error;
  const latest=new Map();
  for(const report of data||[]){
   const snap=report.analysis_snapshot,target=snap?.data_quality?.price_target_view;
   if(snap?.schema_version!==1||typeof snap.ticker!=="string"||!target||!["verified_analyst_target","conditional_model_price"].includes(target.kind)||!Number.isFinite(target.price)||target.price<=0||typeof target.currency!=="string")continue;
   const ticker=snap.ticker.trim().toUpperCase();if(!latest.has(ticker))latest.set(ticker,{target,date:report.generated_at});
  }
  valuationLookup.clear();for(const [ticker,value] of latest)valuationLookup.set(ticker,value);
  valuationRows.hidden=false;
  refreshPriorities();
  let n=0;
  for(const item of stocks().slice(0,30)){
   const match=latest.get(item.ticker.toUpperCase());if(!match)continue;n++;
   const {target,date}=match,box=make("article",undefined,"signal-summary-entry");
   const verified=target.kind==="verified_analyst_target";
   const targetCurrency=target.currency.toUpperCase();
   box.append(make("strong",item.name+" · "+item.ticker),make("span",(verified?"Analyytikon tallennettu tavoitehinta":"Ehdollinen Base-laskelma")+" · "+Number(target.price).toLocaleString("fi-FI",{maximumFractionDigits:2})+" "+targetCurrency));
   const current=Number(item.price),currency=String(item.currency||"").toUpperCase();
   if(verified&&Number.isFinite(current)&&current>0&&currency===targetCurrency){
    const pct=(target.price/current-1)*100;
    box.append(make("small","Vertailu tallennettuun seurantalistan kurssiin "+current.toLocaleString("fi-FI")+" "+currency+": "+(pct>=0?"+":"")+pct.toLocaleString("fi-FI",{maximumFractionDigits:1})+" % · ei tuottoennuste","muted"));
   }else box.append(make("small","Prosenttivertailu näytetään vain varmennetulle tavoitteelle, kun kurssi ja valuutta ovat vertailukelpoiset.","muted"));
   const d=Date.parse(date);
   box.append(make("small","Raportti "+(Number.isFinite(d)?new Date(d).toLocaleDateString("fi-FI"):"päiväys puuttuu")+" · ei päivitetä automaattisesti","muted"));
   valuationRows.append(box);
  }
  valuationStatus.textContent=n?n+" tallennettua arvoa löytyi. Arvostus ja tekninen signaali ovat erillisiä havaintoja.":"Ei yhteensopivia tallennettuja yritysanalyysejä.";
 }catch(err){valuationStatus.textContent="Arvostusvertailu epäonnistui: "+err.message}
 finally{valuationButton.disabled=false}
});
const signalSummary=make("div",undefined,"watchlist-signal-summary");
const signalResults=new Map();
const refreshSignalSummary=()=>{renderSignalSummary(signalResults,signalSummary,Math.min(stocks().filter(x=>validSymbol(x.ticker)).length,30));refreshPriorities()};
signalActions.append(signalButton,signalReset,historyButton);
signalPanel.append(signalTitle,signalHelp,signalActions,signalStatus,signalSummary,priorityHost,signalRows,historyHost,valuationButton,valuationStatus,valuationRows);
refreshSignalSummary();
let signalOffset=0,signalRun=0,signalBusy=false;
signalReset.addEventListener("click",()=>{signalRun++;signalOffset=0;signalRows.replaceChildren();signalResults.clear();refreshSignalSummary();signalStatus.textContent="Valmis uuteen hakuun.";signalBusy=false;signalButton.disabled=false;});
function signalCard(item,result,message){
 const card=make("article",undefined,"watchlist-signal-card");
 card.append(make("strong",item.name+" · "+item.ticker));
 if(!result){card.append(make("p",message||"Ei riittävää kurssihistoriaa.","muted"));return card}
 const rsi=result.overbought?"Yliostettu":result.oversold?"Ylimyyty":"Neutraali";
 const macd=result.macd?(result.macd.bullishCross?"Nouseva risteämä":result.macd.bearishCross?"Laskeva risteämä":result.macd.histogram>=0?"Positiivinen histogrammi":"Negatiivinen histogrammi"):"Ei saatavilla";
 const volume=result.volume?result.volume.ratio.toLocaleString("fi-FI")+"× 20 pv keskiarvo":"Ei saatavilla";
 for(const [label,value] of [["RSI(14)",result.rsi14.toLocaleString("fi-FI")+" · "+rsi],["MACD",macd],["SMA50/200",result.trend],["Volyymi",volume]]){
  const line=make("div",undefined,"watchlist-signal-line");line.append(make("span",label),make("span",value));card.append(line)
 }
 card.append(make("small","Havainto "+new Date(result.asOf).toLocaleDateString("fi-FI")+" · Yahoo Finance (epävirallinen)","muted"));
 return card;
}
signalButton.addEventListener("click",async()=>{
 if(signalBusy)return;
 const rows=stocks().filter(x=>validSymbol(x.ticker)).slice(0,30);
 if(!rows.length){signalStatus.textContent="Lisää seurantalistaan osake.";return}
 const {data:{session}}=await db.auth.getSession();
 if(!session?.access_token){signalStatus.textContent="Kirjaudu sisään.";return}
 const batch=rows.slice(signalOffset,signalOffset+5);
 if(!batch.length){signalStatus.textContent="Kaikki 30 enimmäisosaketta käsitelty.";return}
 const ownRun=++signalRun;signalBusy=true;signalButton.disabled=true;
 try{
  for(const item of batch){
   if(ownRun!==signalRun)break;
   signalStatus.textContent="Käsitellään "+(signalOffset+1)+"/"+Math.min(rows.length,30)+" · "+item.ticker;
   let raw=getCachedDaily(session.user.id,item.ticker);
   try{
    if(!raw){raw=await request({action:"history",symbol:item.ticker,period:"1y"});
     if(ownRun!==signalRun)break;
     const {data:{session:liveSession}}=await db.auth.getSession();
     if(liveSession?.user?.id!==session.user.id){signalStatus.textContent="Istunto vaihtui. Keskeytetty.";break}
     storeCachedDaily(session.user.id,item.ticker,raw);
    }
    if(ownRun!==signalRun)break;
    const result=calculateTechnicalSignals(raw);
    signalResults.set(item.id,{item,result});
    if(result){const observation=makeSignalObservation(item,result,Date.now(),raw);if(observation)saveSignalHistory(session.user.id,[observation]);updateSignalOutcomes(session.user.id,observation.ticker,raw);}
    signalRows.append(signalCard(item,result,"RSI- ja trenditietoja ei voitu laskea."));
    refreshSignalSummary();
   }catch(error){if(ownRun===signalRun){signalResults.set(item.id,{item,result:null});signalRows.append(signalCard(item,null,"Haku epäonnistui: "+error.message));refreshSignalSummary()}}
   signalOffset++;
  }
  if(ownRun===signalRun)signalStatus.textContent="Käsitelty "+signalOffset+"/"+Math.min(rows.length,30)+" osaketta. Uudet haut tehdään vain pyynnöstä.";
 }finally{if(ownRun===signalRun){signalBusy=false;signalButton.disabled=false}}
});
const positions=make("div",undefined,"stock-positions");
panel.append(searchForm,matches,actions,status,signalPanel,positions);
async function request(body){
 const {data:{session}}=await db.auth.getSession();if(!session?.access_token)throw Error("Kirjaudu sisään.");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(api,{method:"POST",signal:controller.signal,headers:{"Authorization":"Bearer "+session.access_token,"apikey":publicKey,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||"Tietojen haku epäonnistui ("+response.status+")");
  return payload;
 }finally{clearTimeout(timeout)}
}
function save(item){document.dispatchEvent(new CustomEvent("agent:stock-change",{detail:{action:"upsert",item}}));window.agentStockBridge?.set(stocks().map(s=>s.id===item.id?item:s));renderPositions()}
function addItem(quote){
 if(stocks().some(s=>s.ticker===quote.symbol)){status.textContent="Osake on jo seurantalistalla.";return}
 const item={id:crypto.randomUUID(),name:quote.name,ticker:quote.symbol,exchange:quote.exchange||"",quantity:null,average_cost:null,price:null,currency:null,price_time:null,quote_source:null};
 document.dispatchEvent(new CustomEvent("agent:stock-change",{detail:{action:"upsert",item}}));
 window.agentStockBridge?.set([...stocks(),item]);clearSearch();status.textContent="Lisätty seurantalistalle: "+item.name;renderPositions();
}
searchForm.addEventListener("submit",async e=>{
 e.preventDefault();const generation=++searchGeneration;matches.replaceChildren();searchButton.disabled=true;status.textContent="Etsitään yhtiöitä…";
 try{
  const data=await request({action:"search",query:query.value.trim()});
  if(generation!==searchGeneration)return;
  if(!data.matches?.length){status.textContent="Ei hakutuloksia. Tarkista nimi tai ticker.";return}
  status.textContent="Valitse oikea yhtiö ja pörssi:";
  for(const match of data.matches){
   const row=make("div");row.style.cssText="padding:8px 0;border-bottom:1px solid #353c50";
   const b=make("button","Lisää "+match.name+" · "+match.symbol+" · "+match.exchange,"secondary-btn");b.type="button";
   b.addEventListener("click",()=>addItem(match));row.append(b);matches.append(row);
  }
 }catch(err){if(generation===searchGeneration)status.textContent="Haku epäonnistui: "+err.message}
 finally{if(generation===searchGeneration)searchButton.disabled=false}
});
updateButton.addEventListener("click",async()=>{
 const items=stocks();if(!items.length){status.textContent="Lisää ensin osake.";return}
 updateButton.disabled=true;if(watchlistRefresh)watchlistRefresh.disabled=true;let success=0;const errors=[];
 try{
  for(const item of items.slice(0,30)){
   try{
    if(!validSymbol(item.ticker))throw Error("Virheellinen ticker");
    const q=await request({symbol:item.ticker});
    const updated={...item,name:q.name||item.name,exchange:q.exchange||item.exchange,price:q.price,currency:q.currency,price_time:q.price_time,quote_source:q.source,change:q.change,change_percent:q.change_percent};
    save(updated);success++;
   }catch(err){errors.push(item.ticker+": "+err.message)}
  }
  status.textContent="Päivitetty "+success+"/"+Math.min(items.length,30)+" osaketta."+(items.length>30?" Päivitys rajattu 30 osakkeeseen.":"")+(errors.length?" Virheet: "+errors.join("; "):"");
 }finally{updateButton.disabled=false;if(watchlistRefresh)watchlistRefresh.disabled=false}
});
function renderPositions(){
 positions.replaceChildren();const items=stocks();
 if(!items.length){positions.append(make("p","Seurantalista on tyhjä. Etsi ja lisää osake yllä.","muted"));return}
 const heading=make("h3","Omistukset ja tuotot");positions.append(heading);
 let investedTotal=0,marketTotal=0,complete=0;
 for(const item of items){
  const box=make("div");box.style.cssText="border-top:1px solid #353c50;padding:12px 0";
  box.append(make("strong",item.name+" ("+item.ticker+")"));
  const note=make("p",item.price!=null?"Kurssi "+item.price+" "+(item.currency||"")+" · "+(item.price_time?new Date(item.price_time).toLocaleString("fi-FI"):"ajankohta puuttuu")+" · "+(item.quote_source||"lähde tuntematon"):"Kurssia ei ole haettu.","muted");box.append(note);
  const form=make("form",undefined,"stock-position-form");
  const qLabel=make("label","Osakkeita"),qInput=make("input"),cLabel=make("label","Keskihankintahinta"),cInput=make("input");
  for(const inp of [qInput,cInput]){inp.type="text";inp.inputMode="decimal";inp.style.cssText="display:block;width:160px;max-width:100%;padding:10px;margin-top:6px";inp.required=true}
  qInput.value=item.quantity??"";cInput.value=item.average_cost??"";qLabel.append(qInput);cLabel.append(cInput);
  const b=make("button","Tallenna omistus","secondary-btn");b.type="submit";form.append(qLabel,cLabel,b);box.append(form);
  const profit=make("p","","muted");box.append(profit);
  const qty=Number(item.quantity),cost=Number(item.average_cost),price=Number(item.price);
  if(item.quantity!=null&&item.average_cost!=null&&item.price!=null&&[qty,cost,price].every(Number.isFinite)&&qty>=0&&cost>=0&&price>=0){
   const invested=qty*cost,market=qty*price,delta=market-invested;
   profit.textContent="Hankintahinta yhteensä "+money(invested,item.currency)+" · Arvo "+money(market,item.currency)+" · Tuotto "+money(delta,item.currency)+" ("+(invested?(delta/invested*100).toFixed(2).replace(".",",")+" %":"ei laskettavissa")+")";
   if(item.currency==="EUR"){investedTotal+=invested;marketTotal+=market;complete++}
  }else profit.textContent="Lisää omistus ja päivitä kurssi nähdäksesi tuoton.";
  form.addEventListener("submit",e=>{
   e.preventDefault();const quantity=number(qInput.value.trim()),average_cost=number(cInput.value.trim());
   if(![quantity,average_cost].every(Number.isFinite)||quantity<0||average_cost<0||quantity>1e9){status.textContent="Tarkista omistuksen numerot.";return}
   save({...item,quantity,average_cost});status.textContent="Omistus tallennettu synkronointijonoon.";
  });
  positions.append(box);
 }
 const summary=make("p","EUR-omistukset, joille on kurssi ja hankintahinta ("+complete+" kpl): sijoitettu "+money(investedTotal)+" · arvo "+money(marketTotal)+" · tuotto "+money(marketTotal-investedTotal)+". Kulut ja verot eivät sisälly.","muted");
 positions.insertBefore(summary,positions.children[1]||null);
}
document.addEventListener("agent:open-stock-search",()=>{query.focus();query.scrollIntoView({behavior:"smooth",block:"center"})});
document.addEventListener("agent:stocks-loaded",renderPositions);
document.addEventListener("agent:stock-change",()=>setTimeout(renderPositions,0));
db.auth.onAuthStateChange(()=>setTimeout(renderPositions,0));
renderPositions();

db.auth.onAuthStateChange(()=>{signalRun++;signalOffset=0;signalRows.replaceChildren();signalStatus.textContent="";signalBusy=false;signalButton.disabled=false});
