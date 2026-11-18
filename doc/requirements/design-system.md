# Design system en visuele identiteit Level Up (voorstel)

Status: concept, ter bespreking

Dit document beschrijft de visuele identiteit en de bouwstenen van de interface. Het hoort bij [requirements.md](./requirements.md); verwijzingen zoals NF-07 slaan op requirements uit dat document.

## 1. Merkidentiteit

### Karakter

Level Up voelt als een game, niet als een schoolboek. De stijl is **neon-arcade**: donkere achtergrond, felle accentkleuren, hoekige vormen en duidelijke beloningsmomenten.

| Wel | Niet |
|---|---|
| Energiek en zelfverzekerd | Druk of schreeuwerig |
| Speels | Kinderachtig |
| Uitdagend | Straffend of beschamend |
| Helder | Schools of zakelijk |

### Ontwerpprincipes

1. **De vraag staat centraal.** Tijdens het oefenen is alleen het woord, het invoerveld en de directe feedback prominent. Decoratie mag nooit afleiden van het lezen en typen.
2. **Elke actie geeft een reactie.** Een antwoord, een combo en een nieuw niveau hebben elk een eigen, herkenbaar visueel moment.
3. **Fouten zijn informatie.** Een fout antwoord wordt rustig en duidelijk getoond, zonder alarmerende effecten.
4. **Rustig waar je leert, uitbundig waar je wint.** Effecten zijn kort tijdens een sessie en groter op het resultaatscherm.
5. **Eén hand, één duim.** Alles is op een telefoon met één hand te bedienen (NF-01).

### Tone of voice

- Kort, direct en in de je-vorm.
- Aanmoedigend zonder overdrijving: "Bijna goed! Let op het accent." in plaats van "Fout!".
- Speltermen waar ze helpen (XP, level, combo, boss), gewone taal voor uitleg en instellingen.
- Geen sarcasme, geen straattaal die snel veroudert en geen emoji in vaste interfaceteksten.

## 2. Kleur

Het donkere thema is de standaard en bepaalt de identiteit. Een licht thema is een latere uitbreiding (zie open vragen).

### Basiskleuren

| Token | Hex | Gebruik |
|---|---|---|
| `bg` | `#0B0E1A` | Achtergrond van de app |
| `surface` | `#151A2E` | Kaarten, panelen, invoervelden |
| `surface-raised` | `#1F2642` | Zwevende elementen, geselecteerde kaarten |
| `border` | `#2E3760` | Decoratieve scheidingslijnen |
| `border-strong` | `#5A66A3` | Randen van invoervelden en knoppen |
| `text` | `#F2F4FF` | Hoofdtekst |
| `text-muted` | `#A7AFD1` | Secundaire tekst, labels |
| `ink` | `#0B0E1A` | Tekst op felle accentkleuren |

### Accentkleuren

| Token | Hex | Betekenis | Tekstkleur erop |
|---|---|---|---|
| `primary` | `#6C47FF` | Hoofdactie, merkkleur | wit |
| `primary-light` | `#A995FF` | Links, iconen en merkkleur als tekst | n.v.t. |
| `energy` | `#22D3EE` | Combo, snelheid, tijd | `ink` |
| `xp` | `#FFC53D` | XP, niveaus, beloningen | `ink` |
| `boss` | `#FF4FD8` | Boss Battle, tegenstander | `ink` |

### Feedbackkleuren

| Token | Hex | Betekenis | Vast icoon |
|---|---|---|---|
| `success` | `#2EE59D` | Goed antwoord | vinkje |
| `warning` | `#FFA94D` | Bijna goed (LD-07) | tilde of uitroepteken |
| `error` | `#FF5C7A` | Fout antwoord | kruis |

### Beheersingsniveaus

De vier niveaus uit LD-01 hebben een vaste kleur én een vast aantal gevulde blokjes, zodat ze ook zonder kleur te onderscheiden zijn.

| Niveau | Kleur | Hex | Blokjes |
|---|---|---|---|
| Nieuw | grijs | `#8A93B8` | 0 van 3 |
| Geoefend | cyaan | `#22D3EE` | 1 van 3 |
| Bekend | paars | `#A995FF` | 2 van 3 |
| Beheerst | goud | `#FFC53D` | 3 van 3 |

### Regels voor kleurgebruik

