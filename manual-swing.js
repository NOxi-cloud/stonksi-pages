// Stonksi manual swing research: no scheduled runs, no model calls.
const db=window.agentSupabaseClient;
const host=document.getElementById("manual-swing-workspace");
if(host&&db){
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
 const title=el("h2","Tallennetut swing-signaalit");
 const help=el("p","SMA20/50-strategia perustuu viivästettyyn päivähistoriaan. Käynnistyy vain painikkeesta. Ei kauppasuositus eikä automaattista kaupankäyntiä.","muted");
 const bar=el("div",undefined,"form-actions");
 const input=el("input");input.placeholder="Esim. NOKIA.HE";input.maxLength=20;input.setAttribute("aria-label","Analysoitava ticker");
 const run=el("button","Laske ja tallenna","primary-btn");run.type="button";
 const refresh=el("button","Näytä tallennetut","secondary-btn");refresh.type="button";
 const status=el("p","","muted");status.setAttribute("role","status");
 const out=el("div",undefined,"watchlist-signal-grid");bar.append(input,run,refresh);host.append(title,help,bar,status,out);
 let owner=null,busy=false,epoch=0;
 const fmt=t=>t?new Date(t).toLocaleString("fi-FI"):"–";
 function card(s){
  const box=el("article",undefined,"watchlist-signal-card");
  box.append(el("h3",s.symbol+" · "+({candidate:"Mahdollinen ehdokas",watch:"Seurattava",avoid:"Ei signaalia",insufficient_data:"Riittämätön data"}[s.signal_type]||s.signal_type)));
  box.append(el("p","Viitehinta "+Number(s.reference_price).toLocaleString("fi-FI")+" · "+s.strategy,"muted"));
  for(const [label,value] of [["Markkinatieto",fmt(s.market_data_time)],["Tieto vastaanotettu",fmt(s.data_received_at)],["Signaali luotu",fmt(s.generated_at)],["Voimassa enintään",fmt(s.valid_until)]])box.append(el("p",label+": "+value,"muted"));
  if(Date.parse(s.valid_until)<=Date.now())box.append(el("strong","VANHENTUNUT"));
  const reasons=Array.isArray(s.reasons)?s.reasons:[],flags=Array.isArray(s.risk_flags)?s.risk_flags:[];
  for(const r of reasons.slice(0,8)){if(typeof r?.metric==="string"&&Number.isFinite(Number(r.value)))box.append(el("p",r.metric+": "+Number(r.value).toLocaleString("fi-FI"),"muted"))}
  if(flags.length)box.append(el("p","Riskit: "+flags.filter(x=>typeof x==="string").join("; "),"muted"));
  box.append(el("small","Tutkimussignaali – ei ajantasainen ostokehotus","muted"));return box;
 }
 async function load(){
  const localEpoch=++epoch;
  const {data:{session}}=await db.auth.getSession();
  if(localEpoch!==epoch)return;
  out.replaceChildren();
  if(!session){status.textContent="Kirjaudu sisään nähdäksesi signaalit.";return}
  owner=session.user.id;
  const {data,error}=await db.from("signals").select("id,symbol,strategy,signal_type,reference_price,market_data_time,data_received_at,generated_at,valid_until,reasons,risk_flags").order("generated_at",{ascending:false}).limit(30);
  if(localEpoch!==epoch)return;
  if(error){status.textContent="Tallennettujen signaalien lataus epäonnistui.";return}
  status.textContent=data?.length?data.length+" viimeisintä tallennettua tutkimussignaalia":"Ei vielä tallennettuja swing-signaaleja.";
  for(const s of data||[])out.append(card(s));
 }
 run.addEventListener("click",async()=>{
  if(busy)return;
  const symbol=input.value.trim().toUpperCase();
  if(!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(symbol)){status.textContent="Virheellinen ticker. Esim. NOKIA.HE";return}
  const {data:{session}}=await db.auth.getSession();
  if(!session){status.textContent="Kirjautuminen vaaditaan.";return}
  const localEpoch=epoch;busy=true;run.disabled=true;status.textContent="Lasketaan "+symbol+"…";
  try{
   const response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/manual-swing-signal",{
    method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE","Content-Type":"application/json"},body:JSON.stringify({action:"run",symbol})
   });
   const payload=await response.json();
   const {data:{session:check}}=await db.auth.getSession();
   if(epoch!==localEpoch||check?.user.id!==session.user.id)return;
   if(!response.ok)throw Error(payload.error||"Analyysi epäonnistui");
   status.textContent=payload.status==="insufficient_data"?"Riittämätön hintahistoria ("+payload.records_used+" havaintoa).":"Tallennettu: "+symbol+" · "+payload.signal_type;
   await load();
  }catch(e){if(epoch===localEpoch)status.textContent="Signaalin laskenta epäonnistui: "+e.message}
  finally{busy=false;run.disabled=false}
 });
 refresh.addEventListener("click",load);
 db.auth.onAuthStateChange(()=>{epoch++;owner=null;out.replaceChildren();status.textContent="";});
}
