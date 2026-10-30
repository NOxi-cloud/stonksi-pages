// Display only assumptions that match the same visible report and numerical scenario.
// Historical comparison gives sensitivity bounds, not causal explanations or forecasts.
const allowedModes=new Set(["verified_comparison_bounded","fixed_generic"]);
const within=(a,b,tolerance=0.015)=>typeof a==="number"&&typeof b==="number"&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
const safeNumber=(v)=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<1e9;
export function normalizedScenarioAssumptions(payload,visible){
 const report=payload?.data_quality?.operating_scenarios,cal=report?.calibration;
 if(!report||!cal||!allowedModes.has(cal.mode)||!visible||
  typeof report.period!=="string"||report.period!==visible.period||
  report.revenue_unit!==visible.unit||!/^milj\. (?:USD|EUR|€)$/.test(report.revenue_unit)||
  !Array.isArray(report.scenarios)||report.scenarios.length!==3||
  !Array.isArray(visible.rows)||visible.rows.length!==3)return null;
 let url;
 try{
  url=new URL(report.source_url);
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password||
   typeof report.source_url!=="string"||report.source_url.length>1000)return null;
 }catch{return null}
 const amplitudeRevenue=cal.revenue_amplitude_pct,amplitudeMargin=cal.margin_amplitude_pp;
 if(!safeNumber(amplitudeRevenue)||!safeNumber(amplitudeMargin)||
  amplitudeRevenue<=0||amplitudeRevenue>25||amplitudeMargin<=0||amplitudeMargin>5)return null;
 for(const [i,name] of ["Bear","Base","Bull"].entries()){
  const row=report.scenarios[i],shown=visible.rows[i];
  if(!row||!shown||row.name!==name||shown.name!==name||
   !within(row.revenue_change_pct,shown.revenueChange)||
   !within(row.margin_change_pp,shown.marginChange)||
   !within(row.revenue,shown.revenue,0.025)||
   !within(row.operating_result,shown.profit,0.025))return null;
  const sign=i===0?-1:i===1?0:1;
  if(!within(row.revenue_change_pct,sign*amplitudeRevenue)||
   !within(row.margin_change_pp,sign*amplitudeMargin))return null;
 }
 let historical=null;
 if(cal.mode==="fixed_generic"){
  if(!within(amplitudeRevenue,10)||!within(amplitudeMargin,2)||
   cal.observed_revenue_change_pct!==null||cal.observed_margin_change_pp!==null)return null;
 }else{
  const rev=cal.observed_revenue_change_pct,margin=cal.observed_margin_change_pp;
  if(!safeNumber(rev)||!safeNumber(margin)||Math.abs(rev)>200||
   !within(rev,report.prior_revenue_growth_pct,0.035)||
   !safeNumber(report.reported_margin_pct)||!safeNumber(report.prior_reported_margin_pct)||
   !within(margin,report.reported_margin_pct-report.prior_reported_margin_pct,0.045))return null;
  if(amplitudeRevenue<3||amplitudeMargin<0.5)return null;
  historical={revenue_growth_pct:rev,margin_change_pp:margin};
 }
 const reason=typeof cal.explanation==="string"&&cal.explanation.length<=700?cal.explanation.trim():"";
 if(!reason)return null;
 return {mode:cal.mode,period:report.period,source_url:url.href,
  revenue_amplitude_pct:amplitudeRevenue,margin_amplitude_pp:amplitudeMargin,
  historical,explanation:reason};
}
