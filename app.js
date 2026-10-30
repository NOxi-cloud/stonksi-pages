(() => {
"use strict";
const LEGACY_KEY="oma-agentti-v1";
let activeUid=null;
let adminVerified=false;
const RESTRICTED_VIEWS=new Set(["development","approvals"]);
function applyAdminAccess(){
 document.querySelectorAll("[data-admin-only]").forEach(node=>{
  node.hidden=!adminVerified;
  if(node.tagName==="OPTION")node.disabled=!adminVerified;
 });
 if(!adminVerified&&document.querySelector(".view.active[data-admin-only]"))showView("home");
}
document.addEventListener("agent:admin-access",event=>{
 if(!activeUid||event.detail?.uid!==activeUid)return;
 adminVerified=event.detail.isAdmin===true;
 applyAdminAccess();
});
const scopedKey=()=>activeUid?`oma-agentti-local-v2-${activeUid}`:null;
const defaultState={tasks:[],approvals:[],research:[],memories:[],stocks:[{id:"s1",name:"Nokia",ticker:"NOKIA",exchange:"Helsinki"},{id:"s2",name:"Metso",ticker:"METSO",exchange:"Helsinki"},{id:"s3",name:"Wärtsilä",ticker:"WRT1V",exchange:"Helsinki"},{id:"s4",name:"Kesko B",ticker:"KESKOB",exchange:"Helsinki"}],activity:[{id:"e1",text:"PWA:n paikallinen käyttöliittymä avattiin.",time:Date.now()}]};
let state=structuredClone(defaultState),toastTimer,cloudMode=false;
let localSnapshot=structuredClone(state);
window.agentLocalBridge={setUser(uid){
 const next=uid||null;
 if(activeUid===next)return;
 activeUid=next;cloudMode=false;
 adminVerified=false;applyAdminAccess();
 state=next?loadState():structuredClone(defaultState);
 localSnapshot=structuredClone(state);
 render();
},legacyAvailable(){return !!localStorage.getItem(LEGACY_KEY)}};
window.agentTaskBridge={set(tasks){if(!cloudMode){/* Legacy data stays untouched until explicit import. */}cloudMode=true;state.tasks=tasks;render()},disable(){if(cloudMode){cloudMode=false;state.tasks=localSnapshot.tasks;render()}}};
window.agentApprovalBridge={set(items){state.approvals=items;render()},get(){return structuredClone(state.approvals)}};
function approvalChange(item){document.dispatchEvent(new CustomEvent("agent:approval-change",{detail:{item}}))}
window.agentStockBridge={set(items){state.stocks=items;render()},get(){return structuredClone(state.stocks)}};
function stockChange(action,item,id){document.dispatchEvent(new CustomEvent("agent:stock-change",{detail:{action,item,id}}))}
window.agentResearchBridge={set(items){state.research=items;render()},get(){return structuredClone(state.research)}};
function researchChange(action,item,id){document.dispatchEvent(new CustomEvent('agent:research-change',{detail:{action,item,id}}));}
function cloudChange(action,task,id){if(cloudMode)document.dispatchEvent(new CustomEvent("agent:task-change",{detail:{action,task,id}}));}
function validLocalEntry(kind,item){
 if(!item||typeof item!=="object"||Array.isArray(item))return false;
 const stringFields={tasks:["id","title","priority","category"],approvals:["id","title","status"],research:["id","query"],memories:["id","title","body"],stocks:["id","name","ticker"],activity:["id","text"]};
 if(!stringFields[kind].every(k=>typeof item[k]==="string"))return false;
 if(kind==="tasks"&&typeof item.done!=="boolean")return false;
 if(kind==="approvals"&&item.detail!=null&&typeof item.detail!=="string")return false;
 if(kind==="stocks"&&item.exchange!=null&&typeof item.exchange!=="string")return false;
 return true;
}
function sanitizeLocalState(parsed){
 const result=structuredClone(defaultState);
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return result;
 for(const kind of ["tasks","approvals","research","memories","stocks","activity"]){
  if(Array.isArray(parsed[kind]))result[kind]=parsed[kind].filter(item=>validLocalEntry(kind,item)).slice(0,5000);
 }
 return result;
}
function loadState(){try{const key=scopedKey();if(!key)return structuredClone(defaultState);const raw=localStorage.getItem(key);if(!raw)return structuredClone(defaultState);return sanitizeLocalState(JSON.parse(raw))}catch{return structuredClone(defaultState)}}
function save(){try{const key=scopedKey();if(!key)return;if(cloudMode){const local=JSON.parse(localStorage.getItem(key)||"{}");localStorage.setItem(key,JSON.stringify({...state,tasks:local.tasks||localSnapshot.tasks}));}else localStorage.setItem(key,JSON.stringify(state))}catch{notify("Tallennus epäonnistui. Tarkista selaimen tallennustila.")}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function id(p){return p+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)}
function dateLabel(t){try{return new Intl.DateTimeFormat("fi-FI",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(t))}catch{return ""}}
function log(text){state.activity.unshift({id:id("e"),text,time:Date.now()});state.activity=state.activity.slice(0,12)}
function notify(message){const el=document.getElementById("toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function empty(message){return '<div class="empty-state"><div class="empty-symbol">✳</div>'+esc(message)+'</div>'}
function taskMarkup(t){const pc=t.priority==="Korkea"?"high":t.priority==="Matala"?"low":"";return '<div class="task-row" data-id="'+esc(t.id)+'"><input class="task-check" type="checkbox" aria-label="Merkitse valmiiksi" data-action="toggle-task" data-id="'+esc(t.id)+'" '+(t.done?"checked":"")+'><div class="task-copy"><div class="task-title '+(t.done?"done":"")+'">'+esc(t.title)+'</div><div class="task-meta"><span class="priority '+pc+'">'+esc(t.priority)+'</span><span>'+esc(t.category)+'</span><span>· '+dateLabel(t.created)+'</span></div></div><button class="icon-btn" data-action="delete-task" data-id="'+esc(t.id)+'" aria-label="Poista tehtävä">×</button></div>'}
function approvalMarkup(a){if(a.status!=="pending")return '<div class="task-row"><span class="stat-icon '+(a.status==="approved"?"green":"amber")+'">'+(a.status==="approved"?"✓":"×")+'</span><div class="task-copy"><div class="task-title">'+esc(a.title)+'</div><div class="task-meta"><span>'+(a.status==="approved"?"Hyväksytty":"Hylätty")+'</span><span>· '+dateLabel(a.created)+'</span></div></div></div>';return '<div class="task-row"><span class="stat-icon amber">◷</span><div class="task-copy"><div class="task-title">'+esc(a.title)+'</div><div class="task-meta">'+esc(a.detail||"Odottaa käyttäjän päätöstä.")+'</div><div class="form-actions" style="justify-content:flex-start;margin-top:10px"><button class="primary-btn" data-action="approve" data-id="'+esc(a.id)+'">Hyväksy</button><button class="secondary-btn" data-action="reject" data-id="'+esc(a.id)+'">Hylkää</button></div></div></div>'}
function render(){const open=state.tasks.filter(t=>!t.done),pending=state.approvals.filter(a=>a.status==="pending");document.getElementById("stat-tasks").textContent=open.length;document.getElementById("stat-approvals").textContent=pending.length;document.getElementById("stat-stocks").textContent=state.stocks.length;document.getElementById("nav-task-count").textContent=open.length;document.getElementById("nav-approval-count").textContent=pending.length;document.getElementById("task-count-label").textContent=state.tasks.length+" tehtävää";document.getElementById("approval-count-label").textContent=pending.length+" odottaa";document.getElementById("home-task-list").innerHTML=open.length?open.slice(0,4).map(taskMarkup).join(""):empty("Ei avoimia tehtäviä. Lisää uusi tehtävä, kun haluat jatkaa.");document.getElementById("all-task-list").innerHTML=state.tasks.length?state.tasks.slice().sort((a,b)=>Number(a.done)-Number(b.done)).map(taskMarkup).join(""):empty("Tehtävälista on tyhjä.");document.getElementById("approval-list").innerHTML=state.approvals.length?state.approvals.slice().reverse().map(approvalMarkup).join(""):empty("Ei hyväksyntää odottavia ehdotuksia.");document.getElementById("research-list").innerHTML=state.research.length?state.research.slice().reverse().map(r=>'<div class="task-row"><div class="task-copy"><div class="task-title">'+esc(r.query)+'</div><div class="task-meta">Tallennettu '+dateLabel(r.created)+'</div></div><button class="icon-btn" data-action="delete-research" data-id="'+esc(r.id)+'" aria-label="Poista tutkimusaihe">×</button></div>').join(""):empty("Tutkimusjono on tyhjä. Tallenna aihe yllä olevalla lomakkeella.");document.getElementById("memory-list").innerHTML=state.memories.length?state.memories.slice().reverse().map(m=>'<div class="task-row"><div class="task-copy"><div class="task-title">'+esc(m.title)+'</div><p class="muted" style="margin-top:6px;white-space:pre-wrap">'+esc(m.body)+'</p><div class="task-meta">'+dateLabel(m.created)+'</div></div><button class="icon-btn" data-action="delete-memory" data-id="'+esc(m.id)+'" aria-label="Poista muistiinpano">×</button></div>').join(""):empty("Ei tallennettuja muistiinpanoja.");document.getElementById("activity-list").innerHTML=state.activity.length?state.activity.slice(0,5).map(a=>'<div class="activity-item"><span class="activity-mark"></span><span>'+esc(a.text)+'</span><span class="activity-time">'+dateLabel(a.time)+'</span></div>').join(""):empty("Ei tapahtumia vielä.");document.getElementById("stock-table").innerHTML=state.stocks.map(stock=>{
 const price=stock.price==null?null:Number(stock.price);
 const change=stock.change==null?null:Number(stock.change);
 const percent=stock.change_percent==null?null:Number(stock.change_percent);
 const currency=stock.currency||"";
 const time=stock.price_time&&Number.isFinite(Date.parse(stock.price_time))?new Date(stock.price_time).toLocaleString("fi-FI"):null;
 const priceText=price!==null&&Number.isFinite(price)?new Intl.NumberFormat("fi-FI",{maximumFractionDigits:4}).format(price)+" "+currency:"Ei kurssia";
 const changeText=change!==null&&percent!==null&&Number.isFinite(change)&&Number.isFinite(percent)?(change>=0?"+":"")+new Intl.NumberFormat("fi-FI",{maximumFractionDigits:4}).format(change)+" "+currency+" / "+(percent>=0?"+":"")+new Intl.NumberFormat("fi-FI",{maximumFractionDigits:2}).format(percent)+" %":"—";
 return '<tr><td class="stock-name"><button type="button" class="stock-open-chart" data-stock-chart="'+esc(stock.id)+'" aria-label="Avaa osakkeen '+esc(stock.name)+' kurssigraafi">'+esc(stock.name)+'</button></td><td class="stock-ticker">'+esc(stock.ticker)+'</td><td>'+esc(stock.exchange)+'</td><td class="table-status">'+esc(priceText)+'</td><td>'+esc(changeText)+'</td><td>'+esc(time||"—")+'</td><td><button class="icon-btn" data-action="delete-stock" data-id="'+esc(stock.id)+'" aria-label="Poista osake">×</button></td></tr>';
}).join("");save()}
function showView(name){if(RESTRICTED_VIEWS.has(name)&&!adminVerified)name="home";const target=document.getElementById("view-"+name);if(!target)return;document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v===target));document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",name===b.dataset.view&&b.classList.contains("nav-item")));window.scrollTo({top:0,behavior:"smooth"});document.dispatchEvent(new CustomEvent("agent:view-changed",{detail:{view:name}}))}
applyAdminAccess();
function showTaskForm(){showView("tasks");document.getElementById("task-form").classList.remove("hidden");document.getElementById("task-title").focus()}
document.addEventListener("click",e=>{const v=e.target.closest("[data-view]");if(v){e.preventDefault();showView(v.dataset.view);return}const chartButton=e.target.closest("[data-stock-chart]");if(chartButton){document.dispatchEvent(new CustomEvent("agent:open-stock-chart",{detail:{id:chartButton.dataset.stockChart}}));return}const b=e.target.closest("[data-action]");if(!b)return;const a=b.dataset.action,itemId=b.dataset.id;if(a==="new-task"){showTaskForm();return}if(a==="cancel-task"){document.getElementById("task-form").classList.add("hidden");return}if(a==="toggle-task"){const t=state.tasks.find(x=>x.id===itemId);if(t){t.done=b.checked;log((t.done?"Tehtävä merkitty valmiiksi: ":"Tehtävä avattu: ")+t.title);render();cloudChange("upsert",t)}return}if(a==="delete-task"){state.tasks=state.tasks.filter(t=>t.id!==itemId);log("Tehtävä poistettiin.");render();cloudChange("delete",null,itemId);notify("Tehtävä poistettu.");return}if(a==="approve"||a==="reject"){const item=state.approvals.find(x=>x.id===itemId);if(item){item.status=a==="approve"?"approved":"rejected";approvalChange(item);log((a==="approve"?"Hyväksytty paikallisesti: ":"Hylätty paikallisesti: ")+item.title);render();notify("Päätös tallennettu; synkronointi käynnistyy verkkoyhteydellä.")}return}if(a==="delete-research"){state.research=state.research.filter(r=>r.id!==itemId);render();researchChange("delete",null,itemId);return}if(a==="delete-memory"){state.memories=state.memories.filter(m=>m.id!==itemId);log("Muistiinpano poistettiin.");render();return}if(a==="delete-stock"){state.stocks=state.stocks.filter(s=>s.id!==itemId);render();stockChange("delete",null,itemId);notify("Osake poistettu seurannasta.")}});
document.querySelectorAll(".notice-close").forEach(b=>b.addEventListener("click",()=>b.closest(".notice")?.remove()));
document.getElementById("task-form").addEventListener("submit",e=>{e.preventDefault();const title=document.getElementById("task-title").value.trim();if(!title)return;const newTask={id:crypto.randomUUID(),title,priority:document.getElementById("task-priority").value,category:document.getElementById("task-category").value,done:false,created:Date.now()};state.tasks.unshift(newTask);log("Uusi tehtävä lisättiin: "+title);e.currentTarget.reset();e.currentTarget.classList.add("hidden");render();cloudChange("upsert",newTask);notify("Tehtävä tallennettu.")});
document.getElementById("research-form").addEventListener("submit",e=>{e.preventDefault();const query=document.getElementById("research-query").value.trim();if(!query)return;const item={id:id("r"),query,created:Date.now()};state.research.push(item);researchChange("upsert",item);log("Tutkimusaihe lisättiin jonoon.");e.currentTarget.reset();render();notify("Tutkimusaihe tallennettu.")});
document.getElementById("memory-form").addEventListener("submit",e=>{e.preventDefault();const title=document.getElementById("memory-title").value.trim(),body=document.getElementById("memory-body").value.trim();if(!title||!body)return;state.memories.push({id:id("m"),title,body,created:Date.now()});log("Muistiinpano tallennettiin: "+title);e.currentTarget.reset();render();notify("Muistiinpano tallennettu.")});
document.getElementById("add-stock-btn").addEventListener("click",()=>document.dispatchEvent(new Event("agent:open-stock-search")));
document.getElementById("export-data").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="oma-agentti-varmuuskopio.json";link.click();URL.revokeObjectURL(url);notify("Varmuuskopion vienti käynnistetty.")});
document.getElementById("clear-data").addEventListener("click",()=>{if(!confirm("Poistetaanko tämän sovelluksen paikalliset tehtävät, muistiinpanot ja asetukset tältä laitteelta? Tätä ei voi perua."))return;if(scopedKey())localStorage.removeItem(scopedKey());state=structuredClone(defaultState);localSnapshot=structuredClone(state);render();notify("Paikalliset tiedot palautettu oletuksiin.")});
document.getElementById("footer-date").textContent=new Intl.DateTimeFormat("fi-FI",{dateStyle:"medium"}).format(new Date());
if("serviceWorker"in navigator&&location.protocol!=="file:")window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
render();
})();

