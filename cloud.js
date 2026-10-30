import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";
// Tallenna vain kutsun tyyppi ja virhekoodi ennen kuin Supabase siivoaa URL:n.
// Älä tallenna access_token-, refresh_token- tai token_hash-arvoja.
const initialAuthHash=new URLSearchParams(location.hash.replace(/^#/, ""));
const initialAuthQuery=new URLSearchParams(location.search);
const initialAuthType=initialAuthHash.get("type")||initialAuthQuery.get("type")||"";
const initialAuthErrorCode=initialAuthHash.get("error_code")||initialAuthQuery.get("error_code")||"";
const initialAuthError=initialAuthHash.get("error_description")||initialAuthQuery.get("error_description")||initialAuthHash.get("error")||initialAuthQuery.get("error")||"";
const initialAuthFlow=["invite","recovery"].includes(initialAuthType);
const supabase = createClient("https://ywrnmfozoyniftkzcopt.supabase.co","sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE");
window.agentSupabaseClient=supabase;
const panel=document.getElementById("cloud-panel");
const status=document.getElementById("cloud-status");
const email=document.getElementById("cloud-email");
const password=document.getElementById("cloud-password");
const signIn=document.getElementById("cloud-sign-in");
const signUp=document.getElementById("cloud-sign-up");
const signOut=document.getElementById("cloud-sign-out");
const importBtn=document.getElementById("cloud-import");
let user=null,ready=false,busy=false,flushing=false,sessionVersion=0,syncError=null,recoveryMode=false,recoveryCompleted=false;
const recoveryLink=()=>!recoveryCompleted&&(initialAuthFlow||/type=(recovery|invite)/.test(location.hash)||["recovery","invite"].includes(new URLSearchParams(location.search).get("type")));
if(recoveryLink())recoveryMode=true;
const passwordPanel=document.getElementById("password-change-panel");
const passwordPanelHome=passwordPanel.parentElement;
const passwordPanelNext=passwordPanel.nextSibling;
function renderPasswordFlow(){
 const active=recoveryMode&&!!user;
 document.body.classList.toggle("recovery-flow",active);
 if(active){
  if(passwordPanel.parentElement!==document.body)document.body.appendChild(passwordPanel);
  passwordPanel.hidden=false;
  const title=passwordPanel.querySelector("h2");if(title)title.textContent="Aseta uusi salasana";
  const intro=passwordPanel.querySelector("p.muted");if(intro)intro.textContent="Viimeistele tilin käyttöönotto tai salasanan palautus. Sovellus avautuu vasta salasanan tallennuksen jälkeen.";
  const button=document.getElementById("password-change-submit");if(button)button.textContent="Tallenna salasana ja jatka";
 }else{
  if(passwordPanel.parentElement===document.body)passwordPanelHome.insertBefore(passwordPanel,passwordPanelNext);
  const title=passwordPanel.querySelector("h2");if(title)title.textContent="Vaihda salasana";
  const intro=passwordPanel.querySelector("p.muted");if(intro)intro.textContent="Vaihda kirjautuneen tilisi salasana. Vähintään 12 merkkiä.";
  const button=document.getElementById("password-change-submit");if(button)button.textContent="Vaihda salasana";
 }
}
const queueKey=uid=>`oma-agentti-preview-queue-${uid}`;
const cacheKey=uid=>`oma-agentti-preview-tasks-${uid}`;
const readJSON=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const pending=uid=>readJSON(queueKey(uid),[]);
function persistTasks(uid,tasks){localStorage.setItem(cacheKey(uid),JSON.stringify(tasks));}
function updateQueue(uid,change){const q=pending(uid).filter(x=>x.id!==change.id);q.push(change);localStorage.setItem(queueKey(uid),JSON.stringify(q));}
function overlay(tasks,queue){const map=new Map(tasks.map(t=>[t.id,t]));for(const c of queue){if(c.action==='delete')map.delete(c.id);else map.set(c.id,c.task);}return [...map.values()];}
async function flushQueue(){if(flushing||!user||!ready||!navigator.onLine)return;flushing=true;syncError=null;syncIndicator();const uid=user.id;try{while(user?.id===uid&&navigator.onLine){const q=pending(uid);if(!q.length)break;const c=q[0];const result=c.action==='delete'?await supabase.from('tasks').delete().eq('id',c.id).eq('user_id',uid):await supabase.from('tasks').upsert({...toRow(c.task),user_id:uid});if(result.error)throw result.error;const latest=pending(uid);if(latest.find(x=>x.id===c.id)?.stamp===c.stamp){localStorage.setItem(queueKey(uid),JSON.stringify(latest.filter(x=>x.id!==c.id)));}}if(user?.id===uid)message(pending(uid).length?'Muutoksia odottaa synkronointia.':'Tehtävät synkronoitu pilveen.');}catch(e){if(user?.id===uid){syncError=e.message;message('Synkronointi epäonnistui, muutokset odottavat: '+e.message);}}finally{flushing=false;syncIndicator();}}
window.addEventListener('online',()=>{syncIndicator();flushQueue();});window.addEventListener('offline',syncIndicator);window.addEventListener('focus',()=>{syncIndicator();flushQueue();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncIndicator();flushQueue();}});

function setIndicator(state,label){
 const el=document.getElementById("sync-indicator"),text=document.getElementById("sync-label");
 if(el)el.dataset.state=state;
 if(text)text.textContent=label;
 const sidebar=document.getElementById("sidebar-sync-status");
 if(!sidebar)return;
 sidebar.dataset.state=state;
 const title=document.getElementById("sidebar-sync-title"),detail=document.getElementById("sidebar-sync-detail");
 const descriptions={
  connecting:["Yhdistetään…","Tarkistetaan pilviyhteyttä"],
  synced:["Pilviyhteys toimii","Tiedot synkronoitu"],
  syncing:["Synkronoidaan…","Siirretään muutoksia pilveen"],
  pending:["Synkronointi odottaa",label],
  error:["Synkronointivirhe","Tarkista yhteys ja asetukset"],
  offline:["Ei verkkoyhteyttä","Muutokset odottavat verkkoa"],
  local:["Paikallinen tila","Kirjaudu sisään synkronoidaksesi"]
 };
 const info=descriptions[state]||["Yhteyden tila",label];
 if(title)title.textContent=info[0];
 if(detail)detail.textContent=info[1];
}
function syncIndicator(){
 if(!navigator.onLine){setIndicator("offline","Offline");return;}
 if(!user){setIndicator("local","Paikallinen tila");return;}
 const count=pending(user.id).length;
 if(syncError){setIndicator("error","Synkronointivirhe"+(count?" ("+count+")":""));return;}
 if(flushing){setIndicator("syncing","Synkronoidaan…");return;}
 if(count){setIndicator("pending","Odottaa: "+count);return;}
 if(!ready){setIndicator("connecting","Yhdistetään…");return;}
 setIndicator("synced","Synkronoitu");
}
function message(text){status.textContent=text;syncIndicator();}
function toRow(t){return {id:t.id,user_id:user.id,title:t.title,priority:({Korkea:"high",Matala:"low",Normaali:"normal"}[t.priority]||"normal"),category:t.category||"Yleinen",status:t.done?"done":"open"};}
function fromRow(t){return {id:t.id,title:t.title,priority:({high:"Korkea",low:"Matala",normal:"Normaali"}[t.priority]||"Normaali"),category:t.category||"Yleinen",done:t.status==="done",created:Date.parse(t.created_at)};}
async function loadCloud(uid,version){
 const {data,error}=await supabase.from("tasks").select("id,title,priority,category,status,created_at").order("created_at",{ascending:false});
 if(error)throw error;
 if(version!==sessionVersion||user?.id!==uid)return;
 const merged=overlay(data.map(fromRow),pending(uid));
 persistTasks(uid,merged);window.agentTaskBridge?.set(merged);
 message(pending(uid).length?`${pending(uid).length} muutosta odottaa synkronointia.`:"Pilvitehtävät ladattu. Tehtävien muutokset tallennetaan pilveen.");
}
async function onSession(session){
 ready=false;syncError=null;const version=++sessionVersion;adminRequestEpoch++;adminCheckInFlight=false;user=session?.user||null;
 window.agentLocalBridge?.setUser(user?.id||null);
 document.dispatchEvent(new CustomEvent("agent:admin-access",{detail:{uid:user?.id||null,isAdmin:false}}));
 document.body.classList.remove("auth-pending","auth-guest","auth-user");
 document.body.classList.add(user?"auth-user":"auth-guest");
 const settingsHeading=document.querySelector("#view-settings .page-heading h1");
 if(settingsHeading)settingsHeading.textContent=user?"Asetukset":"Kirjautuminen";
 const settingsIntro=document.querySelector("#view-settings .page-heading p");
 if(settingsIntro)settingsIntro.textContent=user?"Tämän version tallennus- ja tietosuojatiedot.":"Kirjaudu sisään jatkaaksesi omaan työtilaan.";
 renderPasswordFlow();
 if(recoveryMode&&user){document.getElementById("password-change-status").textContent="Aseta tilillesi uusi salasana (vähintään 12 merkkiä).";document.getElementById("password-new").focus();}
 const cloudHeading=document.querySelector("#cloud-panel h2");
 if(cloudHeading)cloudHeading.textContent=user?"Supabase-pilvitallennus":"Kirjaudu sisään";
 if(user && !recoveryMode && document.getElementById("view-settings")?.classList.contains("active")){document.querySelector('[data-view="home"]')?.click();}
 if(!user||recoveryMode){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-settings"));}
 document.getElementById("password-change-panel").hidden=!user&&!recoveryMode;
 document.getElementById("session-security-panel").hidden=!user;
 document.getElementById("cloud-forgot-password").hidden=!!user;
 signOut.hidden=!user;signIn.hidden=!!user;signUp.hidden=true;signUp.disabled=true;importBtn.hidden=!user;
 if(!user){document.getElementById("admin-users-panel").hidden=true;document.getElementById("admin-users-list").replaceChildren();}else{adminPanel.hidden=true;adminStatus.textContent="Tarkistetaan ylläpitäjän oikeuksia…";void loadAdminUsers();}
 email.disabled=!!user;password.disabled=!!user;
 email.hidden=!!user;password.hidden=!!user;
 document.querySelector('label[for="cloud-email"]').hidden=!!user;
 document.querySelector('label[for="cloud-password"]').hidden=!!user;
 if(!user){window.agentTaskBridge?.disable();message("Ei kirjautunut – tehtävät pysyvät paikallisina.");return;}
 const uid=user.id;const cached=readJSON(cacheKey(uid),null);
 if(cached){window.agentTaskBridge?.set(overlay(cached,pending(uid)));ready=true;}
 message("Ladataan pilvitehtäviä…");
 if(!navigator.onLine){message("Offline-tila: muutokset tallentuvat jonoon.");return;}
 try{await loadCloud(uid,version);if(version!==sessionVersion||user?.id!==uid)return;ready=true;syncIndicator();await flushQueue();}catch(e){if(version===sessionVersion)message("Pilvilataus epäonnistui: "+e.message+(cached?" – paikalliset tehtävät käytössä.":""));}
}
// Turnstile is public client-side challenge; Supabase Auth verifies its token server-side once CAPTCHA is enabled.
const TURNSTILE_SITE_KEY="0x4AAAAAAFaAPsjoYFC8GWDo";
let turnstileWidget=null,turnstileToken="";
function resetTurnstile(){
 turnstileToken="";
 if(turnstileWidget!==null&&window.turnstile)window.turnstile.reset(turnstileWidget);
}
function initTurnstile(){
 if(!window.turnstile){setTimeout(initTurnstile,250);return;}
 const target=document.getElementById("cloud-turnstile");
 if(!target||turnstileWidget!==null)return;
 turnstileWidget=window.turnstile.render(target,{
  sitekey:TURNSTILE_SITE_KEY,theme:"auto",
  callback:token=>{turnstileToken=token},
  "expired-callback":()=>{turnstileToken=""},
  "error-callback":()=>{turnstileToken=""}
 });
}
initTurnstile();
// Browser-side cooldown is only a usability layer, not a server-side brute-force defense.
const LOGIN_LOCK_KEY="oma-agentti-login-cooldown-v1";
const LOGIN_LOCK_MS=60*1000;
const loginLock=()=>readJSON(LOGIN_LOCK_KEY,{failures:0,until:0});
function updateLoginLock(){
 const lock=loginLock(),remaining=Math.max(0,lock.until-Date.now());
 signIn.disabled=remaining>0;
 if(remaining>0)message("Kirjautuminen lukittu tällä selaimella "+Math.ceil(remaining/60000)+" minuutiksi. Yritä myöhemmin.");
}
updateLoginLock();
async function authenticate(create){
 if(busy)return;
 if(!create){
  const lock=loginLock();
  if(lock.until>Date.now()){updateLoginLock();return;}
 }
 if(!email.value.trim()||!password.value){message("Anna sähköposti ja salasana.");return;}
 if(password.value.length<6){message("Salasanan on oltava vähintään 6 merkkiä.");return;}
 busy=true;signIn.disabled=true;signUp.disabled=true;
 message("Odota…");
 try{
  if(!turnstileToken){message("Vahvista ensin Turnstile-tarkistus.");return;}
  const args={email:email.value.trim(),password:password.value,options:{captchaToken:turnstileToken}};
  if(create){message("Rekisteröityminen onnistuu vain ylläpitäjän kutsulla.");return;}
  const {data,error}=await supabase.auth.signInWithPassword(args);
  if(error){
   if(error.status===429){message("Kirjautumispyyntöjä on liian paljon. Odota hetki ja yritä uudelleen.");return;}
   if(!create){
    const prev=loginLock();
    const failures=prev.until>Date.now()?3:(prev.until?0:prev.failures)+1;
    const until=failures>=3?Date.now()+LOGIN_LOCK_MS:0;
    localStorage.setItem(LOGIN_LOCK_KEY,JSON.stringify({failures,until}));
    message(until?"Kolme epäonnistunutta yritystä. Kirjautuminen lukittu tällä selaimella 1 minuutiksi.":"Kirjautuminen epäonnistui. Yrityksiä jäljellä: "+(3-failures)+".");
   }else message(error.message);
   return;
  }
  if(!create)localStorage.removeItem(LOGIN_LOCK_KEY);
  password.value="";
  if(create&&!data.session)message("Tarkista sähköpostisi ja vahvista tili ennen kirjautumista.");
 }catch{message("Kirjautumispalveluun ei saatu yhteyttä.");}
 finally{resetTurnstile();busy=false;signUp.disabled=false;signIn.disabled=false;updateLoginLock();}
}
const forgotButton=document.getElementById("cloud-forgot-password");
forgotButton.addEventListener("click",async()=>{
 const address=email.value.trim(),output=document.getElementById("cloud-reset-status");
 if(!address||!email.checkValidity()){output.textContent="Anna ensin kelvollinen sähköpostiosoite.";return;}
 if(!navigator.onLine){output.textContent="Palautus vaatii verkkoyhteyden.";return;}
 if(!turnstileToken){output.textContent="Vahvista ensin Turnstile-tarkistus.";return;}
 forgotButton.disabled=true;output.textContent="Lähetetään palautuspyyntö…";
 try{
  const {error}=await supabase.auth.resetPasswordForEmail(address,{
   redirectTo:new URL("./index.html",location.href).href,captchaToken:turnstileToken
  });
  if(error)throw error;
  output.textContent="Jos osoitteeseen liittyy tili, saat palautusviestin. Tarkista myös roskaposti.";
 }catch(error){output.textContent=error.status===429?"Liian monta pyyntöä. Odota hetki.":"Palautuspyyntö epäonnistui: "+error.message;}
 finally{forgotButton.disabled=false;resetTurnstile();}
});
signIn.addEventListener("click",()=>authenticate(false));

const adminPanel=document.getElementById("admin-users-panel");
const adminStatus=document.getElementById("admin-users-status");
const adminList=document.getElementById("admin-users-list");
const inviteTimer=document.getElementById("admin-email-cooldown");
const INVITE_WAIT_KEY="oma-agentti-invite-wait-until-v1";
const INVITE_WAIT_MS=60*60*1000;
function inviteWaitUntil(){const n=Number(localStorage.getItem(INVITE_WAIT_KEY)||0);return Number.isFinite(n)&&n>Date.now()?n:0;}
function renderInviteTimer(){
 const until=inviteWaitUntil();
 const button=document.getElementById("admin-invite-submit");
 if(!until){
  inviteTimer.hidden=true;
  if(localStorage.getItem(INVITE_WAIT_KEY))localStorage.removeItem(INVITE_WAIT_KEY);
  return;
 }
 const seconds=Math.ceil((until-Date.now())/1000);
 const mm=String(Math.floor(seconds/60)).padStart(2,"0");
 const ss=String(seconds%60).padStart(2,"0");
 inviteTimer.hidden=false;
 inviteTimer.textContent="Arvio seuraavaan kutsuyritykseen: "+mm+":"+ss+" (Supabasen todellinen kiintiö voi vapautua eri aikaan).";
 // Timer is informational: Supabase decides actual availability.
}
renderInviteTimer();
setInterval(renderInviteTimer,1000);

async function adminRequest(method,payload){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw Error("Kirjaudu sisään.");
 const response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/Admin-users",{
  method,headers:{"Authorization":"Bearer "+session.access_token,"apikey":"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE",...(method==="POST"?{"Content-Type":"application/json"}:{})},
  ...(method==="POST"?{body:JSON.stringify(typeof payload==="string"?{email:payload}:payload)}:{})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(result.error||"Pyyntö epäonnistui.");error.status=response.status;throw error;}
 return result;
}
let adminCheckInFlight=false;
let adminRequestEpoch=0;
async function loadAdminUsers(){
 if(adminCheckInFlight||!user)return;
 const expectedUid=user.id,requestEpoch=adminRequestEpoch;
 adminPanel.hidden=true;adminStatus.textContent="Haetaan käyttäjiä…";
 adminCheckInFlight=true;
 try{
  const data=await adminRequest("GET");
  if(!user||user.id!==expectedUid||requestEpoch!==adminRequestEpoch)return;
  document.dispatchEvent(new CustomEvent("agent:admin-access",{detail:{uid:expectedUid,isAdmin:true}}));
  adminPanel.hidden=false;
  if(data.limits){document.getElementById("admin-user-limit").value=data.limits.user_daily_limit;document.getElementById("admin-global-limit").value=data.limits.global_daily_limit;}
  const inactivitySelect=document.getElementById("admin-inactivity-months");
  if(inactivitySelect&&[3,6,12].includes(data.inactivity_months))inactivitySelect.value=String(data.inactivity_months);
  const board=document.getElementById("admin-inactivity-dashboard");
  if(board){const w=data.warning_summary||{};board.textContent="Varoitukset: odottaa "+(w.pending||0)+", lähetetty "+(w.sent||0)+", peruutettu "+(w.cancelled||0)+", virheitä "+(w.failed||0)+", määräajan ylittäneet "+(w.overdue||0)+".";}
  adminList.replaceChildren();
  for(const entry of data.users||[]){
   const row=document.createElement("div");
   row.className="task-item";
   const emailNode=document.createElement("strong");
   emailNode.textContent=entry.email||"(ei sähköpostia)";
   row.append(emailNode);
   const details=document.createElement("p");details.className="muted";
   const dateLabel=d=>d?new Date(d).toLocaleDateString("fi-FI"):"Ei tiedossa";
   const months=Number(data.inactivity_months)||6;
   const last=entry.last_sign_in_at?new Date(entry.last_sign_in_at):null;
   const confirmed=!!entry.confirmed_at;
   const warning=(data.warnings||[]).find(w=>w.user_id===entry.id&&w.status!=="cancelled");
   if(entry.is_admin)details.textContent="Pääkäyttäjä · Suojattu automaattiselta poistamiselta";
   else if(!confirmed)details.textContent="Vahvistamaton kutsu · Ei automaattista poistoa";
   else if(!last||!Number.isFinite(last.getTime()))details.textContent="Viimeisin kirjautuminen ei tiedossa · Ei poistopäätöstä";
   else{
    const days=Math.max(0,Math.floor((Date.now()-last.getTime())/86400000));
    const due=new Date(last);due.setMonth(due.getMonth()+months);
    const warn=new Date(due.getTime()-30*86400000);
    const state=warning?.status==="sent"?"Varoitus lähetetty":warning?.status==="pending"?"Varoitus odottaa":warning?.status==="failed"?"Varoituksen lähetysvirhe":Date.now()>=due.getTime()?"Määräaika ylitetty (ei automaattista poistoa)":Date.now()>=warn.getTime()?"Varoitusajankohta saavutettu":days>=30?"Aktiivisuutta seurataan":"Aktiivinen";
    details.textContent="Viimeksi "+dateLabel(last)+" · "+days+" pv käyttämättä · Varoitus "+dateLabel(warn)+" · Määräaika "+dateLabel(due)+" · "+state;
   }
   row.append(details);
   if(entry.id&&!entry.is_admin){
    const remove=document.createElement("button");remove.type="button";remove.textContent="Poista käyttäjä";remove.style.marginLeft="12px";
    remove.addEventListener("click",async()=>{
     if(!confirm("Poistetaanko "+entry.email+" pysyvästi?"))return;
     const confirmation=prompt("Kirjoita POISTA KÄYTTÄJÄ vahvistaaksesi");
     if(confirmation!=="POISTA KÄYTTÄJÄ")return;
     remove.disabled=true;adminStatus.textContent="Poistetaan käyttäjää…";
     try{await adminRequest("POST",{action:"delete_user",user_id:entry.id,confirmation});row.remove();adminStatus.textContent="Käyttäjä poistettu. Päivitä luettelo tarkistaaksesi tilanteen.";}
     catch(error){adminStatus.textContent="Poisto epäonnistui: "+error.message;remove.disabled=false;}
    });row.append(remove);
   }
   adminList.append(row);
  }
  adminStatus.textContent="Käyttäjiä: "+(data.users?.length||0)+" (enintään 100 ensimmäistä).";
 }catch(error){
  if(!user||user.id!==expectedUid||requestEpoch!==adminRequestEpoch)return;
  document.dispatchEvent(new CustomEvent("agent:admin-access",{detail:{uid:expectedUid,isAdmin:false}}));
  if(error.status===403||error.status===401){
   adminPanel.hidden=true;
adminList.replaceChildren();
   adminStatus.textContent="";
  }else{
   adminPanel.hidden=true;
   adminStatus.textContent="Ylläpidon yhteysvirhe ("+(error.status||"verkko")+"): "+(error.message||"Tuntematon virhe");
  }
 }finally{adminCheckInFlight=false;}
}
document.getElementById("admin-refresh-users").addEventListener("click",loadAdminUsers);
document.getElementById("admin-inactivity-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const months=Number(document.getElementById("admin-inactivity-months").value);
 if(![3,6,12].includes(months))return;
 if(!confirm("Tallennetaanko käyttämättömyyden aikarajaksi "+months+" kuukautta? Tämä ei käynnistä automaattista poistoa."))return;
 const button=document.getElementById("admin-save-inactivity");button.disabled=true;
 try{await adminRequest("POST",{action:"inactivity_months",months});adminStatus.textContent="Aikaraja tallennettu: "+months+" kk. Automaattinen poisto ei ole käytössä.";}
 catch(error){adminStatus.textContent="Aikarajan tallennus epäonnistui: "+error.message;}
 finally{button.disabled=false;}
});
document.getElementById("admin-limits-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const button=document.getElementById("admin-save-limits");
 const userLimit=Number(document.getElementById("admin-user-limit").value);
 const globalLimit=Number(document.getElementById("admin-global-limit").value);
 if(!Number.isInteger(userLimit)||!Number.isInteger(globalLimit)||userLimit<1||userLimit>100||globalLimit<userLimit||globalLimit>1000){adminStatus.textContent="Tarkista rajat: käyttäjä 1–100 ja palvelu käyttäjän rajasta 1000:een.";return;}
 if(!confirm("Tallennetaanko AI-analyysien päivärajat "+userLimit+" / käyttäjä ja "+globalLimit+" / koko palvelu?"))return;
 button.disabled=true;adminStatus.textContent="Tallennetaan käyttörajoja…";
 try{await adminRequest("POST",{action:"limits",user_daily_limit:userLimit,global_daily_limit:globalLimit});adminStatus.textContent="AI-käyttörajat tallennettu palvelimelle.";}
 catch(error){adminStatus.textContent="Rajojen tallennus epäonnistui: "+error.message;}
 finally{button.disabled=false;}
});

