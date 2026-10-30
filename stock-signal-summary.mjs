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
 host.append(el("p","Tutkimisprioriteetti ja tekniset pisteet näkyvät yhdistetyissä osakekorteissa alempana.","muted"));

}
