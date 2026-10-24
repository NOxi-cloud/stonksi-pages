// AI suggestions are derived exclusively from the current user's synced stock watchlist.
// No hardcoded company shortcuts or automatic analysis requests.
export function watchlistSuggestions(rows){
 if(!Array.isArray(rows))return [];
 const seen=new Set(),out=[];
 for(const item of rows){
  if(!item||typeof item!=="object")continue;
  const ticker=typeof item.ticker==="string"?item.ticker.trim().toUpperCase():"";
  if(!/^[A-Z0-9^][A-Z0-9.^_-]{0,19}$/.test(ticker)||seen.has(ticker))continue;
  const rawName=typeof item.name==="string"?item.name.trim():"";
  const name=rawName?rawName.slice(0,90):ticker;
  seen.add(ticker);out.push({ticker,name});
 }
 return out;
}
export function filterWatchlistSuggestions(rows,search){
 const term=String(search||"").trim().toLocaleLowerCase("fi");
 const list=watchlistSuggestions(rows);
 if(!term)return list;
 return list.filter(row=>row.name.toLocaleLowerCase("fi").includes(term)||row.ticker.toLocaleLowerCase("fi").includes(term));
}
