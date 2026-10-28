// Only verified Inderes company page URLs. No copied target prices or ratings.
// Adding a company requires checking the exact canonical page and ticker.
const SOURCES={
 "NOKIA.HE":{company:"Nokia",url:"https://www.inderes.fi/companies/Nokia"},
 "KESKOB.HE":{company:"Kesko",url:"https://www.inderes.fi/companies/Kesko"},
 "METSO.HE":{company:"Metso",url:"https://www.inderes.fi/companies/Metso"},
 "WRT1V.HE":{company:"Wärtsilä",url:"https://www.inderes.fi/companies/Wartsila"}
};
export function analystSource(ticker){
 const symbol=String(ticker||"").trim().toUpperCase();
 const match=SOURCES[symbol];
 return match?{...match,provider:"Inderes",ticker:symbol}:null;
}
export const ANALYST_SOURCE_FALLBACK="https://screener.inderes.fi/";
