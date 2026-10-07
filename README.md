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

## Kalibrieren (einmal vor der ersten Übung)

Ohne Kalibrierung rechnet die App mit Durchschnittswerten. Mit Kalibrierung lernt sie, wie *deine* entspannte Haltung aussieht und wie weit eine Fehlstellung bei dir davon abweicht.

Der Ablauf dauert etwa drei Minuten und hat zwölf Schritte: viermal deine normale Haltung aus verschiedenen Abständen, danach sieben Fehlstellungen, die du absichtlich einnimmst, und zum Schluss wieder normal. Jeder Schritt startet auf Knopfdruck, hat drei Sekunden Vorlauf und nimmt dann vier bis sechs Sekunden auf. Die Aufnahme pausiert automatisch, wenn du nicht vollständig im Bild bist.

### Per Zuruf bedienen

Weil du während der Kalibrierung zwei Meter vom Handy entfernt sitzt, lässt sich jeder Schritt per Sprache auslösen. Möglich sind:

| Sagen | Wirkung |
|---|---|
| „weiter“, „bereit“, „los“, „ok“ | Schritt starten |
| „wiederholen“, „nochmal“ | Aktuellen Schritt neu aufnehmen |
| „zurück“ | Einen Schritt zurück |
| „überspringen“ | Fehler-Schritt auslassen |
| „abbrechen“, „stopp“ | Kalibrierung beenden |

Während die App selbst spricht, hört sie nicht zu, damit sie nicht auf die eigene Ansage reagiert. Die Knöpfe funktionieren weiterhin.

Die Spracherkennung des Browsers braucht Internet und gibt es nicht in jedem Browser. Fehlt sie, schaltet die App auf **zweimal Klatschen** um, was auch offline geht. Ein einzelner Impuls reicht dort absichtlich nicht, sonst würde jeder Gitarrenanschlag den nächsten Schritt starten. Während einer laufenden Aufnahme ist die Klatsch-Erkennung abgeschaltet.

Abschalten lässt sich das Ganze auf dem Kalibrierbildschirm unter „Per Zuruf bedienen“.

Am Ende steht, welche Fehlstellungen klar messbar waren. Mit **Übernehmen** gelten sie ab sofort. Mit **Datei sichern** bekommst du eine JSON-Datei mit allen Messwerten (keine Bilder, kein Video), die sich auswerten lässt, um die Voreinstellungen der App zu verbessern.

Nach jeder Kalibrierung kannst du frei sitzen: Die Haltungswerte werden aus den 3D-Weltkoordinaten in Metern berechnet und sind deshalb unabhängig vom Abstand zur Kamera. Im Aufstellungs-Check zeigt die App den geschätzten Abstand in Metern an.

## Bedienung

**Haltung üben:** Handy auf ein Stativ oder ins Regal stellen, 1,5–2 m entfernt, auf Brusthöhe, frontal. Die App prüft die Aufstellung, kalibriert sich 3 Sekunden auf deine entspannte Haltung und zeigt dann Hinweise, sobald ein Problem länger als 1,5 Sekunden anhält.

**Fingerspiel üben:** Handy nah an der Greifhand, sodass Finger und Griffbrett gut zu sehen sind. Ein Lied wählen, dann prüft die App über das Mikrofon, ob der Akkord sauber klingt, zeigt das Griffbild und markiert die Saite, die nicht klingt. Gitarre vorher stimmen, sonst erkennt sie Töne falsch.

Die Greifhand wird dabei auf flache Finger, einen abstehenden kleinen Finger und einen über den Hals gehakten Daumen geprüft. Ist beim Einrichten genug vom Oberkörper im Bild, prüft die App zusätzlich die Körperhaltung mit und nimmt sie in die Note auf. Steht das Handy zu nah, bleibt es bei den Fingern; der Aufstellungs-Check sagt, was gerade gilt.

**Korrekturhinweise im Video:** In beiden Modi wird jeder erkannte Fehler direkt an der betroffenen Stelle im Bild beschriftet, etwa „Daumen runter“ am Daumen oder „Schultern locker“ an der Schulterlinie. Der ausführliche Hinweis steht zusätzlich groß am unteren Rand.

### Liederfundus

Oben auf dem Lied-Bildschirm steht ein Auswahlfeld mit 48 fertigen Akkordfolgen, nach Schwierigkeit filterbar: Übungen und Akkordwechsel, Kinder- und Volkslieder, Folk und Traditionals, Blues, Weihnachtslieder und bekannte Akkordfolgen. Vor dem Start siehst du alle Griffbilder der Folge. Eingeben musst du nichts.

Enthalten sind gemeinfreie Stücke und Übungen, nur die Akkordfolgen, keine Texte und keine Noten. Eigene Lieder lassen sich darunter weiterhin von Hand anlegen.

**Verlauf:** Notenverlauf, Fehlerquote je Akkord, Export als CSV (öffnet direkt in Excel) oder JSON.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html`, `styles.css` | Oberfläche |
| `app.js` | Ablauf, Bewertung, Verlauf, Export |
| `vision.js` | Körper- und Handerkennung, Messwerte, Fehlstellungen, Voreinstellung (`DEFAULT_RULES`) |
| `calib.js` | Kalibrierungsschritte, Statistik, Ableitung der Grenzwerte |
| `songbook.js` | Mitgelieferter Liederfundus |
| `listen.js` | Sprachbefehle und Klatsch-Erkennung |
| `audio.js` | Anschlag- und Akkorderkennung |
| `chords.js` | Akkorde, Griffbilder |
| `db.js` | Lokale Datenbank (gleiche Struktur wie das Supabase-Schema) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline-Start und App-Symbol |

## Anpassen

Am einfachsten über die Kalibrierung. Wer von Hand nachstellen will: `DEFAULT_RULES` in `vision.js` enthält je Fehlstellung den Messwert und `delta`, also wie weit du von deiner Ruhehaltung abweichen darfst, bevor ein Hinweis kommt. Größeres `delta` = nachsichtiger.

## Grenzen

- Die Erkennung arbeitet mit Schätzungen aus dem Kamerabild. Hinweise sind Anhaltspunkte, keine Messung wie im Labor.
- Die Akkordprüfung funktioniert am besten mit einzelnen Anschlägen und kurzen Pausen, schlechter bei schnellem Wechsel oder Zupfmustern.
- Wie fest du drückst, sieht die App nicht.
- Fingerhaltung und Akkordfehler werden nicht mitkalibriert, dort gelten feste Werte.
- Der Zeigefinger wird bewusst nicht auf flache Haltung geprüft, weil er beim Barré richtigerweise flach liegt.
- Im Fingermodus wird die Körperhaltung nur geprüft, wenn der Oberkörper beim Einrichten im Bild war.
- Der Zuruf ist nur in der Kalibrierung aktiv, nicht beim normalen Üben.
- Die Klatsch-Erkennung kann von anderen kurzen, scharfen Geräuschen ausgelöst werden. Schlimmstenfalls startet ein Schritt zu früh, dann hilft „wiederholen“.
- Bei anhaltenden Schmerzen bitte ärztlich oder physiotherapeutisch abklären lassen.
