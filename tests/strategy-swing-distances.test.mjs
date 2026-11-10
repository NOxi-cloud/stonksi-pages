import test from "node:test";
import assert from "node:assert/strict";
import {swingRuleDistances} from "../strategy-swing.mjs";

test("Nokia example: distance to SMA and 20-day breakout",()=>{
 const distance=swingRuleDistances({rules:{aboveSma200:false,breakout20:false,volumeAboveAverage:true},
  close:7.746,sma200:8.925,previous20High:9.602,volumeRatio:1.18});
 assert.ok(distance);
 assert.ok(Math.abs(distance.sma200.changePct-15.22)<0.02);
 assert.ok(Math.abs(distance.breakout20.changePct-23.96)<0.02);
 assert.ok(Math.abs(distance.volume.vsAveragePct-18)<1e-8);
});

test("touching an unchanged level has zero gap, not an assumed strict breakout",()=>{
 const distance=swingRuleDistances({rules:{breakout20:false},close:10,sma200:10,previous20High:10,volumeRatio:1});
 assert.equal(distance.sma200.difference,0);
 assert.equal(distance.breakout20.changePct,0);
});

test("above the level shows a negative remaining price gap",()=>{
 const distance=swingRuleDistances({rules:{aboveSma200:true},close:11,sma200:10,previous20High:9,volumeRatio:1.4});
 assert.ok(distance.sma200.changePct<0);
 assert.ok(distance.sma200.marginPct>0);
});

test("unavailable or invalid values are rejected",()=>{
 assert.equal(swingRuleDistances({}),null);
 assert.equal(swingRuleDistances({rules:{},close:0,sma200:10,previous20High:9,volumeRatio:1.1}),null);
});