// Check published release independently of Supabase and AI quotas.
const stonksiVersionBadge=document.getElementById("stonksi-version-status");
const stonksiCurrentVersion=document.querySelector('meta[name="stonksi-version"]')?.content||"tuntematon";
async function checkStonksiVersion(){
 if(!stonksiVersionBadge)return;
 try{
  const url=new URL("./index.html",location.href);url.searchParams.set("_release_check",String(Date.now()));
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok)throw Error("Version check failed");
  const html=await response.text();
  const latest=html.match(/<meta\s+name="stonksi-version"\s+content="([^"]+)"/)?.[1];
  if(!latest)throw Error("Missing version");
  const current=latest===stonksiCurrentVersion;
  stonksiVersionBadge.textContent="v"+stonksiCurrentVersion+" · "+(current?"Ajantasalla":"Vanhentunut – päivitä");
  stonksiVersionBadge.style.color=current?"#69d5a4":"#f2bd68";
  stonksiVersionBadge.disabled=current;
 }catch{
  stonksiVersionBadge.textContent="v"+stonksiCurrentVersion+" · Ei voitu tarkistaa";
  stonksiVersionBadge.style.color="#969eb3";stonksiVersionBadge.disabled=true;
 }
}
if(stonksiVersionBadge){
 stonksiVersionBadge.addEventListener("click",()=>{if(!stonksiVersionBadge.disabled)location.reload()});
 window.addEventListener("load",checkStonksiVersion);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkStonksiVersion()});
 setInterval(()=>{if(!document.hidden)checkStonksiVersion()},300000);
}

