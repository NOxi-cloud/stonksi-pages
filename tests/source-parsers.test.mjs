import test from "node:test";
import assert from "node:assert/strict";
import {parseTimonList, selectWatchlist, companyKey} from "../piksu-tips-parser.mjs";
import {inspectXbrlJson} from "../esef-facts.mjs";

// Minimal static DOM double for testing parser logic, without any external browser/network.
function fakeDocument(html){
 const spec=JSON.parse(html);
 const row=arr=>({children:arr.map(s=>({tagName:"TD",textContent:String(s)})),textContent:arr.join(" ")});
 const table={querySelectorAll(selector){return selector==="tr"?spec.rows.map(row):[]}};
 const document={
  body:{textContent:spec.title},
  querySelectorAll(selector){return selector==="table"?[table]:[]}
 };
 return {document};
}
class FakeDomParser{
 parseFromString(html){return fakeDocument(html).document}
}
function sampleRows(){
 const rows=[["Sija","Sektori","Yhtiö","Osakekurssi/EUR 30.07.2026","Tavoitekurssi","Kurssin nousu- tai laskupotentiaali"]];
 for(let i=1;i<=18;i++){
  const company=i===1?"Vaisala":i===2?"Metso":i===3?"Wärtsilä":i===4?"Kesko":"Yhtiö "+i;
  const price=10, target=10+i*0.1, pct=i;
  rows.push([i,1,company,price.toFixed(2),target.toFixed(2),pct+"%"]);
 }
 return rows;
}
test("parses dated ranked source without requesting any network resources",()=>{
 const html=JSON.stringify({title:"Päivitetty 31.7.2026 Timon OMXH-lista",rows:sampleRows()});
 const result=parseTimonList(html,FakeDomParser);
 assert.equal(result.source_updated,"2026-07-31");
 assert.equal(result.quote_date,"2026-07-30");
 assert.equal(result.row_count,18);
 assert.equal(result.top.length,8);
 assert.equal(result.top[1].company,"Metso");
 assert.equal(result.top[1].target_price,10.2);
});
test("matches watchlist ticker and name without arbitrary unrelated matches",()=>{
 const html=JSON.stringify({title:"Päivitetty 31.7.2026",rows:sampleRows()});
 const result=parseTimonList(html,FakeDomParser);
 const found=selectWatchlist(result.rows,[
  {ticker:"METSO.HE",name:"Metso Oyj"}, {ticker:"WRT1V.HE",name:"Wärtsilä Oyj"},
  {ticker:"NOKIA.HE",name:"Nokia Oyj"}, {ticker:"KESKOB.HE",name:"Kesko B"}]);
 assert.deepEqual(found.map(r=>r.company),["Metso","Wärtsilä","Kesko"]);
 assert.equal(companyKey("WRT1V.HE"),companyKey("Wärtsilä Oyj"));
});
test("rejects source layout changes and mismatched target percentages",()=>{
 const rows=sampleRows();
 for(let i=1;i<=6;i++)rows[i][5]="99%";
 assert.throws(()=>parseTimonList(JSON.stringify({title:"Päivitetty 31.7.2026",rows}),FakeDomParser),/source_layout_changed/);
});
const lei="549300R0VN9C371W0E07",period="2025-12-31";
const doc={
 documentInfo:{documentType:"https://xbrl.org/2021/xbrl-json",namespaces:{
   lei:"http://standards.iso.org/iso/17442",
   ifrs:"https://xbrl.ifrs.org/taxonomy/2025-03-27/ifrs-full",
   iso4217:"http://www.xbrl.org/2003/iso4217"
 }},
 facts:{
  revenue:{value:"123000000",dimensions:{concept:"ifrs:Revenue",entity:"lei:"+lei,
   period:"2025-01-01T00:00:00/2026-01-01T00:00:00",unit:"iso4217:EUR"}},
  assets:{value:"800000000",dimensions:{concept:"ifrs:Assets",entity:"lei:"+lei,
   period:"2026-01-01T00:00:00",unit:"iso4217:EUR"}}
 }
};
test("accepts undimensioned IFRS EUR annual and balance-sheet facts",()=>{
 const out=inspectXbrlJson(doc,lei,period);
 assert.equal(out.status,"facts_extracted");
 assert.deepEqual(out.metrics.map(x=>x.key),["revenue","assets"]);
});
test("rejects another issuer, another currency, segmented facts and conflicting values",()=>{
 const other=structuredClone(doc);other.facts.revenue.dimensions.entity="lei:00000000000000000000";
 assert.equal(inspectXbrlJson(other,lei,period).metrics.some(x=>x.key==="revenue"),false);
 const dollar=structuredClone(doc);dollar.facts.revenue.dimensions.unit="iso4217:USD";
 assert.equal(inspectXbrlJson(dollar,lei,period).metrics.some(x=>x.key==="revenue"),false);
 const segmented=structuredClone(doc);segmented.facts.revenue.dimensions["ifrs:OperatingSegments"]="ifrs:FirstSegment";
 assert.equal(inspectXbrlJson(segmented,lei,period).metrics.some(x=>x.key==="revenue"),false);
 const conflicted=structuredClone(doc);conflicted.facts.duplicateRevenue={...conflicted.facts.revenue,value:"999"};
 assert.equal(inspectXbrlJson(conflicted,lei,period).ambiguous.some(x=>x.key==="revenue"),true);
});
test("never treats a non-XBRL JSON document as verified issuer data",()=>{
 assert.equal(inspectXbrlJson({documentInfo:{},facts:{}},lei,period).status,"rejected");
});
