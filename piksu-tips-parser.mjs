// Pure Timon-lista parser. Fail closed on unexpected layout; no AI or trades.
export const SOURCE_URL="https://piksu.net/extras/timo/timon_lista.html";
const clean=s=>String(s??"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
export const companyKey=s=>{
 const n=clean(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fi").replace(/\.he$/,"").replace(/\b(oyj|abp|plc|corporation|group|b-osake|b osake)\b/g,"").replace(/[^a-z0-9]+/g," ").trim();
 return ({"keskob":"kesko","kesko b":"kesko","wrt1v":"wartsila","valmt":"valmet","fsecure":"f secure","nlg1v":"nurminen logistics","qtcom":"qt"})[n]||n;
};
const day=str=>{
 const m=/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/.exec(str);
 if(!m)return null;
 const iso=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
 const d=new Date(iso+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:null;
};
const num=str=>{const n=Number(clean(str).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:null};
function parseRows(table){
 const rows=[];
 for(const tr of Array.from(table.querySelectorAll("tr")).slice(0,280)){
  const c=Array.from(tr.children).filter(x=>["TD","TH"].includes(x.tagName)).map(x=>clean(x.textContent));
  if(c.length!==6)continue;
  const rank=Number(c[0]),sector=Number(c[1]),company=c[2],price=num(c[3]),target=num(c[4]);
  const pm=/^([+-]?\d{1,3}(?:[.,]\d+)?)\s*%$/.exec(c[5]),potential=pm?num(pm[1]):null;
  if(!Number.isInteger(rank)||rank<1||rank>220||!Number.isInteger(sector)||sector<1||sector>120||
   !company||company.length>100||!/\p{L}/u.test(company)||price===null||price<=0||price>100000||
   target===null||target<=0||target>100000||potential===null||potential< -99||potential>500)continue;
  if(Math.abs(100*(target/price-1)-potential)>Math.max(2.6,100*(0.011/price)))continue;
  rows.push({rank,sector,company,reference_price:price,target_price:target,potential_pct:potential});
 }
 const ordered=rows.sort((a,b)=>a.rank-b.rank);
 if(ordered.length<15||ordered[0].rank!==1||new Set(ordered.map(r=>r.rank)).size!==ordered.length)return [];
 return ordered;
}
export function parseTimonList(html,DOMParserClass){
 if(typeof html!=="string"||html.length>2000000||!DOMParserClass)throw Error("invalid_source");
 const document=new DOMParserClass().parseFromString(html,"text/html");
 if(!document?.querySelectorAll)throw Error("invalid_document");
 let best=null;
 for(const table of Array.from(document.querySelectorAll("table")).slice(0,35)){
  const rows=parseRows(table);if(rows.length&&(!best||rows.length>best.rows.length))best={table,rows};
 }
 if(!best)throw Error("source_layout_changed");
 const summary=clean(document.body?.textContent||"").slice(0,450);
 const sourceUpdated=day(summary.match(/Päivitetty.{0,35}/i)?.[0]||summary.slice(0,85));
 const header=clean(best.table.querySelector("tr")?.textContent||"");
 const quoteDate=day(header.match(/Osakekurssi\/EUR.{0,38}/i)?.[0]||"");
 if(!sourceUpdated||!quoteDate||sourceUpdated<"2020-01-01"||quoteDate>sourceUpdated||
  Date.parse(sourceUpdated+"T00:00:00Z")>Date.now()+86400000)throw Error("source_dates_unverified");
 return {source_updated:sourceUpdated,quote_date:quoteDate,row_count:best.rows.length,top:best.rows.slice(0,8),rows:best.rows};
}
export function selectWatchlist(rows,watchlist){
 const seen=new Set(),out=[];
 for(const watch of watchlist.slice(0,60)){
  const keys=[watch?.ticker,watch?.name].filter(x=>typeof x==="string").map(companyKey);
  const hit=rows.find(r=>keys.includes(companyKey(r.company)));
  if(hit&&!seen.has(hit.rank)){out.push(hit);seen.add(hit.rank)}
  if(out.length>=15)break;
 }
 return out.sort((a,b)=>a.rank-b.rank);
}
