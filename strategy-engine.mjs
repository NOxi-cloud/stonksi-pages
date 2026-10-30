// Deterministic paper-trading controls. No order placement or broker integration.
export function positionRisk({capital,riskPercent,entry,stop,fee=0}){
 const x=[capital,riskPercent,entry,stop,fee];
 if(x.some(v=>typeof v!=="number"||!Number.isFinite(v))||capital<=0||riskPercent<=0||riskPercent>2||entry<=0||stop<=0||stop>=entry||fee<0)return null;
 const budget=capital*riskPercent/100,perShare=entry-stop+2*fee;
 const quantity=Math.max(0,Math.min(Math.floor(budget/perShare),Math.floor(capital/(entry+fee))));
 return {budget,quantity,plannedExposure:quantity*entry,maxModelLoss:quantity*perShare,warning:"Stop ei takaa toteutushintaa; liukuma voi kasvattaa tappiota."};
}
export function paperMetrics(rows,strategy,capital){
 const items=rows.filter(r=>r.strategy===strategy&&r.status==="closed"&&Number.isFinite(r.pnl));
 const net=items.reduce((s,r)=>s+r.pnl,0);
 let equity=capital,peak=capital,maxDrawdown=0;
 for(const row of items.slice().sort((a,b)=>a.closed_at.localeCompare(b.closed_at))){
  equity+=row.pnl;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak>0?(peak-equity)/peak*100:0);
 }
 return {trades:items.length,net,winRate:items.length?items.filter(x=>x.pnl>0).length/items.length*100:null,maxDrawdown};
}
export function dayTradeDataGate(input){
 if(!input?.minuteBarsVerified||!input?.liveBidAskVerified||!input?.marketPhaseVerified||!input?.feesVerified)
  return {enabled:false,reason:"Avaushaarukkastrategia vaatii varmennetut minuuttikynttilät, reaaliaikaiset osto-/myyntitarjoukset, markkinavaiheen ja kulut."};
 return {enabled:false,reason:"Paperisignaalin toteutus vaatii vielä lähdekohtaisen validoinnin ja historiallisen testauksen."};
}
