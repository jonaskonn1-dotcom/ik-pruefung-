# IK-Prüfungstrainer – Industriekaufmann/-frau

Lern-App zur Vorbereitung auf die IHK-Abschlussprüfung **Industriekaufmann/-frau**
(neue Ausbildungsordnung 2024 als Standard, alte Verordnung 2002 umschaltbar).
Statische Website ohne Backend und ohne Login, als PWA auf dem Handy installierbar und offline nutzbar.

**Live:** <https://jonaskonn1-dotcom.github.io/ik-pruefung-/>

> Kein offizielles Angebot der IHK oder der AkA. Alle Aufgaben sind selbst erstellt
> (Modellunternehmen: fiktive *Westpfalz Metallwerk GmbH*). Angaben ohne Gewähr.

---

## Funktionen

| Bereich | Was es kann |
|---|---|
| **Start** | Countdown zur schriftlichen Prüfung und zur Fachaufgabe, Fortschritt je Prüfungsbereich, Tagesstatistik |
| **Quiz** | AkA-Aufgabentypen: Einfach-/Mehrfachauswahl, Zuordnung, Reihenfolge, Rechenaufgaben mit Toleranz; Lösungsweg nach jeder Antwort; Tasten 1–9 und Enter am PC |
| **Gemischtes Quiz** | standardmäßig nur MVPK + WiSo; Teil 1 per Schalter zuschaltbar |
| **Prüfungssimulation** | echtes Zeitlimit (MVPK 150 Min., WiSo 60 Min., Teil 1 90 Min.; Kurzvariante mit halber Zeit), keine Lösungen während der Bearbeitung, IHK-Notenschlüssel, Auswertung nach Thema, läuft nach Neuladen weiter |
| **Lernkarten** | Leitner-System mit 5 Fächern (Wiederholung nach 1/3/7/16/35 Tagen) |
| **Fehlerkorb** | falsche Antworten werden gesammelt, nach 2× richtig in Folge entfernt |
| **Statistik** | Schwachstellen nach Thema, „Schwächste Themen üben“, Simulationsverlauf |
| **Formelsammlung** | ca. 80 Formeln mit Beispielen, durchsuchbar |
| **Entgeltrechner** | Brutto → Netto mit SV-Sätzen 2026, Arbeitgeberanteile |
| **Fachaufgaben-Trainer** | Checklisten für Dokumentation, Präsentation und Fachgespräch, typische Fachgesprächsfragen mit eigenen Notizen, 10-/20-Minuten-Probe-Timer |
| **Eigene Inhalte** | eigene Fragen und Lernkarten in der App anlegen |
| **Sicherung** | Lernstand exportieren/importieren, **Zusammenführen** zwischen Geräten (Handy ↔ Mac) |

Werte, die sich jährlich ändern, sind in der App mit **„Stand 2026 – prüfen“** gekennzeichnet.

---

## Benutzung auf Handy und Mac

1. Link öffnen: <https://jonaskonn1-dotcom.github.io/ik-pruefung-/>
2. **Installieren:**
   - Android/Chrome: Menü ⋮ → *App installieren* bzw. *Zum Startbildschirm hinzufügen*
   - iPhone/Safari: Teilen-Symbol → *Zum Home-Bildschirm*
   - Mac/Chrome oder Edge: Installieren-Symbol in der Adressleiste; Safari (macOS 14+): *Ablage → Zum Dock hinzufügen*
3. Der Lernstand wird **nur im Browser des jeweiligen Geräts** gespeichert.
   Gerätewechsel: *Mehr → Sicherung & Gerätewechsel → Teilen/Herunterladen*, auf dem
   anderen Gerät die Datei auswählen und **Zusammenführen** wählen (pro Frage gilt die neuere Antwort).
4. Updates: Nach einer neuen Veröffentlichung lädt die App beim nächsten Öffnen mit Internet automatisch die neue Version.

---

## Entwicklung

Voraussetzung: Node.js 20+ (getestet mit 22).

