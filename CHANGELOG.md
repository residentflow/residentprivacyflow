# Changelog

Alle relevanten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-04-17

### Behoben
- **Dokument-/Vorschau-Mismatch bei Multi-Tab-Nutzung** (kritisch): Der globale PDF-Cache verursachte Race-Conditions — Thumbnails und Hauptansicht zeigten verschiedene Dokumente, Schwärzungen landeten auf falschem Seitenlayout. Jetzt WeakMap-basierter Cache pro Dokument.
- **App schloss sich nach Entfernen des letzten Tabs**: Bleibt jetzt im Editor mit EmptyState.
- **Fehlerhaftes PDF brach den gesamten Öffnen-Vorgang ab**: Jede Datei wird einzeln versucht, Fehler werden als Liste gesammelt, restliche Dateien trotzdem geladen.
- **Nur eine IBAN pro Dokument erkannt**: Regex generisch auf alle SEPA-Längen (15–34 Zeichen) erweitert.
- **Datum wurde geschwärzt**: Datum ist kein schützenswertes Feld nach DSGVO — Erkennung entfernt.
- **Hilfe-Link im Menü falsch**: `community.residentprivacyflow.de` → `community.residentflow.de`.

### Geändert
- **Kein Startbildschirm mehr**: Der Editor wird direkt nach dem App-Start geöffnet, mit EmptyState + großer „+ PDF-Datei(en) öffnen"-Schaltfläche.
- **Manuelle Schwärzung öffnet Variablen-Editor automatisch**: Nach dem Aufziehen wird der zugehörige Eintrag in der Markierungs-Tabelle direkt im Edit-Mode geöffnet, sodass der Variablenname sofort eingegeben werden kann.

### Technisch
- Neues `AppState.editingRedactionId` für komponentenübergreifende Edit-Mode-Koordination.
- `file-handler.ts` gibt `OpenResult { loaded, failed[] }` zurück.
- `pdf-init.ts` nutzt `WeakMap<Uint8Array, Promise<PDFDocument>>` statt globalem Singleton.

## [1.1.0] - 2026-04-17

### Hinzugefügt (Feature-Release)

**Phase 1 — PII-Erkennung & UX:**
- 5 neue PII-Kategorien: **Kreditkarte**, **Sozialversicherung**, **BIC/SWIFT**, **Fahrzeug-Kennzeichen**, **Steuernummer** (Betrieb, getrennt von Steuer-ID).
- **PDF-Metadaten-Schwärzung**: Exportierte PDFs enthalten keinerlei Ursprungs-Spuren (Creator/Producer/Datum byte-weise neutralisiert mit xref-Stabilität).
- **Tastaturkürzel**: Pfeiltasten (Seitennavigation), `+`/`-`/`0` (Zoom), `S` (Modus), `A`/`D` (Akzeptieren/Ablehnen), `Tab` (nächste Schwärzung), `Delete`, `Escape`.
- **Bulk-Aktionen**: Akzeptieren/Ablehnen pro Kategorie, Checkbox-Mehrfachauswahl mit Shift+Click.

**Phase 2 — Workflow:**
- **Gruppenzuweisung über Markierung**: Rechteck aufziehen → alle enthaltenen Schwärzungen einer Gruppe zuweisen (z.B. ganzes Adressfeld als „Empfänger").
- **Export-Vorschau**: Modal mit gerenderter Vorschau vor finalem Export, Qualitäts-/Modus-Auswahl inline.

**Phase 3 — Batch-Verarbeitung:**
- **Multi-Dokument-Support**: Mehrere PDFs in Tabs gleichzeitig geöffnet halten.
- **Cross-Dokument-Variablenkonsistenz**: Gleiche Person in Doc A/B/C erhält identischen Variablennamen (gemeinsames Registry).
- **Mehrere PDFs gleichzeitig öffnen**: Multi-Select im Datei-Dialog.
- **Kombinierter CSV-Export**: Zuordnungstabelle für alle Dokumente mit `Dokument`-Spalte (deduped pro Variable).
- **Export-Auswahl-Dialog**: „Dieses Dokument" vs. „Alle Dokumente" bei mehreren offenen PDFs.

**Phase 4 — OCR:**
- **OCR für bildbasierte PDFs**: Tesseract.js v5 im Renderer-Prozess, vollständig offline, Deutsch + Englisch. Konfigurierbare Confidence-Schwelle.

### Sicherheit
- **CSV-Injection-Schutz**: Führende `=`, `+`, `-`, `@` werden in CSV-Export mit Apostroph escaped.
- **Metadaten-Bereinigung**: Autor, Titel, Subject, Keywords leer; Creator = `ResidentPrivacyFlow`; CreationDate/ModDate entfernt.

### Technisch
- Vollständiger State-Refactor: `DocumentState[]` + `activeDocumentId` statt Single-Document-State (Legacy-Actions saubergestellt).
- **Vitest-Test-Framework** integriert: 138 Tests in 12 Dateien, alle grün.
- **Agentic Specs** (`docs/specs/00_OVERVIEW.md` … `08_OCR.md`): 9 self-contained Spec-Dateien mit TDD-Pattern, pro Feature vollständig implementierbar.
- **Build-Optimierung**: `asar: true`, DevDeps aus Production-Bundle ausgeschlossen → schnellerer Start + AV-Kompatibilität.
- Drei Distributions-Formate: **NSIS-Installer** (Setup.exe), **Portable** (Portable.exe), **ZIP** (manuelles Entpacken).

## [1.0.1] - 2026-04-04

### Geändert
- Release-Build ohne Code-Signing (Vorbereitung für Testphase).

## [1.0.0] - 2026-04-04

### Hinzugefügt
- Erstveröffentlichung der ResidentPrivacyFlow Desktop-Anwendung.
- PDF-Anzeige mit Thumbnail-Navigation.
- Manuelle Schwärzungs-Tools für PII-Daten.
- Pseudonymisierungs-System für konsistente Variablen-Zuweisung.
- Export-Funktion als strukturierte CSV-Datei.
- Installations-Pakete für Windows (EXE, MSI, ZIP & Portable).
- Umfassende Dokumentation (README, DEVELOPMENT, SECURITY, CONTRIBUTING).
- GitHub Repository-Infrastruktur (Issue- & PR-Templates).

---
*© 2026 ResidentPrivacyFlow*
