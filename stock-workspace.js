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
const positions=make("div");
panel.append(searchForm,matches,actions,status,positions);
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
  const form=make("form");form.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:end";
  const qLabel=make("label","Osakkeita"),qInput=make("input"),cLabel=make("label","Keskihankintahinta"),cInput=make("input");
  for(const inp of [qInput,cInput]){inp.type="text";inp.inputMode="decimal";inp.style.cssText="display:block;width:125px;padding:10px;margin-top:4px";inp.required=true}
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
