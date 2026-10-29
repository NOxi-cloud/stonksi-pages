// Display contract for server-computed company observations.
// Never reconstruct missing figures from an AI narrative or a saved text report.
const statuses=new Set(["verified_official_html","dated_snapshot_only"]);
const kinds=new Set(["year_over_year_sales","reported_margin","profit_reconciliation","annual_cash_flow","reported_net_cash"]);
const limited=(value,max)=>typeof value==="string"&&value.trim().length>0&&value.length<=max?value.trim():null;
export function normalizedFinancialDrivers(payload){
 const source=payload?.data_quality?.financial_drivers;
 if(!source||!statuses.has(source.source_status)||!Array.isArray(source.items))return null;
 const period=limited(source.period,100),sourceUrl=limited(source.source_url,800);
 if(!period||!sourceUrl)return null;
 let url;
 try{
  url=new URL(sourceUrl);
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password)return null;
 }catch{return null}
 const seen=new Set(),items=[];
 for(const item of source.items.slice(0,20)){
  if(!kinds.has(item?.kind)||seen.has(item.kind))continue;
  const title=limited(item.title,150),finding=limited(item.finding,500);
  const interpretation=limited(item.interpretation,500),monitor=limited(item.monitor,500);
  if(!title||!finding||!interpretation||!monitor)continue;
  seen.add(item.kind);
  items.push({kind:item.kind,title,finding,interpretation,monitor});
  if(items.length===5)break;
 }
 if(!items.length)return null;
 return {period,source_url:url.href,source_status:source.source_status,items};
}
