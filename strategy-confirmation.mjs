// Deterministic technical confirmation using only closes available at the observation.
import {calculateRsi14,calculateMacd} from "./stock-signals.mjs";
export const CONFIRMATION_VERSION="rsi_macd_v1";
export function evaluateTechnicalConfirmation(prices){
 if(!Array.isArray(prices)||prices.length<205)return {available:false,confirmed:false,rsi:null,histogram:null,reason:"Liian vähän havaintoja"};
 const rsi=calculateRsi14(prices),macd=calculateMacd(prices);
 if(!Number.isFinite(rsi)||!macd||!Number.isFinite(macd.histogram))return {available:false,confirmed:false,rsi:null,histogram:null,reason:"Indikaattoritietoja ei saatu"};
 // Avoid an overbought chase, and require a positive MACD momentum observation.
 const rsiPass=rsi>=45&&rsi<=70,macdPass=macd.histogram>0;
 return {available:true,confirmed:rsiPass&&macdPass,rsi:Number(rsi.toFixed(2)),histogram:macd.histogram,
  rsiPass,macdPass,reason:rsiPass&&macdPass?"RSI 45–70 ja MACD-histogrammi positiivinen":"RSI tai MACD-suodatin ei täyttynyt"};
}
