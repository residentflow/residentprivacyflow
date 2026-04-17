# ResidentPrivacyFlow — Agentic Development Overview

> Dieses Dokument ist die Grundlage für alle Feature-Specs. Jeder Agent der eine einzelne Spec implementiert, MUSS dieses Dokument zuerst lesen.

---

## Produktbeschreibung

**ResidentPrivacyFlow** ist eine lokale Windows-Desktop-Anwendung (Electron 28 + React 18 + Vite 5 + TypeScript 5.3) zur GDPR-konformen PDF-Schwärzung und Pseudonymisierung. Alle Daten bleiben lokal — keine Netzwerkverbindungen.

**Wichtige Constraints:**
- Kein Internet, keine externen APIs
- Windows x64 only
- Deutsche UI-Sprache
- Functional React Components only (keine Klassen)
- TypeScript strict mode

---

## Projektstruktur

```
residentprivacyflow/
├── src/
│   ├── common/
│   │   └── types.ts              ← Geteilte Typen zwischen Main + Renderer
│   ├── main/
│   │   ├── main.ts               ← Electron Entry, IPC Handler
│   │   ├── preload.ts            ← Sichere IPC-Bridge zum Renderer
│   │   ├── menu.ts               ← App-Menü
│   │   └── services/
│   │       ├── pii-detection-service.ts  ← Regex/Heuristik PII-Erkennung
│   │       ├── pdf-analysis-service.ts   ← PDF-Datei-Validierung
│   │       ├── pdf-export-service.ts     ← PDF + CSV Export
│   │       ├── audit-service.ts          ← Audit-Log
│   │       └── settings-service.ts       ← App-Settings
│   └── renderer/
│       ├── main.tsx              ← React DOM Mount
│       ├── App.tsx               ← Root, View-Routing, Keyboard-Handler
│       ├── components/
│       │   ├── EditorLayout.tsx  ← Haupt-Editor (Toolbar + Sidebar + Viewer + Table)
│       │   ├── PdfViewer.tsx     ← Canvas-Rendering, Overlay-Interaktion
│       │   ├── RedactionTable.tsx← Rechte Seitenleiste, Schwärzungs-Liste
│       │   ├── Toolbar.tsx       ← Analyse, Export, Modus, Zoom
│       │   ├── SidebarThumbnails.tsx
│       │   ├── StartPage.tsx
│       │   ├── AuditLogView.tsx
│       │   ├── SettingsView.tsx
│       │   ├── ErrorBanner.tsx
│       │   ├── LoadingOverlay.tsx
│       │   └── Tooltip.tsx
│       ├── services/
│       │   ├── pii-detection-client.ts   ← Renderer-seitige PII-Erkennung
│       │   ├── pdf-init.ts               ← pdf.js Worker-Init
│       │   └── file-handler.ts           ← Datei öffnen
│       ├── store/
│       │   ├── app-store.tsx             ← React Context Provider + Helpers
│       │   └── types-and-reducer.ts      ← AppState, Actions, Reducer
│       └── styles/
│           └── global.css
├── docs/
│   └── specs/                    ← Diese Spec-Dateien
├── package.json
├── vite.config.ts
├── tsconfig.renderer.json
├── tsconfig.main.json
└── index.html
```

---

## Test-Framework Setup (einmalig, vor allen Features)

**Kein Test-Framework ist aktuell konfiguriert.** Jedes Feature muss zuerst Tests schreiben. Setup:

### Installation
```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/testing-library__jest-dom
```

### vite.config.ts erweitern
```typescript
// vite.config.ts (bestehende Datei)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {                          // ← NEU hinzufügen
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

### src/test-setup.ts (neue Datei)
```typescript
import '@testing-library/jest-dom';
```

### package.json scripts ergänzen
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

### tsconfig.renderer.json — types ergänzen
```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

### Test ausführen
```bash
npm test                    # alle Tests einmalig
npx vitest run --reporter=verbose    # mit Details
npx tsc --noEmit           # TypeScript-Typen prüfen
```

