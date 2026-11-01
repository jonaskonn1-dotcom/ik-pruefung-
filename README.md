# IK-Prüfungstrainer – Industriekaufmann/-frau

Lern-App (PWA, offline, ohne Login) zur Vorbereitung auf die IHK-Abschlussprüfung
Industriekaufmann/-frau – AO 2024 (Standard) und VO 2002 umschaltbar.

> Vollständige Doku (Content-Format, Veröffentlichen auf GitHub Pages/Netlify) folgt mit Version 1.0.

## Schnellstart

```bash
npm install
npm run dev      # Entwicklung: http://localhost:5173
npm test         # prüft alle Inhalte und rechnet jede Rechenaufgabe nach
npm run build    # Test + Build nach dist/
```

## Wichtige Dateien

| Datei | Zweck |
|---|---|
| `content/config.json` | Prüfungstermine, IHK, Notenschlüssel, Quiz-Einstellungen |
| `content/pruefung/*.json` | Prüfungsstruktur je Ordnung (AO 2024 / VO 2002) |
| `content/themen/<bereich>/<thema>.json` | Fragen + Lernkarten je Thema |
| `content/formeln/*.json` | Formelsammlung |
| `data/werte-2026.json` | jährlich wechselnde Werte mit Quelle + Abrufdatum |
