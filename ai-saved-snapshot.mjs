// Preserve the source-backed data and derived valuation displayed with each saved report.
// The database owns the text and snapshot; never refetch a quote or recalculate an
// historical target when opening a stored record.
const MAX_BYTES=190000;
export function createAnalysisSnapshot(payload){
 if(!payload||typeof payload!=="object"||!payload.data_quality||
    typeof payload.data_quality!=="object"||Array.isArray(payload.data_quality))return null;
 const ticker=typeof payload.ticker==="string"&&payload.ticker.length<32?payload.ticker:null;
 const company=typeof payload.company==="string"?payload.company.slice(0,160):null;
 const snapshot={schema_version:1,ticker,company,data_quality:payload.data_quality};
 try{const json=JSON.stringify(snapshot);return json.length<=MAX_BYTES?JSON.parse(json):null}
 catch{return null}
}
export function restoreAnalysisSnapshot(report){
 const snapshot=report?.analysis_snapshot;
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot)||
    snapshot.schema_version!==1||typeof report.analysis!=="string"||
    !snapshot.data_quality||typeof snapshot.data_quality!=="object"||
    Array.isArray(snapshot.data_quality))return null;
 try{if(JSON.stringify(snapshot).length>MAX_BYTES)return null}catch{return null}
 return {analysis:report.analysis,generated_at:report.generated_at,query:report.query,
  ticker:typeof snapshot.ticker==="string"?snapshot.ticker:null,
  company:typeof snapshot.company==="string"?snapshot.company:null,
  data_quality:snapshot.data_quality};
}
