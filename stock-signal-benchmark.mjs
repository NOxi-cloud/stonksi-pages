// Benchmark comparisons are computed locally after an explicit, authenticated history request.
export const BENCHMARKS=Object.freeze([{symbol:"^OMXH25",label:"OMX Helsinki 25"},{symbol:"^GSPC",label:"S&P 500"}]);
export function benchmarkMatches(items,raw,symbol){
 const pts=Array.isArray(raw?.points)?raw.points:[],priceByDate=new Map();
 for(const p of pts){const d=new Date(Number(p.t)*1000);if(Number.isFinite(d.getTime())&&Number.isFinite(p.price)&&p.price>0)priceByDate.set(d.toISOString().slice(0,10),p.price)}
 const out=[];
 for(const item of items){
  if(!item||!item.outcomeDates||!item.outcomes)continue;
  const begin=new Date(item.asOf).toISOString().slice(0,10),b0=priceByDate.get(begin);
  if(!b0)continue;
  for(const h of [5,10,20]){
   const end=item.outcomeDates[h],b1=priceByDate.get(end),stock=item.outcomes[h];
   if(!end||!b1||!Number.isFinite(stock))continue;
   const indexChange=100*(b1/b0-1);
   out.push({ticker:item.ticker,horizon:h,stock,index:indexChange,relative:stock-indexChange,benchmark:symbol});
  }
 }
 return out;
}
export function renderBenchmarkComparison(host,rows,symbol){
 host.replaceChildren();
 const heading=document.createElement("h4");heading.textContent="Vertailuindeksi · "+symbol;host.append(heading);
 for(const h of [5,10,20]){
  const matched=rows.filter(x=>x.horizon===h),card=document.createElement("div");card.className="signal-summary-stat";
  const strong=document.createElement("strong");strong.textContent=h+" kaupankäyntipäivää";
  const info=document.createElement("span");
  const wins=matched.filter(x=>x.relative>0).length;
  const avg=matched.length?matched.reduce((s,x)=>s+x.relative,0)/matched.length:null;
  info.textContent=matched.length?"Indeksin ylitti "+wins+"/"+matched.length+" · keskimääräinen ylituotto "+avg.toLocaleString("fi-FI",{maximumFractionDigits:2})+" %-yks.":"Ei täsmääviä sulkemispäiviä";
  const note=document.createElement("small");note.className="muted";note.textContent=matched.length<10?"Pieni otos · "+matched.length+" havaintoa":"Havaintoja "+matched.length;
  card.append(strong,info,note);host.append(card);
 }
 const p=document.createElement("p");p.className="muted";p.textContent="Vain täsmälleen samat alkamis- ja päättymispäivät. Indeksin valuutta voi erota osakkeen valuutasta. Ei osinkoja, kaupankäyntikuluja eikä valuuttamuunnosta.";host.append(p);
}
