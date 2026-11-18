# Requirements Level Up (voorstel)

Status: concept, ter bespreking

## 1. Doel

Level Up is een browser-app waarmee middelbare scholieren woorden en zinnen uit hun eigen lesstof leren. De app combineert bewezen leertechnieken (actief ophalen, gespreide herhaling) met spelelementen, zodat leerlingen vaker en korter oefenen en de stof beter onthouden.

### Uitgangspunten

- Het leereffect gaat voor het speleffect: spelelementen belonen beheersing, niet alleen activiteit.
- Sessies zijn kort (3 tot 10 minuten) en werken goed op een telefoon.
- Iedere leerling kan succes ervaren, ook de leerling die langzamer leert.
- Er worden zo weinig mogelijk persoonsgegevens verwerkt.

## 2. Doelgroepen

| Rol | Omschrijving | Belangrijkste behoefte |
|---|---|---|
| Leerling | Scholier van 12 tot 18 jaar | Snel en leuk leren voor een toets |
| Docent | Vakdocent moderne vreemde talen | Lijsten klaarzetten en zien wat de klas moeilijk vindt |
| Beheerder | Technisch of functioneel beheerder | Accounts, klassen en inhoud beheren |

## 3. Scope en fasering

Prioriteit volgens MoSCoW: **M** = must, **S** = should, **C** = could, **W** = won't (voorlopig).

| Fase | Inhoud |
|---|---|
| 1 (MVP) | Woordlijsten, leermodus met gespreide herhaling, Speedrun, XP, niveaus en weekdoel |
| 2 | Boss Battle, toetsplanner, audio, klassen, ranglijsten en docentendashboard |
| 3 | Classroom Arena (live multiplayer), gezamenlijke klasdoelen, cosmetische winkel |

Buiten scope: betaalde voordelen in het spel (pay-to-win), chat tussen leerlingen, advertenties en native apps.

## 4. Functionele requirements

### 4.1 Woordlijsten

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| WL-01 | Een gebruiker kan een woordlijst aanmaken met een titel, brontaal en doeltaal. | M | 1 |
| WL-02 | Een gebruiker kan items toevoegen, wijzigen en verwijderen. Een item bevat een woord of zin en de vertaling. | M | 1 |
| WL-03 | Een gebruiker kan een lijst importeren door tekst te plakken (gescheiden door tab, komma of `=`). | M | 1 |
| WL-04 | Een item kan meerdere goede antwoorden hebben (synoniemen). | M | 1 |
| WL-05 | Een item kan een voorbeeldzin bevatten waarin het woord in context staat. | S | 1 |
| WL-06 | Een gebruiker kan een lijst importeren uit een CSV- of Excel-bestand. | S | 2 |
| WL-07 | Een gebruiker kan een lijst delen via een link of code. | S | 2 |
| WL-08 | Een docent kan een lijst toewijzen aan een klas. | S | 2 |
| WL-09 | Een gebruiker kan een lijst importeren vanaf een foto van een woordenlijst. | C | 3 |
| WL-10 | Lijsten zijn te ordenen per methode, leerjaar en hoofdstuk. | C | 3 |
| WL-11 | De app biedt een bibliotheek met meegeleverde woordlijsten die met de app worden gepubliceerd. Een leerling kan zo'n lijst met één handeling toevoegen en daarna ook offline oefenen. De eerste meegeleverde lijst is Nederlands–Frans. | M | 1 |
| WL-12 | Bij een bijgewerkte versie van een meegeleverde lijst blijft de voortgang op ongewijzigde items behouden. | S | 1 |

