# ResidentPrivacyFlow

**Lokale Windows-Desktop-Anwendung zur PDF-Schwärzung und Pseudonymisierung**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Über das Projekt
ResidentPrivacyFlow ist eine effiziente und benutzerfreundliche Desktop-Anwendung, die speziell für die Analyse, Schwärzung und Pseudonymisierung von PDF-Dokumenten entwickelt wurde. Die Anwendung arbeitet **ausschließlich lokal und offline**, um höchste Datenschutzstandards (DSGVO-konform) zu gewährleisten. Keine sensiblen Daten verlassen jemals Ihren Rechner.

## Hauptfunktionen
- **Sichere PDF-Anzeige**: Schnelles Rendering von PDF-Dokumenten mit interaktiven Seiten-Thumbnails.
- **Lokale Verarbeitung**: Vollständige Offline-Verarbeitung ohne Cloud-Dienste oder externe APIs.
- **Manuelle Schwärzung**: Intuitive Markierung sensibler Datenbereiche direkt im PDF-Viewer.
- **Pseudonymisierung**: Zuweisung von Markierungen zu logischen Gruppen (z. B. *Name_1*, *Adresse_1*, *IBAN*), um personenbeziehbare Daten konsistent zu schützen.
- **Strukturierter CSV-Export**: Export der Daten als strukturierte CSV-Datei für die weitere Verarbeitung oder Dokumentation.

## Schnellstart

### Voraussetzungen
- Node.js (Version 18 oder höher)
- npm (Node Package Manager)

### Installation & Ausführung
```bash
# Repository klonen
git clone <Ihre-Repository-URL>
cd residentprivacyflow

# Abhängigkeiten installieren
npm install

# Anwendung im Entwicklungsmodus starten
npm run dev
```

## Build & Release (Deployment)

Die Anwendung wird mit `electron-builder` für Windows optimiert.

- **Kompilieren**: `npm run build`
- **Standard-Dist (Portable & ZIP)**: `npm run dist`
- **Windows Setup (NSIS)**: `npm run dist:exe`
- **Windows MSI Installer**: `npm run dist:msi`

Die fertigen Artefakte finden Sie nach dem Build im Ordner `release/`.

## Dokumentation

- [**Entwickler-Handbuch (DEVELOPMENT.md)**](DEVELOPMENT.md): Technische Details zur Architektur, Debugging und den verwendeten Bibliotheken.
- [**Mitwirken (CONTRIBUTING.md)**](CONTRIBUTING.md): Richtlinien für Beiträge, Issues und Pull Requests.
- [**Asset-Anleitung (assets/README.md)**](assets/README.md): Informationen zu Icons, Logos und grafischen Ressourcen.

## Projektstruktur

- **`src/main/`**: Electron Main-Prozess (Dateimanagement, IPC).
- **`src/renderer/`**: React 18 UI (Vite-basiert).
- **`src/common/`**: Gemeinsame Typen und Utilities.
- **`assets/`**: Statische Ressourcen (App-Icons).

## Lizenz
Dieses Projekt ist unter der [MIT-Lizenz](LICENSE) lizenziert.

---
© 2026 ResidentPrivacyFlow
