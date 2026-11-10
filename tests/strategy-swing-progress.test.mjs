import test from "node:test";
import assert from "node:assert/strict";
import {createSwingSnapshot,readSwingProgress,saveSwingProgress,compareSwingProgress} from "../strategy-swing-progress.mjs";

function row(symbol,passed,marketAt,missing=[5,10,20]){
 return {symbol,name:symbol,comparable:true,passed,marketAt,
  missing:{sma200:missing[0],breakout20:missing[1],volume:missing[2]},
  result:{status:"no_action",close:10,currency:"EUR",rules:{
   aboveSma200:passed>=1,breakout20:passed>=2,volumeAboveAverage:passed>=3}}};
}
const date1="2026-11-06T08:00:00.000Z",date2="2026-11-09T08:00:00.000Z";
function storage(){
 const db=new Map();
 return {getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v)};
}
test("only user-directed distinct newer sessions are stored",()=>{
 const store=storage(),a=createSwingSnapshot(row("NOKIA.HE",1,date1),Date.parse(date2));
 const b=createSwingSnapshot(row("NOKIA.HE",2,date2,[0,4,8]),Date.parse(date2));
 assert.deepEqual(saveSwingProgress("user-a",[a],store).saved,1);
 assert.deepEqual(saveSwingProgress("user-a",[a],store).skipped,1);
 assert.deepEqual(saveSwingProgress("user-a",[b],store).saved,1);
 assert.equal(readSwingProgress("user-a",store).length,2);
 assert.equal(readSwingProgress("user-b",store).length,0);
 assert.equal(saveSwingProgress("user-a",[a],store).saved,0);
});
test("recognizes improvement, unchanged session and weakening",()=>{
 const old=createSwingSnapshot(row("AAPL",1,date1),Date.parse(date2));
 const better=createSwingSnapshot(row("AAPL",2,date2,[0,5,8]),Date.parse(date2));
 const weaker=createSwingSnapshot(row("AAPL",0,date2,[8,15,25]),Date.parse(date2));
 assert.equal(compareSwingProgress(better,[old]).state,"improved");
 assert.equal(compareSwingProgress(old,[old]).state,"same");
 assert.equal(compareSwingProgress(weaker,[old]).state,"weakened");
});
test("a closer distance alone changes the label without falsely adding a passed condition",()=>{
 const old=createSwingSnapshot(row("GOOG",1,date1,[10,15,20]),Date.parse(date2));
 const closer=createSwingSnapshot(row("GOOG",1,date2,[8,12,18]),Date.parse(date2));
 const result=compareSwingProgress(closer,[old]);
 assert.equal(result.state,"closer");
 assert.equal(result.deltaPassed,0);
});
test("rejects invalid symbols, missing values and future market dates",()=>{
 assert.equal(createSwingSnapshot(row("bad ticker",1,date1),Date.parse(date2)),null);
 assert.equal(createSwingSnapshot(row("AAPL",1,date2),Date.parse(date1)),null);
 assert.equal(createSwingSnapshot(row("AAPL",1,date1,[NaN,1,1]),Date.parse(date2)),null);
});