/* Cloud startup status watchdog: displays failures without claiming a successful sync.
   Normal Supabase state updates can still replace the error when connection recovers. */
(() => {
 const indicator=document.getElementById("sync-indicator");
 const sidebar=document.getElementById("sidebar-sync-status");
 const feature=document.getElementById("cloud-feature-status");
 if(!indicator)return;
 const render=()=>{
  const state=indicator.dataset.state||"connecting";
  const label=document.getElementById("sync-label")?.textContent||"";
  if(feature){
   const names={connecting:"Yhdistetään…",synced:"Synkronoitu",syncing:"Synkronoidaan…",pending:"Muutoksia jonossa",error:"Synkronointivirhe",offline:"Ei verkkoyhteyttä",local:"Ei kirjautunut"};
   feature.textContent=names[state]||label||"Tuntematon tila";
   feature.classList.toggle("connected",state==="synced");
   feature.classList.toggle("pending",state!=="synced");
  }
 };
 new MutationObserver(render).observe(indicator,{attributes:true,attributeFilter:["data-state"]});
 render();
 window.setTimeout(()=>{
  if(indicator.dataset.state!=="connecting"||!navigator.onLine)return;
  indicator.dataset.state="error";
  const label=document.getElementById("sync-label");
  if(label)label.textContent="Yhteystarkistus viivästyy";
  if(sidebar){
   sidebar.dataset.state="error";
   const title=document.getElementById("sidebar-sync-title"),detail=document.getElementById("sidebar-sync-detail");
   if(title)title.textContent="Yhteystarkistus viivästyy";
   if(detail)detail.textContent="Tarkista yhteys ja tarvittaessa päivitä sivu";
  }
  render();
 },20000);
})();
