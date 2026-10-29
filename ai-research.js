import {watchlistSuggestions} from "./ai-watchlist-suggestions.mjs";
import {describeEvidence,stripResearchIdentityBanner} from "./ai-data-quality.mjs";
import {extractOperatingScenarioBlock,formatScenarioAmount,formatScenarioPercent} from "./ai-scenarios.mjs";
// Research UI: explicit user-triggered AI request, never runs trades.
const db=window.agentSupabaseClient;
const view=document.getElementById("view-research");
const panel=document.createElement("section");
panel.className="panel form-panel";
panel.innerHTML='<h2>AI-osaketutkimus (testi)</h2><p class="muted">Kirjoita yhtiön nimi tai ticker ja käynnistä analyysi halutessasi. Talouslukujen saatavuus riippuu yhtiöstä ja lähteistä. AI-analyysi kuluttaa käyttökiintiötä ja voi aiheuttaa API-kuluja.</p><form id="ai-stock-form"><label for="ai-stock-query">Yhtiö tai ticker</label><input id="ai-stock-query" maxlength="160" minlength="2" required placeholder="Esim. Nokia" style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:8px 0 12px;background:#10141f;color:#fff;border:1px solid #353c50;border-radius:8px"><div class="ai-analysis-actions"><button class="primary-btn" id="ai-stock-submit" type="submit">Laadi analyysi</button></div></form><p id="ai-stock-status" role="status" aria-live="polite"></p><div id="ai-stock-result" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6"></div>';
const usage=document.createElement("div");
usage.style.cssText="margin:12px 0 20px";
usage.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px"><strong>Päivän AI-analyysit</strong><span id="ai-usage-count">Ladataan…</span></div><progress id="ai-usage-progress" max="5" value="0" style="width:100%;height:12px;margin-top:8px"></progress><p class="muted" id="ai-usage-reset" style="margin-top:4px"></p>';
usage.insertAdjacentHTML("beforeend",'<div style="margin-top:12px;display:flex;justify-content:space-between;gap:12px"><strong>Koko palvelun analyysit</strong><span id="ai-global-count">Ladataan…</span></div><progress id="ai-global-progress" max="10" value="0" style="width:100%;height:12px;margin-top:8px"></progress><p class="muted" id="ai-global-reset" style="margin-top:4px"></p>');
panel.insertBefore(usage,panel.querySelector("form"));
const aiInput=panel.querySelector("#ai-stock-query");
const watchlistSelect=document.createElement("select");
watchlistSelect.className="ai-watchlist-select";
watchlistSelect.hidden=true;
watchlistSelect.disabled=true;
watchlistSelect.setAttribute("aria-label","Valitse osake omalta seurantalistalta");
panel.querySelector(".ai-analysis-actions").append(watchlistSelect);
let ownWatchlist=[],watchlistOwner=null,watchlistReady=false;
function renderWatchlistSuggestions(){
 const currentUid=window.agentStockSyncState?.owner||null;
 const items=watchlistReady&&watchlistOwner&&currentUid===watchlistOwner
  ?watchlistSuggestions(ownWatchlist):[];
 watchlistSelect.replaceChildren();
 const placeholder=document.createElement("option");
 placeholder.value="";
 placeholder.textContent="Valitse seurantalistalta ▾";
 watchlistSelect.append(placeholder);
 for(const item of items){
  const option=document.createElement("option");
  option.value=item.ticker;
  option.textContent=item.name+" · "+item.ticker;
  watchlistSelect.append(option);
 }
 watchlistSelect.value="";
 watchlistSelect.hidden=!items.length;
 watchlistSelect.disabled=!items.length;
}
watchlistSelect.addEventListener("change",()=>{
 const ticker=watchlistSelect.value;
 if(!ticker)return;
 // Revalidate against the user's currently active list; never start analysis here.
 const state=window.agentStockSyncState;
 if(state?.ready&&state.owner===watchlistOwner&&watchlistSuggestions(ownWatchlist).some(item=>item.ticker===ticker)){
  aiInput.value=ticker;
 }
 watchlistSelect.value="";
});
document.addEventListener("agent:stocks-loaded",()=>{const state=window.agentStockSyncState;
 if(!state?.owner||!state.ready){watchlistReady=false;ownWatchlist=[];watchlistOwner=null;renderWatchlistSuggestions();return}
 watchlistOwner=state.owner;watchlistReady=true;ownWatchlist=window.agentStockBridge?.get()||[];
 renderWatchlistSuggestions();
});
document.addEventListener("agent:stock-change",()=>queueMicrotask(()=>{
 const state=window.agentStockSyncState;
 if(!state?.ready||state.owner!==watchlistOwner)return;
 ownWatchlist=window.agentStockBridge?.get()||[];renderWatchlistSuggestions();
}));
db.auth.onAuthStateChange(()=>{watchlistReady=false;watchlistOwner=null;ownWatchlist=[];renderWatchlistSuggestions();setTimeout(()=>{
 const state=window.agentStockSyncState;if(!state?.ready||!state.owner)return;
 watchlistOwner=state.owner;watchlistReady=true;ownWatchlist=window.agentStockBridge?.get()||[];renderWatchlistSuggestions();
},0)});

