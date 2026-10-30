// Pure xBRL-JSON fact inspection. No network or AI calls.
// Assesses XBRL assertions, not the audit opinion or the listed share class.
const FIELDS=[
 ["revenue",["Revenue","RevenueFromContractsWithCustomers"]],
 ["operating_profit",["ProfitLossFromOperatingActivities"]],
 ["profit_loss",["ProfitLoss"]],
 ["assets",["Assets"]],
 ["equity",["Equity"]],
 ["liabilities",["Liabilities"]],
 ["operating_cash_flow",["CashFlowsFromUsedInOperatingActivities","NetCashFlowsFromUsedInOperatingActivities"]],
 ["capital_expenditure",["PurchaseOfPropertyPlantAndEquipment","PaymentsToAcquirePropertyPlantAndEquipment"]]
];
const oneDayAfter=s=>{const d=new Date(s+"T00:00:00Z");if(!Number.isFinite(d.getTime()))return null;d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)+"T00:00:00"};
const annualStart=s=>{const d=new Date(s+"T00:00:00Z");if(!Number.isFinite(d.getTime()))return null;d.setUTCFullYear(d.getUTCFullYear()-1);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)+"T00:00:00"};
const numberText=x=>typeof x==="string"&&/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(x)&&x.length<80;
export function inspectXbrlJson(data,issuerLei,periodEnd,{maxFacts=150000}={}){
 const fail=reason=>({status:"rejected",reason,metrics:[],fact_count:0});
 if(!data||typeof data!=="object"||Array.isArray(data))return fail("invalid_document");
 const doc=data.documentInfo,all=data.facts;
 if(!doc||doc.documentType!=="https://xbrl.org/2021/xbrl-json"||!doc.namespaces||typeof doc.namespaces!=="object"||!all||typeof all!=="object"||Array.isArray(all))return fail("unsupported_xbrl_format");
 const namespaces=doc.namespaces;
 const leiPrefixes=Object.keys(namespaces).filter(p=>/^https?:\/\/standards\.iso\.org\/iso\/17442\/?$/.test(namespaces[p]));
 const ifrsPrefixes=Object.keys(namespaces).filter(p=>typeof namespaces[p]==="string"&&/^https?:\/\/xbrl\.ifrs\.org\/taxonomy\/[0-9-]+\/ifrs-full\/?$/.test(namespaces[p]));
 const eurPrefixes=Object.keys(namespaces).filter(p=>/^https?:\/\/www\.xbrl\.org\/2003\/iso4217\/?$/.test(namespaces[p]));
 if(!leiPrefixes.length||!ifrsPrefixes.length||!eurPrefixes.length)return fail("required_namespaces_missing");
 if(!/^[A-Z0-9]{18}[0-9]{2}$/.test(issuerLei)||!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))return fail("invalid_identity_or_period");
 const expectedEntity=new Set(leiPrefixes.map(p=>p+":"+issuerLei));
 const expectedUnit=new Set(eurPrefixes.map(p=>p+":EUR"));
 const end=oneDayAfter(periodEnd),start=annualStart(periodEnd);
 if(!end||!start)return fail("invalid_period");
 const candidates=new Map(FIELDS.map(([key])=>[key,[]]));
 const concepts=new Map();
 for(const [key,terms] of FIELDS)for(const t of terms)for(const p of ifrsPrefixes)concepts.set(p+":"+t,key);
 const entries=Object.entries(all);
 if(entries.length>maxFacts)return fail("too_many_facts");
 let matched=0,entityFacts=0,periodFacts=0;
 for(const [id,f] of entries){
  if(!f||typeof f!=="object"||!f.dimensions||typeof f.dimensions!=="object")continue;
  const d=f.dimensions;
  if(!expectedEntity.has(d.entity))continue;
  entityFacts++;
  const target=concepts.get(d.concept);if(!target||!expectedUnit.has(d.unit))continue;
  const isInstant=["assets","equity","liabilities"].includes(target);
  const period=isInstant?end:start+"/"+end;
  if(d.period!==period)continue;
  periodFacts++;
  // Consolidated undimensioned only: no segment, type, language, or share-class dimensions.
  if(Object.keys(d).some(k=>!["concept","entity","period","unit"].includes(k)))continue;
  if(!numberText(f.value))continue;
  const v=Number(f.value);
  if(!Number.isFinite(v)||Math.abs(v)>9e15)continue;
  matched++;
  candidates.get(target).push({fact_id:id,concept:d.concept,value:v,raw_value:f.value,unit:"EUR",period:d.period,decimals:typeof f.decimals==="number"?f.decimals:null});
 }
 const metrics=[],ambiguous=[];
 for(const [key,values] of candidates){
  if(!values.length)continue;
  const distinct=[...new Set(values.map(x=>x.value))];
  if(distinct.length!==1){ambiguous.push({key,values:distinct.length});continue}
  const best=values[0];
  metrics.push({key,value:best.value,raw_value:best.raw_value,unit:best.unit,concept:best.concept,period:best.period,fact_id:best.fact_id,duplicates:values.length});
 }
 return {status:metrics.length?"facts_extracted":"no_matching_facts",reason:null,metrics,ambiguous,fact_count:entries.length,entity_facts:entityFacts,period_facts:periodFacts,matched_fact_count:matched,
  caveat:"Poiminta koskee yhtenäisiä IFRS-taksonomian EUR-lukuja. Ei vahvista tilintarkastusta, listattua osakelajia eikä analyytikon tavoitehintaa."};
}