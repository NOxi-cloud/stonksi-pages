// EOD swing-screening research. Never treat an in-progress daily candle as settled.
import {validateHistory} from "./stock-chart-utils.mjs";
const helsinkiParts=ms=>{const d=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(ms);const v=Object.fromEntries(d.map(x=>[x.type,x.value]));return {day:v.year+"-"+v.month+"-"+v.day,minutes:Number(v.hour)*60+Number(v.minute)}};
export function evaluateSwingCandidate(raw,receivedAt=Date.now()){
 const history=validateHistory(raw);
 if(raw?.period!=="1y"||!history||history.length<205||history.length>360||raw.price_kind!=="unadjusted_close"||!Number.isFinite(receivedAt))return {status:"insufficient_data",reason:"Päiväkurssisarja puuttuu tai ei ole vertailukelpoinen."};
 const now=helsinkiParts(receivedAt),lastPoint=history.at(-1);
 // Helsinki equities regular trading finishes 18:30 local. Conservative 15 minute data buffer.
 const unfinished=helsinkiParts(lastPoint.t*1000).day===now.day && now.minutes<18*60+45;
 const p=unfinished?history.slice(0,-1):history;
 if(p.length<205)return {status:"insufficient_data",reason:"Vahvistettuja päivähavaintoja ei ole riittävästi.",provisional:unfinished};
 const last=p.at(-1),marketAt=last.t*1000;
 if(marketAt>receivedAt+300000||receivedAt-marketAt>7*86400000||marketAt-p[0].t*1000<230*86400000)return {status:"insufficient_data",reason:"Viimeisin valmis kurssihavainto on liian vanha tai aikasarja on liian lyhyt.",provisional:unfinished};
 const prices=p.map(x=>x.price);
 const sma200=prices.slice(-200).reduce((a,v)=>a+v,0)/200;
 const high20=Math.max(...prices.slice(-21,-1));
 const recent=p.slice(-21);
 const volumes=recent.map(x=>raw.points.find(y=>y.t===x.t)?.volume);
 if(volumes.some(x=>!Number.isSafeInteger(x)||x<=0))return {status:"insufficient_data",reason:"Kaupankäyntivolyymin havaintoja puuttuu.",provisional:unfinished};
 const averageVolume=volumes.slice(0,20).reduce((a,b)=>a+b,0)/20;
 const volumeRatio=volumes[20]/averageVolume;
 const rules={aboveSma200:last.price>sma200,breakout20:last.price>high20,volumeAboveAverage:volumeRatio>1};
 const passed=Object.values(rules).filter(Boolean).length;
 const all=passed===3;
 return {status:all?"watch_candidate":"no_action",rules,passed,score:Math.round(passed/3*100),close:last.price,sma200,previous20High:high20,volumeRatio,provisional:unfinished,
  marketAt:new Date(marketAt).toISOString(),receivedAt:new Date(receivedAt).toISOString(),
  source:"Yahoo Finance (epävirallinen, mahdollisesti viivästynyt)",quoteType:"päivän viimeinen valmis havainto / ei varmistettu toteutushinta",
  brokerSpread:"ei saatavilla",executionPrice:null,
  reason:unfinished?"Kuluvan päivän keskeneräinen kynttilä ohitettiin. Analyysi perustuu edelliseen valmiiseen päivähavaintoon.":"Laskettu viimeisimmästä käytettävissä olevasta päivähavainnosta; lähde ei takaa lopullista pörssin päätöskurssia.",
  nextStep:all?"Tarkista seuraavan kaupankäyntikerran hinta, spread, likviditeetti, kulut, uutiset ja riskirajat ennen päätöstä.":"Ei toimenpidettä.",
  disclaimer:"Viivästetty päivähavainto ei oikeuta jälkikäteistä ostoa samalla päätöskurssilla. Tämä on tutkimusehdokas, ei toimeksianto."};
}
