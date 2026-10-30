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
export function calculateMacd(prices){
 if(!Array.isArray(prices)||prices.length<60||prices.some(x=>!Number.isFinite(x)||x<=0))return null;
 const ema=(values,period)=>{let v=values.slice(0,period).reduce((a,b)=>a+b,0)/period;const alpha=2/(period+1);const result=[];
  for(let i=period-1;i<values.length;i++){if(i>period-1)v+=(values[i]-v)*alpha;result.push({i,value:v})}return result};
 const a=ema(prices,12),b=ema(prices,26),slow=new Map(b.map(x=>[x.i,x.value]));
 const macd=a.filter(x=>slow.has(x.i)).map(x=>({i:x.i,value:x.value-slow.get(x.i)}));
 const signal=ema(macd.map(x=>x.value),9);
 if(signal.length<2)return null;
 const last=signal.at(-1),prev=signal.at(-2);
 const current=macd[last.i]?.value,previous=macd[prev.i]?.value;
 if(![current,previous,last.value,prev.value].every(Number.isFinite))return null;
 return {macd:Number(current.toFixed(4)),signal:Number(last.value.toFixed(4)),
  histogram:Number((current-last.value).toFixed(4)),bullishCross:previous<=prev.value&&current>last.value,
  bearishCross:previous>=prev.value&&current<last.value};
}
export function calculateVolumeSignal(points){
 if(!Array.isArray(points)||points.length<21)return null;
 const last=points.at(-1),prior=points.slice(-21,-1).map(x=>x.volume);
 if(!Number.isSafeInteger(last.volume)||last.volume<=0||prior.some(x=>!Number.isSafeInteger(x)||x<=0))return null;
 const mean=prior.reduce((a,b)=>a+b,0)/20,ratio=last.volume/mean;
 return {latestVolume:last.volume,average20:Math.round(mean),ratio:Number(ratio.toFixed(2)),
  unusuallyHigh:ratio>=1.5,unusuallyLow:ratio<=0.5};
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
 const macd=calculateMacd(prices),volume=calculateVolumeSignal(raw.points);
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
  macd,volume,rsi14:Number(rsi.toFixed(2)),sma50:Number(sma50.toFixed(4)),
  sma200:Number(sma200.toFixed(4)),overbought:rsi>70,oversold:rsi<30,
  goldenCross:crossover==="goldenCross",deathCross:crossover==="deathCross",
  trend:sma50>sma200?"50 päivän KA yli 200 päivän KA":sma50<sma200?"50 päivän KA alle 200 päivän KA":"Liukuvat keskiarvot samalla tasolla",
  exchangeWatchStatus:"not_checked",
  disclaimer:"RSI ja liukuvat keskiarvot perustuvat päivittäisiin sulkemishintoihin. Historialliset signaalit eivät ennusta tulevaa kurssia eivätkä yksin muodosta osto- tai myyntisuositusta."};
}
