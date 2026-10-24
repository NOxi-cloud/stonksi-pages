// Authenticated, privacy-minded page counters and verified-admin-only dashboard.
const client=window.agentSupabaseClient;
const pages=new Set(["home","tasks","stocks","research","memory","settings","development","approvals"]);
const root=document.getElementById("site-usage-dashboard");
if(!client||!root)throw Error("Usage dashboard not mounted");
let adminId=null,activePage=null,loading=false;
let lastRecorded={page:null,at:0,uid:null};
const status=document.createElement("p");status.className="muted";status.setAttribute("role","status");
const controls=document.createElement("div");controls.className="site-usage-controls";
const period=document.createElement("select");period.setAttribute("aria-label","Kävijätilastojen aikaväli");
for(const [value,label] of [[7,"7 päivää"],[30,"30 päivää"],[90,"90 päivää"]]){
 const option=document.createElement("option");option.value=String(value);option.textContent=label;
 if(value===30)option.selected=true;period.append(option);
}
const refresh=document.createElement("button");refresh.type="button";refresh.className="secondary-btn";refresh.textContent="Päivitä tilastot";
controls.append(period,refresh);
const numbers=document.createElement("div");numbers.className="site-usage-numbers";
const chart=document.createElement("div");chart.className="site-usage-chart";
const popular=document.createElement("div");popular.className="site-usage-popular";
root.replaceChildren(controls,status,numbers,chart,popular);
function resetAdmin(){adminId=null;root.hidden=true;numbers.replaceChildren();chart.replaceChildren();popular.replaceChildren();}
const todayPage=()=>document.querySelector(".view.active")?.id?.replace(/^view-/,"")||null;
async function recordPage(page){
 if(!pages.has(page)||document.hidden||!navigator.onLine)return;
 const {data:{session}}=await client.auth.getSession();
 const uid=session?.user?.id;
 if(!uid)return;
 const now=Date.now();
 if(lastRecorded.uid===uid&&lastRecorded.page===page&&now-lastRecorded.at<30000)return;
 const {error}=await client.rpc("record_site_page_view",{p_page:page});
 if(!error)lastRecorded={uid,page,at:now};
}
document.addEventListener("agent:view-changed",event=>{
 activePage=event.detail?.view;
 if(activePage)void recordPage(activePage);
 if(activePage==="development"&&adminId)void load();
});
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden){const page=todayPage();if(page)void recordPage(page)}
});
client.auth.onAuthStateChange((_event,session)=>{
 lastRecorded={page:null,uid:null,at:0};
 if(!session?.user){resetAdmin();return}
 setTimeout(()=>{const page=todayPage();if(page)void recordPage(page)},0);
});
document.addEventListener("agent:admin-access",event=>{
 if(event.detail?.isAdmin!==true||!event.detail.uid){resetAdmin();return}
 adminId=event.detail.uid;root.hidden=false;
 if(todayPage()==="development")void load();
});
const labels={home:"Etusivu",tasks:"Tehtävät",stocks:"Osakkeet",research:"Tutkimus",memory:"Muisti",settings:"Asetukset",development:"Kehitys",approvals:"Hyväksynnät"};
const number=n=>Number(n||0).toLocaleString("fi-FI");
async function load(){
 if(!adminId||loading)return;
 loading=true;refresh.disabled=true;status.textContent="Haetaan käyttötilastoja…";
 try{
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token||session.user.id!==adminId)throw Error("Ylläpitäjän istunto puuttuu");
  const response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/Admin-users?usage_days="+encodeURIComponent(period.value),{
   headers:{"Authorization":"Bearer "+session.access_token,"apikey":"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE"}
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||"Tietoja ei saatu");
  if(adminId!==session.user.id)return;
  const usage=payload.usage||{};
  numbers.replaceChildren();chart.replaceChildren();popular.replaceChildren();
  for(const [heading,value] of [["Kirjautuneet kävijät",usage.unique_visitors],["Sivunäkymät",usage.page_views]]){
   const el=document.createElement("div");el.className="site-usage-number";
   const b=document.createElement("strong");b.textContent=number(value);
   const p=document.createElement("span");p.textContent=heading;el.append(b,p);numbers.append(el);
  }
  const daily=Array.isArray(usage.daily)?usage.daily:[];
  const title=document.createElement("h3");title.textContent="Päivittäiset sivunäkymät";chart.append(title);
  const plot=document.createElement("div");plot.className="site-usage-bars";
  const max=Math.max(1,...daily.map(x=>Number(x.views)||0));
  for(const entry of daily){
   const bar=document.createElement("div");bar.className="site-usage-bar";
   const count=document.createElement("span");count.textContent=String(Number(entry.views)||0);
   const fill=document.createElement("div");fill.className="site-usage-fill";fill.style.height=Math.max(2,Math.round((Number(entry.views)||0)/max*125))+"px";
   const time=document.createElement("time");time.dateTime=String(entry.date||"");time.textContent=String(entry.date||"").slice(5);
   bar.title=String(entry.date)+" · "+number(entry.views)+" sivunäkymää · "+number(entry.visitors)+" kävijää";
   bar.append(count,fill,time);plot.append(bar);
  }
  chart.append(plot);
  const pTitle=document.createElement("h3");pTitle.textContent="Suosituimmat sivut";popular.append(pTitle);
  for(const entry of Array.isArray(usage.pages)?usage.pages:[]){
   const line=document.createElement("div");line.className="site-usage-page";
   const name=document.createElement("span");name.textContent=labels[entry.page]||"Muu";
   const views=document.createElement("strong");views.textContent=number(entry.views);
   line.append(name,views);popular.append(line);
  }
  status.textContent="Tilasto sisältää kirjautuneiden käyttäjien sivunäkymiä, ei anonyymejä vierailuja. Ei IP-osoitteita tai selaintunnisteita. Säilytys 90 päivää.";
 }catch(error){status.textContent="Tilastoja ei voitu hakea: "+(error?.message||"Tuntematon virhe");}
 finally{loading=false;refresh.disabled=false;}
}
period.addEventListener("change",()=>{if(adminId)void load()});
refresh.addEventListener("click",()=>void load());