---

## Vollständige Quelldateien (Referenz für Agents)

### src/common/types.ts (aktueller Stand)

```typescript
export type RedactionStatus = 'vorschlag' | 'akzeptiert' | 'abgelehnt' | 'manuell';

export type PIICategory =
  | 'Name' | 'Adresse' | 'IBAN' | 'E-Mail'
  | 'Telefon' | 'Mobilfunk' | 'Fax' | 'Datum'
  | 'Steuer-ID' | 'URL' | 'Kontonummer'
  | 'Manuell' | 'Unbekannt';

export type RedactionMode = 'schwärzen' | 'pseudonymisieren';
export type ExportQuality = 'high' | 'compressed';

export interface BoundingBox {
  x: number; y: number; width: number; height: number;
}

export interface RedactionEntry {
  id: string;
  variableName: string;
  originalContent: string;
  category: PIICategory;
  page: number;
  bounds: BoundingBox;
  status: RedactionStatus;
  groupNumber: number;
  source: 'regex' | 'heuristic' | 'manual' | 'ner';
}

export interface TextItem {
  text: string; bounds: BoundingBox; page: number; confidence?: number;
}

export interface PageAnalysis {
  pageNumber: number; hasTextLayer: boolean; ocrUsed: boolean;
  textItems: TextItem[]; suggestions: RedactionEntry[];
}

export interface AnalysisResult {
  pages: PageAnalysis[]; totalSuggestions: number; analysisTypes: string[];
}

export interface ExportOptions {
  quality: ExportQuality; outputPath: string; csvPath: string; mode: RedactionMode;
}

export interface ExportProgress {
  currentPage: number; totalPages: number;
  phase: 'rendering' | 'compositing' | 'saving' | 'csv' | 'done';
  message: string;
}

export interface AuditLogEntry {
  id: string; timestamp: string; fileName: string; pageCount: number;
  redactionCount: number; pseudonymizationCount: number;
  exportQuality: ExportQuality; analysisTypes: string[]; mode: RedactionMode;
}

export interface CSVRow {
  bezeichnung: string; inhalt: string; typ: string;
  gruppe: string; status: string; seite: string;
}

export interface AppSettings {
  maxFileSizeMB: number; maxPageCount: number; tempDirectory: string;
  defaultExportQuality: ExportQuality; defaultMode: RedactionMode;
  lastOpenDirectory: string; lastExportDirectory: string;
}

export const IPC_CHANNELS = {
  OPEN_FILE_DIALOG: 'dialog:openFile',
  SAVE_FILE_DIALOG: 'dialog:saveFile',
  ANALYZE_PDF: 'pdf:analyze',
  ANALYZE_PROGRESS: 'pdf:analyzeProgress',
  EXPORT_PDF: 'pdf:export',
  EXPORT_PROGRESS: 'pdf:exportProgress',
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  GET_AUDIT_LOG: 'audit:getAll',
  ADD_AUDIT_LOG: 'audit:add',
  GET_APP_PATH: 'app:getPath',
  CLEAN_TEMP: 'app:cleanTemp',
  MENU_OPEN_FILE: 'menu:open-file',
  MENU_GO_TO_SETTINGS: 'menu:go-to-settings',
  MENU_GO_TO_AUDIT: 'menu:go-to-audit',
} as const;
```

### src/renderer/store/types-and-reducer.ts (aktueller Stand, gekürzt)