- Kleur is nooit de enige drager van betekenis: feedback heeft altijd ook een icoon en tekst.
- Accentkleuren worden spaarzaam gebruikt; per scherm is er één hoofdactie in `primary`.
- Gloed (neon-effect) is voorbehouden aan interactieve of belonende elementen, niet aan gewone tekst.
- Felle accentkleuren krijgen donkere tekst (`ink`); alleen `primary` krijgt witte tekst.

### Contrast

De combinaties hieronder zijn doorgerekend volgens WCAG 2.1 (NF-07). De eis is 4,5:1 voor tekst en 3:1 voor randen van bedieningselementen.

| Voorgrond | Achtergrond | Verhouding |
|---|---|---|
| `text` | `bg` / `surface` / `surface-raised` | 17,6 / 15,7 / 13,6 |
| `text-muted` | `bg` / `surface` / `surface-raised` | 8,9 / 8,0 / 6,9 |
| wit | `primary` | 5,3 |
| `primary-light` | `bg` / `surface-raised` | 7,7 / 6,0 |
| `ink` | `energy` / `xp` / `success` / `warning` | 10,6 / 12,2 / 11,7 / 10,1 |
| `error` | `bg` / `surface-raised` | 6,5 / 5,0 |
| `boss` | `bg` / `surface-raised` | 6,7 / 5,2 |
| niveau Nieuw | `surface-raised` | 4,9 |
| `border-strong` | `bg` / `surface` | 3,5 / 3,2 |

Twee beperkingen volgen hieruit:

- `border` (1,5:1 op `surface`) is alleen decoratief en mag geen bedieningselement afbakenen.
- `border-strong` haalt op `surface-raised` 2,7:1; invoervelden en knoppen met alleen een rand staan daarom op `bg` of `surface`.

## 3. Typografie

| Rol | Lettertype | Gebruik |
|---|---|---|
| Display | Chakra Petch (600, 700) | Titels, knoppen, scores, niveaus |
| Tekst | Inter (400, 500, 600) | Vragen, antwoorden, uitleg, formulieren |

- Beide lettertypes hebben een open licentie (SIL Open Font License) en worden zelf gehost, niet via een externe dienst geladen (NF-10).
- Vragen en antwoorden staan altijd in het tekstlettertype: accenten en tekens zoals é, ç, ß, ñ en ø moeten goed leesbaar zijn. Het displaylettertype is alleen voor interfacetekst.
- Bij uitbreiding naar talen met een ander schrift (bijvoorbeeld Grieks) moet het tekstlettertype opnieuw worden beoordeeld.
- Scores, timers en XP gebruiken cijfers van gelijke breedte (`font-variant-numeric: tabular-nums`), zodat getallen niet verspringen.

### Schaal

| Token | Grootte / regelhoogte | Gebruik |
|---|---|---|
| `display-xl` | 40 / 44 px | Resultaat, nieuw niveau |
| `display-l` | 28 / 32 px | Schermtitel |
| `display-m` | 20 / 24 px | Kaarttitel, knoptekst |
| `prompt` | 32 / 40 px | Het gevraagde woord of de zin |
| `answer` | 20 / 28 px | Invoerveld |
| `body` | 16 / 24 px | Lopende tekst |
| `small` | 14 / 20 px | Labels, hulptekst |

- Tekst is nooit kleiner dan 14 px. Het invoerveld is minimaal 16 px, anders zoomt iOS in bij het typen.
- Lange zinnen in `prompt` schalen terug naar minimaal 20 px in plaats van af te breken met puntjes.
- Hoofdletters met extra letterafstand alleen voor korte labels (maximaal drie woorden).

## 4. Vorm, ruimte en diepte

| Onderdeel | Waarde |
|---|---|
| Ruimteschaal | 4, 8, 12, 16, 24, 32, 48 px |
| Afronding | 6 px (klein), 12 px (kaarten en knoppen), volledig rond (avatars, labels) |
| Minimaal aanraakdoel | 48 × 48 px |
| Maximale inhoudsbreedte | 480 px voor oefenschermen, 960 px voor overzichten |
| Breekpunten | 360 px (basis), 768 px (tablet), 1024 px (desktop) |

