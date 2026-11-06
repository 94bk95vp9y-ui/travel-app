# CLAUDE.md – Hinweise für die Arbeit an Fernweh

Persönliche Reise-Web-App (PWA) fürs iPhone. Konzept und Entscheidungen: `KONZEPT.md`. Bedienung/Deploy: `README.md`.

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm test` – Vitest (Logik in `src/lib/*.test.ts`)
- `npm run typecheck` – TypeScript
- `npm run build` – Produktions-Build (prüft vorher Typen); `BASE_PATH=/travel-app/` für GitHub Pages
- `npm run build:data` / `npm run build:icons` – generierte Dateien neu erzeugen (nicht von Hand ändern: `src/data/countries.json`, `public/data/*`, `public/icons/*.png`, `public/splash/*`)

## Architektur

- `src/store/data.ts`: einziger Ort für Datenänderungen (zustand). Jede Änderung → `commit()` → Ansichten neu ableiten + verzögert in IndexedDB speichern.
- `src/lib/status.ts`: Länderstatus wird aus manuellem Status **und** Städten abgeleitet (besucht schlägt Wunsch). Nie den abgeleiteten Status speichern.
- `src/globe/engine.ts`: kapselt globe.gl imperativ. React (`GlobeView.tsx`) ruft nur Methoden auf, die Szene wird nie neu erstellt.
- Panels (Sheets) laufen über `useUI().sheets` (Stapel). `showDetail` ersetzt ein offenes Detail-Panel, `pushDetail` legt eins obendrauf.
- Datenformat-Version: `AppData.version = 1`. Bei Änderungen am Format: Migration in `hydrate()` und `parseBackup()` ergänzen, Backups müssen lesbar bleiben.

## Regeln

- Alle Texte in der Oberfläche auf **Deutsch**, Du-Form.
- **Leistung zuerst** (Ziel: flüssig auf dem iPhone):
  - Keine neuen Polygon-Layer für alle Länder – die Grundkarte ist eine Textur (`globe/texture.ts`).
  - Render-Schleife nur bei Bewegung (`engine.wake()`), keine Dauer-Animationen in WebGL.
  - Kein `backdrop-filter` auf großen Flächen über dem Globus.
  - Zustand-Selektoren müssen stabile Werte liefern (keine neuen Objekte/Arrays im Selektor zurückgeben).
- iOS-Besonderheiten beachten: Eingabefelder mind. 16 px Schrift (sonst Auto-Zoom), Safe-Area-Abstände, Tastatur nur per direktem Tipp (`primeKeyboard()`).
- Kein Backend/Login ohne ausdrückliche Rückfrage – die App ist bewusst lokal.
- Daten-/Bibliotheks-Lizenzen in den Einstellungen („Über“) nennen, wenn neue Quellen dazukommen.
