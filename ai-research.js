import {describeEvidence} from "./ai-data-quality.mjs";
// Research UI: explicit user-triggered AI request, never runs trades.
const db=window.agentSupabaseClient;
const view=document.getElementById("view-research");
const panel=document.createElement("section");
panel.className="panel form-panel";
panel.innerHTML='<h2>AI-osaketutkimus (testi)</h2><p class="muted">Alustava AI-analyysi. Kurssihavainto voidaan hakea tuetuille tickereille, mutta se voi olla viivästynyt. Talouslukuja käytetään vain päivätystä Nokia-tilannekuvasta tai rajatusti virallisesta raporttitaulukosta tarkistettuina. Muilla yhtiöillä talousluvut voivat puuttua. AI-palvelu voi aiheuttaa API-kuluja.</p><form id="ai-stock-form"><label for="ai-stock-query">Yhtiö tai ticker</label><input id="ai-stock-query" maxlength="160" minlength="2" required placeholder="Esim. Nokia" style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:8px 0 12px;background:#10141f;color:#fff;border:1px solid #353c50;border-radius:8px"><button class="primary-btn" id="ai-stock-submit" type="submit">Laadi analyysi</button></form><p id="ai-stock-status" role="status" aria-live="polite"></p><div id="ai-stock-result" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6"></div>';
const usage=document.createElement("div");
usage.style.cssText="margin:12px 0 20px";
usage.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px"><strong>Päivän AI-analyysit</strong><span id="ai-usage-count">Ladataan…</span></div><progress id="ai-usage-progress" max="5" value="0" style="width:100%;height:12px;margin-top:8px"></progress><p class="muted" id="ai-usage-reset" style="margin-top:4px"></p>';
usage.insertAdjacentHTML("beforeend",'<div style="margin-top:12px;display:flex;justify-content:space-between;gap:12px"><strong>Koko palvelun analyysit</strong><span id="ai-global-count">Ladataan…</span></div><progress id="ai-global-progress" max="10" value="0" style="width:100%;height:12px;margin-top:8px"></progress><p class="muted" id="ai-global-reset" style="margin-top:4px"></p>');
panel.insertBefore(usage,panel.querySelector("form"));
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
function renderAnalysis(raw){
 result.replaceChildren();
 const text=String(raw||"").trim();
 const sections=[];let current={title:"Tiivistelmä",lines:[]};
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
  const intro=document.createElement("section");const label=document.createElement("strong");label.textContent="Tiivistelmä";intro.append(label,block(paragraphs[0]));result.append(intro);
  const details=document.createElement("details");details.style.marginTop="14px";const sum=document.createElement("summary");sum.textContent="Näytä koko analyysi";sum.style.cursor="pointer";details.append(sum,block(paragraphs.slice(1).join("\n\n")));result.append(details);return;
 }
 const index=sections.findIndex(x=>/tiivistelmä|yhteenveto/i.test(x.title));
 const intro=sections.splice(index>=0?index:0,1)[0];
 const title=document.createElement("strong");title.textContent="Tiivistelmä";result.append(title,block(intro.lines.join("\n")));
 for(const part of sections){
  const details=document.createElement("details");details.style.cssText="border-top:1px solid #353c50;padding:12px 0";
  const sum=document.createElement("summary");sum.textContent=part.title;sum.style.cssText="cursor:pointer;font-weight:600";
  details.append(sum,block(part.lines.join("\n")));result.append(details);
 }
}
function describeDataQuality(payload){return describeEvidence(payload?.data_quality)}
const qualityPanel=document.createElement("section");
qualityPanel.style.cssText="display:none;border:1px solid #353c50;border-radius:10px;padding:12px;margin:12px 0;line-height:1.6";
qualityPanel.setAttribute("aria-label","Analyysin tietolähteet");
analysisHeader.after(qualityPanel);
function renderDataQuality(payload){
 qualityPanel.replaceChildren();
 const quality=payload?.data_quality;
 if(!quality){qualityPanel.style.display="none";return}
 qualityPanel.style.display="block";
 const title=document.createElement("strong");title.textContent="Lähtötietojen laatu";qualityPanel.append(title);
 const row=(text)=>{const p=document.createElement("p");p.style.margin="6px 0";p.textContent=text;qualityPanel.append(p)};
 if(quality.quote_available&&quality.quote_observed_at){
  const date=new Date(quality.quote_observed_at);
  row("Kurssi: "+(Number.isNaN(date.getTime())?"aika tuntematon":date.toLocaleString("fi-FI"))+" · epävirallinen, mahdollisesti viivästynyt");
 }else row("Kurssi: ajantasaista havaintoa ei saatu");
 if(quality.financial_data_status==="verified_official_html")row("Talousluvut tarkistettiin tämän analyysin aikana Nokian virallisesta HTML-raporttitaulukosta.");
 else if(quality.financial_data_status==="dated_snapshot_only")row("Talousluvut perustuvat aiemmin tarkistettuun päivättyyn tilannekuvaan. Virallisen HTML-raportin automaattista tarkistusta ei saatu vahvistettua.");
 else if(!quality.financial_data_status&&quality.financial_reports_verified)row("Analyysin taustapalvelu ei vielä ilmoita automaattisen raporttitarkistuksen tilaa.");
 if(quality.quote_stale)row("Varoitus: viimeisin kurssihavainto on vanhentunut eikä sovellu nykyhintaan.");
 if(Number.isFinite(quality.quote_age_hours))row("Kurssihavainnon ikä: "+quality.quote_age_hours.toLocaleString("fi-FI")+" tuntia.");
 const sensitivity=quality.price_sensitivity;
 if(Array.isArray(sensitivity)&&sensitivity.length){
  const details=document.createElement("details"),title=document.createElement("summary");
  title.textContent="Hintaherkkyys ±10 % ja ±20 % (ei ennuste eikä suositus)";details.append(title);
  const currency=quality.quote_currency||"";
  for(const point of sensitivity){if(!Number.isFinite(point.change_pct)||!Number.isFinite(point.hypothetical_price))continue;
   const line=document.createElement("p");line.textContent=(point.change_pct>0?"+":"")+point.change_pct+" %: "+point.hypothetical_price.toLocaleString("fi-FI",{maximumFractionDigits:4})+" "+currency;details.append(line)}
  qualityPanel.append(details);
 }
 if(Number.isFinite(quality.report_age_days))row("Raportin ikä: "+quality.report_age_days+" päivää · raportti ei ole reaaliaikainen");
 if(quality.financial_reports?.length){
  for(const report of quality.financial_reports){
   row("Raportti: "+report.period+" · julkaistu "+report.published_at+" · "+(quality.financial_data_status==="verified_official_html"?"tarkistettu virallisesta HTML-taulukosta":"päivätty tilannekuva, ei tarkistettu uudelleen"));
   if(typeof report.net_sales_reported==="number")row("Liikevaihto: "+report.net_sales_reported.toLocaleString("fi-FI")+" milj. €");
   if(typeof report.operating_profit_reported==="number"&&typeof report.operating_profit_comparable==="number")row("Liikevoitto: raportoitu "+report.operating_profit_reported+" milj. € · vertailukelpoinen "+report.operating_profit_comparable+" milj. €");
   if(report.source_url){
    try{const url=new URL(report.source_url);if(url.protocol==="https:"){const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Avaa virallinen raportti ↗";link.style.color="#9cc5ff";qualityPanel.append(link)}}catch{}
   }
  }
  const checks=quality.financial_checks;
  if(checks){
   row("Marginaalien laskentatarkistus: "+(checks.reported_margin_matches&&checks.comparable_margin_matches?"täsmää pyöristystarkkuudella":"ristiriita – tarkista lähdeluvut"));
   row("Liikevoittojen erotus: "+checks.operating_profit_adjustment_million_eur+" milj. € (syitä ei päätellä)");
  }
 }else row("Talousraportit: ei varmennettuja lukuja");
 const fetched=quality.report_fetch;
 if(fetched?.status==="not_verified_from_live_html")row("Automaattista raporttitietojen poimintaa ei voitu varmentaa.");
 if(fetched?.attempted?.length)row("Virallisten raporttiosoitteiden tarkistusyrityksiä: "+fetched.attempted.length);
 const discovery=quality.report_discovery;
 if(discovery)row("Raporttihakemisto: "+(discovery.reachable?"tavoitettavissa":"ei tavoitettavissa")+" · ei todista uusimman raportin sisältöä");
 if(discovery?.candidate_reports?.some(item=>item.newer_than_snapshot===true))row("Huomio: löytyi mahdollisesti uudempi raporttilinkki. Talouslukuja ei ole päivitetty ilman varmennusta.");
 if(discovery?.candidate_urls?.length){
  const details=document.createElement("details");details.style.marginTop="8px";
  const summary=document.createElement("summary");summary.textContent="Mahdollisia raporttilinkkejä ("+discovery.candidate_urls.length+") · ei varmennettuja";details.append(summary);
  for(const href of discovery.candidate_urls.slice(0,12)){
   try{const url=new URL(href);if(url.protocol!=="https:"||url.hostname!=="www.nokia.com")continue;
    const p=document.createElement("p");p.style.margin="7px 0";
    const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";const candidate=discovery.candidate_reports?.find(item=>item.url===href);
    link.textContent=(candidate?.period?candidate.period+" · ":"")+(url.pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g," ")||"Nokia");
    if(candidate?.newer_than_snapshot===true){const note=document.createElement("span");note.textContent=" · Mahdollisesti uudempi – ei varmennettu";p.append(note)}link.style.color="#9cc5ff";p.append(link);details.append(p);
   }catch{}
  }
  qualityPanel.append(details);
 }

}
function showAnalysis(){analysisHeader.style.display="flex"}
closeAnalysis.addEventListener("click",()=>{result.textContent="";status.textContent="";analysisHeader.style.display="none";qualityPanel.style.display="none"});
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
 open.addEventListener("click",()=>{renderAnalysis(report.analysis);renderDataQuality(null);status.textContent="Tallennettu analyysi · "+new Date(report.generated_at).toLocaleString("fi-FI");analysisTitle.textContent="Analyysi: "+report.query;showAnalysis();reportsVisible=false;reportList.hidden=true;loadButton.textContent="Näytä tallennetut";loadButton.setAttribute("aria-expanded","false");saveStatus.textContent="";analysisHeader.scrollIntoView({behavior:"smooth",block:"start"})});
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
  renderAnalysis(payload.analysis);renderDataQuality(payload);status.textContent="Päivitetty analyysi · "+new Date(generatedAt).toLocaleString("fi-FI")+" · "+describeDataQuality(payload);
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
 button.disabled=true;button.textContent="Analyysi käynnissä…";saveButton.disabled=true;currentReport=null;result.textContent="";analysisHeader.style.display="none";status.textContent="Tarkistetaan kirjautuminen...";
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
  if(!response.ok)throw new Error(payload.error||"Palvelinvirhe ("+response.status+")");
  status.textContent="Analyysi valmis · "+new Date(payload.generated_at).toLocaleString("fi-FI")+" · "+describeDataQuality(payload);
  renderAnalysis(payload.analysis||"Analyysiteksti puuttuu.");renderDataQuality(payload);
  if(payload.analysis){analysisTitle.textContent="Analyysi: "+query;showAnalysis()}
  if(payload.analysis){currentReport={query,analysis:payload.analysis,generated_at:payload.generated_at};saveButton.disabled=false}
 }catch(err){status.textContent=err.name==="AbortError"?"Pyyntö aikakatkaistiin.":("Analyysi epäonnistui: "+err.message)}
 finally{button.disabled=false;button.textContent="Laadi analyysi";await refreshUsage()}
});
