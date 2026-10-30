// Combined research priority is an information-quality workflow, not a trading score.
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
export function renderResearchPriorities(host,signals,valuations,stocks,now=Date.now()){
 host.replaceChildren();
 host.append(make("h4","Tutkimisjärjestys · tekninen tilanne ja arvostus","signal-summary-title"));
 if(!signals.size){host.append(make("p","Laske ensin tekniset signaalit. Tallennettujen arvostusten haku tehdään erikseen omalla painikkeella.","muted"));return}
 const results=[];
 for(const item of stocks.slice(0,30)){
  const entry=signals.get(item.id);
  if(!entry?.result)continue;
  const s=entry.result,valuation=valuations.get(item.ticker.toUpperCase());
  const age=now-Date.parse(s.asOf),fresh=Number.isFinite(age)&&age>=0&&age<=5*86400000;
  const trend=s.sma50>s.sma200?"nouseva":s.sma50<s.sma200?"laskeva":"neutraali";
  const macd=s.macd?.bearishCross?"heikkenevä":s.macd?.bullishCross?"vahvistuva":s.macd?.histogram>0?"positiivinen":s.macd?.histogram<0?"negatiivinen":"puuttuu";
  let priority="Seuraa",order=2,why="Tekninen kuva ei yksin anna selvää tutkimissuuntaa.";
  if(!fresh){priority="Päivitä data",order=0;why="Teknisen havainnon ikä ylittää viisi päivää."}
  else if(trend==="nouseva"&&(macd==="vahvistuva"||macd==="positiivinen")&&!s.overbought){priority="Tutki tarkemmin",order=1;why="Nouseva trendi ja positiivinen momentti ovat samansuuntaisia."}
  else if(trend==="laskeva"&&(macd==="heikkenevä"||macd==="negatiivinen")){priority="Tarkista riskit",order=1;why="Laskeva trendi ja heikko momentti ovat samansuuntaisia."}
  else if((trend==="nouseva"&&macd==="heikkenevä")||(trend==="laskeva"&&macd==="vahvistuva")){priority="Ristiriita",order=1;why="Trendi ja MACD:n tuore risteämä viittaavat eri suuntiin."}
  const notes=["Trendi "+trend,"MACD "+macd,"RSI "+s.rsi14.toLocaleString("fi-FI")];
  if(s.overbought)notes.push("RSI yli 70");if(s.oversold)notes.push("RSI alle 30");
  if(valuation){
   const t=valuation.target,reportAge=now-Date.parse(valuation.date);
   const verified=t.kind==="verified_analyst_target";
   notes.push(verified?"Tallennettu analyytikon tavoitehinta":"Ehdollinen Base-arvo");
   if(!Number.isFinite(reportAge)||reportAge<0||reportAge>90*86400000)notes.push("Yritysanalyysi yli 90 pv vanha / päiväys puuttuu");
   const quoteAge=now-Date.parse(item.price_time);
   if(verified&&Number.isFinite(reportAge)&&reportAge>=0&&reportAge<=90*86400000&&Number.isFinite(quoteAge)&&quoteAge>=0&&quoteAge<=5*86400000&&Number.isFinite(Number(item.price))&&Number(item.price)>0&&String(item.currency||"").toUpperCase()===String(t.currency||"").toUpperCase()){
    const delta=100*(t.price/Number(item.price)-1);
    notes.push("Tavoitteen ja kurssin erotus "+(delta>=0?"+":"")+delta.toLocaleString("fi-FI",{maximumFractionDigits:1})+" %");
   }else notes.push("Ei ajantasaista vertailukelpoista tavoitehinta–kurssi-paria");
  }else notes.push("Ei tallennettua arvostustietoa");
  const technicalScore=(trend==="nouseva"?2:trend==="laskeva"?-2:0)+(s.macd?.bullishCross?2:s.macd?.bearishCross?-2:s.macd?.histogram>0?1:s.macd?.histogram<0?-1:0)+(s.goldenCross?2:0)-(s.deathCross?2:0);
  notes.unshift("Tekniset pisteet "+(technicalScore>0?"+":"")+technicalScore);
  results.push({item,priority,order,why,notes,technicalScore});
 }
 results.sort((a,b)=>a.order-b.order||b.technicalScore-a.technicalScore||a.item.name.localeCompare(b.item.name,"fi"));
 const grid=make("div",undefined,"signal-summary-ranking");
 for(const r of results){
  const card=make("article",undefined,"signal-summary-entry");
  card.append(make("strong",r.item.name+" · "+r.item.ticker),make("span",r.priority),make("small",r.why,"muted"),make("small",r.notes.join(" · "),"muted"));grid.append(card);
 }
 host.append(make("p",results.length+" osakkeen tutkimisjärjestys. Merkinnät kertovat seuraavan tarkistettavan asian, eivät osto- tai myyntisuositusta.","muted"),grid);
}