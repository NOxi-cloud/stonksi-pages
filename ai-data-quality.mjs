// Human-readable evidence labels; never confuse a dated snapshot with a live verification.
export function financialEvidenceLabel(quality){
 const reports=Array.isArray(quality?.financial_reports)?quality.financial_reports:[];
 const period=typeof reports[0]?.period==="string"?reports[0].period:"raportti";
 if(quality?.financial_data_status==="verified_official_html"&&reports.length)
  return "Talousraportti: "+period+" tarkistettu virallisesta raporttitaulukosta";
 if(quality?.financial_data_status==="source_link_only")
  return "Talousraportti: "+period+" lähdeviite (ei vahvistettuja tunnuslukuja)";
 if(quality?.financial_data_status==="dated_snapshot_only"||reports.length)
  return "Talousraportti: "+period+" päivätty tilannekuva (ei tarkistettu uudelleen)";
 return "Talousraportit: ei raporttilukuja saatavilla";
}
export function quoteEvidenceLabel(quality){
 if(!quality?.quote_available||!quality.quote_observed_at)return "Kurssihavainto: ei saatavilla";
 const date=new Date(quality.quote_observed_at);
 if(!Number.isFinite(date.getTime()))return "Kurssihavainto: aikaleima virheellinen";
 return "Kurssihavainto: "+date.toLocaleString("fi-FI")+
  (quality.quote_stale?" · vanhentunut":" · mahdollisesti viivästynyt");
}
export function describeEvidence(quality){
 if(!quality)return "Lähdetietoja ei ole saatavilla tästä analyysistä.";
 return quoteEvidenceLabel(quality)+" · "+financialEvidenceLabel(quality);
}

export function stripResearchIdentityBanner(raw){
 const text=String(raw||"").trim().replace(/^Osakeanalyysi:[^\r\n]*(?:\r?\n)*/i,"").trim();
 // Previously saved reports may include backend diagnostics in their source section.
 // Keep the issuer's dates and URLs, but never present internal status identifiers.
 let isSources=false;
 const kept=[];
 for(const line of text.split(/\r?\n/)){
  if(/^#{1,4}\s+/.test(line))isSources=/^#{1,4}\s+Lähteet ja tiedon puutteet\s*$/i.test(line);
  if(isSources&&/^(?:Raporttihaun tila:|SEC-haun tila:|Haettu kohde:|Tietojen puuttuessa analyysissä|Mekaaninen kurssiherkkyys ei)/i.test(line.trim()))continue;
  if(isSources&&/^Virallinen raportti tai raporttihakemisto:/i.test(line.trim())){
   kept.push(line.replace(/^Virallinen raportti tai raporttihakemisto:/i,"Virallinen lähde:"));
   continue;
  }
  kept.push(line);
 }
 return kept.join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
