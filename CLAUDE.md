# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Full dev mode: Vite renderer + Electron main (with DevTools)
npm run dev:renderer     # Vite dev server only (localhost:5173)
npm run dev:main         # Type-check main process + start Electron

# Build
npm run build            # Build renderer (Vite) then main (tsc)
npm run build:renderer   # Vite production build → dist/renderer/
npm run build:main       # TypeScript compile → dist/main/

# Package
npm run dist             # Build + electron-builder → release/ (portable ZIP + unpacked)
npm run dist:exe         # Build + NSIS installer (German locale)
npm run dist:msi         # Build + MSI installer
```

No test runner or linter is configured. TypeScript strict mode acts as the primary safety net.

**Code style:** Prettier — semi: true, singleQuote: true, tabWidth: 2, printWidth: 100.

## Architecture

ResidentPrivacyFlow is a **local-first Windows desktop application** (Electron 28 + React 18 + Vite 5) for GDPR-compliant PDF redaction and PII pseudonymization. All processing happens on-device; no network calls are made.

### Two-Process Electron Split

```
src/main/       → Electron main process (Node.js, file I/O, IPC)
src/renderer/   → React UI (sandboxed renderer, no Node access)
src/common/     → Shared types (IPC channel names, domain types)
```

**IPC bridge:** `src/main/preload.ts` exposes a typed `window.electron` API to the renderer. All cross-process communication goes through the IPC channel names defined in `src/common/types.ts`.

### Main Process Services (`src/main/services/`)

| File | Responsibility |
|------|---------------|
| `pii-detection-service.ts` | Regex/heuristic detection of PII (names, IBANs, dates, addresses) |
| `pdf-analysis-service.ts` | PDF text extraction + coordinate mapping via pdfjs-dist |
| `pdf-export-service.ts` | Redacted PDF generation via jspdf (draws black rectangles over redacted areas) |
| `audit-service.ts` | Tracks all redaction actions to an audit log |
| `settings-service.ts` | Persists user preferences to disk |

Entry point: `src/main/main.ts` (window creation, IPC handler registration).

### Renderer / UI (`src/renderer/`)

**State:** React Context + useReducer with undo/redo stack — see `src/renderer/store/app-store.tsx` and `src/renderer/store/types-and-reducer.ts`.

**Views** (routed in `App.tsx`): start → editor → audit → settings.

**Key components:** `EditorLayout.tsx` composes `PdfViewer.tsx` + `SidebarThumbnails.tsx` + `RedactionTable.tsx` + `Toolbar.tsx` into the main working screen.

### TypeScript Configuration

Three tsconfig files are in play:
- `tsconfig.renderer.json` — React renderer (DOM lib, jsx: react-jsx, ES2020)
- `tsconfig.main.json` — Main process (Node, CommonJS, ES2020)
- `tsconfig.node.json` — Vite config compilation

### Domain Types

All shared domain types live in `src/common/types.ts`: `RedactionEntry`, `PIICategory`, `AppSettings`, IPC channel string constants.

## Key Constraints

- **Windows x64 only** — electron-builder targets win/x64; no macOS or Linux builds.
- **No networking** — intentional by design (GDPR/privacy). Do not introduce fetch/axios or any external calls.
- **Node.js 18** required (`.nvmrc`).
- **German-first UI** — all user-visible strings are in German.
- **Functional React components only** — no class components.
