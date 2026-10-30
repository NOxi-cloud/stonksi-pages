import {evaluateSwingCandidate} from "./strategy-swing.mjs";
// Retrospective research only. No simulated fills, fees, or claims of achievable returns.
// A day's input may be used only after the Helsinki session has finished.
export function backtestSwingHistory(raw,maxCases=35){
 if(raw?.period!=="1y"||!Array.isArray(raw.points)||raw.points.length<215)return {error:"Vähintään 215 päiväkohtaista havaintoa tarvitaan."};
 const rows=raw.points, results=[];
 const maxIndex=rows.length-6;
 const start=Math.max(205,maxIndex-maxCases+1);
 for(let index=start;index<=maxIndex;index++){
  const history={...raw,points:rows.slice(0,index+1)};
  // Analyze only information available by 20:00 Helsinki local time that date.
  const date=new Date(rows[index].t*1000);
  const dateString=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Helsinki",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
  const clock=Date.parse(dateString+"T20:00:00+02:00");
  // Historical daylight saving changes make exact clock unreliable; use 23:59 UTC
  // of the observation date solely for this retrospective check.
  const receivedAt=Date.parse(date.toISOString().slice(0,10)+"T23:59:00Z");
  const assessment=evaluateSwingCandidate(history,receivedAt);
  if(!assessment.rules)continue;
  const fiveDaysLater=rows[index+5]?.price;
  if(!(typeof fiveDaysLater==="number"&&Number.isFinite(fiveDaysLater)))continue;
  results.push({day:dateString,signal:assessment.status,score:assessment.score,price:assessment.close,
   laterPrice:fiveDaysLater,changePct:(fiveDaysLater/assessment.close-1)*100,
   horizon:"5 seuraavaa havaintoa"});
 }
 const candidates=results.filter(x=>x.signal==="watch_candidate");
 const mean=candidates.length?candidates.reduce((a,x)=>a+x.changePct,0)/candidates.length:null;
 return {rows:results,candidates:candidates.length,mean,disclaimer:"Historiallinen kuvaileva testi. Ei toteutettavia osto-/myyntihintoja, eikä kuluja, spreadia, osinkoja tai slippagea. Aiempi menestys ei ennusta tulevaa."};
}
