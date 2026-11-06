# Fernweh – dein Reise-Atlas fürs iPhone

Eine Web-App (PWA), die du auf dem iPhone zum Home-Bildschirm hinzufügst und dann wie eine normale App nutzt – ohne App Store und ohne Apple-Entwicklerkonto.

- **3D-Globus**: besuchte Länder leuchten gold, Wunschziele violett, Städte als Pins
- **Länder & Städte** markieren: *besucht* (mit Jahr) oder *will hin*
- **Ideen & Links**: TikTok-, Instagram-, YouTube- oder Maps-Links mit Notiz und Kategorie direkt an einem Land oder einer Stadt speichern – oder erst einmal in die **Sammelbox**
- **Statistik**: Anteil an 195 Ländern, Kontinente, Zeitleiste nach Jahren, Erfolge, Zufallsziel aus der Wunschliste
- **Offline** nutzbar, alle Daten bleiben auf dem Gerät, **Backup** als Datei

## Auf dem iPhone installieren

1. Die App-Adresse in **Safari** öffnen (z. B. `https://94bk95vp9y-ui.github.io/travel-app/`, siehe „Veröffentlichen“).
2. Unten auf **Teilen** tippen → **„Zum Home-Bildschirm“**.
3. Fernweh ab jetzt nur über das neue Icon öffnen.

> **Wichtig:** Safari und die installierte App haben **getrennte Speicher**. Trag deine Reisen erst in der installierten App ein. Wird das Icon gelöscht, sind die Daten weg – mach regelmäßig ein Backup (Einstellungen → „Backup sichern“, z. B. nach „Dateien“/iCloud Drive).
>
> Der Speicher gehört zur Web-Adresse. Wenn du später auf eine andere Adresse umziehst (z. B. eigene Domain), nimm die Daten per Backup → Laden mit.

## Veröffentlichen (kostenlos über GitHub Pages)

Das Repository enthält einen fertigen Workflow (`.github/workflows/deploy.yml`):

1. Auf GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions“** einstellen.
2. Den Code auf `main` bringen (Pull Request mergen). Danach baut und veröffentlicht GitHub die App automatisch bei jedem Push auf `main`.
3. Die Adresse steht anschließend unter **Settings → Pages** bzw. im Actions-Lauf.

Alternativ funktionieren auch Vercel, Netlify oder Cloudflare Pages (Build-Befehl `npm run build`, Ausgabeordner `dist`).

## Entwicklung

Voraussetzung: Node.js 22

```bash
npm install
npm run dev          # Entwicklungsserver (auch im WLAN erreichbar, zum Testen auf dem iPhone)
npm test             # Logik-Tests (Vitest)
npm run build        # Produktions-Build nach dist/
npm run preview      # Build lokal ansehen
npm run build:data   # Karten-/Länderdaten neu erzeugen (lädt Natural Earth herunter)
npm run build:icons  # App-Icons & iOS-Startbilder neu erzeugen (braucht Playwright)
```

Zum Testen auf dem iPhone im selben WLAN: `npm run dev` zeigt eine „Network“-Adresse. Hinweis: Service Worker und manche Funktionen (z. B. Zwischenablage) brauchen HTTPS – dafür am besten die veröffentlichte Version nutzen.

## Technik

| Bereich | Lösung |
|---|---|
| Oberfläche | React 19 + TypeScript, Vite, eigenes CSS (dunkles Design) |
| Globus | globe.gl / three.js (WebGL) |
| Kartendaten | Natural Earth (gemeinfrei), vereinfacht mit mapshaper |
| Länderinfos | `world-countries` (mledoze/countries, ODbL) |
| Städte | ~7.300 Städte mit deutschen Namen (Natural Earth), offline |
| Kleine Orte | Online-Suche über Photon (komoot), Daten © OpenStreetMap-Mitwirkende |
| Speicher | IndexedDB auf dem Gerät (idb-keyval), Zustand mit zustand |
| Offline/Installierbar | vite-plugin-pwa (Workbox) |

### Leistung (wichtig für flüssiges Scrollen und Drehen)

- Die Ländergrenzen werden **einmal** in eine Textur gezeichnet → der ganze Globus ist ein einziger Draw-Call. Nur Länder mit Status werden als 3D-Flächen dargestellt.
- Die Render-Schleife **pausiert**, sobald sich nichts bewegt (Akku). Die Auto-Rotation stoppt nach einer Minute ohne Berührung.
- Pixeldichte auf max. 2 begrenzt, keine Weichzeichner-Effekte hinter großen Panels.
- Ungenutzte Teile der Globus-Bibliothek (WebGPU, H3) sind durch Platzhalter ersetzt (`src/globe/stubs`), das spart ~1 MB JavaScript.

## Projektstruktur

```
src/
  components/      Globus-Ansicht, Panels (Sheets), Tab-Leiste, UI-Bausteine
  components/sheets/  Land, Stadt, Idee, Suche, Hinzufügen, Einstellungen
  screens/         Orte, Ideen, Statistik
  globe/           Globus-Engine (globe.gl), Textur, Länder-Lookup
  lib/             Logik: Status-Ableitung, Statistik, Links, Suche, Backup, Speicher
  store/           Daten-Store (persistiert) und UI-Store
  data/            Länder-Metadaten (generiert)
public/data/       Ländergrenzen & Städte (generiert)
scripts/           Daten- und Icon-Generatoren
```

## Bekannte Grenzen

- Web-Apps erscheinen auf iOS **nicht im Teilen-Menü** anderer Apps. Links werden kopiert und in Fernweh eingefügt.
- Kein haptisches Feedback (iOS Safari unterstützt die Vibrations-Schnittstelle nicht).
- Automatische Titel für TikTok/YouTube-Links funktionieren nur, wenn der Anbieter Browser-Anfragen erlaubt; sonst bleibt der Titel leer bzw. wird von Hand eingegeben.
