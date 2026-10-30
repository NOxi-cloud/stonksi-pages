// Technical-analysis observations from strictly ordered, daily 1-year closes.
// These are descriptive indicator states, not trade recommendations or predictions.
import {validateHistory} from "./stock-chart-utils.mjs";

export const SIGNAL_DESCRIPTIONS=Object.freeze({
 overbought:"RSI(14) ylittää 70. Viittaa viimeaikaisen nousuvauhdin voimakkuuteen; nousu voi silti jatkua.",
 oversold:"RSI(14) alittaa 30. Viittaa viimeaikaisen laskuvauhdin voimakkuuteen; lasku voi silti jatkua.",
 goldenCross:"50 kaupankäyntipäivän yksinkertainen liukuva keskiarvo ylittää 200 päivän keskiarvon. Viiveellinen trendihavainto.",
 deathCross:"50 kaupankäyntipäivän yksinkertainen liukuva keskiarvo alittaa 200 päivän keskiarvon. Viiveellinen trendihavainto.",
 exchangeWatch:"Pörssin tarkkailulistamerkintä on virallinen yhtiökohtainen tieto. Sitä ei voida päätellä hintahistoriasta."
});
const average=(prices,window,end)=>{
 if(end<window-1)return null;
 let sum=0;
 for(let i=end-window+1;i<=end;i++)sum+=prices[i];
 return sum/window;
};
export function calculateRsi14(prices){
 if(!Array.isArray(prices)||prices.length<15||prices.some(v=>!Number.isFinite(v)||v<=0))return null;
 let gain=0,loss=0;
 for(let i=1;i<=14;i++){const diff=prices[i]-prices[i-1];gain+=Math.max(0,diff);loss+=Math.max(0,-diff)}
 gain/=14;loss/=14;
 for(let i=15;i<prices.length;i++){
  const diff=prices[i]-prices[i-1];
  gain=(gain*13+Math.max(0,diff))/14;
  loss=(loss*13+Math.max(0,-diff))/14;
 }
 if(gain===0&&loss===0)return 50;
 if(loss===0)return 100;
 if(gain===0)return 0;
 return 100-100/(1+gain/loss);
}
export function calculateTechnicalSignals(raw,now=Date.now()){
 const points=validateHistory(raw);
 if(raw?.period!=="1y"||!points||points.length<202||points.length>360||
    raw.price_kind!=="unadjusted_close"||
    !Number.isFinite(now)||now<0)return null;
 const times=points.map(p=>p.t),first=times[0]*1000,last=times[times.length-1]*1000;
 // A 200-session moving average needs a real trading year; reject truncated,
 // future, duplicate-session and anomalously sparse daily feeds.
 if(last>now+300000||last<now-10*86400000||last-first<230*86400000||
    last-first>440*86400000)return null;
 for(let i=1;i<points.length;i++){
  const d=(times[i]-times[i-1])*1000;
  if(d<18*3600000||d>11*86400000)return null;
 }
 const prices=points.map(p=>p.price),n=prices.length,i=n-1;
 const rsi=calculateRsi14(prices),sma50=average(prices,50,i),sma200=average(prices,200,i);
 if(!Number.isFinite(rsi)||!Number.isFinite(sma50)||!Number.isFinite(sma200))return null;
 const crossAt=(index)=>{
  const shortPrev=average(prices,50,index-1),longPrev=average(prices,200,index-1);
  const shortNow=average(prices,50,index),longNow=average(prices,200,index);
  if([shortPrev,longPrev,shortNow,longNow].some(x=>!Number.isFinite(x)))return null;
  if(shortPrev<=longPrev&&shortNow>longNow)return "goldenCross";
  if(shortPrev>=longPrev&&shortNow<longNow)return "deathCross";
  return null;
 };
 // Show a crossover only if it happened in the latest two completed sessions.
 const crossover=crossAt(i)||crossAt(i-1);
 return {asOf:new Date(last).toISOString(),observationCount:n,currency:typeof raw.currency==="string"?raw.currency:"",
  source:"Yahoo Finance (epävirallinen, voi olla viivästynyt)",
  rsi14:Number(rsi.toFixed(2)),sma50:Number(sma50.toFixed(4)),
  sma200:Number(sma200.toFixed(4)),overbought:rsi>70,oversold:rsi<30,
  goldenCross:crossover==="goldenCross",deathCross:crossover==="deathCross",
  trend:sma50>sma200?"50 päivän KA yli 200 päivän KA":sma50<sma200?"50 päivän KA alle 200 päivän KA":"Liukuvat keskiarvot samalla tasolla",
  exchangeWatchStatus:"not_checked",
  disclaimer:"RSI ja liukuvat keskiarvot perustuvat päivittäisiin sulkemishintoihin. Historialliset signaalit eivät ennusta tulevaa kurssia eivätkä yksin muodosta osto- tai myyntisuositusta."};
}
