# Streamcards — lokaal op een evenement-NUC

Countdown, titels, berichten, achtergronden en overlays met een live preview en een aparte schone uitvoer voor OBS of een scherm. Deze evenementversie gebruikt één lokale timer (`event`) zonder account of Firebase. Bediening en uitvoer delen de timergegevens via de NUC, ook op verschillende computers.

Alle twintig standaardachtergronden, aanwezige uploads uit de oorspronkelijke app, lettertypen, Tailwind-styling, Lottie-player, broncode en lockfiles zijn inbegrepen. Er zijn geen CDN-verzoeken nodig tijdens gebruik. Firebase-accountgegevens en cloud-timerinstellingen worden niet automatisch geïmporteerd; stel de evenementtimer in via de lokale bediening.

## Installeren

Installeer **Docker met Compose v2.24 of nieuwer** en Git op de NUC. Linux: [Docker Engine voor Ubuntu](https://docs.docker.com/engine/install/ubuntu/) met de [Compose-plugin](https://docs.docker.com/compose/install/linux/). Windows: [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/), met Linux-containers. Je hebt geen losse Node-installatie nodig. Houd minimaal 3 GB vrije ruimte beschikbaar, plus ruimte voor eigen uploads en back-ups.

Linux:

```sh
git clone https://github.com/blomsma/streamcards.git
cd streamcards
bash scripts/start.sh
```

Windows PowerShell:

```powershell
git clone https://github.com/blomsma/streamcards.git
cd streamcards
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Dit is een privérepo; gebruik je eigen GitHub-aanmelding of download de ZIP en pak die uit. De eerste build vereist internet; daarna start de app zonder downloads. De build en productiefrontend worden automatisch in Docker gemaakt.

- Bediening: **http://localhost:8787/**
- Uitvoer / OBS-browserbron: **http://localhost:8787/streamcard.html?timerId=event**
- Status: http://localhost:8787/api/health

Op een andere computer vervang je `localhost` door het IP-adres van de NUC. Flags kan tegelijkertijd draaien op poort 4174.

## Gebruik tijdens het evenement

Stel een duur of eindtijd in, kies vormgeving en start de timer. Pauze, hervatten, stoppen en herstarten werken vanuit de bediening. De preview ondersteunt slepen, schalen, roteren, uploads en verwijderen. De gewone uitvoer heeft geen editor. Gebruik één actieve operator; meerdere uitvoerschermen kunnen meekijken.

In OBS: voeg een browserbron toe met de uitvoer-URL en bijvoorbeeld 1920×1080. Gebruik transparante achtergrond wanneer je de klok over een andere bron wilt leggen. De timergegevens worden op de NUC opgeslagen. Een lopende countdown bewaart zijn eindtijd na een herstart; een gepauzeerde timer blijft gepauzeerd. Na verbindingsverlies probeert de browser opnieuw te verbinden en blijft de uitvoer aftellen.

Gebruik een vast IP-adres/DHCP-reservering, laat poort 8787 toe op het evenementnetwerk en controleer de klok van de NUC vóór het evenement. Browsers gebruiken de servertijd voor de countdown. Zet slaapstand en automatische herstarts tijdens de show uit.

Deze versie is bedoeld voor een vertrouwd lokaal evenementnetwerk: iedereen die de poort bereikt kan de lokale timer bedienen. De aanvraagmarker voor uploads is geen wachtwoord. Publiceer deze poort niet op internet. Externe bestanden waar je eigen SVG/Lottie-upload naar verwijst moeten eveneens lokaal beschikbaar zijn.

## Configuratie en opslag

Het startscript maakt `.env` uit `.env.example`:

```dotenv
BIND_ADDRESS=0.0.0.0
APP_PORT=8787
TZ=Europe/Amsterdam
```

Gebruik `BIND_ADDRESS=127.0.0.1` als alleen de NUC zelf toegang nodig heeft. Voer na aanpassen het startscript opnieuw uit. De interne containerpoort is 3001; de NUC-poort is 8787.

Timergegevens, uploads en custom fonts staan in één Docker-volume. Bij de eerste start worden bestanden uit `seed/` gekopieerd. Rebuilds en herstarts overschrijven bestaande data niet. De oude uploads zijn als bestanden meegenomen; om ze in de lokale timer te selecteren kun je ze opnieuw uploaden vanuit `seed/images`, `seed/fonts` of `seed/video`. Normale nieuwe uploads worden aan de lokale timer gekoppeld.

Uploadlimieten: video 50 MB, afbeelding/overlay 10 MB, custom font 5 MB. De meegeleverde online fonts worden tijdens de build lokaal verpakt; Arial en Georgia gebruiken de op het weergaveapparaat geïnstalleerde fonts. Lettertypen buiten het Latin-tekenset kun je als custom font uploaden.

```sh
docker compose ps
docker compose logs --tail=100
docker compose restart
docker compose stop
```

De container start mee wanneer Docker na een reboot start, zolang je hem niet handmatig hebt gestopt. Laat onder Linux Docker bij boot starten. Onder Windows moeten Docker Desktop en de gebruikerssessie starten; test dit vooraf.

## Back-up en herstel

De back-up bevat timerinstellingen, video, afbeeldingen, overlays en custom fonts. De app stopt kort en start daarna weer.

```sh
bash scripts/backup.sh
bash scripts/restore.sh backups/streamcards-YYYYMMDD-HHMMSS.tar.gz
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 -Archive backups/streamcards-YYYYMMDD-HHMMSS.tar.gz
```

Herstellen maakt eerst een back-up van de aanwezige data en overschrijft gegevens uit het gekozen archief. Overige mediabestanden blijven staan. Gebruik alleen eigen vertrouwde archieven. Kopieer belangrijke back-ups naar USB. `docker compose down` bewaart het volume; **`docker compose down -v` verwijdert de opgeslagen gegevens**.

## Installatie op een NUC zonder internet

Installeer Docker vooraf. Op een computer met internet:

```sh
bash scripts/export-offline.sh
```

Windows: `powershell -ExecutionPolicy Bypass -File scripts/export-offline.ps1`. De export bouwt expliciet voor een Intel-NUC (`linux/amd64`); een ARM-computer heeft hiervoor Docker-emulatie nodig. Je kunt op GitHub via **Actions → Verify install → Run workflow** ook een gecontroleerd Intel-image bouwen en het artifact `streamcards-nuc-amd64` downloaden.

Kopieer de repo en `transfer/images.tar` naar de NUC. Zet uit een Actions-artifact `images.tar` in `transfer/`. Op de NUC:

```sh
docker image load -i transfer/images.tar
bash scripts/start.sh --offline
```

Windows: `docker image load -i transfer/images.tar`, daarna `powershell -ExecutionPolicy Bypass -File scripts/start.ps1 -Offline`. Neem voor bestaande evenementinstellingen en uploads ook een back-up mee en herstel die. Een image-export neemt later geüploade bestanden niet mee.

## Ontwikkeling en tests

Node 22.12 of nieuwer:

```sh
npm ci
npm test
npm run build
```

Start de gebouwde app onder Linux met `WEB_ROOT=./dist npm start` (poort 3001). Onder PowerShell: `$env:WEB_ROOT = (Resolve-Path dist).Path`, daarna `npm start`. Uploads staan zonder Docker in `data/`.

Browsertest tegen de draaiende Docker-app: `npx playwright install --with-deps chromium`, daarna `npm run test:browser`. De test gebruikt de echte lokale server, blokkeert externe verzoeken en controleert bediening, live uitvoer in een aparte browsercontext, uploads, rotatie en herladen. Run deze op een testinstallatie, niet tijdens een show. `TEST_BASE_URL` kiest een andere URL. GitHub Actions controleert een schone installatie en Docker-build op Intel Linux.