document.getElementById("admin-invite-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const field=document.getElementById("admin-invite-email");
 const button=document.getElementById("admin-invite-submit");
 if(!confirm("Lähetetäänkö käyttäjäkutsu osoitteeseen "+field.value.trim()+"?"))return;
 button.disabled=true;adminStatus.textContent="Lähetetään kutsua…";
 try{await adminRequest("POST",field.value.trim());adminStatus.textContent="Kutsu lähetetty.";field.value="";await loadAdminUsers();}
 catch(error){adminStatus.textContent="Kutsua ei voitu lähettää: "+error.message;
  if(error.status===429){localStorage.setItem(INVITE_WAIT_KEY,String(Date.now()+INVITE_WAIT_MS));renderInviteTimer();}
 }
 finally{button.disabled=false;}
});
const passwordForm=document.getElementById("password-change-form");
passwordForm.addEventListener("submit",async(event)=>{
 event.preventDefault();
 const next=document.getElementById("password-new");
 const confirm=document.getElementById("password-confirm");
 const output=document.getElementById("password-change-status");
 const submit=document.getElementById("password-change-submit");
 const newPassword=next.value;
 if(!user){output.textContent="Kirjaudu ensin sisään.";return;}
 if(newPassword.length<12||newPassword.length>128){output.textContent="Salasanan tulee olla 12–128 merkkiä.";return;}
 if(newPassword!==confirm.value){output.textContent="Salasanat eivät täsmää.";return;}
 if(!navigator.onLine){output.textContent="Salasanan vaihtaminen vaatii verkkoyhteyden.";return;}
 submit.disabled=true;output.textContent="Vaihdetaan salasanaa…";
 try{
  const {data:{user:verified},error:verifyError}=await supabase.auth.getUser();
  if(verifyError||!verified||verified.id!==user.id)throw Error("Kirjautuminen on vahvistettava uudelleen.");
  const {error}=await supabase.auth.updateUser({password:newPassword});
  if(error)throw error;
  next.value="";confirm.value="";
  output.textContent="Salasana vaihdettu onnistuneesti.";
  if(recoveryMode){
   recoveryMode=false;
   renderPasswordFlow();
   output.textContent="Salasana tallennettu. Tervetuloa!";
   document.querySelector('[data-view="home"]')?.click();
  }
 }catch(error){output.textContent="Salasanan vaihto epäonnistui: "+(error.message||"Yritä uudelleen.");}
 finally{submit.disabled=false;}
});
document.getElementById("sign-out-others").addEventListener("click",async()=>{
 const button=document.getElementById("sign-out-others"),output=document.getElementById("sign-out-others-status");
 if(!user)return;
 if(!confirm("Kirjataanko muut laitteet ulos? Tämä laite pysyy kirjautuneena."))return;
 button.disabled=true;output.textContent="Suljetaan muita istuntoja…";
 try{
  const {error}=await supabase.auth.signOut({scope:"others"});
  if(error)throw error;
  output.textContent="Muiden laitteiden istunnot mitätöity. Jo myönnetyt käyttötokenit voivat toimia niiden vanhenemiseen asti.";
 }catch(error){output.textContent="Toiminto epäonnistui: "+error.message;}
 finally{button.disabled=false;}
});
signOut.addEventListener("click",async()=>{const {error}=await supabase.auth.signOut();if(error)message(error.message);});
importBtn.addEventListener("click",async()=>{
 if(!user||!ready||busy)return;
 if(!confirm("Tuodaanko tämän laitteen aiemmin tallennetut tehtävät pilveen? Tämä voi luoda kaksoiskappaleita."))return;
 const raw=localStorage.getItem("oma-agentti-before-cloud");
 if(!raw){message("Vanhaa tehtävävarmuuskopiota ei löytynyt. Vanhoja paikallisia tietoja ei poisteta automaattisesti.");return;}
 let tasks;try{if(raw.length>2000000)throw Error("Liian suuri tiedosto");const data=JSON.parse(raw);if(!data||!Array.isArray(data.tasks)||data.tasks.length>500)throw Error("Virheellinen tehtävälista");tasks=data.tasks.map(t=>{if(!t||typeof t.title!=="string"||!t.title.trim()||t.title.length>140||typeof t.category!=="string"||t.category.length>80||!["Normaali","Korkea","Matala"].includes(t.priority)||typeof t.done!=="boolean")throw Error("Virheellisiä tehtävätietoja");return {title:t.title.trim(),category:t.category,priority:t.priority,done:t.done}})}catch(e){message("Tuontia ei tehty: "+e.message);return;}
 busy=true;
 try{
  const rows=tasks.map(t=>({user_id:user.id,title:t.title,priority:({Korkea:"high",Matala:"low",Normaali:"normal"}[t.priority]||"normal"),category:t.category||"Yleinen",status:t.done?"done":"open"}));
  if(rows.length){const {error}=await supabase.from("tasks").insert(rows);if(error)throw error;}
  await loadCloud(user.id,sessionVersion);
 }catch(e){message("Tuonti epäonnistui: "+e.message);}finally{busy=false;}
});
document.addEventListener("agent:task-change",event=>{
 if(!user||!ready)return;
 const {action,task,id}=event.detail,uid=user.id;
 const change={action,task:task?structuredClone(task):null,id:id||task.id,stamp:crypto.randomUUID()};
 syncError=null;
 updateQueue(uid,change);syncIndicator();
 const cached=readJSON(cacheKey(uid),[]);
 persistTasks(uid,overlay(cached,[change]));
 message(navigator.onLine?"Tallennetaan pilveen…":"Offline: muutos tallennettu jonoon.");
 flushQueue();
});
// Poistetun Auth-käyttäjän istunto voi jäädä selaimen välimuistiin.
// Tarkista käyttäjä palvelimelta; älä kirjaa ulos verkkokatkon tai 5xx-virheen takia.
let accountCheckInFlight=false;
let accountLastChecked=0;
async function checkAccountStillExists(force=false){
 if(!user||!navigator.onLine||accountCheckInFlight)return;
 if(!force&&Date.now()-accountLastChecked<60000)return;
 accountCheckInFlight=true;
 const checkedUserId=user.id;
 try{
  const {data,error}=await supabase.auth.getUser();
  if(user?.id!==checkedUserId)return;
  if(!error&&data?.user?.id===checkedUserId){accountLastChecked=Date.now();return;}
  const status=Number(error?.status||0);
  const code=String(error?.code||"").toLowerCase();
  const removed=!error&&!data?.user||status===401||status===403||["user_not_found","user_banned","session_not_found","refresh_token_not_found"].includes(code);
  if(!removed)return;
  accountLastChecked=Date.now();
  recoveryMode=false;
  try{await supabase.auth.signOut({scope:"local"});}catch(_error){}
  if(user?.id===checkedUserId)await onSession(null);
  const notice=document.getElementById("cloud-reset-status");
  if(notice)notice.textContent="Kirjautuminen päättyi: käyttäjätili tai istunto ei ole enää voimassa.";
 }finally{accountCheckInFlight=false;}
}
window.addEventListener("focus",()=>{void checkAccountStillExists();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void checkAccountStillExists();});
window.addEventListener("online",()=>{void checkAccountStillExists(true);});
setInterval(()=>{if(!document.hidden)void checkAccountStillExists();},300000);
supabase.auth.onAuthStateChange((event,session)=>{
 if(!recoveryCompleted&&(event==="PASSWORD_RECOVERY"||event==="SIGNED_IN"&&recoveryLink())){
  recoveryMode=true;
  renderPasswordFlow();
  setTimeout(()=>{
   document.getElementById("password-change-panel").hidden=false;
   document.querySelector('[data-view="settings"]')?.click();
   document.getElementById("password-change-status").textContent="Aseta tilillesi salasana jatkaaksesi.";
  },0);
 }
 setTimeout(()=>onSession(session),0);
});

const {data:{session}}=await supabase.auth.getSession();
if(recoveryLink()&&session?.user)recoveryMode=true;
await onSession(session);syncIndicator();
void checkAccountStillExists(true);
// Näytä Supabasen virhekoodi ilman linkin kertakäyttöisiä tunnisteita.
if(initialAuthError||initialAuthErrorCode){
 recoveryMode=false;
 const safeCode=/^[a-z0-9_-]{1,80}$/i.test(initialAuthErrorCode)?initialAuthErrorCode:"auth_error";
 const hint=safeCode==="otp_expired"?"Linkki on vanhentunut tai jo käytetty.":safeCode==="access_denied"?"Kutsun vahvistus estettiin.":"Kirjautumislinkin vahvistus epäonnistui.";
 const details=document.getElementById("cloud-reset-status");
 if(details)details.textContent=hint+" Virhekoodi: "+safeCode+". Tarkista Supabasen Authentication-lokit ennen uuden viestin lähettämistä.";
 document.querySelector('[data-view="settings"]')?.click();
 message("Kirjautumislinkin käsittely epäonnistui ("+safeCode+").");
}
