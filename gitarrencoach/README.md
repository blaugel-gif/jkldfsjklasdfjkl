# Haltungscoach Gitarre

Web-App, die dich über die Handykamera beim Gitarrespielen beobachtet, Haltung und Fingerspiel bewertet und dir Hinweise auf dem Bildschirm und per Sprache gibt. Alle Auswertungen bleiben lokal auf dem Handy.

## Online stellen mit GitHub Pages (kostenlos, ca. 10 Minuten)

Kamera und Mikrofon funktionieren im Browser nur über eine https-Adresse. GitHub Pages liefert das automatisch.

1. Konto auf github.com anlegen (falls noch nicht vorhanden).
2. Oben rechts auf **+** → **New repository**. Name z. B. `gitarrencoach`, Sichtbarkeit **Public**, dann **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken und alle Dateien aus diesem Ordner hineinziehen (nicht den Ordner selbst). Unten **Commit changes**.
4. Im Repository **Settings** → **Pages**. Unter *Branch* `main` und `/ (root)` wählen, **Save**.
5. Nach ein bis zwei Minuten erscheint dort die Adresse, z. B. `https://deinname.github.io/gitarrencoach/`.
6. Diese Adresse auf dem Handy öffnen und über das Teilen-Menü **Zum Home-Bildschirm** hinzufügen. Dann startet sie wie eine App.

Beim ersten Start lädt die App die Erkennungsmodelle (ca. 15 MB). Danach liegen sie im Speicher und die App startet schneller.

## Bedienung

**Haltung üben:** Handy auf ein Stativ oder ins Regal stellen, 1,5–2 m entfernt, auf Brusthöhe, frontal. Die App prüft die Aufstellung, kalibriert sich 3 Sekunden auf deine entspannte Haltung und zeigt dann Hinweise, sobald ein Problem länger als 1,5 Sekunden anhält.

**Fingerspiel üben:** Handy nah an der Greifhand, sodass Finger und Griffbrett gut zu sehen sind. Ein Lied mit Akkordfolge wählen. Die App hört über das Mikrofon, ob der Akkord sauber klingt, zeigt das Griffbild und markiert die Saite, die nicht klingt. Gitarre vorher stimmen, sonst erkennt sie Töne falsch.

**Verlauf:** Notenverlauf, Fehlerquote je Akkord, Export als CSV (öffnet direkt in Excel) oder JSON.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Oberfläche |
| `app.js` | Ablauf, Bewertung, Verlauf, Export |
| `vision.js` | Körper- und Handerkennung, Grenzwerte (`LIMITS`) |
| `audio.js` | Anschlag- und Akkorderkennung |
| `chords.js` | Akkorde, Griffbilder |
| `db.js` | Lokale Datenbank (gleiche Struktur wie das Supabase-Schema) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline-Start und App-Symbol |

## Anpassen

Die Grenzwerte stehen oben in `vision.js` unter `LIMITS`. Wenn dir die App zu streng oder zu nachsichtig ist, dort z. B. `wristFret: 40` (Grad Abknickung der Greifhand) ändern.

## Grenzen

- Die Erkennung arbeitet mit Schätzungen aus dem Kamerabild. Hinweise sind Anhaltspunkte, keine Messung wie im Labor.
- Die Akkordprüfung funktioniert am besten mit einzelnen Anschlägen und kurzen Pausen, schlechter bei schnellem Wechsel oder Zupfmustern.
- Wie fest du drückst, sieht die App nicht.
- Bei anhaltenden Schmerzen bitte ärztlich oder physiotherapeutisch abklären lassen.