```bash
npm install
```

```bash
npm run dev          # Entwicklungsserver: http://localhost:5173
```

```bash
npm test             # prüft alle Inhalte und rechnet jede Rechenaufgabe nach
```

```bash
npm run build        # erst Test, dann Build nach dist/ (inkl. Service Worker)
```

```bash
npm run preview      # Build lokal ansehen: http://localhost:4173
```

```bash
npm run uebersicht   # Tabelle: Fragen/Rechenaufgaben/Karten je Thema
```

Technik: Vite + Vanilla JavaScript, keine Laufzeit-Abhängigkeiten. Der Service Worker wird
beim Build von einem kleinen Plugin in `vite.config.js` erzeugt (alle Dateien werden vorab gecacht).

### Projektstruktur

```
content/
  config.json                 Prüfungstermine, IHK, Notenschlüssel, Quiz-Einstellungen
  modellunternehmen.json      fiktives Modellunternehmen
  pruefung/ao2024.json        Prüfungsstruktur neue AO (Bereiche, Dauer, Gewichte, Simulationsgröße)
  pruefung/vo2002.json        Prüfungsstruktur alte VO
  themen/teil1/*.json         Themen Teil 1
  themen/teil2-mvpk/*.json    Themen MVPK (Marketing, Vertrieb, Personal, KSK)
  themen/teil2-wiso/*.json    Themen WiSo
  formeln/*.json              Formelsammlung (eine Datei je Gruppe)
  fachaufgabe/*.json          Checklisten und Fachgesprächsfragen
data/werte-2026.json          jährlich wechselnde Werte mit Quelle und Abrufdatum
scripts/                      Test, Nachrechnen, Übersicht, Icons
src/                          App-Code (views/, lib/)
tests/                        Browser-Tests (Playwright) und Unit-Tests
```

---

## Inhalte bearbeiten

### Prüfungstermin ändern

`content/config.json`:

```json
"termine": {
  "schriftlich": { "von": "2026-11-24", "bis": "2026-11-25", "label": "Schriftliche Prüfung Teil 2" },
  "muendlich":   { "von": "2027-01-04", "bis": "2027-01-29", "label": "Fachaufgabe im Einsatzgebiet" }
}
```

Die Standard-Prüfungsordnung legt `"pruefungsordnung": "ao2024"` fest (in der App unter *Mehr* umschaltbar).

### Prüfungsstruktur

`content/pruefung/ao2024.json` bzw. `vo2002.json`: Jeder Bereich hat `id`, `name`, `kurz`, `dauer` (Minuten),
`gewicht` (%), `art` (`schriftlich`/`muendlich`), `teil` und optional `simFragen` (Anzahl Fragen in der Simulation).
Die Gewichte eines Profils müssen zusammen 100 ergeben (wird getestet).

### Jährliche Werte (z. B. für 2027)

`data/werte-2026.json` enthält Werte wie SV-Sätze, Beitragsbemessungsgrenzen und Mindestlohn – jeweils mit
`wert`, `einheit`, `label`, `quelle` (Schlüssel in `quellen`) und optional `hinweis`.
Alle Rechenaufgaben, die `W.<schlüssel>` oder `svAN(...)` verwenden, rechnen automatisch mit den neuen Werten;
`npm run fill` trägt die neuen Lösungen ein. Für ein neues Jahr die Werte anpassen, `stand`/`abgerufen` ändern
und `npm run fill && npm test` ausführen.

### Format eines Themas

Eine Datei je Thema unter `content/themen/<bereich>/<thema>.json`:

```json
{
  "id": "ksk-kalkulation",
  "titel": "Zuschlagskalkulation (Vor- und Nachkalkulation)",
  "gruppe": "KSK",
  "bereich": { "ao2024": "mvpk", "vo2002": "ksk" },
  "beschreibung": "Kurzbeschreibung",
  "fragen": [ … ],
  "karten": [ … ]
}
```