const usageCount=usage.querySelector("#ai-usage-count"),usageProgress=usage.querySelector("#ai-usage-progress"),usageReset=usage.querySelector("#ai-usage-reset");
const globalCount=usage.querySelector("#ai-global-count"),globalProgress=usage.querySelector("#ai-global-progress"),globalReset=usage.querySelector("#ai-global-reset");
async function refreshGlobalUsage(){
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.user){globalCount.textContent="Kirjaudu sisään";globalProgress.value=0;globalReset.textContent="";return}
  const {data,error}=await db.rpc("get_ai_research_global_usage");
  if(error)throw error;
  const used=Number(data.used)||0,limit=Number(data.limit)||10;
  globalProgress.max=limit;globalProgress.value=Math.min(used,limit);
  globalCount.textContent=used+" / "+limit+" · jäljellä "+Math.max(0,limit-used);
  globalReset.textContent="Nollautuu "+new Date(data.reset_at).toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"});
 }catch{globalCount.textContent="Ei saatavilla";globalReset.textContent="Suorita ensin koko palvelun käyttömittarin SQL-päivitys."}
}
async function refreshUsage(){
 await refreshGlobalUsage();
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.user){usageCount.textContent="Kirjaudu sisään";usageProgress.value=0;usageReset.textContent="";return}
  const {data,error}=await db.rpc("get_ai_research_usage");
  if(error)throw error;
  const used=Number(data.used)||0,limit=Number(data.limit)||5;
  usageProgress.max=limit;usageProgress.value=Math.min(used,limit);
  usageCount.textContent=used+" / "+limit+" · jäljellä "+Math.max(0,limit-used);
  usageReset.textContent="Nollautuu "+new Date(data.reset_at).toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"});
 }catch{usageCount.textContent="Ei saatavilla";usageReset.textContent="Tarkista käyttömittarin SQL-päivitys."}
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshUsage()});
db.auth.onAuthStateChange(()=>{setTimeout(refreshUsage,0)});
refreshUsage();
const form=view.querySelector("#research-form");
form?.insertAdjacentElement("beforebegin",panel);
const button=panel.querySelector("#ai-stock-submit"),status=panel.querySelector("#ai-stock-status"),result=panel.querySelector("#ai-stock-result");
const identityChoices=document.createElement("div");
identityChoices.className="ai-identity-choices";
identityChoices.setAttribute("aria-label","Valitse oikea osake");
status.after(identityChoices);
function showIdentityChoices(payload){
 identityChoices.replaceChildren();
 if(payload?.identity_status!=="ambiguous"||!Array.isArray(payload.candidates))return;
 const intro=document.createElement("p");intro.textContent="Tarkoititko jotakin näistä? Valitse osake, tarkista ticker ja paina sitten Laadi analyysi.";
 identityChoices.append(intro);
 for(const item of payload.candidates.slice(0,5)){
  if(typeof item?.symbol!=="string"||!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(item.symbol))continue;
  const option=document.createElement("button");option.type="button";option.className="secondary-btn";
  option.style.cssText="margin:4px;max-width:100%;white-space:normal;text-align:left";
  option.textContent=String(item.name||item.symbol).slice(0,120)+" · "+item.symbol;
  option.addEventListener("click",()=>{
   aiInput.value=item.symbol;identityChoices.replaceChildren();aiInput.focus();
  });
  identityChoices.append(option);
 }
}

