// Pure deterministic research levels; not executable trade instructions.
export function swingRiskLevels(signal,capital=1000,riskPct=0.5){
 if(!signal||signal.status!=="watch_candidate"||!signal.rules||!Object.values(signal.rules).every(Boolean))return null;
 const price=Number(signal.close),breakout=Number(signal.previous20High);
 if(!Number.isFinite(price)||!Number.isFinite(breakout)||price<=0||breakout<=0)return null;
 const entry=Math.max(price,breakout)*1.002;
 const stop=breakout*0.97;
 const risk=entry-stop;
 if(!Number.isFinite(risk)||risk<=0)return null;
 const target=entry+2*risk;
 const cap=Number(capital),pct=Number(riskPct);
 if(!Number.isFinite(cap)||cap<=0||!Number.isFinite(pct)||pct<=0||pct>2)return null;
 const quantity=Math.max(0,Math.min(Math.floor(cap/entry),Math.floor(cap*pct/100/risk)));
 return {entry,stop,target,quantity,maxLoss:quantity*risk,rMultiple:2,
  note:"Havainnollinen 2R-tutkimusskenaario. Tasot perustuvat edeltävän 20 päivän huippuun, eivät ennusta tulevaa kurssia. Kulut, spread ja liukuma puuttuvat; tarkista toteutettavuus ennen kauppaa."};
}
