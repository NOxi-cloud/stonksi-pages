# Oma AI-agentti – tietosuoja (testiversio)

Päivitetty 18.10.2026. Tämä on sovelluksen tekninen tietosuojakuvaus, ei vielä valmis lakisääteinen tietosuojaseloste.

## Käsiteltävät tiedot
Supabase Auth käsittelee kirjautumisen sähköpostiosoitetta ja tunnistautumistietoja. Kirjautuneen käyttäjän tehtävät, tutkimusaiheet, osakeseuranta, hyväksyntäpäätökset ja erikseen tallennetut AI-osakeanalyysit tallentuvat Supabaseen. Muistiinpanot tallentuvat tämänhetkisessä versiossa selaimen paikalliseen tallennustilaan. Selaimessa säilytetään myös kirjautumisistunnon tietoja ja synkronointijonoja.

## Palvelut
Sovelluksen käyttöliittymä julkaistaan GitHub Pagesissa. Tietokanta ja kirjautuminen toimivat Supabasessa. Käyttäjän erikseen käynnistämä AI-analyysi välitetään Supabase Edge Functionin kautta OpenAI API:lle. Älä kirjoita tutkimuskenttiin salasanoja, henkilötunnuksia tai muuta arkaluonteista sisältöä.

## Tietojen suojaaminen
Supabase-taulujen RLS-käytännöt rajaavat tiedot kirjautuneen käyttäjän tunnisteella. Selaimessa käytetään julkista publishable-avainta, ei palvelinpuolen salaisuuksia. Laitteelle tallennetut tiedot voivat olla muiden samaa selainprofiilia käyttävien nähtävissä.

## Poistaminen ja säilytys
Asetusten "Tyhjennä paikalliset tiedot" ei poista Supabasen pilvidataa eikä käyttäjätiliä. Tilin ja siihen viittaavien tietokantarivien poisto on testattu erillisellä testitilillä. Poistotoiminto on toistaiseksi rajattu palvelinpuolella erikseen sallittuun testikäyttäjään. Poisto ei välttämättä kata palveluntarjoajien varmuuskopioita, lokitietoja tai muita säilytettäviä tietoja. Käyttäjäkohtaiset synkronointivälimuistit tyhjennetään poistamisen yhteydessä; yleiset laitekohtaiset muistiinpanot voivat säilyä selaimessa. Käyttäjän tulee voida pyytää tietojensa poistamista palvelun ylläpitäjältä; yhteystiedot, rekisterinpitäjän nimi, säilytysajat, oikeusperuste ja mahdolliset siirrot EU/ETA-alueen ulkopuolelle täydennetään ennen julkista käyttöönottoa.

## Huomautus
Tämä on henkilökohtaisen projektin testiversio. Älä käytä sitä vielä arkaluonteisten henkilötietojen säilytykseen.