```typescript
export interface AppState {
  filePath: string | null; fileName: string | null;
  fileData: Uint8Array | null; pageCount: number; currentPage: number;
  redactions: RedactionEntry[];
  selectedRedactionId: string | null; hoveredRedactionId: string | null;
  mode: RedactionMode; exportQuality: ExportQuality; zoom: number;
  isAnalyzing: boolean; analysisProgress: string;
  isExporting: boolean; exportProgress: string;
  hasAnalyzed: boolean; analysisTypes: string[];
  view: 'start' | 'editor' | 'audit' | 'settings';
  error: string | null; manualCounter: number;
  undoStack: UndoAction[]; redoStack: UndoAction[];
}

export type Action =
  | { type: 'SET_FILE'; filePath: string; fileName: string; fileData: Uint8Array; pageCount: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_MODE'; mode: RedactionMode }
  | { type: 'SET_EXPORT_QUALITY'; quality: ExportQuality }
  | { type: 'SET_VIEW'; view: 'start' | 'editor' | 'audit' | 'settings' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ANALYZING'; isAnalyzing: boolean; progress?: string }
  | { type: 'SET_EXPORTING'; isExporting: boolean; progress?: string }
  | { type: 'SET_ANALYSIS_PROGRESS'; progress: string }
  | { type: 'SET_EXPORT_PROGRESS'; progress: string }
  | { type: 'SET_ANALYSIS_TYPES'; types: string[] }
  | { type: 'SET_REDACTIONS'; redactions: RedactionEntry[] }
  | { type: 'ADD_REDACTION'; redaction: RedactionEntry }
  | { type: 'UPDATE_REDACTION'; id: string; updates: Partial<RedactionEntry> }
  | { type: 'REMOVE_REDACTION'; id: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string }
  | { type: 'REJECT_SUGGESTION'; id: string }
  | { type: 'SELECT_REDACTION'; id: string | null }
  | { type: 'HOVER_REDACTION'; id: string | null }
  | { type: 'CLEAR_PAGE_REDACTIONS'; page: number }
  | { type: 'SET_HAS_ANALYZED'; value: boolean }
  | { type: 'INCREMENT_MANUAL_COUNTER' }
  | { type: 'PUSH_UNDO'; action: UndoAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };
```

---

## Feature-Implementierungsreihenfolge

| # | Spec-Datei | Feature | Abhängigkeiten | Komplexität |
|---|-----------|---------|----------------|-------------|
| 1 | `01_PII_CATEGORIES.md` | Neue PII-Kategorien | keine | Niedrig |
| 2 | `02_PDF_METADATA.md` | PDF-Metadaten löschen | keine | Niedrig |
| 3 | `03_KEYBOARD_SHORTCUTS.md` | Tastaturkürzel | keine | Niedrig |
| 4 | `04_BULK_ACTIONS.md` | Bulk-Aktionen | `01` (neue Kategorien im Filter) | Mittel |
| 5 | `05_GROUP_SELECTION.md` | Gruppenzuweisung via Markierung | `04` (Undo-Pattern) | Mittel |
| 6 | `06_EXPORT_PREVIEW.md` | Export-Vorschau | keine | Mittel |
| 7 | `07_BATCH_PROCESSING.md` | Batch / Multi-Tab | `04`, `05` | Hoch |
| 8 | `08_OCR.md` | OCR für Bild-PDFs | `01` (Kategorien), `07` optional | Hoch |

**Regel:** Ein Agent darf erst mit Feature N beginnen, wenn alle Features in der „Abhängigkeiten"-Spalte abgeschlossen und deren Tests grün sind.

---

## Abhängigkeitsprüfung (vor Implementierungsbeginn)

Jeder Agent muss vor dem Start prüfen:

```bash
# TypeScript kompiliert fehlerfrei?
npx tsc --noEmit

# Alle bisherigen Tests grün?
npm test

# Korrekte Node-Version?
node --version  # muss v18.x sein
```

---

## Code-Konventionen

- Keine Klassen-Komponenten — nur `function` oder Arrow-Function Components
- Kein `any` — TypeScript strict
- Imports: relative Pfade, keine barrel-Imports
- CSS: Vanilla CSS, bestehende CSS-Variablen aus `global.css` nutzen (`var(--space-sm)`, `var(--bg-surface)`, etc.)
- Kommentare: nur wenn das „Warum" nicht offensichtlich ist
- Neue Dateien: co-located mit Source (Test-Datei `*.test.ts` neben `*.ts`)
- Deutsche User-Strings in allen UI-Texten
