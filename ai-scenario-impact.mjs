// Validate the server's arithmetic bridge against the visible operating scenarios.
// Financial drivers and impact decomposition are distinct: this never explains causality.
const allowedStatuses=new Set(["verified_official_html","dated_snapshot_only"]);
export function normalizedScenarioImpact(payload, visible){
 const raw=payload?.data_quality?.scenario_impact;
 if(!raw||raw.status!=="mechanical_decomposition_not_causes"||
  !allowedStatuses.has(raw.source_status)||!visible||!Array.isArray(visible.rows)||
  visible.rows.length!==3||!Array.isArray(raw.rows)||raw.rows.length!==2||
  typeof raw.period!=="string"||raw.period!==visible.period||
  raw.revenue_unit!==visible.unit||!/^milj\. (?:€|EUR|USD)$/.test(raw.revenue_unit)||
  typeof raw.result_label!=="string"||raw.result_label.trim().length===0||raw.result_label.length>90)
  return null;
 let url;
 try{
  url=new URL(raw.source_url);
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password||raw.source_url.length>1200)return null;
 }catch{return null}
 const scenarios=visible.rows;
 if(scenarios[0].name!=="Bear"||scenarios[1].name!=="Base"||scenarios[2].name!=="Bull")return null;
 const fields=["base_result","conditional_result","result_change","revenue_effect","margin_effect","interaction_effect"];
 const rows=[];
 for(const [i,kind] of ["Bear","Bull"].entries()){
  const row=raw.rows[i],visibleRow=scenarios[i===0?0:2];
  if(!row||row.case!==kind||fields.some(k=>typeof row[k]!=="number"||!Number.isFinite(row[k])||Math.abs(row[k])>1e12))return null;
  if(Math.abs(row.base_result-scenarios[1].profit)>0.025||
   Math.abs(row.conditional_result-visibleRow.profit)>0.025||
   Math.abs(row.conditional_result-row.base_result-row.result_change)>0.025||
   Math.abs(row.revenue_effect+row.margin_effect+row.interaction_effect-row.result_change)>0.025)return null;
  rows.push({name:kind,base_result:row.base_result,result_change:row.result_change,
   revenue_effect:row.revenue_effect,margin_effect:row.margin_effect,interaction_effect:row.interaction_effect});
 }
 return {period:raw.period,unit:raw.revenue_unit,source:url.href,source_status:raw.source_status,rows};
}