`bereich` ordnet das Thema für **beide** Prüfungsordnungen einem Prüfungsbereich zu (IDs aus `content/pruefung/*.json`).
Jedes Thema braucht mindestens **15 Fragen** und **10 Lernkarten** (wird getestet). IDs müssen app-weit eindeutig sein.

### Fragetypen

Gemeinsame Felder: `id`, `typ`, `frage`, `erklaerung`, optional `vars`, `stand2026`, `feste_reihenfolge`.

**Einfachauswahl** – `loesung` ist der Index (ab 0) der richtigen Option:

```json
{ "id": "mk-04", "typ": "einfach", "frage": "…", "optionen": ["A", "B", "C", "D"], "loesung": 0, "erklaerung": "…" }
```

**Mehrfachauswahl** – `loesung` ist eine Liste von Indizes:

```json
{ "id": "mk-02", "typ": "mehrfach", "frage": "…", "optionen": ["A", "B", "C", "D"], "loesung": [0, 2], "erklaerung": "…" }
```

**Zuordnung** – Paare `[links, rechts]`; rechte Seiten dürfen sich wiederholen:

```json
{ "id": "mk-05", "typ": "zuordnung", "frage": "…", "paare": [["Star", "hoher Marktanteil, hohes Wachstum"], ["Cash Cow", "…"]], "erklaerung": "…" }
```

**Reihenfolge** – `elemente` in der **richtigen** Reihenfolge (die App mischt):

```json
{ "id": "mk-03", "typ": "reihenfolge", "frage": "…", "elemente": ["Einführung", "Wachstum", "Reife"], "erklaerung": "…" }
```

**Rechenaufgabe** – mit Variablen, Rechenweg `calc` und `loesung`:

```json
{
  "id": "ksk-kalk-05", "typ": "zahl",
  "frage": "MGK {{mgkS|€}}, Fertigungsmaterial {{fm|€}}. Berechnen Sie den MGK-Zuschlagssatz.",
  "vars": { "mgkS": 37800, "fm": 315000 },
  "calc": "r2(mgkS / fm * 100)",
  "einheit": "%",
  "toleranz": 0.01,
  "loesung": 12,
  "erklaerung": "= {{mgkS|€}} ÷ {{fm|€}} × 100 = **{{r2(mgkS/fm*100)|%}}**"
}
```

- `{{ausdruck}}` bzw. `{{ausdruck|format}}` in `frage`, `erklaerung`, Optionen und Karten wird berechnet.
  Formate: `€` (1.234,56 €), `%`, `n0`/`n1`/`n2` (feste Nachkommastellen); ohne Format bis 2 Nachkommastellen.
- In Ausdrücken verfügbar: die `vars`, `W` (Werte 2026, z. B. `W.rv`), `r2(x)` (kaufmännisch runden), `r(x, d)`, `r0`,
  `min`, `max`, `abs`, `sqrt`, `ceil`, `floor`, `svAN(brutto, {zusatz, kinder, kinderlos, sachsen})`, `svAG(...)`,
  `zinsen(k, p, tage)`, `abzinsen(betrag, i, n)`, `aufzinsen(...)`, `annuitaet(k, i, n)`.
- `toleranz`: erlaubte Abweichung (Standard 0,01). Eingaben mit Komma oder Punkt werden akzeptiert.

**Ablauf beim Schreiben neuer Rechenaufgaben:**

1. Aufgabe mit `vars`, `calc` und `"loesung": null` anlegen.
2. `npm run fill` – rechnet `calc` aus und trägt die Lösung ein.
3. `npm test` – prüft, dass `loesung` und `calc` übereinstimmen, alle Platzhalter funktionieren und kein `NaN` entsteht.

Weil Frage, Lösung und Erklärung aus denselben Variablen berechnet werden, können sie nicht auseinanderlaufen.

### Lernkarten

```json
{ "id": "mk-k01", "vorne": "Primär- vs. Sekundärforschung", "hinten": "**Primär**: …\n- Punkt 1\n- Punkt 2" }
```

