// Timon listan arviot: erillinen lähde, vain käyttäjän käskystä tehtävä verkkohaku.
const root=document.getElementById("piksu-tips-workspace");
const db=window.agentSupabaseClient;
if(root&&db){
 const url="https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/piksu-tips";
 const key="sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE";
 const source="https://piksu.net/timon-lista/";
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)?new Date(x+"T12:00:00Z").toLocaleDateString("fi-FI"):"Ei tiedossa";
 const datetime=x=>{const n=Date.parse(x);return Number.isFinite(n)?new Date(n).toLocaleString("fi-FI"):"Ei tiedossa"};
 const price=v=>Number(v).toLocaleString("fi-FI",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
 const pct=v=>(Number(v)>0?"+":"")+Number(v).toLocaleString("fi-FI",{maximumFractionDigits:1})+" %";
 const title=make("h2","Timon listan arvostustärpit");
 const lead=make("p","Timon OMXH-listan laskennalliset arvot ja sijoitukset. Erillinen ulkopuolinen malli, ei Stonksin oma tavoitehinta eikä osto- tai myyntisuositus.","muted");
 const toolbar=make("div",undefined,"piksu-tips-toolbar");
 const refresh=make("button","Päivitä Timon lista","primary-btn");refresh.type="button";
 const load=make("button","Näytä tallennettu","secondary-btn");load.type="button";
 const link=make("a","Avaa alkuperäinen Timon lista","external-link");
 link.href=source;link.target="_blank";link.rel="noopener noreferrer";
 toolbar.append(refresh,load,link);
 const status=make("p","Lähdetietoja ei haeta automaattisesti.","muted");
 status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const summary=make("div",undefined,"piksu-tips-summary");
 const sections=make("div",undefined,"piksu-tips-sections");
 root.append(title,lead,toolbar,status,summary,sections);
 let busy=false,epoch=0;
 const currentSession=async()=>{const {data:{session}}=await db.auth.getSession();return session?.user?.id&&session?.access_token?session:null};
 const field=(box,label,value)=>{const f=make("div",undefined,"piksu-tip-metric");f.append(make("small",label),make("strong",value));box.append(f)};
 function card(item){
  const box=make("article",undefined,"piksu-tip-card");
  const rank=make("span","Sija "+item.rank,"piksu-tip-rank");
  const head=make("div",undefined,"piksu-tip-card-head");
  head.append(make("h3",item.company),rank);box.append(head);
  const metrics=make("div",undefined,"piksu-tip-metrics");
  field(metrics,"Listan kurssi",price(item.reference_price));
  field(metrics,"Timon mallin tavoite",price(item.target_price));
  field(metrics,"Mallin potentiaali",pct(item.potential_pct));
  box.append(metrics);
  const foot=make("p","Lähteen laskennallinen arvio. Ei markkinakurssi nyt, eikä Stonksin vahvistama tavoitehinta.","muted");
  box.append(foot);return box;
 }
 function render(snapshot){
  summary.replaceChildren();sections.replaceChildren();
  if(!snapshot){summary.append(make("p","Ei tallennettua listaa. Käynnistä lähdehaku Päivitä-painikkeesta.","muted"));return}
  const fetched=Date.parse(snapshot.fetched_at),sourceUpdated=snapshot.source_updated,quoteDate=snapshot.quote_date;
  const age=Date.now()-Date.parse(sourceUpdated+"T00:00:00Z");
  const old=Number.isFinite(age)&&age>14*86400000;
  const facts=make("div",undefined,"piksu-tips-metadata");
  facts.append(
   make("span","Lista päivitetty: "+date(sourceUpdated)),
   make("span","Listan kurssipäivä: "+date(quoteDate)),
   make("span","Stonksin haku: "+datetime(snapshot.fetched_at))
  );
  summary.append(facts);
  if(old)summary.append(make("p","Huomio: alkuperäisen listan päiväys on yli 14 päivää vanha. Näitä arvoja ei saa tulkita ajantasaisiksi.","piksu-tips-warning"));
  const groups=[{name:"Kärkisijat",subtitle:"Timon laskennallisen listan kahdeksan kärkinimeä.",items:snapshot.top_picks},
                {name:"Oman seurantalistan osumat",subtitle:"Osakkeet, jotka löytyivät omasta Stonksin seurantalistastasi viimeisimmän haun yhteydessä.",items:snapshot.watchlist_picks}];
  for(const group of groups){
   const panel=make("section",undefined,"piksu-tips-section");
   panel.append(make("h3",group.name),make("p",group.subtitle,"muted"));
   const items=Array.isArray(group.items)?group.items:[];
   const grid=make("div",undefined,"piksu-tips-grid");
   for(const item of items.slice(0,group.name==="Kärkisijat"?8:15)){
    if(!item||typeof item.company!=="string"||!Number.isFinite(Number(item.reference_price))||!Number.isFinite(Number(item.target_price))||!Number.isFinite(Number(item.potential_pct)))continue;
    grid.append(card(item));
   }
   if(!grid.children.length)panel.append(make("p","Ei osumia tässä haussa.","muted"));
   else panel.append(grid);
   sections.append(panel);
  }
 }
 async function request(action){
  if(busy)return;
  const session=await currentSession();
  if(!session){status.textContent="Kirjaudu sisään nähdäksesi Tärpit.";return}
  const token=++epoch;busy=true;refresh.disabled=true;load.disabled=true;
  status.textContent=action==="refresh"?"Tarkistetaan lähdettä käyttäjän pyynnöstä…":"Haetaan aiemmin tallennettuja tietoja…";
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
   let response;
   try{response=await fetch(url,{method:"POST",signal:controller.signal,
    headers:{Authorization:"Bearer "+session.access_token,apikey:key,"Content-Type":"application/json"},
    body:JSON.stringify({action})})}finally{clearTimeout(timer)}
   const data=await response.json();
   if(!response.ok)throw Error(typeof data?.error==="string"?data.error:"Tietojen käsittely epäonnistui");
   const now=await currentSession();
   if(token!==epoch||now?.user?.id!==session.user.id)return;
   render(data.snapshot);
   status.textContent=action==="refresh"?"Lähde tarkistettu ja tallennettu. OpenAI-kutsuja ei tehty.":"Tallennettu tilannekuva avattu. Ulkoista lähdettä ei haettu.";
  }catch(e){if(token===epoch)status.textContent=e?.name==="AbortError"?"Tietojen haku aikakatkaistiin.":"Haku epäonnistui: "+String(e?.message||"Tuntematon virhe");}
  finally{busy=false;refresh.disabled=false;load.disabled=false}
 }
 refresh.addEventListener("click",()=>void request("refresh"));
 load.addEventListener("click",()=>void request("load"));
 document.addEventListener("agent:view-changed",e=>{if(e.detail?.view==="tips"&&summary.children.length===0)void request("load")});
 db.auth.onAuthStateChange(()=>{epoch++;summary.replaceChildren();sections.replaceChildren();status.textContent="Kirjautumistila muuttui. Avaa tallennettu lista uudelleen.";});
}
