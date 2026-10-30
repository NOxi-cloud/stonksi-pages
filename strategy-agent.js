import {evaluateSwingCandidate} from "./strategy-swing.mjs";
import {getCachedDaily,storeCachedDaily} from "./stock-history-cache.mjs";
import {positionRisk,paperMetrics,dayTradeDataGate} from "./strategy-engine.mjs";
const root=document.getElementById("strategy-agent-workspace"),db=window.agentSupabaseClient;
const e=(tag,label,cls)=>{const x=document.createElement(tag);if(label!==undefined)x.textContent=label;if(cls)x.className=cls;return x};
const input=(label,value)=>{const l=e("label",label),x=e("input");x.value=value;x.type="number";x.min="0";x.step="any";l.append(x);return {l,x}};
let uid=null,records=[],settings={day:1000,long:5000,risk:.5,maxDayLoss:25};
const key=()=>uid?"stonksi-strategy-sandbox-"+uid:null;
const save=()=>{if(uid)sessionStorage.setItem(key(),JSON.stringify({records,settings}))};
function restore(){try{const o=JSON.parse(sessionStorage.getItem(key())||"null");if(o&&Array.isArray(o.records)&&o.records.length<500){records=o.records;settings={...settings,...o.settings}}}catch{}}
function render(){
 root.replaceChildren();
 root.append(e("p","Paperikaupankäynnin ja sijoitusteesien työtila. Käynnistät jokaisen tietohaun itse. Ei toimeksiantoja, ei taustalla toimivaa agenttia.","muted"));
 const cols=e("div",undefined,"strategy-columns"),day=e("section",undefined,"panel"),long=e("section",undefined,"panel");
 cols.append(day,long);root.append(cols);
 day.append(e("h2","Päiväkauppa · harjoittelu"),e("p",dayTradeDataGate({}).reason,"muted"));
 long.append(e("h2","Pitkäaikainen sijoittaminen"),e("p","Tallenna sijoitusteesi ja sen kumoutumisehdot. Päiväkaupan tappio ei koskaan siirry automaattisesti pitkäaikaiseksi sijoitukseksi.","muted"));
 const a=input("Päiväkaupan pääoma €",settings.day),b=input("Pitkän salkun pääoma €",settings.long),r=input("Riski % / päiväkauppa",settings.risk),limit=input("Päivän tappioraja €",settings.maxDayLoss);
 for(const c of [a,r,limit])day.append(c.l);long.append(b.l);
 const saveBtn=e("button","Tallenna strategioiden rajat","secondary-btn"),info=e("p","","muted");saveBtn.type="button";day.append(saveBtn,info);
 saveBtn.onclick=()=>{const values=[a,b,r,limit].map(t=>Number(t.x.value));if(values.some(n=>!Number.isFinite(n)||n<=0)||values[2]>2||values[0]>1e7||values[1]>1e7){info.textContent="Virheelliset arvot. Riski korkeintaan 2 %.";return}settings={day:values[0],long:values[1],risk:values[2],maxDayLoss:values[3]};save();info.textContent="Tallennettu selainistuntoon.";draw()};
 const riskForm=e("form",undefined,"strategy-form"),entry=input("Ostohinta €",10),stop=input("Stop €",9.6),fee=input("Kulut / osake €",.01),result=e("p","Position koko on laskennallinen, stop ei takaa toteutushintaa.","muted");
 riskForm.append(entry.l,stop.l,fee.l,e("button","Laske position koko","secondary-btn"));day.append(riskForm,result);
 riskForm.onsubmit=event=>{event.preventDefault();const v=positionRisk({capital:settings.day,riskPercent:settings.risk,entry:Number(entry.x.value),stop:Number(stop.x.value),fee:Number(fee.x.value)});result.textContent=v?"Enintään "+v.quantity+" osaketta · laskennallinen riski "+v.maxModelLoss.toFixed(2)+" €. "+v.warning:"Tarkista hinnat ja stop-taso."};
 const swing=e("section",undefined,"panel");root.append(swing);
 swing.append(e("h2","Swing · päivistä viikkoihin"),e("p","Tutkii päivän viimeistä havaintoa, 200 päivän trendiä, edeltävän 20 päivän huippua ja volyymia. Ehdokas koskee vasta seuraavaa kaupankäyntikertaa.","muted"));
 const swingTicker=e("input");swingTicker.placeholder="Ticker, esim. NOKIA.HE";swingTicker.maxLength=20;
 const swingRun=e("button","Tarkista swing-ehdokas","secondary-btn");swingRun.type="button";
 const swingOutput=e("div");swing.append(swingTicker,swingRun,swingOutput);
 swingRun.onclick=async()=>{const symbol=swingTicker.value.trim().toUpperCase();if(!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(symbol)){swingOutput.textContent="Tarkista osaketunnus.";return}
  swingRun.disabled=true;swingOutput.textContent="Haetaan yhden vuoden hintahistoriaa…";
  const expectedUser=uid;
  try{const {data:{session}}=await db.auth.getSession();if(!session?.access_token||session.user.id!==expectedUser)throw Error("Kirjaudu sisään");
   let data=getCachedDaily(expectedUser,symbol);
   if(!data){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
    let response;try{response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/stock-quotes",{method:"POST",signal:ctrl.signal,headers:{Authorization:"Bearer "+session.access_token,apikey:"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE","Content-Type":"application/json"},body:JSON.stringify({action:"history",symbol,period:"1y"})})}finally{clearTimeout(timer)}
    const payload=await response.json();if(!response.ok)throw Error(payload.error||"Kurssihaku epäonnistui");
    const {data:{session:check}}=await db.auth.getSession();if(check?.user?.id!==expectedUser)return;
    storeCachedDaily(expectedUser,symbol,payload);data=payload;
   }
   if(uid!==expectedUser)return;const v=evaluateSwingCandidate(data,Date.now());swingOutput.replaceChildren();
   swingOutput.append(e("h3",v.status==="watch_candidate"?"Seurantaehdokas":v.status==="no_action"?"Ei toimenpidettä":"Ei riittävästi tietoa"));
   for(const line of [v.reason,v.marketAt&&"Markkinahavainto: "+v.marketAt,v.receivedAt&&"Tieto käsitelty: "+v.receivedAt,v.close&&"Viimeisin havaintohinta: "+v.close,v.volumeRatio&&"Vaihto suhteessa 20 päivään: "+v.volumeRatio.toFixed(2)+"×",v.nextStep,v.disclaimer].filter(Boolean))swingOutput.append(e("p",String(line),"muted"));
  }catch(err){if(uid===expectedUser)swingOutput.textContent="Tarkistus ei onnistunut: "+err.message}finally{swingRun.disabled=false}
 };
 const form=e("form",undefined,"strategy-form"),ticker=e("input"),thesis=e("textarea"),invalidates=e("textarea"),thesisList=e("div");
 ticker.placeholder="Yhtiön ticker, esim. NOKIA.HE";ticker.maxLength=20;thesis.placeholder="Miksi omistaisin yhtiötä?";invalidates.placeholder="Mikä muutos kumoaa sijoitusteesin?";for(const t of [thesis,invalidates]){t.maxLength=1000;t.required=true}ticker.required=true;
 form.append(ticker,thesis,invalidates,e("button","Tallenna sijoitusteesi","secondary-btn"));long.append(form,thesisList);
 form.onsubmit=event=>{event.preventDefault();const t=ticker.value.trim().toUpperCase();if(!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(t))return;records.push({type:"thesis",strategy:"long",ticker:t,thesis:thesis.value.slice(0,1000),invalidates:invalidates.value.slice(0,1000)});save();draw();thesis.value="";invalidates.value=""};
 const search=e("button","Tarkista tallennettu yritysanalyysi","secondary-btn"),output=e("p","Haku käynnistyy vain painalluksesta.","muted");search.type="button";long.append(search,output);
 search.onclick=async()=>{search.disabled=true;output.textContent="Haetaan…";try{
 const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==uid)throw Error("Kirjaudu sisään");
 const {data,error}=await db.from("ai_research_reports").select("query,analysis,generated_at").eq("user_id",uid).order("generated_at",{ascending:false}).limit(30);
 if(error)throw error;const found=(data||[]).find(x=>x.query?.toUpperCase().includes(ticker.value.trim().toUpperCase())&&ticker.value.trim());
 output.textContent=found?"Tallennettu "+new Date(found.generated_at).toLocaleDateString("fi-FI")+" · "+found.analysis.slice(0,1500):"Tallennettua analyysiä ei löytynyt. Laadi analyysi Tutkimus-välilehdellä.";
 }catch(err){output.textContent="Haku epäonnistui: "+err.message}finally{search.disabled=false}};
 const paper=e("section",undefined,"panel");paper.append(e("h2","Paperikauppojen tulosseuranta"));root.append(paper);
 const log=e("form",undefined,"strategy-form"),select=e("select");for(const [v,label] of [["day","Päiväkauppa"],["long","Pitkäaikainen"]]){const o=e("option",label);o.value=v;select.append(o)}
 const stock=e("input"),buy=input("Osto €",10),sell=input("Myynti €",11),qty=input("Kpl",5),cost=input("Kulut €",2);
 stock.placeholder="Ticker";stock.maxLength=20;log.append(select,stock,buy.l,sell.l,qty.l,cost.l,e("button","Kirjaa suljettu paperikauppa","secondary-btn"));paper.append(log);
 const numbers=e("div"),history=e("div");paper.append(numbers,history);
 log.onsubmit=event=>{event.preventDefault();const v=[buy,sell,qty,cost].map(x=>Number(x.x.value));if(v.some(n=>!Number.isFinite(n)||n<0)||v[0]<=0||!Number.isSafeInteger(v[2])||v[2]<=0||v[2]>1e7||! /^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(stock.value.trim().toUpperCase()))return;
 records.push({type:"paper",strategy:select.value,status:"closed",ticker:stock.value.trim().toUpperCase(),pnl:(v[1]-v[0])*v[2]-v[3],closed_at:new Date().toISOString()});save();draw()};
 function draw(){
 numbers.replaceChildren();history.replaceChildren();thesisList.replaceChildren();
 for(const [type,name,cap] of [["day","Päiväkauppa",settings.day],["long","Pitkäaikainen",settings.long]]){const m=paperMetrics(records,type,cap);numbers.append(e("p",name+" · suljettuja "+m.trades+" · nettotulos "+m.net.toFixed(2)+" € · suurin lasku "+m.maxDrawdown.toFixed(1)+" %","muted"))}
 for(const x of records.filter(x=>x.type==="paper").slice(-10).reverse())history.append(e("p",x.ticker+" · "+x.strategy+" · "+x.pnl.toFixed(2)+" €","muted"));
 for(const x of records.filter(x=>x.type==="thesis").slice(-12).reverse())thesisList.append(e("p",x.ticker+" · "+x.thesis+" · Kumoutuu: "+x.invalidates,"muted"));
 }draw();
}
db.auth.onAuthStateChange((_evt,session)=>{const next=session?.user?.id||null;if(next===uid)return;uid=next;records=[];settings={day:1000,long:5000,risk:.5,maxDayLoss:25};if(uid)restore();render()});
const {data:{session}}=await db.auth.getSession();uid=session?.user?.id||null;if(uid)restore();render();
