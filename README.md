# ResidentPrivacyFlow

**Sichere, lokale PDF-Schwärzung und Pseudonymisierung für höchste Datenschutzansprüche.**

![ResidentPrivacyFlow Hero Mockup](assets/hero_mockup.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-Latest-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

---

## 🛡️ Über das Projekt

ResidentPrivacyFlow ist eine spezialisierte Windows-Desktop-Anwendung zur Analyse, Schwärzung und Pseudonymisierung von PDF-Dokumenten. In einer Welt, in der Datenschutz an erster Stelle steht, bietet dieses Tool eine **zu 100% lokale Lösung**. Keine Daten werden jemals in die Cloud hochgeladen; alle Verarbeitungsschritte erfolgen ausschließlich auf Ihrem Endgerät (DSGVO-konform by Design).

### Warum ResidentPrivacyFlow?
- **Absoluter Datenschutz**: Keine Internetverbindung erforderlich. Ideal für hochsensible Dokumente.
- **Benutzerzentrierte UI**: Intuitive Bedienung mit Fokus auf Effizienz und Übersichtlichkeit.
- **Automatisierte Systematik**: Unterstützung beim Management von PII (Personally Identifiable Information) durch logische Gruppierung.

---

## ✨ Hauptfunktionen

### Kernfunktionen
- **🚀 High-Performance PDF-Viewer**: Schnelles Laden und flüssiges Navigieren durch Dokumente jeder Größe.
- **🔍 Interaktive Thumbnails**: Übersichtliche Seitenleiste für die schnelle Navigation.
- **🖊️ Präzise manuelle Schwärzung**: Markieren Sie sensible Bereiche direkt im Dokument per Drag-and-Drop.
- **🏷️ Intelligente Pseudonymisierung**: Weisen Sie Markierungen Variablen wie `Name_1`, `Adresse_1` oder `IBAN_1` zu.
- **📊 Strukturierter Export**: Generieren Sie detaillierte CSV-Berichte über alle vorgenommenen Änderungen.
- **📦 Windows Optimiert**: Nahtlose Integration als native Desktop-Anwendung.

### Neu in v1.1 🆕

**Erweiterte PII-Erkennung (14 Kategorien):**
- Name, Adresse, IBAN, E-Mail, Telefon, Mobilfunk, Fax, Steuer-ID, Steuernummer, URL, Kontonummer
- **Neu:** Kreditkarte, Sozialversicherung, BIC/SWIFT, Fahrzeug-Kennzeichen

**Batch-Verarbeitung:**
- **Mehrere PDFs gleichzeitig geöffnet** in Tabs
- **Variablenkonsistenz über Dokumente hinweg** (gleiche Person = gleicher Variablenname)
- **Kombinierter CSV-Export** mit Dokument-Zuordnungsspalte
- **Multi-Select im Datei-Dialog** — mehrere PDFs in einem Zug öffnen

**OCR für gescannte PDFs:**
- Tesseract.js v5 — vollständig offline, Deutsch + Englisch
- Automatisch aktiviert bei Seiten ohne Textlayer

**Workflow-Beschleunigung:**
- **Gruppenzuweisung über Markierung**: Rechteck aufziehen → alle Schwärzungen der Gruppe zuweisen
- **Export-Vorschau** vor dem Speichern
- **Bulk-Aktionen**: Alle Vorschläge einer Kategorie akzeptieren/ablehnen
- **Tastaturkürzel**: Pfeiltasten, Zoom, Modus-Wechsel, Akzeptieren/Ablehnen, Tab-Navigation

**Sicherheit & Compliance:**
- **PDF-Metadaten vollständig neutralisiert** (Autor, Erstellungsdatum, Bearbeitungsspuren)
- **CSV-Injection-geschützt** (Excel-Formel-Angriffe blockiert)
- **Byte-stabile xref-Struktur** im Export

---

## 🛠️ Technologie-Stack

- **Frontend**: React 18 & Vite 5 für eine moderne, reaktive Benutzeroberfläche.
- **Shell**: Electron 28 zur Bereitstellung als native Desktop-App.
- **Styling**: Vanilla CSS mit Fokus auf Performance und modernem Design.
- **PDF-Engine**: pdf.js (Rendering) + jsPDF (Export).
- **OCR**: Tesseract.js v5 — 100% lokal, keine Cloud.
- **Sprache**: TypeScript 5 im strict-mode.
- **Testing**: Vitest + React Testing Library (138 Tests).

---

## 🚀 Schnellstart

### Voraussetzungen
- [Node.js](https://nodejs.org/) (Version 18 oder höher)
- [npm](https://www.npmjs.com/)

### Installation & Betrieb

**Option A — NSIS-Installer (empfohlen):**
```
1. ResidentPrivacyFlow-1.1.1-x64-Setup.exe herunterladen
2. Doppelklick → Installation folgen
3. App startet automatisch, Startmenü-Eintrag wird angelegt
```

**Option B — Portable (für USB-Stick):**
```
1. ResidentPrivacyFlow-1.1.1-x64-Portable.exe herunterladen
2. Einzelne Datei — direkt ausführbar, keine Installation
```

**Option C — ZIP (manuell):**
```
1. ResidentPrivacyFlow-1.1.1-x64-Setup.zip herunterladen
2. In lokalen Ordner entpacken
3. ResidentPrivacyFlow.exe starten
```

Alle drei Downloads: [**GitHub Releases**](https://github.com/residentflow/residentprivacyflow/releases/latest)

### Build & Deployment
Um eine ausführbare Windows-Datei zu erstellen:
```bash
# Standard Build (ZIP & Portable)
npm run dist

# Windows Installer (EXE/MSI)
npm run dist:exe
npm run dist:msi
```
Die fertigen Programme befinden sich im Ordner `release/`.

### 🔏 Code Signing (Produktion)
Damit keine SmartScreen-Warnung ("Der Computer wurde durch Windows geschützt") erscheint, muss die App signiert werden:
1. **Zertifikat:** Ein Code Signing Zertifikat (empfohlen: EV) von einer CA erwerben.
2. **Umgebung:** `.env`-Datei erstellen (siehe `.env.example`) und Pfad/Passwort hinterlegen.
3. **Build:** `npm run dist` ausführen. Die Signierung erfolgt automatisch.

---

## 📦 Aktuelle Version & Releases

Die offizielle Release-Historie und die ausführbaren Dateien finden Sie auf der [**GitHub Releases Seite**](https://github.com/residentflow/residentprivacyflow/releases).

### Aktuelle Version: **v1.1.1** (Apr 2026)
- 8 Bugfixes (u.a. Multi-Tab Doc/Preview-Mismatch, IBAN-Multi-Erkennung, Per-File-Error-Handling)
- Kein Startbildschirm mehr — Editor öffnet direkt
- Auto-Edit-Mode bei manueller Schwärzung

### Vorgänger: **v1.1.0** (Apr 2026)
- Major Feature-Release: 8 neue Kernfunktionen (Multi-Tab, OCR, Bulk-Aktionen, Export-Vorschau, u.v.m.)
- 138 automatisierte Tests

### Download-Formate
- **Setup.exe** (NSIS-Installer, empfohlen): Installation mit Shortcuts
- **Portable.exe**: Einzelne Datei, keine Installation
- **Setup.zip**: Manuelles Entpacken

Detaillierte Änderungs-Historie: [**CHANGELOG.md**](CHANGELOG.md).

---

## 📝 Dokumentation & Beteiligung

- [**DEVELOPMENT.md**](DEVELOPMENT.md): Architektur-Diagramme, interne Abläufe und Tooling.
- [**CONTRIBUTING.md**](CONTRIBUTING.md): Wie Sie zum Projekt beitragen können (Code-Guidelines, PRs).
- [**SECURITY.md**](SECURITY.md): Unser Versprechen für Ihre Sicherheit.
- [**LICENSE**](LICENSE): Rechtliche Informationen (MIT Lizenz).

---

## 🤝 Support

Bei Fragen oder Problemen öffnen Sie bitte ein [Issue](https://github.com/residentflow/residentprivacyflow/issues) oder kontaktieren Sie uns direkt unter [stefan@residentflow.de](mailto:stefan@residentflow.de).

---
© 2026 ResidentPrivacyFlow - Lokale Sicherheit für Ihre Dokumente.