- **Kenmerkende vorm:** kaarten en primaire knoppen hebben één afgeschuinde hoek (rechtsboven, 12 px). Dit is het herkenningsteken van de stijl en wordt niet op elk klein element toegepast.
- **Diepte door licht, niet door schaduw:** op een donkere achtergrond werkt een lichtere tint (`surface-raised`) en een gekleurde gloed beter dan een donkere schaduw.
- **Gloed:** `0 0 16px` in de accentkleur met 40% dekking, alleen op de hoofdactie, een actieve combo en beloningen.
- **Achtergrond:** een subtiel raster of verloop is toegestaan op overzichtsschermen, niet achter de vraag.

## 5. Componenten

### Knoppen

| Variant | Uiterlijk | Gebruik |
|---|---|---|
| Primair | Vlak `primary`, witte tekst, afgeschuinde hoek, gloed | Eén per scherm: de hoofdactie |
| Secundair | Rand `border-strong`, tekst `text` | Alternatieve actie |
| Tekstknop | Alleen tekst in `primary-light` | Minder belangrijke actie |
| Antwoordknop | Kaart op `surface`, volle breedte | Meerkeuzeopties |

Elke knop heeft de toestanden standaard, ingedrukt (2 px omlaag), focus (2 px rand in `energy` met 2 px tussenruimte), uitgeschakeld (40% dekking) en bezig.

### Invoerveld voor antwoorden

- Volle breedte, minimaal 56 px hoog, tekst in `answer`.
- Autocorrectie, automatische hoofdletters en spellingcontrole staan uit; die verstoren het typen in een vreemde taal.
- Onder het veld staat een rij met speciale tekens voor de doeltaal (bijvoorbeeld é, è, ç), omdat die op een telefoon lastig te vinden zijn.
- Het veld houdt de focus tussen vragen, zodat het toetsenbord niet steeds in- en uitklapt.

### Feedbackbalk

Verschijnt direct na een antwoord onder aan het scherm (LD-08).

| Toestand | Kleur | Inhoud |
|---|---|---|
| Goed | `success` | Vinkje, verdiende XP |
| Bijna goed | `warning` | Het juiste antwoord, met het verschil gemarkeerd |
| Fout | `error` | Het juiste antwoord en het gegeven antwoord |

De balk blijft bij "bijna goed" en "fout" staan tot de leerling doorgaat; bij "goed" gaat de sessie na korte tijd vanzelf verder.

### Voortgang en status

| Component | Beschrijving |
|---|---|
| XP-balk | Horizontale balk in `xp` met het niveau als getal ernaast |
| Sessiebalk | Dunne balk bovenaan die de voortgang binnen de sessie toont |
| Timer | Balk in `energy` die leegloopt; onder 10 seconden wisselt de kleur naar `warning` |
| Combo-teller | Getal in `energy` dat bij elke stap kort groter wordt; verdwijnt bij een fout |
| Levensbalk | Voor speler en baas in Boss Battle; de baas gebruikt `boss` |
| Beheersingsmeter | Drie blokjes per item of een gestapelde balk per lijst en per richting (BM-05) |
| Weekdoel | Zeven stippen voor de dagen van de week; actieve dagen zijn gevuld (BM-04) |

### Overige componenten

| Component | Beschrijving |
|---|---|
| Lijstkaart | Titel, talen, aantal items en beheersingsmeter per richting |
| Richtingkiezer | Drie keuzes: heen, terug, beide (LD-04), met de taalnamen uitgeschreven |
| Moduskaart | Illustratie, naam en korte uitleg per spelmodus |
| Navigatie | Balk onderaan met maximaal vier onderdelen op telefoon; zijbalk op desktop |
| Resultaatscherm | Score, verdiende XP, nieuwe beheersing en één duidelijke vervolgactie |
| Melding | Korte melding bovenaan die vanzelf verdwijnt; nooit over het invoerveld heen |
| Lege toestand | Illustratie, één zin uitleg en één actie |

## 6. Beeldtaal

- **Iconen:** één lijnstijl (2 px, afgeronde uiteinden) uit een open iconenset zoals Lucide of Phosphor. Iconen zonder tekstlabel alleen voor algemeen bekende acties (sluiten, terug, geluid).
- **Illustraties:** vlakke vectorfiguren met dikke contouren en de accentkleuren uit het palet. Monsters en bazen zijn stoer of grappig, niet eng of gewelddadig.
- **Avatars:** opgebouwd uit geometrische basisvormen, zodat varianten en cosmetische extra's (BM-08) goedkoop te maken zijn.
- **Inclusief:** figuren zijn niet gebonden aan een geslacht, huidskleur of cultuur; fantasiewezens hebben de voorkeur boven mensfiguren.
- **Formaat:** SVG voor iconen en illustraties, zodat alles scherp blijft en de app klein blijft (NF-05).

