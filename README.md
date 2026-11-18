# Level Up

Level Up is een app om woordjes te oefenen met korte, speelse sessies: je verdient punten, bouwt voortgang op en herhaalt woorden op het juiste moment. De app draait volledig in de browser, werkt offline en is installeerbaar als app op je telefoon of computer.

Gebouwd met SvelteKit (Svelte 5, TypeScript), Dexie (IndexedDB) en `adapter-static`.

## Ontwikkelen

Vereist Node 24 of nieuwer (zie `.nvmrc`).

```sh
npm i
npm run dev        # ontwikkelserver
npm run check      # typecontrole (svelte-check)
npm test           # unit-tests (Vitest)
npm run build      # statische build naar build/
npm run preview    # build lokaal bekijken
```

Het basispad van de site is instelbaar met de omgevingsvariabele `BASE_PATH` (standaard leeg, voor een eigen domein). Voorbeeld voor een projectsite: `BASE_PATH=/level-up npm run build`.

De app-iconen staan als PNG in `static/icons/`. Na een wijziging van `static/icon.svg` maak je ze opnieuw met `node scripts/make-icons.mjs` (gebruikt het devDependency `sharp`).

## Meegeleverde woordlijsten toevoegen

Meegeleverde lijsten staan in `static/lists/`: een catalogus (`index.json`) en één bestand per lijst.

1. Maak `static/lists/<id>.json`:

   ```json
   {
     "id": "fr-nl-basis-1",
     "version": 1,
     "title": "Frans basiswoorden 1",
     "source": "nl",
     "target": "fr",
     "items": [
       { "id": "huis", "term": "het huis", "translation": "la maison", "example": "La maison est grande." },
       { "id": "fiets", "term": "de fiets", "translation": "le vélo", "alternatives": ["la bicyclette"] }
     ]
   }
   ```

2. Voeg de lijst toe aan `static/lists/index.json` met dezelfde `id`, `version`, `title`, `source` en `target`, plus `itemCount` (aantal items) en `file` (bestandsnaam).
3. Controleer alles met `npm run validate:lists`.

Regels voor item-id's: kleine letters, cijfers en streepjes (ASCII), uniek binnen de lijst en nooit hergebruiken voor een ander woord. Zo blijft de voortgang van leerlingen behouden als je een lijst bijwerkt. Verhoog `version` bij elke inhoudelijke wijziging, in zowel de lijst als de catalogus. Neem geen woordlijsten uit lesmethodes over zonder toestemming van de uitgever.

## Publiceren (GitHub Pages)

De workflow `.github/workflows/deploy.yml` draait bij elke push en pull request: `npm ci`, `check`, `test`, `validate:lists` en `build`. Alleen een push naar `main` publiceert de site.

1. Zet in de repository bij **Settings → Pages** de bron op **GitHub Actions**.
2. Eigen domein `levelup.mind4.dev`:
   - verifieer het domein in de accountinstellingen van GitHub (`TXT`-record);
   - maak bij de DNS-provider een `CNAME`-record voor `levelup` naar `<account>.github.io`;
   - vul het domein in bij **Settings → Pages → Custom domain** (het bestand `static/CNAME` zorgt dat dit bij elke publicatie behouden blijft);
   - zet **Enforce HTTPS** aan zodra het certificaat klaar is.
3. Zonder eigen domein staat de site op `https://<account>.github.io/<repository>/`. Zet dan `BASE_PATH=/<repository>` bij de build-stap in de workflow en verwijder `static/CNAME`.

Koppel het domein vóór de eerste gebruikers: opslag in de browser is gebonden aan het adres.

## Privacy

Alles blijft lokaal in je browser (IndexedDB). Er is geen account, geen analytics en geen tracking, en de app laadt alleen bestanden van de eigen site. GitHub Pages registreert als hoster wel de IP-adressen van bezoekers.

## Back-up en herstel

Wis je browsergegevens of wissel je van apparaat, dan ben je je voortgang kwijt. Gebruik in de app de functie **exporteren** om een back-upbestand te bewaren en **importeren** om het terug te zetten.
