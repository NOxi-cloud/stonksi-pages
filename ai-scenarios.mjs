// Render previously saved deterministic financial sensitivities without changing values.
// Do not parse free-form AI forecasts. Only the fixed-format backend-generated block.
const CASES=["Bear","Base","Bull"];
export function extractOperatingScenarioBlock(text){
 const raw=String(text||"");
 const lines=raw.split(/\r?\n/);
 const index=lines.findIndex(line=>/^Ehdolliset Bear \/ Base \/ Bull -tulosherkkyydet \(.+\):\s*$/.test(line.trim()));
 if(index<0||index+3>=lines.length)return {text:raw,scenario:null};
 const heading=lines[index].trim();
 const parsed=/^Ehdolliset Bear \/ Base \/ Bull -tulosherkkyydet \((.*)\):$/.exec(heading);
 if(!parsed)return {text:raw,scenario:null};
 const rowPattern=/^(Bear|Base|Bull): liikevaihto (-?\d+(?:\.\d+)?) (milj\. (?:USD|EUR|€)), (.+?) (-?\d+(?:\.\d+)?) \3 \(muutos liikevaihdossa (-?\d+(?:\.\d+)?) %, marginaalissa (-?\d+(?:\.\d+)?) %-yks\.\)$/;
 const rows=[];
 for(let i=0;i<3;i++){
  const m=rowPattern.exec(lines[index+1+i].trim());
  if(!m||m[1]!==CASES[i])return {text:raw,scenario:null};
  const revenue=Number(m[2]),profit=Number(m[5]),revenueChange=Number(m[6]),marginChange=Number(m[7]);
  if(![revenue,profit,revenueChange,marginChange].every(Number.isFinite)||revenue<=0||Math.abs(profit)>revenue*2)
   return {text:raw,scenario:null};
  rows.push({name:m[1],revenue,profit,unit:m[3],resultLabel:m[4],revenueChange,marginChange,
   margin:Number((100*profit/revenue).toFixed(2))});
 }
 if(!rows.every(row=>row.unit===rows[0].unit&&row.resultLabel===rows[0].resultLabel))
  return {text:raw,scenario:null};
 const next=lines[index+4]||"";
 const hasCaveat=/^Mekaaniset, ehdolliset saman raporttikauden/.test(next.trim());
 const cleaned=lines.filter((_,i)=>i<index||i>index+3+(hasCaveat?1:0)).join("\n").trim();
 const caption=parsed[1].split("; lähde ")[0].trim();
 return {text:cleaned,scenario:{period:caption,rows,resultLabel:rows[0].resultLabel,unit:rows[0].unit}};
}
export function formatScenarioAmount(millionValue,unit){
 if(!Number.isFinite(millionValue)||!/^milj\. (?:USD|EUR|€)$/.test(unit))return "–";
 const currency=unit.slice(6);
 const big=Math.abs(millionValue)>=1000;
 const value=big?millionValue/1000:millionValue;
 const digits=big?1:Math.abs(value)>=10?1:2;
 return value.toLocaleString("fi-FI",{maximumFractionDigits:digits})+" "+(big?"mrd. ":"milj. ")+currency;
}
export function formatScenarioPercent(num,digits=0){
 return Number(num).toLocaleString("fi-FI",{maximumFractionDigits:digits,minimumFractionDigits:digits});
}