### 4.2 Leren en didactiek

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| LD-01 | De app houdt per leerling, per item en per richting een beheersingsniveau bij: nieuw, geoefend, bekend, beheerst. Een goed of fout antwoord in de ene richting verandert het niveau in de andere richting niet. | M | 1 |
| LD-02 | De app plant herhalingen met gespreide herhaling: goed gekende items komen met steeds grotere tussenpozen terug. De planning wordt per richting apart bijgehouden. | M | 1 |
| LD-03 | Een nieuw item wordt eerst als meerkeuzevraag aangeboden en daarna als typvraag. | M | 1 |
| LD-04 | Elke lijst is in twee richtingen te oefenen (bijvoorbeeld Nederlands → Frans en Frans → Nederlands). De leerling kiest bij het starten van een sessie de richting: heen, terug of beide door elkaar. | M | 1 |
| LD-05 | Een fout beantwoord item komt in dezelfde sessie nog minimaal twee keer terug, waarvan minimaal één keer als typvraag. | M | 1 |
| LD-06 | Een fout beantwoord item wordt ook de volgende dag en enkele dagen later opnieuw ingepland. | M | 1 |
| LD-07 | Bij een antwoord met een kleine typfout meldt de app "bijna goed" en toont het juiste antwoord. Het item telt niet als fout, maar ook niet als volledig goed. | M | 1 |
| LD-08 | De app toont direct na elk antwoord of het goed was en wat het juiste antwoord is. | M | 1 |
| LD-09 | Een leerling kan een eigen antwoord alsnog goed rekenen ("ik had het goed"). | S | 1 |
| LD-10 | De app onderscheidt soorten fouten (typfout, accent, lidwoord, hoofdletter, verwisseling met ander item) en geeft daar gerichte feedback op. | S | 2 |
| LD-11 | De gebruiker kan instellen of accenten en hoofdletters meetellen. | S | 2 |
| LD-12 | De app kan een item voorlezen (tekst-naar-spraak in de browser). | S | 2 |
| LD-13 | De app biedt luistervragen: de leerling hoort het woord en typt het woord of de vertaling. | S | 2 |
| LD-14 | Een leerling kan een toetsdatum invoeren. De app verdeelt de stof over de beschikbare dagen en toont de dagtaak in aantal items en geschatte minuten. | S | 2 |
| LD-15 | De app biedt invulvragen waarbij het woord in een zin moet worden ingevuld. | C | 3 |
| LD-16 | De leerling kan het aantal dagen tussen herhalingen per stap zelf instellen. De standaardwaarden zijn 1, 3, 7, 14 en 30 dagen en zijn met één handeling te herstellen. | S | 1 |

### 4.3 Spelmodi

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| SM-01 | Leermodus: oefenen zonder tijdsdruk, bedoeld voor nieuwe items. | M | 1 |
| SM-02 | Speedrun: de leerling beantwoordt in 60 seconden zoveel mogelijk items. | M | 1 |
| SM-03 | In Speedrun levert elke 5 goede antwoorden op rij extra tijd op. | M | 1 |
| SM-04 | De app bewaart per lijst en per richting de persoonlijke hoogste score van Speedrun. | M | 1 |
| SM-05 | Modi met tijdsdruk gebruiken alleen items die de leerling in de gekozen richting al minimaal geoefend heeft. Zijn dat er te weinig, dan verwijst de app naar de leermodus. | M | 1 |
| SM-06 | Boss Battle: een goed antwoord brengt schade toe aan de baas, een fout antwoord kost de speler levenspunten. | S | 2 |
| SM-07 | In Boss Battle levert een sneller goed antwoord meer schade op, met een begrensd maximum. | S | 2 |
| SM-08 | Herhaalwerk wordt zichtbaar gemaakt als iets dat achteruitgaat zonder onderhoud (bijvoorbeeld een stad of een monster dat sterker wordt). | C | 3 |
| SM-09 | Classroom Arena: een docent start een live sessie en leerlingen doen mee met een code. | S | 3 |
| SM-10 | In Classroom Arena speelt iedere leerling tot het einde mee; niemand valt voortijdig af. | S | 3 |
| SM-11 | Classroom Arena heeft een teamvariant waarin de klas samen tegen één baas speelt. | S | 3 |
| SM-12 | Classroom Arena toont een tussenstand die geschikt is voor weergave op een beamer. | S | 3 |

