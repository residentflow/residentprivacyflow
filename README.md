# ResidentPrivacyFlow

**DSGVO-konforme PDF-Schwärzung und Pseudonymisierung — komplett lokal auf Ihrem Rechner.**

[![Aktuelles Release](https://img.shields.io/github/v/release/residentflow/residentprivacyflow?label=Download&color=2ea44f)](https://github.com/residentflow/residentprivacyflow/releases/latest)
[![Plattform](https://img.shields.io/badge/Windows-10%20%2F%2011%20(x64)-0078d4)](https://github.com/residentflow/residentprivacyflow/releases/latest)
[![Datenschutz](https://img.shields.io/badge/Verarbeitung-100%25%20lokal-blue)]()

---

## Warum ResidentPrivacyFlow?

Wer Mietverträge, Nebenkostenabrechnungen, Übergabeprotokolle oder Exposés weitergibt, gibt fast immer auch personenbezogene Daten weiter: Namen, Adressen, IBANs, Telefonnummern, Geburtsdaten. Manuelles Schwärzen ist mühsam, fehleranfällig — und ein einziger übersehener Name kann ein Datenschutzproblem werden.

ResidentPrivacyFlow nimmt Ihnen diese Arbeit ab:

- **Findet** personenbezogene Daten automatisch — mit einem lokalen KI-Modell, das auf Ihrem Rechner läuft.
- **Schwärzt oder pseudonymisiert** sie mit einem Klick — konsistent über das ganze Dokument und über mehrere Dokumente hinweg.
- **Behält die Kontrolle bei Ihnen**: Jede Erkennung ist prüfbar, korrigierbar und rückgängig machbar, bevor irgendetwas exportiert wird.

Entwickelt für Hausverwaltungen, Vermieter und Immobilienprofis — geeignet für alle, die PDFs datenschutzsicher weitergeben müssen.

## Das Wichtigste zuerst: Ihre Daten bleiben bei Ihnen

ResidentPrivacyFlow ist **local-first**. PDF-Analyse, PII-Erkennung, OCR, Schwärzung und Export laufen vollständig auf Ihrem Gerät. Es gibt kein Konto, keine Cloud, kein Hochladen Ihrer Dokumente.

| Funktion | Wo läuft sie? |
|---|---|
| PDF-Analyse & PII-Erkennung (KI-Modell) | 🖥️ lokal |
| OCR für gescannte Dokumente | 🖥️ lokal |
| Schwärzung, Pseudonymisierung, Export | 🖥️ lokal |
| Update-Prüfung & News | 🌐 nur Metadaten (GitHub, ohne Dokumentdaten) |
| KI-Chat, Berichte, Dokumentgenerierung | 🌐 **opt-in** — sendet ausschließlich pseudonymisierte Inhalte an den von *Ihnen* konfigurierten Anbieter |

Eine eingebaute Datenschutz-Sperre prüft jeden ausgehenden Inhalt ein zweites Mal: Erkennt sie unverarbeitete personenbezogene Daten, wird die Übertragung blockiert — nicht gewarnt, sondern blockiert.

## Funktionen

### 🔍 Automatische PII-Erkennung
Ein lokales NER-Modell erkennt acht Kategorien personenbezogener Daten — Namen, Adressen, E-Mail-Adressen, Telefonnummern, Kontonummern/IBANs, Geburtsdaten, URLs und Geheimnisse — ergänzt um spezialisierte Heuristiken für deutsche Dokumente.

### ✏️ Voller Editor statt Blackbox
Jede Erkennung landet in einer übersichtlichen Variablen-Tabelle: Typ und Gruppe inline ändern, Treffer löschen (mit Undo/Redo), manuelle Schwärzungen direkt im Dokument zeichnen, Gruppen gesammelt zuweisen. Sie entscheiden, was passiert — das Werkzeug macht Vorschläge.

### 🎭 Schwärzen *oder* Pseudonymisieren
Klassisches Schwärzen entfernt Informationen. Pseudonymisieren ersetzt sie konsistent („Mieter_1", „IBAN_2") — Dokumente bleiben lesbar und auswertbar, ohne dass Personen identifizierbar sind. Ideal, wenn Unterlagen inhaltlich weiterverarbeitet werden sollen (z. B. Due-Diligence-Prüfungen über ganze Objekt-Dossiers).

### 📷 OCR für Scans — offline
Gescannte PDFs ohne Textebene werden per Texterkennung (Deutsch) erschlossen — vollständig offline, ohne dass der Scan das Gerät verlässt.

### 📋 Schwärzungs-Profile pro Dokumenttyp
Mietvertrag, Nebenkostenabrechnung, Protokoll: Die App klassifiziert den Dokumenttyp automatisch und wendet das passende Profil an. Eigene Profile (bis zu 30) lassen sich anlegen und wiederverwenden.

### 📂 Hotfolder-Automatik
Projektordner werden überwacht: Neue PDFs werden automatisch importiert und analysiert. Vor jedem automatischen Export steht aber immer Ihre Bestätigung — kein Dokument verlässt die App ungeprüft.

### 🤖 KI-Funktionen — opt-in und pseudonymisiert
Wer möchte, verbindet einen eigenen KI-Anbieter und erhält:
- **Skill-Galerie** mit vorgefertigten und eigenen Prompts (Berichte, Analysen, Akquise)
- **Risikoberichte** mit klarem Urteil (VERDICT/SCORE) und projektweitem Berichtsarchiv
- **Dokumentgenerierung** als Word, Excel, PowerPoint, PDF oder Markdown — mit zweiter PII-Prüfung über das Ergebnis
- **Portfolio-Cockpit** mit Kennzahlen über alle Projekte

Dabei gilt immer: Es werden ausschließlich pseudonymisierte Inhalte übertragen — niemals Originaldaten.

### 🧾 Lückenlose Nachvollziehbarkeit
Ein Audit-Protokoll dokumentiert jede Aktion der Sitzung. Der Export ist **fail-closed**: Solange ungeprüfte Treffer offen sind, ist der Export gesperrt.

## Download & Installation

➡️ **[Neueste Version herunterladen](https://github.com/residentflow/residentprivacyflow/releases/latest)**

| Datei | Für wen? |
|---|---|
| `…-Setup.exe` | **Empfohlen** — normaler Windows-Installer |
| `…-Portable.exe` | Ohne Installation, z. B. vom USB-Stick |
| `…-Setup.zip` | Entpacken und starten |

**Systemvoraussetzungen:** Windows 10/11, 64-bit. Beim ersten Analyse-Lauf lädt die App einmalig das lokale Erkennungsmodell herunter; danach funktioniert die Analyse auch offline.

> **Hinweis zu Windows SmartScreen:** Da die App (noch) nicht code-signiert ist, zeigt Windows beim ersten Start ggf. eine SmartScreen-Warnung. Über *„Weitere Informationen" → „Trotzdem ausführen"* lässt sich die App starten.

## So arbeiten Sie mit ResidentPrivacyFlow

1. **Importieren** — PDF öffnen, per Drag & Drop ablegen oder automatisch über den Hotfolder.
2. **Prüfen** — die Analyse markiert alle Funde; Sie kontrollieren, korrigieren und ergänzen.
3. **Exportieren** — geschwärztes oder pseudonymisiertes PDF (plus CSV-Übersicht) erzeugen. Erst wenn alles geprüft ist, gibt die App den Export frei.

## Updates & Neuigkeiten

Die App prüft auf Wunsch beim Start, ob eine neue Version verfügbar ist, und zeigt Neuigkeiten direkt im Programm an (Glocken-Symbol). Dabei werden nur Release-Metadaten abgerufen — niemals Dokumentinhalte übertragen.

## Support & Community

- 💬 Community: [community.residentflow.de](https://community.residentflow.de)
- 🐛 Fehler gefunden? [Issue eröffnen](https://github.com/residentflow/residentprivacyflow/issues)

## Über dieses Repository

Dieses Repository dient der **Verteilung**: Es enthält die Installationsdateien (unter [Releases](https://github.com/residentflow/residentprivacyflow/releases)) und den News-Feed der App. Der Quellcode wird privat entwickelt.

---

*ResidentPrivacyFlow — damit Datenschutz nicht von Sorgfalt im Stress abhängt.*
