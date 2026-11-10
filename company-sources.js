// Manuaalinen talouslähteiden haku: ei OpenAI-kutsuja, ei automaattisia ulkoisia hakuja.
const root=document.getElementById("company-source-workspace");
const db=window.agentSupabaseClient;
if(root&&db){
 const endpoint="https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/company-sources";
 const publicKey="sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE";
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node};
 const labelDate=value=>{const d=new Date(value||"");return Number.isFinite(d.getTime())?d.toLocaleString("fi-FI"):"Tuntematon"};
 const box=el("section",undefined,"company-source-panel");
 const heading=el("h3","Viralliset yrityslähteet (testi)");
 const info=el("p","Hae PRH:n yhtiörekisteritietoja ja ESEF-tilinpäätösten hakemistomerkintöjä pyynnöstä. Haku ei käytä OpenAI:ta. Raporttihakemiston osuma ei vielä ole varmennettu tilinpäätösluku.","muted");
 const form=el("form",undefined,"company-source-form");
 const query=el("input");query.type="text";query.placeholder="Yhtiö tai HEL-ticker, esim. Metso";query.maxLength=100;query.required=true;query.setAttribute("aria-label","Yhtiön nimi tai Helsingin pörssin ticker");
 const run=el("button","Hae lähteet","secondary-btn");run.type="submit";
 const refresh=el("button","Tarkista lähteet uudelleen","secondary-btn");refresh.type="button";
 const status=el("p","Kirjaudu sisään, jotta voit hakea tai katsella tallennettuja lähteitä.","muted");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const result=el("div",undefined,"company-source-results");
 const saved=el("div",undefined,"company-source-saved");
 const title=el("h4","Omat tallennetut lähdehaut");
 const savedRows=el("div",undefined,"company-source-saved-rows");
 saved.append(title,savedRows);
 form.append(query,run,refresh);
 box.append(heading,info,form,status,result,saved);
 root.append(box);
 let owner=null,requestId=0,busy=false,history=[];
 const safeLink=(url,hosts,text)=>{
  if(typeof url!=="string"||url.length>1300)return null;
  try{const u=new URL(url);if(u.protocol!=="https:"||!hosts.includes(u.hostname)||u.username||u.password)return null;
   const a=el("a",text,"external-link");a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";return a
  }catch{return null}
 };
 const addRow=(host,label,value)=>{
  const row=el("div",undefined,"company-source-field");
  row.append(el("strong",label),el("span",value==null?"Ei saatavilla":String(value)));host.append(row);
 };
 const currentUser=async()=>{const {data:{session}}=await db.auth.getSession();return session?.access_token&&session?.user?.id?session:null};

 let financialRenderId=0;
 async function loadStoredFinancials(ticker,host){
  const id=++financialRenderId,session=await currentUser();
  host.replaceChildren();
  if(!session){host.append(el("p","Kirjaudu sisään nähdäksesi tallennetut talousluvut.","muted"));return}
  host.append(el("p","Ladataan aiemmin poimittuja lukuja…","muted"));
  const {data,error}=await db.from("company_financial_facts")
   .select("period_end,report_language,extracted_at,source_sha256,evidence")
   .eq("user_id",session.user.id).eq("ticker",ticker)
   .order("period_end",{ascending:false}).limit(12);
  const active=await currentUser();
  if(id!==financialRenderId||active?.user?.id!==session.user.id||!host.isConnected)return;
  host.replaceChildren();
  if(error){host.append(el("p","Tallennettuja talouslukuja ei voitu lukea.","muted"));return}
  if(!data?.length){host.append(el("p","Ei vielä tallennettuja XBRL-taloustietoja. Poimi luvut valitun raportin painikkeesta.","muted"));return}
  for(const item of data){
   const panel=el("article",undefined,"company-source-financial-record");
   panel.append(el("strong","Tilikausi "+item.period_end+" · "+String(item.report_language||"").toUpperCase()));
   panel.append(el("small","Poimittu "+labelDate(item.extracted_at)+" · SHA-256: "+String(item.source_sha256||"").slice(0,12)+"…","muted"));
   const metrics=Array.isArray(item.evidence?.metrics)?item.evidence.metrics:[];
   for(const metric of metrics.slice(0,8)){
    if(typeof metric?.key!=="string"||!Number.isFinite(metric.value))continue;
    addRow(panel,inspectLabels[metric.key]||metric.key,
      (metric.value/1e6).toLocaleString("fi-FI",{maximumFractionDigits:2})+" milj. €");
   }
   panel.append(el("small","Koneellisesti poimitut havainnot. Ei vielä hyväksytty osakekohtaisen tavoitehinnan laskentaan.","muted"));
   host.append(panel);
  }
 }

 const inspectLabels={revenue:"Liikevaihto",operating_profit:"Liikevoitto",profit_loss:"Tilikauden tulos",
  assets:"Varat",equity:"Oma pääoma",liabilities:"Velat",operating_cash_flow:"Liiketoiminnan rahavirta",
  capital_expenditure:"Investointien rahavirta"};
 async function inspectEsef(button,output,ticker,index){
  const session=await currentUser();
  if(!session){output.textContent="Kirjaudu sisään poimiaksesi talouslukuja.";return}
  if(!/^[A-Z0-9^._-]{1,20}\.HE$/.test(ticker))return;
  button.disabled=true;output.replaceChildren();output.append(el("p","Luetaan valitun raportin XBRL-JSON-tiedostoa…","muted"));
  const owner=session.user.id;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),17000);
  try{
   const res=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/esef-inspect",{
    method:"POST",signal:controller.signal,
    headers:{"Authorization":"Bearer "+session.access_token,"apikey":publicKey,"Content-Type":"application/json"},
    body:JSON.stringify({action:"inspect",ticker,candidate_index:index})
   });
   const payload=await res.json();
   const current=await currentUser();
   if(current?.user?.id!==owner){output.replaceChildren();return}
   if(!res.ok)throw Error(typeof payload?.error==="string"?payload.error:
     typeof payload?.message==="string"?payload.message:"Raportin varmennus ei onnistunut");
   output.replaceChildren();
   const metrics=payload?.evidence?.metrics;
   if(!Array.isArray(metrics)||!metrics.length)throw Error("Varmennettuja numeerisia havaintoja ei saatu.");
   output.append(el("strong","Poimitut raporttiluvut (ei vielä tarkastettu osakelajin suhteen)"));
   const formatted=n=>Number(n/1e6).toLocaleString("fi-FI",{maximumFractionDigits:2})+" milj. €";
   for(const item of metrics.slice(0,8)){
    if(typeof item?.key!=="string"||!Number.isFinite(item.value))continue;
    addRow(output,inspectLabels[item.key]||item.key,formatted(item.value));
   }
   output.append(el("p","Luvut poimittu XBRL-JSON-muodosta ja tallennettu. LEI-/osakelaji-, osakemäärä- ja tilintarkastusvarmistukset ovat edelleen kesken. Ei Stonksin tavoitehintaa.","muted"));
   const savedHost=result.querySelector(".company-source-financial-results");if(savedHost)void loadStoredFinancials(ticker,savedHost);
  }catch(err){output.replaceChildren();output.append(el("p",err?.name==="AbortError"?"Raporttihaku aikakatkaistiin.":"Talouslukujen poiminta epäonnistui: "+String(err?.message||"Tuntematon virhe"),"muted"))}
  finally{clearTimeout(timer);button.disabled=false}
 }

 function render(payload){
  result.replaceChildren();
  const snapshot=payload?.snapshot&&typeof payload.snapshot==="object"?payload.snapshot:payload;
  if(!snapshot||typeof snapshot!=="object")return;
  const card=el("article",undefined,"company-source-card");
  card.append(el("h4",(payload.company||payload.company_name||payload.ticker||"Yhtiö")+" · "+(payload.ticker||"")));
  addRow(card,"Lähteet tarkistettu",labelDate(payload.checked_at));
  addRow(card,"Tietojen tyyppi","Lähdelöytö, ei varmennettu arvostusaineisto");
  if(payload.cached)card.append(el("p","Näytetään aiemmin tallennettu tulos. Ei tehty uusia ulkoisia lähdehakuja.","muted"));
  const prh= snapshot.prh;
  const prhSection=el("div",undefined,"company-source-detail");
  prhSection.append(el("h5","PRH / YTJ"));
  if(prh&&typeof prh==="object"){
   addRow(prhSection,"Rekisterinimi",prh.name);
   addRow(prhSection,"Y-tunnus",prh.business_id);
   const link=safeLink(prh.source_url,["avoindata.prh.fi"],"Avaa PRH:n hakulähde");
   if(link){const wrap=el("div",undefined,"company-source-link");wrap.append(link);prhSection.append(wrap);}
   prhSection.append(el("p","Yrityksen nimiosuma – ei vielä vahvistettua pörssiosakkeen, ISINin tai osakemäärän vastaavuutta.","muted"));
  }else prhSection.append(el("p","PRH:n yksiselitteistä nimiosumaa ei saatu. Tämä ei tarkoita, ettei yhtiötä olisi rekisterissä.","muted"));
  card.append(prhSection);
  const esef=snapshot.esef,esefSection=el("div",undefined,"company-source-detail");
  esefSection.append(el("h5","ESEF / XBRL-raporttihakemisto"));
  addRow(esefSection,"Haun tila",({candidate:"Raporttiehdokkaita löytyi",ambiguous:"Useita liikkeeseenlaskijoita",not_found:"Ei hakemisto-osumia",unavailable:"Hakemisto ei vastannut",skipped:"Ei voitu suorittaa"}[esef?.status]||"Ei tietoa"));
  const candidates=Array.isArray(esef?.candidates)?esef.candidates.slice(0,3):[];
  const groups=new Map();
  for(const [idx,item] of candidates.entries()){const period=String(item.period_end||"Tuntematon");if(!groups.has(period))groups.set(period,[]);groups.get(period).push({...item,_index:idx})}
  for(const [period,variants] of groups){
   const periodHeading=el("h5","Tilikausi "+period);periodHeading.className="company-source-period";esefSection.append(periodHeading);
   for(const item of variants){
   const entry=el("div",undefined,"company-source-filing");
   addRow(entry,"Yhtiö",item.issuer_name);
   const parsedLang=typeof item.json_url==="string"?item.json_url.match(/-([a-z]{2})\.json(?:$|\?)/i)?.[1]?.toLowerCase():null;
   const language=({fi:"Suomi",en:"Englanti",sv:"Ruotsi"})[parsedLang]||"Muu kieli";
   addRow(entry,"Julkaisun kieli",language);
   addRow(entry,"LEI",item.issuer_lei);
   const link=safeLink(item.viewer_url||item.json_url,["filings.xbrl.org"],"Avaa raporttimerkintä");
   if(link){const wrap=el("div",undefined,"company-source-link");wrap.append(link);entry.append(wrap);}
   entry.append(el("small","Hakemistoehdokas – sisältöä ja lukuja ei vielä varmennettu."));
   if(typeof item.json_url==="string"){
    const check=el("button","Poimi IFRS-taloustiedot","secondary-btn");check.type="button";check.className+=" company-source-inspect-button";
    const inspection=el("div",undefined,"company-source-inspection");
    check.addEventListener("click",()=>{void inspectEsef(check,inspection,payload.ticker,item._index)});
    entry.append(check,inspection);
   }
   esefSection.append(entry);
   }
  }
  card.append(esefSection);
  card.append(el("p","Tässä vaiheessa ei vielä lasketa DCF-, EV/EBIT- tai P/FCF-arvostuksia ilman varmennettuja tilinpäätöslukuja ja osakemäärää.","muted"));
  result.append(card);
  const existing=el("section",undefined,"company-source-financial-section");
  existing.append(el("h4","Tallennetut IFRS-taloustiedot"));
  const existingRows=el("div",undefined,"company-source-financial-results");
  existing.append(existingRows);result.append(existing);
  if(typeof payload.ticker==="string"&&/^[A-Z0-9^._-]{1,20}\.HE$/.test(payload.ticker))void loadStoredFinancials(payload.ticker,existingRows);
 }
 async function readSaved(){
  const session=await currentUser(),id=++requestId;
  if(!session){financialRenderId++;owner=null;history=[];savedRows.replaceChildren();result.replaceChildren();status.textContent="Kirjaudu sisään hakeaksesi lähteitä.";return}
  owner=session.user.id;
  const {data,error}=await db.from("company_source_snapshots").select("ticker,company_name,checked_at,snapshot").eq("user_id",owner).order("checked_at",{ascending:false}).limit(15);
  if(id!==requestId||owner!==session.user.id)return;
  savedRows.replaceChildren();
  if(error){status.textContent="Tallennettujen lähteiden lataus epäonnistui.";return}
  history=data||[];
  if(!history.length){savedRows.append(el("p","Ei vielä tallennettuja lähdehakuja.","muted"));return}
  for(const row of history){
   const button=el("button",row.company_name+" · "+row.ticker+" · "+labelDate(row.checked_at),"secondary-btn");button.type="button";
   button.addEventListener("click",()=>{query.value=row.ticker;render(row);status.textContent="Tallennettu tulos avattu. Ei uusia lähdehakuja."});
   savedRows.append(button);
  }
 }
 async function search(force=false){
  if(busy)return;
  const q=query.value.trim();
  if(q.length<2||q.length>100){status.textContent="Anna 2–100 merkin yhtiön nimi tai ticker.";return}
  const session=await currentUser();
  if(!session){status.textContent="Kirjaudu ensin sisään.";return}
  const id=++requestId;
  busy=true;run.disabled=true;refresh.disabled=true;result.replaceChildren();
  status.textContent=force?"Tarkistetaan lähteet uudelleen…":"Haetaan lähteet tai palautetaan tallennettu tarkistus…";
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
   let response;
   try{response=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:publicKey,"Content-Type":"application/json"},body:JSON.stringify({query:q,refresh:force}),signal:controller.signal})}
   finally{clearTimeout(timer)}
   const data=await response.json();
   if(!response.ok)throw Error(typeof data?.error==="string"?data.error:"Lähdehaku epäonnistui");
   const current=await currentUser();
   if(id!==requestId||current?.user?.id!==session.user.id)return;
   render(data);
   status.textContent=data.cached?"Ladattu aiemmin tallennetuista tiedoista.":"Lähdehakemistot tarkistettu. Ei AI-kustannusta.";
   await readSaved();
   if(id===requestId)status.textContent=data.cached?"Ladattu aiemmin tallennetuista tiedoista.":"Lähdehakemistot tarkistettu. Ei AI-kustannusta.";
  }catch(error){if(id===requestId)status.textContent=error?.name==="AbortError"?"Lähdehaku aikakatkaistiin.":error?.message||"Lähdehaku epäonnistui."}
  finally{busy=false;run.disabled=false;refresh.disabled=false}
 }
 form.addEventListener("submit",event=>{event.preventDefault();void search(false)});
 refresh.addEventListener("click",()=>{void search(true)});
 void readSaved();
 db.auth.onAuthStateChange(()=>{requestId++;financialRenderId++;owner=null;history=[];savedRows.replaceChildren();result.replaceChildren();status.textContent="Tarkistetaan kirjautumistila…";setTimeout(()=>{void readSaved()},0)});
}