### 4.4 Beloningen en motivatie

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| BM-01 | Een leerling verdient XP met goede antwoorden. | M | 1 |
| BM-02 | Items die moeilijk zijn of aan herhaling toe zijn, leveren meer XP op dan items die net geoefend zijn. | M | 1 |
| BM-03 | XP leidt tot niveaus; de leerling ziet het huidige niveau en de voortgang naar het volgende. | M | 1 |
| BM-04 | Een leerling heeft een weekdoel (standaard 4 actieve dagen per week) en ziet de voortgang daarvan. | M | 1 |
| BM-05 | De app toont per lijst en per richting hoeveel items nieuw, geoefend, bekend en beheerst zijn. | M | 1 |
| BM-06 | De app toont een dagreeks. Een gemiste dag kan worden opgevangen met een Streak Freeze die met verdiende punten te koop is. | S | 2 |
| BM-07 | Een leerling verdient badges voor mijlpalen (bijvoorbeeld eerste lijst beheerst, 100 items beheerst). | S | 2 |
| BM-08 | Hogere niveaus geven toegang tot cosmetische extra's: avatars, banners, titels, thema's en geluiden. | C | 3 |
| BM-09 | Cosmetische extra's zijn niet met echt geld te koop en geven geen voordeel in het spel. | M | 3 |

### 4.5 Klassen en sociale functies

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| KS-01 | Een docent kan een klas aanmaken; leerlingen sluiten aan met een klascode. | S | 2 |
| KS-02 | Een klas heeft een wekelijkse ranglijst die elke week opnieuw begint. | S | 2 |
| KS-03 | De ranglijst is gebaseerd op inzet en groei in die week, niet op totale XP. | S | 2 |
| KS-04 | Een leerling ziet de eigen positie en de top; de onderste posities worden niet aan klasgenoten getoond. | S | 2 |
| KS-05 | Een leerling kan zich afmelden voor zichtbaarheid op de ranglijst. | S | 2 |
| KS-06 | Een klas kan een gezamenlijk weekdoel hebben; bij het halen ervan krijgt iedere deelnemer een badge. | C | 3 |

### 4.6 Docent

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| DO-01 | Een docent ziet per toegewezen lijst welke items de klas het moeilijkst vindt. | S | 2 |
| DO-02 | Een docent ziet per leerling of er geoefend is en welk deel van de lijst beheerst wordt. | S | 2 |
| DO-03 | Een docent kan een leerling uit een klas verwijderen en een klascode vernieuwen. | S | 2 |
| DO-04 | Een docent kan een schermnaam verbergen of laten wijzigen. | S | 2 |
| DO-05 | Een docent kan resultaten exporteren als CSV. | C | 3 |

### 4.7 Accounts

| ID | Requirement | Prio | Fase |
|---|---|---|---|
| AC-01 | De app is zonder account te gebruiken; voortgang wordt dan lokaal in de browser bewaard. | M | 1 |
| AC-02 | Een gebruiker kan een account aanmaken om voortgang op meerdere apparaten te gebruiken. | S | 2 |
| AC-03 | Lokale voortgang wordt bij het aanmaken van een account overgenomen. | S | 2 |
| AC-04 | Een leerling gebruikt een schermnaam; een echte naam is niet verplicht. | M | 2 |
| AC-05 | Een gebruiker kan het eigen account en alle bijbehorende gegevens verwijderen. | M | 2 |
| AC-06 | Een gebruiker kan inloggen met een schoolaccount (bijvoorbeeld Microsoft of Google). | C | 3 |
| AC-07 | Een gebruiker kan alle eigen lijsten en voortgang exporteren naar een bestand en dat bestand weer importeren, ook in een andere browser of op een ander apparaat. | M | 1 |

