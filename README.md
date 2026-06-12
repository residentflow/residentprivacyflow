# ResidentPrivacyFlow

ResidentPrivacyFlow ist eine Desktop-Anwendung für Windows, die personenbezogene Daten in PDF-Dokumenten erkennt und schwärzt oder pseudonymisiert. Analyse, Texterkennung (OCR) und Export laufen vollständig lokal auf dem eigenen Gerät. Optional lassen sich die pseudonymisierten Dokumente per Chat oder über vorgefertigte Skills mit einem selbst konfigurierten KI-Anbieter auswerten.

[![Aktuelles Release](https://img.shields.io/github/v/release/residentflow/residentprivacyflow?label=Download&color=2ea44f)](https://github.com/residentflow/residentprivacyflow/releases/latest)
[![Plattform](https://img.shields.io/badge/Windows-10%20%2F%2011%20(x64)-0078d4)](https://github.com/residentflow/residentprivacyflow/releases/latest)

## Überblick

Entwickelt für Hausverwaltungen, Vermieter und Immobilienprofis, die Mietverträge, Abrechnungen oder Exposés weitergeben — geeignet für alle PDF-Dokumente mit personenbezogenen Daten.

Der typische Ablauf:

1. **Importieren** — PDF öffnen, per Drag & Drop ablegen oder automatisch über einen Hotfolder.
2. **Prüfen** — die Analyse markiert alle Funde; jede Erkennung lässt sich ändern, löschen oder ergänzen.
3. **Exportieren** — geschwärztes oder pseudonymisiertes PDF plus CSV-Zuordnungstabelle. Solange ungeprüfte Treffer offen sind, bleibt der Export gesperrt.
4. **Auswerten (optional)** — mit den pseudonymisierten Dokumenten chatten oder Skills darauf ausführen.

## Datenverarbeitung

| Funktion | Verarbeitung |
|---|---|
| PDF-Analyse & PII-Erkennung (lokales NER-Modell) | lokal |
| OCR für gescannte Dokumente | lokal |
| Schwärzung, Pseudonymisierung, Export | lokal |
| Update-Prüfung & News | GitHub, nur Release-Metadaten |
| Chat, Skills, Berichte, Dokumentgenerierung | opt-in; pseudonymisierte Inhalte an den selbst konfigurierten Anbieter |

Es gibt kein Konto und keine eigene Cloud. Vor jeder Übertragung an einen KI-Anbieter prüft eine eingebaute Sperre den ausgehenden Inhalt auf unverarbeitete personenbezogene Daten (z. B. E-Mail-Adressen oder IBANs); bei einem Treffer wird die Übertragung blockiert.

## Funktionen

### PII-Erkennung und Editor

Ein lokales NER-Modell erkennt acht Kategorien personenbezogener Daten — Namen, Adressen, E-Mail-Adressen, Telefonnummern, Kontonummern/IBANs, Geburtsdaten, URLs und Geheimnisse — ergänzt um Heuristiken für deutsche Dokumente (u. a. IBAN-Prüfsumme). Alle Funde landen in einer Variablen-Tabelle: Typ und Gruppe lassen sich inline ändern, Treffer löschen (mit Undo/Redo), manuelle Schwärzungen direkt im Dokument zeichnen.

### Schwärzen oder Pseudonymisieren

Schwärzen entfernt Inhalte aus dem Dokument. Pseudonymisieren ersetzt sie stattdessen konsistent („Mieter_1", „IBAN_2") — über das ganze Dokument und über mehrere Dokumente eines Projekts hinweg. Die Zuordnung wird als CSV-Tabelle exportiert. Pseudonymisierte Dokumente bleiben lesbar und können inhaltlich weiterverarbeitet werden, etwa für Due-Diligence-Prüfungen über ganze Objekt-Dossiers.

### Chat mit Dokumenten (opt-in)

Die pseudonymisierten Dokumente eines Projekts lassen sich direkt in der App per Chat befragen — zum Beispiel um Vertragsklauseln zu finden, Abrechnungen zu vergleichen oder ein Dossier zusammenzufassen. Der Chat läuft über einen selbst konfigurierten Anbieter (u. a. OpenAI, Anthropic, Google, Azure, Mistral, Groq, Ollama); der Verlauf wird pro Dokument bzw. Projekt lokal gespeichert. Übertragen werden ausschließlich pseudonymisierte Inhalte — die Originaldaten verlassen das Gerät nicht.

### Skill-Galerie (opt-in)

Skills sind gespeicherte, wiederverwendbare Auswertungen über pseudonymisierte Dokumente. Die App bringt System-Skills mit (z. B. Zusammenfassung, Risikoanalyse, Akquise-Texte); eigene Skills lassen sich anlegen, bearbeiten und als JSON exportieren oder importieren. Drei Ausgabeformate stehen zur Verfügung: Freitext, strukturierte Daten und Berichte mit Urteil und Punktwert (VERDICT/SCORE), die in einem projektweiten Berichtsarchiv abgelegt werden. Eine optionale, lokal gespeicherte Wissensbasis ergänzt eigene Vorgaben (etwa Bewertungskriterien) in die Auswertung; Skill-Empfehlungen werden lokal und deterministisch berechnet.

### OCR für gescannte PDFs

Gescannte PDFs ohne Textebene werden per Texterkennung (Deutsch) erschlossen — offline, der Scan verlässt das Gerät nicht.

### Schwärzungs-Profile und Hotfolder

Dokumenttypen wie Mietvertrag, Nebenkostenabrechnung oder Protokoll werden automatisch klassifiziert und mit dem passenden Schwärzungs-Profil verarbeitet; eigene Profile (bis zu 30) lassen sich anlegen. Überwachte Projektordner importieren und analysieren neue PDFs automatisch — vor jedem automatischen Export ist eine Bestätigung erforderlich.

### Dokumentgenerierung (opt-in)

Aus Chat- und Skill-Ergebnissen lassen sich Dokumente als Word, Excel, PowerPoint, PDF oder Markdown erzeugen. Vor dem Speichern läuft eine zweite PII-Prüfung über das Ergebnis.

### Audit-Protokoll

Ein Protokoll dokumentiert die Aktionen der Sitzung und macht Exporte nachvollziehbar.

## Download und Installation

➡️ **[Neueste Version herunterladen](https://github.com/residentflow/residentprivacyflow/releases/latest)**

| Datei | Verwendung |
|---|---|
| `…-Setup.exe` | Windows-Installer (empfohlen) |
| `…-Portable.exe` | Ohne Installation, z. B. vom USB-Stick |
| `…-Setup.zip` | Entpacken und starten |

**Systemvoraussetzungen:** Windows 10/11, 64-bit. Beim ersten Analyse-Lauf lädt die App einmalig das lokale Erkennungsmodell herunter; danach funktioniert die Analyse auch offline.

> **Hinweis zu Windows SmartScreen:** Die App ist derzeit nicht code-signiert. Windows zeigt beim ersten Start ggf. eine SmartScreen-Warnung; über *„Weitere Informationen" → „Trotzdem ausführen"* lässt sich die App starten.

## Updates und Neuigkeiten

Auf Wunsch prüft die App beim Start, ob eine neue Version verfügbar ist, und zeigt Neuigkeiten im Programm an. Dabei werden nur Release-Metadaten abgerufen, keine Dokumentinhalte übertragen.

## Support

- Fehler oder Fragen: [Issue eröffnen](https://github.com/residentflow/residentprivacyflow/issues)
- Community: [community.residentflow.de](https://community.residentflow.de)

## Über dieses Repository

Dieses Repository dient der Verteilung: Es enthält die Installationsdateien (unter [Releases](https://github.com/residentflow/residentprivacyflow/releases)) und den News-Feed der App. Der Quellcode wird privat entwickelt.
