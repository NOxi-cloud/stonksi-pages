# Stonksi – koottu kehitystyöjono
Päivitetty: 2026-11-10. Lähteet: GitHub-main, Supabase-tietokanta ja aiemmat Stonksi-päätökset.

## Pysyvän toteutuksen rajat
- Yksi käyttäjän käskystä käynnistyvä agentti, kaksi käyttötapaa: swing/pitkä ja erillinen päivänsisäinen.
- Ei ajastettuja AI-ajoja, välittäjäkauppoja eikä tilauspalvelun riippuvuutta.
- OpenAI: valinnainen selityskerros; tunnusluvut, riskirajat ja signaalit lasketaan deterministisesti.
- OpenAI-avaimet ja service_role vain palvelinpuolella. Asiakkaalle vain publishable-avain.
- Kurssin viive, raporttien kausi, lähteiden tarkistus ja mahdolliset tietopuutteet näkyviin.
- Ei automaattista kopiointia, vaikka ulkoisen sivun tiedot olisivat saatavilla.

## P0 – tiedon eheys ja käyttökelpoisuus
1. **[Käynnissä] Timon lista / Tärpit**: käyttäjän päivittämä Piksu-lähde, tallennus ja seurantalistan osumat. Julkaistu v0.98.0, mutta ensimmäinen kirjautuneen käyttäjän haku ja HTML-parserin todellinen toimivuus on tarkistettava. Näytetään vain rajattu määrä arvostuslukuja ja attribuutio, ei koko listaa.
2. **[Osittain toteutettu, käytännön testi kesken] ESEF JSON → IFRS-taloustiedot**: turvallinen lähdehaku, raportin SHA256, LEI/ISIN, validointi, IFRS-käsitteiden kausien ja yksiköiden tarkistus, ristiriitojen hylkäys, tallettaminen `company_financial_facts`-tauluun. Manuaalinen esef-inspect-palvelu ja Poimi IFRS-taloustiedot -painike on julkaistu 10.11.2026, mutta todellinen Metso-läpimeno ja osakelajin varmennus ovat vielä tekemättä. Pelkkä löydetty hakemistorivi ei ole vahvistettu tilinpäätösluku.
3. **[Keskeneräinen] Osakekohtainen listatun osakelajin tunnistus**: pörssi/ticker → liikkeeseenlaskija LEI → ISIN → valuutta → dilutoitu osakemäärä; ei perusosakkeiden ja eri osakelajien sekoittamista.
4. **[Keskeneräinen] Yleiskäyttöinen EUR-arvostus**: varmennettu TTM/FY/FCF, yritysarvo, nettovelka, EV/EBIT ja P/FCF; DCF vain riittävin rahavirta- ja diskonttausoletuksin. Bear/Base/Bull eurohintahaarukat ja lähdeauditointi. Ei arvostusta puuttuvista tiedoista.

## P1 – analyysien täydentäminen
5. **[Kesken] Hintahistorian kerääjä**: `market_daily_prices` on tyhjä 10.11.2026; toteuta kurssilähteen rajat, uudelleenyritykset, cache, aikaleimat, split-tilanne ja käyttäjän painikkeesta toteutuva tallennus.
6. **[Kesken] Analyysi- ja signaaliputki**: `analysis_runs`, `signals`, `swing_backtest_runs` ja `decision_log` olivat tarkistuksessa tyhjiä. Rakennettu manuaalisen swing-signaalin funktio, mutta täysi kerääjä → laadunvalvonta → deterministiset säännöt → signaalin tallennus → tuloksen seuranta -ketju pitää testata käytännössä.
7. **[Kesken] Teknisten ja fundamenttipohjaisten signaalien yhteenveto**: priorisointi, päiväys ja vanhentuneisuus, epävarmuus, mittarien selitykset sekä seurantalistan omat analyysit.
8. **[Kesken] Piksu-vertailu Stonksin arvoihin**: näytä ulkoisen Timon tavoitteen rinnalla oma laskennallinen arvo, mutta vasta kun oman arvon taustalla on tarkistettu lähdeaineisto.

## P1 – tietoturva ja luotettavuus
9. **[Kesken] Supabase-turvallisuusvaroitukset**: arvioi vanhojen SECURITY DEFINER -RPC:iden tarpeellisuus, tiukenna käyttöoikeudet rikkomatta nykyistä toiminnallisuutta; tarkista auth-kutsut ja service_role eristys. Salasanojen tietomurtosuojan käyttö mahdollista palveluasetuksista.
10. **[Kesken] Tiedon laatu ja palvelujen häiriötilanteet**: lähteen muuttunut muoto ei saa tuottaa kelvolliselta näyttävää virheellistä analyysiä; rajaa ulkoiset pyynnöt ja säilytä viimeisin onnistunut versio.
11. **[Kesken] Testit ja julkaisu**: Piksu-parserin HTML-fixturet, xBRL-JSON-esimerkit, pääsyrajojen ja kirjautumisen testit, käyttöliittymän mobiilinäkymä, palvelun terveystesti, CI/branch protection.

## P2 – käyttökokemus ja tekninen velka
12. **[Kesken] Käyttöliittymän viimeistely**: työpöydän korttiasettelu, mobiilin alavalikko, selkeä versiotunnus, analyysin tallennuksen ja synkronoinnin tila.
13. **[Kesken] Koodin siivous**: poistetaan aidosti käyttämättömät polut vasta testien jälkeen, yhdenmukaistetaan Edge Function -nimet ja valtakirjakäsittely.
14. **[Osittain toteutettu] Analyysin omat yritysteesit**: yritysteesien tallennus ja palautus; varmista toimivuus usealle yhtiölle, ei vain Nokialle.
15. **[Kesken] Tallennettujen historiallisten signaalien arviointi**: mittarien toteutumat, jakaumat ja mahdolliset backtest-harhat ilman sijoitussuositusväitteitä.

## Toteutuksen järjestys
Tärpit-näkymän käytännön testaus → ESEF-JSON:n poiminnan käytännön testaus ja varmennus → EUR-arvostuksen auditointi → hintahistoria ja signaalit → testit ja tietoturvakorjaukset → siivous ja viimeistely.

Huom: kaikki 'keskeneräinen'-merkinnät tarkoittavat avoimia tehtäviä, eivät todettua toimintahäiriötä. Edistymisestä voi pitää ajantasaista listaa muuttamalla tätä tiedostoa version mukana.

### Kehityskierros 10.11.2026
- [x] Käyttötilastojen `tips`- ja `strategy`-näkymien sallinta Supabasen kirjauksessa ja käyttöliittymässä.
- [x] Piksun ja IFRS-lukujen jäsentimille offline-regressiotestit, mukana automaattinen GitHub Actions -ajo.
- [x] Swing-vertailutestin liukulukutoleranssin korjaus; testiajo vihreä.
- [x] Talteen otettujen XBRL-havaintojen selaus Osakkeet-osiossa ilman uutta raporttilatausta.
- [ ] Piksun ja Metson XBRL:n todelliset kirjautuneen käyttäjän hakutestit: tietokannassa ei vielä kirjattuja onnistumisia.