## 5. Niet-functionele requirements

| ID | Categorie | Requirement | Prio |
|---|---|---|---|
| NF-01 | Bruikbaarheid | De app is ontworpen voor telefoons (vanaf 360 px breed) en werkt ook op tablet en desktop. | M |
| NF-02 | Bruikbaarheid | Een leerling kan binnen 2 minuten na het openen van de app de eerste oefening doen, zonder uitleg. | M |
| NF-03 | Bruikbaarheid | De interface is in het Nederlands en voorbereid op meerdere talen. | M |
| NF-04 | Prestaties | Feedback op een antwoord verschijnt binnen 100 ms. | M |
| NF-05 | Prestaties | De eerste pagina is op een 4G-verbinding binnen 3 seconden bruikbaar. | S |
| NF-06 | Beschikbaarheid | De app is installeerbaar (PWA) en solo-modi werken zonder internetverbinding; voortgang wordt later gesynchroniseerd. | S |
| NF-07 | Toegankelijkheid | De app voldoet aan WCAG 2.1 niveau AA, is met het toetsenbord te bedienen en animaties zijn uit te schakelen. | S |
| NF-08 | Toegankelijkheid | Geluid staat standaard uit of is met één handeling te dempen. | M |
| NF-09 | Privacy | De app verwerkt alleen gegevens die nodig zijn voor het leren en voldoet aan de AVG. | M |
| NF-10 | Privacy | Er zijn geen advertenties en geen trackers van derden. | M |
| NF-11 | Privacy | Gegevens worden binnen de EU opgeslagen. | M |
| NF-12 | Beveiliging | Alle communicatie verloopt via HTTPS; een gebruiker kan alleen eigen gegevens en gegevens van de eigen klas inzien. | M |
| NF-13 | Beveiliging | Scores en XP worden bij multiplayer en ranglijsten op de server gecontroleerd. | S |
| NF-14 | Schaalbaarheid | Een live sessie ondersteunt minimaal 35 gelijktijdige deelnemers. | S |
| NF-15 | Compatibiliteit | De app werkt in de laatste twee versies van Chrome, Edge, Safari en Firefox. | M |
| NF-16 | Onderhoudbaarheid | De leerlogica (planning, antwoordcontrole, XP) heeft geautomatiseerde tests. | M |

## 6. Technische uitgangspunten (voorstel)

| Onderdeel | Voorstel | Toelichting |
|---|---|---|
| Frontend | SvelteKit met TypeScript | Statische uitvoer |
| Gespreide herhaling | Leitner (bakjes) | Later uit te breiden; zie [architecture.md](./architecture.md) |
| Animaties | CSS-animaties | Een game-engine zoals Phaser pas overwegen in fase 3 |
| Hosting fase 1 | GitHub Pages op `levelup.mind4.dev` | Alleen statische bestanden; zie [architecture.md](./architecture.md) |
| Opslag fase 1 | Lokaal in de browser (IndexedDB) | Geen backend nodig voor de MVP |
| Backend vanaf fase 2 | Supabase (database, login, realtime) | Hosting in een EU-regio |
| Spraak | Web Speech API | Kwaliteit en beschikbare stemmen verschillen per browser |

## 7. Open vragen

1. Welke talen worden als eerste ondersteund?
2. Is de app bedoeld voor individueel gebruik, voor scholen, of voor beide?
3. Leveren we zelf woordlijsten bij lesmethodes mee? Daarvoor is toestemming van uitgevers nodig.
4. Welke leeftijdsgrens geldt voor het zelf aanmaken van een account, en hoe regelen we toestemming van ouders of school?
5. Hoeveel tolerantie krijgt een typfout bij korte woorden, waar één letter verschil een ander woord kan opleveren?
6. Wat is het verdienmodel, en hoe verhoudt dat zich tot de eis dat er geen betaalde voordelen zijn?
