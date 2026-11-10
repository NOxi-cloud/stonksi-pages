import {evaluateSwingCandidate} from "./strategy-swing.mjs";
import {evaluateTechnicalConfirmation,CONFIRMATION_VERSION} from "./strategy-confirmation.mjs";
// Descriptive post-signal price comparison. No order simulation or forecast.
// Re-evaluate each prefix: no future prices enter the signal computation.
const helsinkiDay=ms=>{const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(ms);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day};
export function backtestSwingHistory(raw,maxCases=550){
 if(!["1y","3y"].includes(raw?.period)||!Array.isArray(raw.points)||raw.points.length<215||raw.points.length>750)return {error:"Tarvitaan 215–750 kelvollista päivähavaintoa (1v tai 3v)."};
 const rows=raw.points;
 const cap=Math.max(1,Math.min(550,Math.floor(maxCases)||550));
 // Latest five observations cannot be evaluated because their outcomes are unknown.
 const maxIndex=rows.length-6,start=Math.max(205,maxIndex-cap+1),results=[];
 for(let i=start;i<=maxIndex;i++){
  const current=rows[i];
  if(!Number.isSafeInteger(current?.t)||!Number.isFinite(current?.price)||current.price<=0)continue;
  const prefix={...raw,period:"1y",points:rows.slice(Math.max(0,i-359),i+1)};
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
  const technical=evaluateTechnicalConfirmation(prefix.points.map(p=>p.price));
  results.push({index:i,regime,technicalConfirmed:technical.confirmed,technicalAvailable:technical.available,rsi14:technical.rsi,macdHistogram:technical.histogram,day:helsinkiDay(current.t*1000),signal:assessment.status,score:assessment.score,
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
 const confirmed=candidates.filter(r=>r.technicalConfirmed);
 const independentConfirmed=[];let confirmedEnd=-1;
 for(const observation of confirmed){
  if(observation.index>confirmedEnd){independentConfirmed.push(observation);confirmedEnd=observation.index+5}
 }
 const confirmedMean=average(confirmed),confirmedPositive=confirmed.filter(r=>r.changePct>0).length;
 const confirmedIndependentMean=average(independentConfirmed);
 // Cost sensitivity applies an illustrative round-trip percentage deduction to close-to-close price changes.
 // It is NOT an executable P/L estimate; fills, FX, taxes, spread, corporate actions and dividends are unmodelled.
 const costScenarios=[0,0.25,0.5,1].map(costPct=>({
  costPct, candidates:candidates.length,independentCount:independent.length,
  meanAfterCost:mean===null?null:mean-costPct,
  independentMeanAfterCost:independentMean===null?null:independentMean-costPct,
  positiveAfterCost:candidates.filter(row=>row.changePct>costPct).length
 }));
 const byYear=Object.fromEntries([...new Set(results.map(row=>row.day.slice(0,4)))].sort().map(year=>{
  const observations=results.filter(row=>row.day.startsWith(year)),signals=observations.filter(row=>row.signal==="watch_candidate"),
   confirmedSignals=signals.filter(row=>row.technicalConfirmed);
  return [year,{observations:observations.length,candidates:signals.length,mean:average(signals),
   confirmed:confirmedSignals.length,confirmedMean:average(confirmedSignals),
   baselineMean:average(observations)}];
 }));
 const sampleQuality={
  independentCandidates:independent.length,independentConfirmed:independentConfirmed.length,
  candidateSample:independent.length>=20?"limited":independent.length>=5?"weak":"insufficient",
  confirmedSample:independentConfirmed.length>=20?"limited":independentConfirmed.length>=5?"weak":"insufficient",
  caveats:["Aikasarjan jaksot voivat olla päällekkäisiä.","Viivästynyt data ja hintakorjaukset voivat muuttaa havaintoja.","RSI/MACD-suodatin on valittu ilman riippumatonta validointia."]
 };
 const confirmation={version:CONFIRMATION_VERSION,eligible:candidates.length,confirmed:confirmed.length,
   positive:confirmedPositive,mean:confirmedMean,
   rejected:candidates.length-confirmed.length,independentCount:independentConfirmed.length,
   independentMean:confirmedIndependentMean,
   comparisonDifference:confirmedMean===null||mean===null?null:confirmedMean-mean};
 const regimes=Object.fromEntries(["rising","sideways","falling"].map(regime=>{
   const group=results.filter(r=>r.regime===regime),selected=group.filter(r=>r.signal==="watch_candidate");
   return [regime,{observations:group.length,candidates:selected.length,mean:average(selected),baseline:average(group)}];
 }));
 return {rows:results.map(({index,...rest})=>rest),candidates:candidates.length,mean,baselineMean,positiveCount:positive,independentCount:independent.length,independentMean,independentPositive,regimes,confirmation,costScenarios,byYear,sampleQuality,
  relativeDifference:mean!==null&&baselineMean!==null?mean-baselineMean:null,
  disclaimer:"Kuvaileva, jälkikäteen laskettu 5 havaintopäivän kurssivertailu. Kaikki jaksot voivat olla päällekkäisiä. Erillinen aikajärjestyksessä valittu, ei-päällekkäinen ehdokasotos on myös pieni ja valikoitunut. Markkinatilanne luokitellaan SMA50:n viiden havaintopäivän muutoksella (raja ±0,75 %), ei laajan markkinaindeksin perusteella. RSI/MACD-rajat ovat tutkimusolettamia, eivät optimoituja tai todennettuja. Vahvistusryhmä on swing-ehdokkaiden osajoukko, ei riippumaton vertailuryhmä. Kustannusherkkyys on prosenttivähennys, ei todellinen kaupankäyntituotto. Toteutushintoja, osinkoja, veroja, valuuttakuluja tai riskikorjattua tuottoa ei lasketa. Tulokset eivät ennusta tulevaa."};
}
