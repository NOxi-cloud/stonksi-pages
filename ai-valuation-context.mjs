// Market-implied valuation is reverse engineering, NOT a target-price estimate.
// Only compare the quote observed for the *same* saved research to its model.
export function marketValuationContext(quality,target){
 const own=quality?.independent_price_scenarios;
 if(target?.kind!=="conditional_model_price"||own?.status!=="assumption_based_price_scenarios_not_analyst_target"||
    target.currency!=="USD"||own.currency!=="USD"||quality?.quote_currency!=="USD"||
    !quality.quote_available||quality.quote_stale!==false||
    typeof quality.quote_observed_at!=="string"||own.observed_at!==quality.quote_observed_at||
    !Number.isFinite(quality.quote_age_hours)||quality.quote_age_hours<0||quality.quote_age_hours>96||
    !Number.isFinite(own.annual_fcf_per_share)||own.annual_fcf_per_share<=0||
    !Number.isFinite(own.observed_price)||own.observed_price<=0||
    !Number.isFinite(target.price)||target.price<=0||
    !Number.isFinite(own.base_case_price)||Math.abs(own.base_case_price-target.price)>0.02||
    !Array.isArray(own.scenarios))return null;
 const base=own.scenarios.find(s=>s?.name==="Base");
 if(!base||!Number.isFinite(base.assumed_p_fcf)||base.assumed_p_fcf<=0||
    Math.abs(base.conditional_price-target.price)>0.02)return null;
 const quotedAt=Date.parse(own.observed_at);
 if(!Number.isFinite(quotedAt))return null;
 const historicalFcf=own.annual_fcf_per_share;
 const implied=own.observed_price/historicalFcf;
 const neededAt=(multiple)=>100*(own.observed_price/(historicalFcf*multiple)-1);
 if(!Number.isFinite(implied)||implied<=0||implied>1000)return null;
 const need15=neededAt(15),need20=neededAt(20);
 if(![need15,need20].every(Number.isFinite)||Math.max(Math.abs(need15),Math.abs(need20))>20000)return null;
 return {
  currency:"USD",observedPrice:own.observed_price,observedAt:own.observed_at,
  historicalFcfPerShare:historicalFcf,impliedPfcf:implied,
  modelBasePrice:target.price,baseMultiple:base.assumed_p_fcf,
  requiredFcfChangePctAt15x:need15,requiredFcfChangePctAt20x:need20,
  disclaimer:"Markkinakurssin implisiittiset odotukset ovat laskennallisia ehtoja, eivät ennusteita kassavirran kasvusta tai kurssista."
 };
}
