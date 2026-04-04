# Entwicklung von ResidentPrivacyFlow

Dieses Dokument bietet zusätzliche technische Informationen für Entwickler, die an ResidentPrivacyFlow mitarbeiten oder die Anwendung anpassen möchten.

## Architekturübersicht

ResidentPrivacyFlow basiert auf Electron und ist in zwei Hauptprozesse unterteilt:

1.  **Main-Prozess (`src/main/`)**:
    *   Verwaltet den Lebenszyklus der Anwendung und das Browser-Fenster.
    *   Führt native Operationen aus (Dateisystemzugriff, Dialoge).
    *   Kommuniziert über IPC (Inter-Process Communication) mit dem Renderer.
    *   Wichtige Dienste: `SettingsService`, `AuditService`, `PdfExportService`.

2.  **Renderer-Prozess (`src/renderer/`)**:
    *   Basiert auf React 18.
    *   Verantwortlich für die Benutzeroberfläche und die Anzeige der PDFs (via `pdfjs-dist`).
    *   State-Management erfolgt über React Hooks und Context.

## Projekt-Struktur (Vertiefung)

- `src/common/`: Enthält gemeinsam genutzte Typen und Konstanten (z. B. `IPC_CHANNELS`), um Typsicherheit zwischen den Prozessen zu gewährleisten.
- `src/main/menu.ts`: Definiert das Anwendungsmenü.
- `src/renderer/components/`: Wiederverwendbare UI-Komponenten (Toolbar, Sidebar, Viewer).

## Debugging

- **Entwicklertools**: Im Entwicklungsmodus (`npm run dev`) öffnet sich automatisch das Chrome DevTools-Fenster für den Renderer.
- **Main-Prozess Logs**: Logs aus dem Main-Prozess werden in das Terminal ausgegeben, in dem die Anwendung gestartet wurde.
- **Build-Logs**: Fehler während des Packaging-Prozesses werden in `release/*.log` oder ähnlichen Log-Dateien im Root-Verzeichnis protokolliert.

## PDF-Verarbeitung

Die Anwendung nutzt `pdfjs-dist` für das Rendering im Frontend. Für den Export und das Aufbringen der Schwärzungen auf ein neues PDF-Dokument wird `jspdf` oder eine Kombination aus nativen Puffern und Client-Logik verwendet.

## Empfohlene Tools

- **Visual Studio Code** mit den folgenden Extensions:
  - ESLint
  - Prettier
  - GitHub Copilot
- **Node.js 18.x oder höher**

## Bekannte Themen

- **Leistung bei großen PDFs**: Bei sehr großen Dokumenten kann das Rendern der Thumbnails Speicher beanspruchen. Dies wird durch asynchrones Laden optimiert.
- **Offline-Sicherheit**: Stellen Sie sicher, dass keine externen APIs eingebunden werden, um den "Offline-First"-Ansatz nicht zu gefährden.