## 7. Beweging

| Token | Duur | Gebruik |
|---|---|---|
| `fast` | 120 ms | Knop indrukken, kleurwissel |
| `base` | 200 ms | Feedbackbalk, overgang tussen vragen |
| `slow` | 400 ms | Schermovergang, balk vullen |
| `celebrate` | maximaal 1200 ms | Nieuw niveau, baas verslagen, record |

| Moment | Effect |
|---|---|
| Goed antwoord | Korte groene flits van het veld, XP-getal dat naar de XP-balk beweegt |
| Bijna goed | Rustige oranje markering, geen beweging |
| Fout antwoord | Eén korte horizontale schud van het veld (maximaal 6 px) |
| Combo | Teller groeit kort; bij 5 op rij een lichtflits langs de timer |
| Nieuw niveau | Volledig scherm met confetti in de accentkleuren |

- Feedback op een antwoord start binnen 100 ms (NF-04); animaties mogen het doorgaan naar de volgende vraag nooit vertragen.
- Alleen `transform` en `opacity` worden geanimeerd, zodat het ook op goedkope telefoons soepel blijft.
- Bij de systeeminstelling "verminder beweging" en bij de eigen schakelaar in de app (NF-07) vervallen schudden, confetti en bewegende getallen; kleurwissels blijven.
- Niets knippert vaker dan drie keer per seconde.

## 8. Geluid en trillen

- Geluid staat standaard uit en is met één tik aan of uit te zetten (NF-08).
- Er zijn korte geluiden (korter dan een halve seconde) voor goed, fout, combo en nieuw niveau. Er is geen achtergrondmuziek.
- Geluid voegt nooit informatie toe die niet ook zichtbaar is.
- Trillen bij een fout antwoord is optioneel en volgt dezelfde schakelaar als geluid.

## 9. Toegankelijkheid

- Contrast volgens paragraaf 2; kleur nooit als enige signaal.
- Alle functies zijn met het toetsenbord te bedienen: Enter bevestigt een antwoord en gaat door, de cijfertoetsen 1 tot 4 kiezen een meerkeuzeoptie.
- De focusrand is altijd zichtbaar en wordt nergens weggehaald.
- Feedback op een antwoord wordt ook aan schermlezers gemeld.
- De interface blijft bruikbaar bij 200% tekstvergroting.
- Tijdsdruk is geen voorwaarde om te kunnen leren: de leermodus zonder timer biedt dezelfde stof (SM-01).

## 10. Design tokens

De waarden uit dit document worden als CSS-variabelen vastgelegd, zodat thema's (BM-08) alleen de variabelen hoeven te overschrijven.

```css
:root {
  --color-bg: #0B0E1A;
  --color-surface: #151A2E;
  --color-surface-raised: #1F2642;
  --color-border: #2E3760;
  --color-border-strong: #5A66A3;
  --color-text: #F2F4FF;
  --color-text-muted: #A7AFD1;
  --color-ink: #0B0E1A;

  --color-primary: #6C47FF;
  --color-primary-light: #A995FF;
  --color-energy: #22D3EE;
  --color-xp: #FFC53D;
  --color-boss: #FF4FD8;

  --color-success: #2EE59D;
  --color-warning: #FFA94D;
  --color-error: #FF5C7A;

  --font-display: "Chakra Petch", system-ui, sans-serif;
  --font-text: "Inter", system-ui, sans-serif;

  --radius-s: 6px;
  --radius-m: 12px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 400ms;
}
```

Cosmetische thema's mogen de accentkleuren en de achtergrond wijzigen, maar niet de feedbackkleuren en niet de contrasteisen.

## 11. Open vragen

1. Komt er naast het donkere thema ook een licht thema, bijvoorbeeld voor gebruik op een beamer in een licht lokaal (SM-12)?
2. Krijgt de app een mascotte of vast personage, of blijven het wisselende monsters en bazen?
3. Is er budget voor eigen illustraties, of werken we met een bestaande open set?
4. Moet het docentendashboard dezelfde gaming-stijl krijgen, of een rustiger variant met hetzelfde palet?
5. Zijn de naam "Level Up" en een bijbehorend logo definitief? Het logo is in dit voorstel nog niet uitgewerkt.