In allen Texten: `**fett**`, Zeilenumbruch mit `\n`, Zeilen mit `- ` werden zur Liste.

### Formeln

`content/formeln/<nr>-<gruppe>.json`:

```json
{ "titel": "Kosten- und Leistungsrechnung", "kurz": "KLR", "formeln": [
  { "id": "f-klr-zuschlag", "name": "Gemeinkosten-Zuschlagssatz", "formel": "Gemeinkosten ÷ Grundlage × 100",
    "erklaerung": "…", "tags": ["BAB"], "stand2026": false,
    "beispiel": { "vars": { "mgk": 37800, "fm": 315000 }, "text": "{{mgk/fm*100|%}}", "calc": "mgk/fm*100", "ergebnis": 12 } }
] }
```

Auch Formelbeispiele werden beim Test nachgerechnet.

### Fachaufgabe

`content/fachaufgabe/fachaufgabe.json`: `einsatzgebiete`, `checklisten` (`id`, `titel`, `punkte`) und
`fragen` (`id`, `kategorie`, `frage`, `tipp`). Fragen mit der Kategorie `Einsatzgebiet: <Name>` erscheinen nur,
wenn dieses Einsatzgebiet in der App gewählt ist.

### Viele Fragen auf einmal ergänzen

```bash
node scripts/append-fragen.mjs neue-fragen.json
```

`neue-fragen.json` hat die Form `{ "thema-id": [ {…Frage…}, … ] }`. Danach `npm run fill` und `npm test`.

---

## Tests

| Befehl | Prüft |
|---|---|
| `npm test` | Schema aller Inhalte, eindeutige IDs, Mindestanzahl je Thema, alle Rechenaufgaben und Formelbeispiele, Platzhalter, Unit-Tests der Rechenfunktionen (SV 2026, Rundung, Zahleneingabe), Zusammenführen von Lernständen |
| `node tests/e2e.mjs` | Browser-Durchlauf bei 375 px und 1366 px, hell/dunkel, Screenshots (Server auf Port 4173 nötig) |
| `node tests/simulation-100.mjs` | Simulation mit ausschließlich richtigen Antworten ergibt 100 Punkte |

Die Browser-Tests benötigen Playwright (`npm i -D playwright` und `npx playwright install chromium`).

Lighthouse (lokal, Stand dieser Version): Performance 99 mobil / 100 Desktop, Accessibility 100, Best Practices 100.
Offline-Betrieb und Installierbarkeit (Manifest, Service Worker, Icons inkl. maskable) wurden geprüft.

---

## Kostenlos veröffentlichen

### GitHub Pages (eingerichtet)

Das Repository enthält `.github/workflows/deploy.yml`. Jeder Push auf `main` führt `npm run build`
(inkl. Inhaltstest) aus und veröffentlicht `dist/`. Fehlerhafte Inhalte werden nicht veröffentlicht.

Einmalig nötig (bereits erledigt): *Settings → Pages → Build and deployment → Source: GitHub Actions*.

Den Stand eines Deployments siehst du unter *Actions* im Repository.

### Alternative: Netlify

1. Auf <https://app.netlify.com> mit GitHub anmelden → *Add new site → Import an existing project* → Repository wählen.
2. Build command: `npm run build`, Publish directory: `dist`.
3. *Deploy* – Netlify vergibt eine Adresse wie `https://<name>.netlify.app` und baut bei jedem Push neu.

Da die App relative Pfade nutzt (`base: './'`), funktioniert sie in beiden Fällen ohne Anpassung, auch in Unterverzeichnissen.

---

## Quellen der Werte 2026

Siehe `data/werte-2026.json` (Feld `quellen`), u. a. Deutsche Rentenversicherung (Rechengrößen 2026),
Techniker Krankenkasse, Haufe, AOK, Lexware. Abgerufen am 01.11.2026. Vor der Prüfung bitte prüfen.
