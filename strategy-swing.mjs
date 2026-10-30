// EOD swing-screening research. No executable order prices or backdated fills.
import {validateHistory} from "./stock-chart-utils.mjs";
export function evaluateSwingCandidate(raw,receivedAt=Date.now()){
 const p=validateHistory(raw);
 if(raw?.period!=="1y"||!p||p.length<205||p.length>360||raw.price_kind!=="unadjusted_close"||!Number.isFinite(receivedAt))return {status:"insufficient_data",reason:"Päiväkurssisarja puuttuu tai ei ole vertailukelpoinen."};
 const last=p.at(-1),marketAt=last.t*1000;
 if(marketAt>receivedAt+300000||receivedAt-marketAt>7*86400000||marketAt-p[0].t*1000<230*86400000)return {status:"insufficient_data",reason:"Kurssihavainto on liian vanha, tulevaisuudesta tai aikasarja liian lyhyt."};
 const prices=p.map(x=>x.price);
 const sma200=prices.slice(-200).reduce((a,v)=>a+v,0)/200;
 const high20=Math.max(...prices.slice(-21,-1));
 // Presence of reliable market volume matters: never silently infer liquidity
 // from OHLC prices; actual spread cannot be confirmed by this data source.
 const volumes=raw.points.slice(-21).map(x=>x.volume);
 if(volumes.some(x=>!Number.isSafeInteger(x)||x<=0))return {status:"insufficient_data",reason:"Kaupankäyntivolyymin havaintoja puuttuu."};
 const averageVolume=volumes.slice(0,20).reduce((a,b)=>a+b,0)/20;
 const volumeRatio=volumes[20]/averageVolume;
 const rules={aboveSma200:last.price>sma200,breakout20:last.price>high20,volumeAboveAverage:volumeRatio>1};
 const all=Object.values(rules).every(Boolean);
 return {status:all?"watch_candidate":"no_action",rules,close:last.price,sma200,previous20High:high20,volumeRatio,
  marketAt:new Date(marketAt).toISOString(),receivedAt:new Date(receivedAt).toISOString(),
  source:"Yahoo Finance (epävirallinen, mahdollisesti viivästynyt)",quoteType:"päivän viimeinen havainto / ei varmistettu toteutushinta",
  brokerSpread:"ei saatavilla",executionPrice:null,
  nextStep:all?"Tarkista seuraavan kaupankäyntikerran hinta, spread, likviditeetti, kulut, uutiset ja riskirajat ennen päätöstä.":"Ei toimenpidettä.",
  disclaimer:"Viivästetty päivähavainto ei oikeuta jälkikäteistä ostoa samalla päätöskurssilla. Tämä on tutkimusehdokas, ei toimeksianto."};
}
