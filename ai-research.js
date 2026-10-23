// Research UI: explicit user-triggered AI request, never runs trades.
const db=window.agentSupabaseClient;
const view=document.getElementById("view-research");
const panel=document.createElement("section");
panel.className="panel form-panel";
panel.innerHTML='<h2>AI-osaketutkimus (testi)</h2><p class="muted">Alustava analyysi ilman reaaliaikaisia kursseja tai verkkolähteitä. AI-palvelu voi aiheuttaa API-kuluja.</p><form id="ai-stock-form"><label for="ai-stock-query">Yhtiö tai ticker</label><input id="ai-stock-query" maxlength="160" minlength="2" required placeholder="Esim. Nokia" style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:8px 0 12px;background:#10141f;color:#fff;border:1px solid #353c50;border-radius:8px"><button class="primary-btn" id="ai-stock-submit" type="submit">Laadi analyysi</button></form><p id="ai-stock-status" role="status" aria-live="polite"></p><div id="ai-stock-result" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6"></div>';
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
function showAnalysis(){analysisHeader.style.display="flex"}
closeAnalysis.addEventListener("click",()=>{result.textContent="";status.textContent="";analysisHeader.style.display="none"});
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
 const row=document.createElement("div");row.style.cssText="border-top:1px solid #353c50;padding:12px 0";
 const open=document.createElement("button");open.type="button";open.textContent=report.query+" · "+new Date(report.generated_at).toLocaleString("fi-FI");
 open.addEventListener("click",()=>{result.textContent=report.analysis;status.textContent="Tallennettu analyysi · "+new Date(report.generated_at).toLocaleString("fi-FI");showAnalysis()});
 row.append(open);reportList.append(row);
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
  status.textContent="Analyysi valmis · Ei reaaliaikaista markkinadataa · "+new Date(payload.generated_at).toLocaleString("fi-FI");
  result.textContent=payload.analysis||"Analyysiteksti puuttuu.";
  if(payload.analysis)showAnalysis();
  if(payload.analysis){currentReport={query,analysis:payload.analysis,generated_at:payload.generated_at};saveButton.disabled=false}
 }catch(err){status.textContent=err.name==="AbortError"?"Pyyntö aikakatkaistiin.":("Analyysi epäonnistui: "+err.message)}
 finally{button.disabled=false;button.textContent="Laadi analyysi";await refreshUsage()}
});