const analysisHeader=document.createElement("div");
analysisHeader.style.cssText="display:none;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 8px";
analysisHeader.style.display="none";
const analysisTitle=document.createElement("strong");
analysisTitle.textContent="Analyysi";
const closeAnalysis=document.createElement("button");
closeAnalysis.type="button";
closeAnalysis.textContent="Sulje";
closeAnalysis.setAttribute("aria-label","Sulje analyysi");
analysisHeader.append(analysisTitle,closeAnalysis);
result.before(analysisHeader);
// Display-only conversion: keep underlying report and evidence unchanged.
function compactSummaryMillions(value){
 return String(value||"").replace(/\b(\d{4,9})(?:[ \u00a0]+)(miljoonaa|miljoonan|miljoonaan|miljoonasta|miljoonassa)([ \u00a0]+)(euroa|eur|usd|dollaria)\b/gi,(full,digits,caseWord,space,currency)=>{
  const n=Number(digits);
  if(!Number.isFinite(n)||n<1000)return full;
  const billions=(n/1000).toLocaleString("fi-FI",{maximumFractionDigits:3});
  const word=caseWord.toLowerCase();
  const suffix=word==="miljoonan"?"miljardin":word==="miljoonaan"?"miljardiin":word==="miljoonasta"?"miljardista":word==="miljoonassa"?"miljardissa":"miljardia";
  return billions+" "+suffix+space+currency;
 });
}
function renderAnalysis(raw){
 result.replaceChildren();
 const text=stripResearchIdentityBanner(raw);
 const sections=[];let current={title:"Analyysi",lines:[]};
 for(const line of text.split(/\r?\n/)){
  const m=line.trim().match(/^(?:#{1,4}\s+|\*\*)(.+?)(?:\*\*)?\s*$/);
  const heading=m?.[1]?.replace(/\*\*/g,"").trim();
  if(heading&&heading.length<90&&/^(tiivistelmä|yhteenveto|yhtiö|liiketoiminta|mahdollisu|risk|talou|arvost|kasvu|näkym|skenaar|tarkistettav|johtopäät|suositus|strategia|kannattav|kilpailu|markkina|seurattav|lähteet|tiedon puutteet)/i.test(heading)){
   if(current.lines.some(x=>x.trim()))sections.push(current);
   current={title:heading,lines:[]};
  }else current.lines.push(line);
 }
 if(current.lines.some(x=>x.trim()))sections.push(current);
 const block=(value)=>{
  const el=document.createElement("div");el.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6";
  const raw=String(value||"").trim();
  const pattern=/\[([^\]\n]{1,100})\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s)]+)/g;
  let last=0,match;
  while((match=pattern.exec(raw))!==null){
   if(match.index>last)el.append(document.createTextNode(raw.slice(last,match.index)));
   const href=match[2]||match[3];
   try{
    const url=new URL(href);
    if(url.protocol!=="https:")throw Error("invalid protocol");
    const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
    link.textContent=match[1]||href;link.style.cssText="color:#9cc5ff;text-decoration:underline;overflow-wrap:anywhere";
    el.append(link);
   }catch{el.append(document.createTextNode(match[0]))}
   last=pattern.lastIndex;
  }
  if(last<raw.length)el.append(document.createTextNode(raw.slice(last)));
  return el;
 };
 if(sections.length<2){
  const paragraphs=text.split(/\n\s*\n/).filter(Boolean);
  if(paragraphs.length<2){result.append(block(text));return}
  const intro=document.createElement("section");const label=document.createElement("strong");label.textContent="Tiivistelmä";intro.append(label,block(compactSummaryMillions(paragraphs[0])));result.append(intro);
  const details=document.createElement("details");details.style.marginTop="14px";const sum=document.createElement("summary");sum.textContent="Näytä koko analyysi";sum.style.cursor="pointer";details.append(sum,block(paragraphs.slice(1).join("\n\n")));result.append(details);return;
 }
 const index=sections.findIndex(x=>/tiivistelmä|yhteenveto/i.test(x.title));
 const intro=sections.splice(index>=0?index:0,1)[0];
 const title=document.createElement("strong");title.textContent="Tiivistelmä";result.append(title,block(compactSummaryMillions(intro.lines.join("\n"))));
 for(const part of sections){
  const details=document.createElement("details");details.style.cssText="border-top:1px solid #353c50;padding:12px 0";
  const sum=document.createElement("summary");sum.textContent=part.title;sum.style.cssText="cursor:pointer;font-weight:600";
  const original=part.lines.join("\n");
  const extracted=/^Taloudellinen tilanne ja arvostus/i.test(part.title)?extractOperatingScenarioBlock(original):{text:original,scenario:null};
  details.append(sum,block(extracted.text));
  if(extracted.scenario){
   const info=extracted.scenario;
   const panel=document.createElement("div");panel.className="ai-scenario-panel";
   const heading=document.createElement("h4");heading.textContent="Bear / Base / Bull – tulosherkkyydet";
   const period=document.createElement("p");period.textContent="Laskentakausi: "+info.period;
   const table=document.createElement("table");table.className="ai-scenario-table";
   const header=document.createElement("tr");
   for(const label of ["Skenaario","Liikevaihto","Liikevoitto / tulos","Marginaali"]){const th=document.createElement("th");th.textContent=label;header.append(th)}
   const thead=document.createElement("thead");thead.append(header);table.append(thead);
   const tbody=document.createElement("tbody");
   for(const item of info.rows){
    const tr=document.createElement("tr");
    for(const value of [item.name,formatScenarioAmount(item.revenue,info.unit),formatScenarioAmount(item.profit,info.unit),formatScenarioPercent(item.margin,2)+" %"]){
     const td=document.createElement("td");td.textContent=value;tr.append(td);
    }
    tbody.append(tr);
   }
   table.append(tbody);
   const assumptions=document.createElement("p");assumptions.textContent="Oletukset: Bear −10 % liikevaihto / −2 %-yks. marginaali; Base 0 / 0; Bull +10 % / +2 %-yks.";
   const caveat=document.createElement("p");caveat.textContent="Mekaaninen laskelma, ei tulosennuste, osakekurssin tavoitehinta tai sijoitussuositus.";
   panel.append(heading,period,table,assumptions,caveat);details.append(panel);
  }
  result.append(details);
 }
}
function describeDataQuality(payload){return describeEvidence(payload?.data_quality)}
const analystPanel=document.createElement("section");
analystPanel.className="ai-analyst-panel";
analystPanel.hidden=true;
analysisHeader.after(analystPanel);
function renderAnalystSources(payload){
 analystPanel.replaceChildren();analystPanel.hidden=true;
 const opinion=payload?.data_quality?.analyst_opinion;
 if(opinion&&opinion.provider==="Inderes"&&
  typeof opinion.source_url==="string"&&typeof opinion.published_at==="string"&&
  typeof opinion.target_price==="number"&&Number.isFinite(opinion.target_price)&&
  ["Osta","Lisää","Vähennä","Myy"].includes(opinion.recommendation)&&
  ["EUR","SEK","NOK","USD","DKK","GBP","CHF"].includes(opinion.currency)){
  try{
   const url=new URL(opinion.source_url);
   const age=(Date.now()-Date.parse(opinion.published_at+"T00:00:00Z"))/86400000;
   if(url.protocol==="https:"&&["inderes.fi","www.inderes.fi"].includes(url.hostname)&&
    /^\/(?:en\/)?research\/[^/]+\/?$/.test(url.pathname)&&
    Number.isFinite(age)&&age>=0&&age<=365){
    const h=document.createElement("strong");h.textContent="Inderesin analyytikkonäkemys";
    const value=document.createElement("p");
    value.textContent="Suositus: "+opinion.recommendation+" · Tavoitehinta: "+
     opinion.target_price.toLocaleString("fi-FI")+" "+opinion.currency;
    const date=document.createElement("p");date.className="muted";
    date.textContent="Julkaistu "+opinion.published_at+
     " · tekoälyn lähdeviitteestä poimima tieto, varmista alkuperäisestä raportista.";
    const link=document.createElement("a");link.href=url.href;link.target="_blank";
    link.rel="noopener noreferrer";link.textContent="Avaa analyysin alkuperäislähde";
    analystPanel.append(h,value,date,link);
    const comparison=payload?.data_quality?.analyst_comparison;
    if(comparison?.status==="comparable"&&
     typeof comparison.target_difference_pct==="number"&&
     Number.isFinite(comparison.target_difference_pct)&&
     typeof comparison.observed_price==="number"&&comparison.observed_price>0){
     const detail=document.createElement("p");detail.className="muted";
     detail.textContent="Ero havaittuun kurssiin: "+
      (comparison.target_difference_pct>0?"+":"")+
      comparison.target_difference_pct.toLocaleString("fi-FI")+" % (vertailukurssi "+
      comparison.observed_price.toLocaleString("fi-FI")+" "+opinion.currency+
      "). Laskennallinen erotus, ei tuottoennuste.";
     analystPanel.append(detail);
    }
    analystPanel.hidden=false;return;
   }
  }catch{}
 }
 const item=payload?.data_quality?.analyst_source;
 const diagnostic=payload?.data_quality?.analyst_search;
 if(!item&&diagnostic&&["not_found","unavailable","timeout","rate_limited"].includes(diagnostic.status)){
  const p=document.createElement("p");p.className="muted";
  p.textContent=diagnostic.status==="timeout"?"Inderes-haku aikakatkaistiin.":diagnostic.http_status===400?"Inderes-haun API-pyyntö hylättiin (400).":diagnostic.http_status===429?"Inderes-haun API-käyttöraja (429).":diagnostic.status==="not_found"
   ?"Inderesin analyysilähdettä ei löytynyt tästä hausta."
   :diagnostic.status==="rate_limited"?"Inderes-haun käyttöraja tuli vastaan."
   :"Inderes-lähdehakua ei saatu varmistettua tällä kertaa.";
  if(diagnostic.http_status===400){
   const bits=[diagnostic.error_code,diagnostic.error_param].filter(x=>typeof x==="string"&&/^[A-Za-z0-9_.\\[\\]-]{1,100}$/.test(x));
   if(bits.length)p.textContent+=" API: "+bits.join(" / ");
  }
  if(diagnostic.status==="not_found"){
   const reasons={
    no_citations:"Hakupalvelu ei palauttanut varmennettuja lähdeviitteitä.",
    issuer_not_matched:"Lähteitä löytyi, mutta yhtiösivua ei voitu yhdistää tähän osakkeeseen.",
    empty_response:"Hakupalvelu ei palauttanut analysoitavaa vastausta.",
    oversized_response:"Hakupalvelun vastaus ylitti sallitun koon.",
    invalid_json:"Hakupalvelun vastaus ei ollut kelvollista JSON-muotoa.",
    opinion_not_verified:"Yhtiösivu löytyi, mutta tavoitehintaa ei voitu varmentaa."
   };
   if(typeof reasons[diagnostic.rejection_reason]==="string")p.textContent+=" "+reasons[diagnostic.rejection_reason];
  }
  analystPanel.append(p);analystPanel.hidden=false;return;
 }

 if(!item||item.provider!=="Inderes"||typeof item.url!=="string"||typeof item.company!=="string")return;
 try{
  const url=new URL(item.url);
  if(url.protocol!=="https:"||!["inderes.fi","www.inderes.fi"].includes(url.hostname)||
   !/^\/(?:en\/)?companies\/[^/]+\/?$/.test(url.pathname))return;
  const title=document.createElement("strong");title.textContent="Analyytikoiden näkemykset";
  const explanation=document.createElement("p");explanation.textContent="Löydetty yhtiön analyysilähde. Tarkista tavoitehinta, suositus ja niiden päivämäärä alkuperäiseltä sivulta.";
  const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
  link.textContent="Avaa "+item.company+" – Inderes";
  const reasons={
   research_url_invalid:"Tutkimusartikkelin osoitetta ei voitu vahvistaa.",
   research_retry_unavailable:"Tutkimusartikkelin erillinen haku epäonnistui.",
   research_retry_incomplete:"Tutkimusartikkelin erillinen haku jäi kesken.",
   research_retry_failed:"Tutkimusartikkelin erillinen haku ei vastannut.",
   research_issuer_mismatch:"Tutkimusartikkelia ei voitu yhdistää oikeaan yhtiöön.",
   research_not_cited:"Tutkimusartikkeli ei sisältynyt haun varmennettuihin lähdeviitteisiin.",
   date_invalid:"Tutkimusartikkelin julkaisupäivä puuttui tai oli virheellinen.",
   date_out_of_range:"Tutkimusartikkelin päiväys ei täyttänyt tuoreusvaatimusta.",
   recommendation_invalid:"Analyytikkosuositusta ei voitu varmentaa.",
   target_price_invalid:"Tavoitehintaa ei voitu varmentaa.",
   currency_invalid:"Tavoitehinnan valuuttaa ei voitu varmentaa.",
   evidence_invalid:"Tavoitehinnan ja suosituksen perustelutieto ei läpäissyt tarkistusta."
  };
  const cited=diagnostic?.research_source_count;
  const total=diagnostic?.source_count;
  if(Number.isInteger(cited)&&Number.isInteger(total)&&cited>=0&&total>=0){
   const p=document.createElement("p");p.className="muted";
   const inderes=diagnostic?.inderes_source_count;
   p.textContent="Lähdetarkistus: "+cited+" tutkimusartikkelia / "+total+" lähdeviitettä"+(Number.isInteger(inderes)?" (Inderes-lähteitä "+inderes+")":"")+".";
   analystPanel.append(p);
  }
  const publicRead=diagnostic?.public_read;
  if(publicRead&&typeof publicRead.status==="string"){
   const names={skipped:"Ei käynnistynyt",profile_unavailable:"Yhtiösivun haku epäonnistui",no_article_links:"Yhtiösivulta ei löytynyt tutkimuslinkkejä",article_not_verified:"Tutkimusartikkelin tietoja ei voitu varmentaa",article_date_missing:"Artikkelin julkaisupäivää ei tunnistettu",article_content_missing:"Artikkelin julkinen HTML ei sisällä analyysitekstiä",article_values_missing:"Artikkelista ei tunnistettu tavoitehintaa ja suositusta",article_conflicting_values:"Artikkelissa on ristiriitaisia tavoitehinta- tai suositustietoja",article_evidence_rejected:"Artikkelin tietojen varmennus hylkäsi tuloksen",article_unavailable:"Tutkimusartikkelin lataus epäonnistui",article_fetch_failed:"Tutkimusartikkelin verkkohaku epäonnistui",fetch_failed:"Julkisen sivun haku epäonnistui",verified:"Julkinen tutkimusartikkeli varmennettu"};
   const p=document.createElement("p");p.className="muted";
   p.textContent="Julkinen Inderes-lukija: "+(names[publicRead.status]||( /^[a-z_]{1,60}$/.test(publicRead.status)?"Tuntematon tilakoodi: "+publicRead.status:"Ei varmennettua tulosta"))+(Number.isInteger(publicRead.article_count)?" ("+publicRead.article_count+" artikkelilinkkiä)":"")+(Number.isInteger(publicRead.http_status)?" HTTP "+publicRead.http_status:"")+".";
   analystPanel.append(p);
  }
  const reason=diagnostic?.rejection_reason;
  if(typeof reason==="string"&&Object.prototype.hasOwnProperty.call(reasons,reason)){
   const p=document.createElement("p");p.className="muted";p.textContent=reasons[reason];
   analystPanel.append(title,explanation,p,link);
  }else{
   const p=document.createElement("p");p.className="muted";p.textContent="Varmennettua tavoitehintaa tai suositusta ei löytynyt tästä hausta.";
   analystPanel.append(title,explanation,p,link);
  }
  analystPanel.hidden=false;
 }catch{return}
}
const qualityPanel=document.createElement("section");
qualityPanel.className="ai-quality-card";qualityPanel.hidden=true;
qualityPanel.setAttribute("aria-label","Analyysin lähtötiedot");analysisHeader.after(qualityPanel);
function renderDataQuality(payload){
 qualityPanel.replaceChildren();
 const q=payload?.data_quality;
 if(!q){qualityPanel.hidden=true;return}
 qualityPanel.hidden=false;
 const h=document.createElement("strong");h.textContent="Lähtötietojen yhteenveto";qualityPanel.append(h);
 const fmtDate=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?"Aika puuttuu":d.toLocaleString("fi-FI",{dateStyle:"short",timeStyle:"short"})};
 const summary=document.createElement("div");summary.className="ai-quality-summary";
 const summaryRow=(label,value)=>{const row=document.createElement("div");row.className="ai-quality-summary-row";const a=document.createElement("span"),b=document.createElement("strong");a.textContent=label;b.textContent=value;row.append(a,b);summary.append(row)};
 summaryRow("Kurssi",q.quote_available?fmtDate(q.quote_observed_at)+" · epävirallinen":"Ei saatavilla");
 const reports=Array.isArray(q.financial_reports)?q.financial_reports:[];
 const report=reports[0]||null;
 const status=q.financial_data_status;
 summaryRow("Raportti",report?(report.period+" · "+(status==="verified_official_html"?"Tarkistettu":status==="source_link_only"?"Lähdeviite":"Päivätty")):"Ei saatavilla");
 qualityPanel.append(summary);
 const details=document.createElement("details");details.className="ai-quality-details";
 const label=document.createElement("summary");label.textContent="Näytä lähteet, talousluvut ja tarkistukset";details.append(label);
 const row=text=>{const p=document.createElement("p");p.textContent=text;details.append(p)};
 if(q.quote_available)row("Kurssihavainto: "+fmtDate(q.quote_observed_at)+" · "+(q.quote_source||"epävirallinen lähde")+(q.quote_stale?" · vanhentunut":""));
 else row("Kurssihavaintoa ei saatu.");
 if(Number.isFinite(q.quote_age_hours))row("Kurssihavainnon ikä: "+q.quote_age_hours.toLocaleString("fi-FI")+" tuntia");

 if(report){
  row("Raportti: "+(report.source||report.period)+" · "+report.published_at);
  row(status==="verified_official_html"?"Virallinen raporttisisältö tarkistettu tätä analyysiä varten":status==="source_link_only"?"Virallisen raportin lähdeviite, yksittäisiä talouslukuja ei vahvistettu":"Päivätty tilannekuva, ei uudelleentarkistettu");
  if(report.note){const notes=document.createElement("details"),summary=document.createElement("summary");summary.textContent="Raportin lisähuomautukset";const p=document.createElement("p");p.textContent=report.note;notes.append(summary,p);details.append(notes);}
  if(Array.isArray(report.metrics))for(const metric of report.metrics){if(typeof metric.value==="number"&&Number.isFinite(metric.value))row(metric.label+": "+metric.value.toLocaleString("fi-FI")+" "+metric.unit)}
  for(const [key,caption] of [["net_sales_reported","Liikevaihto"],["operating_profit_reported","Raportoitu liikevoitto"],["operating_profit_comparable","Vertailukelpoinen liikevoitto"]]){
   if(Number.isFinite(report[key]))row(caption+": "+report[key].toLocaleString("fi-FI")+" milj. €");
  }
  if(report.source_url){try{const url=new URL(report.source_url);if(url.protocol==="https:"){
   const a=document.createElement("a");a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Avaa raportin lähdesivu ↗";details.append(a);
  }}catch{}}
 }else row("Varmennettuja talousraporttitietoja ei ole.");
 const checks=q.financial_checks;
 if(checks)row("Marginaalitarkistus: "+(checks.reported_margin_matches&&checks.comparable_margin_matches?"Täsmää pyöristystarkkuudella":"Epäselvä, tarkistettava")+" · liikevoiton erotus "+checks.operating_profit_adjustment_million_eur+" milj. €");
 if(q.report_fetch?.attempted?.length)row("Raporttien tarkistusyrityksiä: "+q.report_fetch.attempted.length);
 const series=Array.isArray(q.price_sensitivity)?q.price_sensitivity:[];
 if(series.length){const nested=document.createElement("details"),sum=document.createElement("summary");sum.textContent="Hintaherkkyys ±10 % ja ±20 % (ei ennuste)";nested.append(sum);
  for(const item of series){if(!Number.isFinite(item.change_pct)||!Number.isFinite(item.hypothetical_price))continue;
   const p=document.createElement("p");p.textContent=(item.change_pct>0?"+":"")+item.change_pct+" %: "+item.hypothetical_price.toLocaleString("fi-FI",{maximumFractionDigits:4})+" "+(q.quote_currency||"");nested.append(p)}
  details.append(nested);
 }
 const pe=q.pe_sensitivity;
 if(pe&&Array.isArray(pe.scenarios)&&pe.scenarios.length===3){
  const box=document.createElement("section");box.className="ai-pe-panel";
  const title=document.createElement("h4");title.textContent="Osakekohtainen P/E-herkkyys";
  const caption=document.createElement("p");caption.textContent="Tilivuoden EPS "+Number(pe.annual_eps).toLocaleString("fi-FI",{maximumFractionDigits:2})+" USD · Havaittu kurssi "+Number(pe.observed_price).toLocaleString("fi-FI",{maximumFractionDigits:2})+" USD";
  const table=document.createElement("table");table.className="ai-scenario-table";
  const head=document.createElement("tr");
  for(const name of ["Skenaario","EPS","P/E","Ehdollinen hinta"]){const th=document.createElement("th");th.textContent=name;head.append(th)}
  const thead=document.createElement("thead");thead.append(head);table.append(thead);
  const tbody=document.createElement("tbody");
  for(const item of pe.scenarios){
   if(!["Bear","Base","Bull"].includes(item.name)||![item.assumed_eps,item.assumed_pe,item.conditional_price].every(Number.isFinite))continue;
   const tr=document.createElement("tr");
   for(const value of [item.name,item.assumed_eps.toLocaleString("fi-FI",{maximumFractionDigits:2})+" USD",item.assumed_pe.toLocaleString("fi-FI",{maximumFractionDigits:1}),item.conditional_price.toLocaleString("fi-FI",{minimumFractionDigits:2,maximumFractionDigits:2})+" USD"]){const td=document.createElement("td");td.textContent=value;tr.append(td)}
   tbody.append(tr);
  }
  table.append(tbody);
  const note=document.createElement("p");note.textContent="Bear: EPS −10 %, P/E −20 % · Base: ei muutosta · Bull: EPS +10 %, P/E +20 %. Ehdollinen laskelma, ei kurssiennuste tai tavoitehinta.";
  box.append(title,caption,table,note);details.append(box);
 }
 qualityPanel.append(details);
}
function showAnalysis(){analysisHeader.style.display="flex"}
closeAnalysis.addEventListener("click",()=>{result.textContent="";status.textContent="";analysisHeader.style.display="none";qualityPanel.hidden=true;analystPanel.hidden=true});
const tools=document.createElement("div");
tools.style.marginTop="16px";
tools.innerHTML='<button type="button" id="ai-save-report" disabled>Tallenna analyysi pilveen</button><button type="button" id="ai-load-reports" style="margin-left:8px">Näytä tallennetut</button><p id="ai-save-status" role="status" aria-live="polite"></p><div id="ai-report-list"></div>';
panel.querySelector("#ai-stock-result").before(tools);
tools.after(analysisHeader);
const saveButton=tools.querySelector("#ai-save-report"),loadButton=tools.querySelector("#ai-load-reports"),saveStatus=tools.querySelector("#ai-save-status"),reportList=tools.querySelector("#ai-report-list");
let currentReport=null;
async function currentUser(){const {data:{session},error}=await db.auth.getSession();if(error||!session?.user)return null;return session.user}
saveButton.addEventListener("click",async()=>{
 if(!currentReport)return;
 saveButton.disabled=true;saveStatus.textContent="Tallennetaan...";
 try{
 const user=await currentUser();if(!user)throw Error("Kirjaudu sisään");
 const {error}=await db.from("ai_research_reports").insert({user_id:user.id,query:currentReport.query,analysis:currentReport.analysis,live_data:false,generated_at:currentReport.generated_at});
 if(error)throw error;
 saveStatus.textContent="Analyysi tallennettu pilveen.";currentReport=null;
 }catch(err){saveStatus.textContent="Tallennus epäonnistui: "+err.message;saveButton.disabled=false}
});
reportList.hidden=true;
let reportsVisible=false;
loadButton.setAttribute("aria-expanded","false");
loadButton.addEventListener("click",async()=>{
 if(reportsVisible){reportsVisible=false;reportList.hidden=true;loadButton.textContent="Näytä tallennetut";loadButton.setAttribute("aria-expanded","false");saveStatus.textContent="";return}
 loadButton.disabled=true;saveStatus.textContent="Haetaan tallennettuja analyysejä...";
 try{
 const user=await currentUser();if(!user)throw Error("Kirjaudu sisään");
 const {data,error}=await db.from("ai_research_reports").select("id,query,analysis,generated_at").eq("user_id",user.id).order("generated_at",{ascending:false}).limit(20);
 if(error)throw error;
 reportList.replaceChildren();
 for(const report of data){
 const row=document.createElement("div");row.style.cssText="border-top:1px solid #353c50;padding:12px 0;display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;align-items:start";
 const open=document.createElement("button");open.type="button";open.textContent=report.query+" · "+new Date(report.generated_at).toLocaleString("fi-FI");
 open.style.cssText="min-width:0;max-width:100%;text-align:left;white-space:normal;overflow-wrap:anywhere";
 open.addEventListener("click",()=>{renderAnalysis(report.analysis);renderDataQuality(null);renderAnalystSources(null);status.textContent="Tallennettu analyysi · "+new Date(report.generated_at).toLocaleString("fi-FI");analysisTitle.textContent="Analyysi: "+report.query;showAnalysis();reportsVisible=false;reportList.hidden=true;loadButton.textContent="Näytä tallennetut";loadButton.setAttribute("aria-expanded","false");saveStatus.textContent="";analysisHeader.scrollIntoView({behavior:"smooth",block:"start"})});
 const menu=document.createElement("details");menu.style.cssText="position:relative;justify-self:end;width:44px";
 const toggle=document.createElement("summary");toggle.textContent="⋮";toggle.setAttribute("aria-label","Analyysin toiminnot: "+report.query);toggle.style.cssText="cursor:pointer;display:grid;place-items:center;width:44px;height:44px;border:1px solid #777;border-radius:8px;background:#303849;color:#fff;font-size:22px;list-style:none";
 menu.append(toggle);
 const actions=document.createElement("div");actions.style.cssText="display:flex;flex-direction:column;gap:8px;position:absolute;right:0;top:46px;z-index:5;min-width:185px;padding:10px;background:#242b3a;border:1px solid #535c73;border-radius:10px;box-shadow:0 6px 18px #0009";
 const update=document.createElement("button");update.type="button";update.textContent="Päivitä analyysi";
 update.addEventListener("click",async()=>{
 if(!confirm("Päivitetäänkö analyysi: "+report.query+"? Tämä käyttää yhden AI-analyysikiintiön."))return;
 if(!navigator.onLine){saveStatus.textContent="Päivitys vaatii verkkoyhteyden.";return}
 update.disabled=true;update.textContent="Päivitetään…";saveStatus.textContent="Päivitetään: "+report.query;
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error("Kirjaudu sisään");
  // Verify update permission BEFORE spending an AI request. Rewriting the same text is harmless.
  const {data:preflight,error:preflightError}=await db.from("ai_research_reports").update({analysis:report.analysis}).eq("id",report.id).eq("user_id",session.user.id).select("id");
  if(preflightError)throw Error("Tallenteen päivitysoikeus puuttuu: "+preflightError.message);
  if(!preflight?.length)throw Error("Tallennetta ei voi päivittää. AI-hakua ei tehty eikä kiintiötä kulutettu.");
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000);
  let response;
  try{response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/stock-reseach",{
   method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE"},body:JSON.stringify({query:report.query})
  })}finally{clearTimeout(timeout)}
  const payload=await response.json();
  if(!response.ok)throw Error(payload.error||"AI-palvelinvirhe ("+response.status+")");
  if(!payload.analysis)throw Error("Analyysiteksti puuttuu");
  const generatedAt=payload.generated_at||new Date().toISOString();
  const {data:updated,error}=await db.from("ai_research_reports").update({analysis:payload.analysis,generated_at:generatedAt,live_data:false}).eq("id",report.id).eq("user_id",session.user.id).select("id");
  if(error)throw error;
  if(!updated?.length){renderAnalysis(payload.analysis);analysisTitle.textContent="Uusi analyysi (tallennus epäonnistui): "+report.query;showAnalysis();throw Error("Uusi analyysi näkyy sivulla mutta ei tallentunut. Älä sulje sivua ennen tekstin kopiointia.");}
  report.analysis=payload.analysis;report.generated_at=generatedAt;
  open.textContent=report.query+" · "+new Date(generatedAt).toLocaleString("fi-FI");
  renderAnalysis(payload.analysis);renderDataQuality(payload);renderAnalystSources(payload);status.textContent="Päivitetty analyysi · "+new Date(generatedAt).toLocaleString("fi-FI")+" · "+describeDataQuality(payload);
  analysisTitle.textContent="Analyysi: "+report.query;showAnalysis();
  reportsVisible=false;reportList.hidden=true;loadButton.textContent="Näytä tallennetut";loadButton.setAttribute("aria-expanded","false");
  saveStatus.textContent="Analyysi päivitetty ja tallennettu.";analysisHeader.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){saveStatus.textContent="Päivitys epäonnistui: "+(err.name==="AbortError"?"Aikakatkaisu":err.message)}
 finally{update.disabled=false;update.textContent="Päivitä analyysi";await refreshUsage()}
});
 const remove=document.createElement("button");remove.type="button";remove.textContent="Poista";remove.className="danger-btn";
 remove.addEventListener("click",async()=>{if(!confirm("Poistetaanko tallennettu analyysi: "+report.query+"? Tätä ei voi perua."))return;remove.disabled=true;try{const user=await currentUser();if(!user)throw Error("Kirjaudu sisään");const {data,error}=await db.from("ai_research_reports").delete().eq("id",report.id).eq("user_id",user.id).select("id");if(error)throw error;if(!data?.length)throw Error("Poistoa ei vahvistettu. Tarkista tietokannan DELETE-oikeus.");row.remove();saveStatus.textContent="Analyysi poistettu."}catch(err){saveStatus.textContent="Poisto epäonnistui: "+err.message;remove.disabled=false}});
 actions.append(update,remove);menu.append(actions);row.append(open,menu);reportList.append(row);
 }
 reportsVisible=true;reportList.hidden=false;loadButton.textContent="Piilota tallennetut";loadButton.setAttribute("aria-expanded","true");
 saveStatus.textContent=data.length?"Tallennetut analyysit: "+data.length:"Ei tallennettuja analyysejä.";
 }catch(err){saveStatus.textContent="Haku epäonnistui: "+err.message}
 finally{loadButton.disabled=false}
});
panel.querySelector("form").addEventListener("submit",async e=>{
 e.preventDefault();
 const query=panel.querySelector("#ai-stock-query").value.trim();
 if(query.length<2)return;
 if(!navigator.onLine){status.textContent="AI-analyysi vaatii verkkoyhteyden.";return}
 identityChoices.replaceChildren();qualityPanel.replaceChildren();qualityPanel.hidden=true;analystPanel.hidden=true;status.textContent="";saveStatus.textContent="";button.disabled=true;button.textContent="Analyysi käynnissä…";saveButton.disabled=true;currentReport=null;result.textContent="";analysisHeader.style.display="none";status.textContent="Tarkistetaan kirjautuminen...";
 try{
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session?.access_token){status.textContent="Kirjaudu ensin sisään Asetukset-osiossa.";return}
  status.textContent="Testataan yhteyttä AI-funktioon...";
  status.textContent="Laaditaan analyysiä...";
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),35000);
  let response;
  try{response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/stock-reseach",{
   method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE"},body:JSON.stringify({query})
  })}finally{clearTimeout(timeout)}
  const payload=await response.json();
  if(!response.ok){showIdentityChoices(payload);throw new Error(payload.error||"Palvelinvirhe ("+response.status+")")}
  status.textContent="Analyysi valmis · "+new Date(payload.generated_at).toLocaleString("fi-FI")+" · "+describeDataQuality(payload);
  renderAnalysis(payload.analysis||"Analyysiteksti puuttuu.");renderDataQuality(payload);renderAnalystSources(payload);
  if(payload.analysis){analysisTitle.textContent="Analyysi: "+query;showAnalysis()}
  if(payload.analysis){currentReport={query,analysis:payload.analysis,generated_at:payload.generated_at};saveButton.disabled=false}
 }catch(err){status.textContent=err.name==="AbortError"?"Pyyntö aikakatkaistiin.":("Analyysi epäonnistui: "+err.message)}
 finally{button.disabled=false;button.textContent="Laadi analyysi";await refreshUsage()}
});
