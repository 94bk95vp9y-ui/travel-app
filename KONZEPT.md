# Fernweh – Konzept & Entscheidungen

## Ziel

Ein persönlicher Reise-Atlas als Web-App fürs iPhone: **wo war ich, wo will ich hin – und alles, was ich dazu gesammelt habe, an einem Ort.**
Kern ist die Kombination aus Karte (Erinnern) und Inspirations-Sammlung (TikTok-/Instagram-Links, Notizen) direkt am Ort. Der Globus ist die visuelle Bühne.

## Getroffene Entscheidungen (Stand v1)

| Frage | Entscheidung | Folge |
|---|---|---|
| Für wen? | Nur für mich | Kein Login, keine Freunde-Funktionen |
| Geräte? | Nur iPhone | Daten lokal (IndexedDB), kein Server, Backup als Datei |
| Links aus TikTok & Co.? | Manuell einfügen reicht | Kein iOS-Kurzbefehl/Server nötig; „Einfügen“-Knopf + Erkennung der URL in geteiltem Text |
| Detailtiefe | Länder und Städte | Keine Einzel-Spots mit eigenem Pin; Spots stehen als Ideen/Notizen an der Stadt |
| Reisen | Ort + Jahr | Kein eigenes „Reise“-Objekt; Jahre (mehrfach möglich) an Land und Stadt |
| Zählweise | 195 Länder (193 UN + Vatikan + Palästina) | Gebiete (Hongkong, Grönland, Kosovo …) markierbar, aber separat gezählt |
| Status-Logik | „Besucht“ schlägt „Will hin“; Länderstatus wird aus Städten abgeleitet | Kein doppeltes Pflegen |

## Funktionen v1

- Globus mit Länderfärbung (gold = besucht, violett = Wunsch), Stadt-Pins, Ring-Effekt beim Markieren
- Land antippen → Panel mit Status, Jahren, Städten, Ideen, Notizen, Infos (Hauptstadt, Sprachen, Währung, Fläche)
- Suche: Länder (deutsch/englisch), ~7.300 Städte offline, kleinere Orte online, Notlösung „ohne Karte hinzufügen“
- Ideen: Link + Titel + Kategorie + Notiz, Ort zuordnen oder Sammelbox, abhaken, Rückgängig beim Löschen
- Listen: Länder nach Kontinent (inkl. „Alle Länder“ zum schnellen Abhaken), Städte nach Land
- Statistik: Weltanteil, Landfläche, Kontinente, Zeitleiste, 12 Erfolge, Zufallsziel
- Einstellungen: Auto-Rotation, Stadt-Pins, Backup sichern/laden, dauerhafter Speicher, alles löschen
- PWA: installierbar, offline, Update-Hinweis, iOS-Startbilder

## Bewusst nicht enthalten

Buchungen/Flugsuche, Visa-Regeln (nur Link zu offiziellen Hinweisen), eigene Fotogalerie, Social-Funktionen, Budget-Tracking.

## Mögliche nächste Schritte (nach ein paar Wochen Nutzung entscheiden)

1. **Titelbild** pro Land/Stadt (komprimiert in IndexedDB, im Backup enthalten)
2. **Teilen-Bild**: Globus + Statistik als Bild für die Instagram-Story
3. **Flugrouten** als Bögen zwischen Orten eines Jahres
4. **Cloud-Sync** (z. B. Supabase) – erst wenn ein zweites Gerät oder das iOS-Teilen-Menü wirklich gebraucht wird
5. **Erinnerung an Backups** per Push (iOS 16.4+ unterstützt Web-Push für installierte Web-Apps)

## Offene Punkte / zu prüfen auf dem echten iPhone

- Flüssigkeit des Globus und Akkuverbrauch (getestet wurde nur in Chromium mit Software-Rendering)
- Verhalten von „Einfügen“ (Zwischenablage) und Datei-Export über das Teilen-Menü
- Ob TikTok/YouTube die automatische Titel-Abfrage aus dem Browser zulassen
