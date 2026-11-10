import test from "node:test";
import assert from "node:assert/strict";
import {pickWatchlistSymbols,compareSwingCandidates} from "../strategy-swing-compare.mjs";

function candidate(passed,sma,high,volume,status="no_action"){
 return {status,rules:{aboveSma200:sma,breakout20:high,volumeAboveAverage:volume},passed,
  close:10,sma200:sma?9:11,previous20High:high?9:12,volumeRatio:volume?1.2:.8,
  marketAt:"2026-11-06T16:00:00Z"};
}
test("deduplicate and validate selected watchlist tickers",()=>{
 const x=pickWatchlistSymbols([{ticker:"NOKIA.HE",name:"Nokia"},{ticker:"NOKIA.HE"},{ticker:"AAPL"},{ticker:"bad ticker"},{ticker:"GOOG"}],2);
 assert.deepEqual(x.map(y=>y.symbol),["NOKIA.HE","AAPL"]);
});
test("rank by completed rules and never rank missing data as candidate",()=>{
 const ranked=compareSwingCandidates([
  {symbol:"AAPL",result:candidate(1,false,false,true)},
  {symbol:"NOKIA.HE",result:candidate(2,true,false,true)},
  {symbol:"GOOG",error:"No data"},
  {symbol:"METSO.HE",result:candidate(3,true,true,true,"watch_candidate")}
 ]);
 assert.deepEqual(ranked.map(x=>x.symbol),["METSO.HE","NOKIA.HE","AAPL","GOOG"]);
 assert.equal(ranked[3].comparable,false);
});
test("same passed rules: smallest worst shortfall ranks first",()=>{
 const a=candidate(2,true,false,true);
 const b={...candidate(2,true,false,true),previous20High:10.5};
 const ranked=compareSwingCandidates([{symbol:"AAPL",result:a},{symbol:"GOOG",result:b}]);
 assert.equal(ranked[0].symbol,"GOOG");
 assert.equal(ranked[0].missing.breakout20,5);
});
test("zero gap does not falsely mark threshold as passed",()=>{
 const r=candidate(2,true,false,true);r.previous20High=10;
 const ranked=compareSwingCandidates([{symbol:"AAPL",result:r}]);
 assert.equal(ranked[0].missing.breakout20,0);
 assert.equal(ranked[0].passed,2);
});
