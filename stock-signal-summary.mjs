// Purely descriptive watchlist overview. No AI calls, network requests or trades.
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
const fmt=n=>Number(n).toLocaleString("fi-FI",{maximumFractionDigits:1});
export function renderSignalSummary(results,host,total){
 host.replaceChildren();
 const items=[...results.values()],valid=items.filter(x=>x.result),failed=items.length-valid.length;
 const now=Date.now();
 const stale=valid.filter(x=>!Number.isFinite(Date.parse(x.result.asOf))||now-Date.parse(x.result.asOf)>5*86400000);
 const heading=el("h4","Signaaliyhteenveto · "+valid.length+"/"+total+" analysoitu","signal-summary-title");
 host.append(heading);
 if(!items.length){host.append(el("p","Yhteenveto muodostuu, kun käynnistät signaalien laskennan.","muted"));return}
 const up=valid.filter(x=>x.result.sma50>x.result.sma200).length;
 const down=valid.filter(x=>x.result.sma50<x.result.sma200).length;
 const mixed=valid.length-up-down;
 const highRsi=valid.filter(x=>x.result.overbought).length;
 const lowRsi=valid.filter(x=>x.result.oversold).length;
 const stats=el("div",undefined,"signal-summary-stats");
 for(const [label,value] of [["Nouseva trendi",up],["Laskeva trendi",down],["Neutraali",mixed],["Yliostettu RSI",highRsi],["Ylimyyty RSI",lowRsi],["Puuttuva analyysi",Math.max(0,total-valid.length)],["Yli 5 pv vanhat",stale.length]]){
  const card=el("div",undefined,"signal-summary-stat");card.append(el("strong",String(value)),el("span",label));stats.append(card)
 }
 host.append(stats);
 const intro=el("p",valid.length===total?"Kaikkien seurantalistan osakkeiden tekniset havainnot käsitelty.":"Osittainen yhteenveto: "+(total-valid.length)+" osakkeen signaali puuttuu. Osittaisia tuloksia ei pidä tulkita koko seurantalistan tilanteeksi.","muted");host.append(intro);
 if(failed)host.append(el("p",failed+" käsitellyssä osakkeessa historia puuttui tai haku epäonnistui.","muted"));
 const scored=valid.map(({item,result})=>{
  let score=0;const reasons=[],warnings=[];
  if(result.sma50>result.sma200){score+=2;reasons.push("SMA50 yli SMA200")}else if(result.sma50<result.sma200){score-=2;warnings.push("SMA50 alle SMA200")}
  if(result.macd){if(result.macd.bullishCross){score+=2;reasons.push("MACD:n nouseva risteämä")}else if(result.macd.bearishCross){score-=2;warnings.push("MACD:n laskeva risteämä")}else if(result.macd.histogram>0){score+=1;reasons.push("MACD-histogrammi positiivinen")}else if(result.macd.histogram<0){score-=1;warnings.push("MACD-histogrammi negatiivinen")}}
  if(result.overbought)warnings.push("RSI yli 70: nousu voi olla venynyt");
  if(result.oversold)warnings.push("RSI alle 30: lasku voi jatkua");
  if(result.goldenCross){score+=2;reasons.push("Tuore golden cross")}if(result.deathCross){score-=2;warnings.push("Tuore death cross")}
  if(result.volume?.unusuallyHigh)reasons.push("Poikkeuksellisen korkea volyymi, suunta tarkistettava");
  const age=now-Date.parse(result.asOf);
  const quality=!Number.isFinite(age)||age>5*86400000?"Vanhentunut: tarkista ennen päätöstä":"Historiallinen sulkemishinta";
  if(!Number.isFinite(age)||age>5*86400000)warnings.push("Hintahavainto yli 5 päivää vanha");
  if(reasons.length&&warnings.some(w=>/MACD:n laskeva|SMA50 alle|death cross/.test(w)))warnings.push("Tekniset signaalit ristiriidassa");
  return {item,result,score,reasons,warnings,quality};
 }).sort((a,b)=>Number(a.quality.startsWith("Vanhentunut"))-Number(b.quality.startsWith("Vanhentunut"))||b.score-a.score||a.item.ticker.localeCompare(b.item.ticker));
 const title=el("h5","Tutkimisjärjestys – teknisten havaintojen perusteella");host.append(title);
 if(stale.length)host.append(el("p","Huomio: "+stale.length+" osakkeen havainto on yli viisi vuorokautta vanha. Nämä näytetään järjestyksen lopussa.","muted"));
 const list=el("div",undefined,"signal-summary-ranking");
 for(const x of scored){
  const row=el("article",undefined,"signal-summary-entry");
  const label=x.score>=3?"Positiivisia havaintoja":x.score<=-3?"Negatiivisia havaintoja":"Ristiriitainen / neutraali";
  row.append(el("strong",x.item.name+" · "+x.item.ticker),el("span",label+" · pisteet "+(x.score>0?"+":"")+x.score));
  row.append(el("small",[...x.reasons,...x.warnings].join(" · ")||"Ei vahvoja havaintoja","muted"));
  row.append(el("small","RSI "+fmt(x.result.rsi14)+" · havainto "+new Date(x.result.asOf).toLocaleDateString("fi-FI")+" · "+x.quality,"muted"));
  list.append(row);
 }
 host.append(list,el("p","Pisteet ovat avoin, suuntaa-antava teknisten havaintojen järjestys, eivät ostosuositus, tuottoennuste tai tavoitehinta. Volyymi ei määrää suuntaa. Yahoo Finance -historia voi olla viivästynyttä.","muted"));
}
