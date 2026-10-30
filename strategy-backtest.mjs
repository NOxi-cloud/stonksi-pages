import {evaluateSwingCandidate} from "./strategy-swing.mjs";
// Descriptive post-signal price comparison. No order simulation or forecast.
// Re-evaluate each prefix: no future prices enter the signal computation.
const helsinkiDay=ms=>{const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(ms);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day};
export function backtestSwingHistory(raw,maxCases=35){
 if(raw?.period!=="1y"||!Array.isArray(raw.points)||raw.points.length<215||raw.points.length>360)return {error:"Vähintään 215 kelvollista päivähavaintoa tarvitaan."};
 const rows=raw.points;
 const cap=Math.max(1,Math.min(35,Math.floor(maxCases)||35));
 // Latest five observations cannot be evaluated because their outcomes are unknown.
 const maxIndex=rows.length-6,start=Math.max(205,maxIndex-cap+1),results=[];
 for(let i=start;i<=maxIndex;i++){
  const current=rows[i];
  if(!Number.isSafeInteger(current?.t)||!Number.isFinite(current?.price)||current.price<=0)continue;
  const prefix={...raw,points:rows.slice(0,i+1)};
  // Only available data through this historical candle. End-of-day after close.
  // 23:59 UTC is after the local Helsinki close for these daily observations.
  const assessedAt=Date.parse(new Date(current.t*1000).toISOString().slice(0,10)+"T23:59:00Z");
  const assessment=evaluateSwingCandidate(prefix,assessedAt);
  if(!assessment.rules||assessment.provisional||assessment.marketAt!==new Date(current.t*1000).toISOString())continue;
  const later=rows[i+5];
  if(!Number.isFinite(later?.price)||later.price<=0)continue;
  const sma50=rows.slice(i-49,i+1).reduce((a,p)=>a+p.price,0)/50;
  const pastSma50=rows.slice(i-54,i-4).reduce((a,p)=>a+p.price,0)/50;
  const trendPct=(sma50/pastSma50-1)*100;
  const regime=trendPct>0.75?"rising":trendPct< -0.75?"falling":"sideways";
  results.push({index:i,regime,day:helsinkiDay(current.t*1000),signal:assessment.status,score:assessment.score,
   price:assessment.close,laterPrice:later.price,
   changePct:(later.price/assessment.close-1)*100,horizon:"5 seuraavaa havaintoa"});
 }
 const candidates=results.filter(r=>r.signal==="watch_candidate");
 const average=arr=>arr.length?arr.reduce((sum,r)=>sum+r.changePct,0)/arr.length:null;
 const mean=average(candidates),baselineMean=average(results);
 const positive=candidates.filter(r=>r.changePct>0).length;
 const independent=[];let lastEnd=-1;
 for(const candidate of candidates){
  if(candidate.index>lastEnd){independent.push(candidate);lastEnd=candidate.index+5}
 }
 const independentMean=average(independent),independentPositive=independent.filter(r=>r.changePct>0).length;
 const regimes=Object.fromEntries(["rising","sideways","falling"].map(regime=>{
   const group=results.filter(r=>r.regime===regime),selected=group.filter(r=>r.signal==="watch_candidate");
   return [regime,{observations:group.length,candidates:selected.length,mean:average(selected),baseline:average(group)}];
 }));
 return {rows:results.map(({index,...rest})=>rest),candidates:candidates.length,mean,baselineMean,positiveCount:positive,independentCount:independent.length,independentMean,independentPositive,regimes,
  relativeDifference:mean!==null&&baselineMean!==null?mean-baselineMean:null,
  disclaimer:"Kuvaileva, jälkikäteen laskettu 5 havaintopäivän kurssivertailu. Kaikki jaksot voivat olla päällekkäisiä. Erillinen aikajärjestyksessä valittu, ei-päällekkäinen ehdokasotos on myös pieni ja valikoitunut. Markkinatilanne luokitellaan SMA50:n viiden havaintopäivän muutoksella (raja ±0,75 %), ei laajan markkinaindeksin perusteella. Ei kauppojen toteutushintoja, kustannuksia, osinkoja tai riskikorjattua tuottoa. Tulokset eivät ennusta tulevaa."};
}
