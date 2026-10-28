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
 return quality?.sec_diagnostic?"SEC-haku ei tuottanut raporttilukuja ("+quality.sec_diagnostic+")":"Talousraportit: ei raporttilukuja saatavilla";
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
