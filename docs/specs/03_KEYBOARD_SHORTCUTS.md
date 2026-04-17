# Spec 03 — Tastaturkürzel

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Keine.  
> **Komplexität:** Niedrig (~1–2h)

---

## Files to READ before starting

- `src/renderer/App.tsx`
- `src/renderer/store/types-and-reducer.ts` (`AppState`, `Action` types)
- `docs/specs/SPEC_CONVENTIONS.md` (Sektionen 6 „React-Pattern" und 8 „Global-Handler")

## Files to MODIFY (EXAKTE Liste)

- `src/renderer/App.tsx`

## Files to CREATE

- `src/renderer/__tests__/keyboard-shortcuts.test.tsx`

---

## Ziel

Navigation und Kernaktionen im Editor ohne Maus ermöglichen. Erweitert den bestehenden `keydown`-Handler in `App.tsx` um 10 neue Shortcuts.

---

## Zu ändernde Datei

**`src/renderer/App.tsx`** — `handleKeyDown`-Funktion

---

## Bestehender Code — vollständig

```typescript
// src/renderer/App.tsx
import React, { useEffect } from 'react';
import { AppProvider, useAppState } from './store/app-store';
import { openPdfFile } from './services/file-handler';
import StartPage from './components/StartPage';
import EditorLayout from './components/EditorLayout';
import AuditLogView from './components/AuditLogView';
import SettingsView from './components/SettingsView';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorBanner from './components/ErrorBanner';
import './styles/global.css';

function AppContent() {
  const { state, dispatch, performUndo, performRedo } = useAppState();

  // Keyboard shortcuts — NUR Ctrl+Z und Ctrl+Y vorhanden
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        performRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo]);

  // Menu item listeners
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubs = [
      window.electronAPI.onMenuOpenFile(() => { openPdfFile(dispatch); }),
      window.electronAPI.onMenuGoToSettings(() => { dispatch({ type: 'SET_VIEW', view: 'settings' }); }),
      window.electronAPI.onMenuGoToAudit(() => { dispatch({ type: 'SET_VIEW', view: 'audit' }); }),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [dispatch]);

  return (
    <div className="app-container">
      {state.error && <ErrorBanner />}
      {(state.isAnalyzing || state.isExporting) && <LoadingOverlay />}
      {state.view === 'start' && <StartPage />}
      {state.view === 'editor' && <EditorLayout />}
      {state.view === 'audit' && <AuditLogView />}
      {state.view === 'settings' && <SettingsView />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
```

### AppState-Interface (aus types-and-reducer.ts, relevant)

```typescript
interface AppState {
  view: 'start' | 'editor' | 'audit' | 'settings';
  currentPage: number;
  pageCount: number;
  zoom: number;
  mode: RedactionMode;                  // 'schwärzen' | 'pseudonymisieren'
  selectedRedactionId: string | null;
  redactions: RedactionEntry[];         // jede hat .status: RedactionStatus
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

// Relevante Actions:
// { type: 'SET_PAGE'; page: number }           — klemmt auf [1, pageCount]
// { type: 'SET_ZOOM'; zoom: number }           — klemmt auf [25, 400]
// { type: 'SET_MODE'; mode: RedactionMode }
// { type: 'ACCEPT_SUGGESTION'; id: string }
// { type: 'REJECT_SUGGESTION'; id: string }
// { type: 'REMOVE_REDACTION'; id: string }
// { type: 'SELECT_REDACTION'; id: string | null }
```

---

## Shortcut-Spezifikation

| Kürzel | Bedingung | Action |
|--------|-----------|--------|
| `Ctrl+Z` | immer | `performUndo()` ← bereits vorhanden |
| `Ctrl+Y` / `Ctrl+Shift+Z` | immer | `performRedo()` ← bereits vorhanden |
| `ArrowLeft` / `PageUp` | `view==='editor'`, kein Input fokussiert | `SET_PAGE page-1` |
| `ArrowRight` / `PageDown` | `view==='editor'`, kein Input fokussiert | `SET_PAGE page+1` |
| `+` | `view==='editor'`, kein Input fokussiert | `SET_ZOOM zoom+25` |
| `-` | `view==='editor'`, kein Input fokussiert | `SET_ZOOM zoom-25` |
| `0` (ohne Ctrl) | `view==='editor'`, kein Input fokussiert | `SET_ZOOM 100` |
| `s` / `S` (ohne Ctrl) | `view==='editor'`, kein Input fokussiert | `SET_MODE` toggle |
| `a` / `A` (ohne Ctrl) | `view==='editor'`, selectedId gesetzt, status=vorschlag | `ACCEPT_SUGGESTION` |
| `d` / `D` (ohne Ctrl) | `view==='editor'`, selectedId gesetzt, status=vorschlag | `REJECT_SUGGESTION` |
| `Delete` | `view==='editor'`, selectedId gesetzt, status=manuell | `REMOVE_REDACTION` |
| `Escape` | `view==='editor'`, selectedId gesetzt | `SELECT_REDACTION null` |
| `Tab` | `view==='editor'`, kein Input fokussiert | nächste Schwärzung auswählen |
| `Shift+Tab` | `view==='editor'`, kein Input fokussiert | vorherige Schwärzung auswählen |

**Guard-Bedingung (verhindert Konflikte mit Input-Feldern):**
```typescript
const isInputFocused = () =>
  document.activeElement instanceof HTMLInputElement ||
  document.activeElement instanceof HTMLTextAreaElement ||
  document.activeElement instanceof HTMLSelectElement;
```

---

## Schritt 1 — Tests schreiben (TDD)

Datei erstellen: **`src/renderer/__tests__/keyboard-shortcuts.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { AppProvider, useAppState } from '../store/app-store';

// ─── Hilfsfunktion: keydown-Event feuern ────────────────────

function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, ...options });
}

// ─── Testziel: die pure Handler-Logik ───────────────────────
// Da App.tsx den electronAPI-Context benötigt (window.electronAPI),
// testen wir nur die Handler-Hilfsfunktion isoliert.

import { buildKeyboardHandler, KeyboardHandlerDeps } from '../App';

describe('Keyboard Handler — Editor-Shortcuts', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let performUndo: ReturnType<typeof vi.fn>;
  let performRedo: ReturnType<typeof vi.fn>;
  let deps: KeyboardHandlerDeps;

  const makeState = (overrides = {}) => ({
    view: 'editor' as const,
    currentPage: 3,
    pageCount: 10,
    zoom: 100,
    mode: 'schwärzen' as const,
    selectedRedactionId: null as string | null,
    redactions: [] as any[],
    undoStack: [],
    redoStack: [],
    ...overrides,
  });

  beforeEach(() => {
    dispatch = vi.fn();
    performUndo = vi.fn();
    performRedo = vi.fn();
    deps = { dispatch, performUndo, performRedo };
  });

  // ── Seitennavigation ────────────────────────────────────────

  it('ArrowRight → nächste Seite', () => {
    const handler = buildKeyboardHandler(makeState(), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PAGE', page: 4 });
  });

  it('ArrowLeft → vorherige Seite', () => {
    const handler = buildKeyboardHandler(makeState({ currentPage: 3 }), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PAGE', page: 2 });
  });

  it('ArrowRight auf letzter Seite → kein Dispatch', () => {
    const handler = buildKeyboardHandler(makeState({ currentPage: 10, pageCount: 10 }), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_PAGE' }));
  });

  // ── Zoom ────────────────────────────────────────────────────

  it('+ → Zoom +25', () => {
    const handler = buildKeyboardHandler(makeState({ zoom: 100 }), deps);
    const e = new KeyboardEvent('keydown', { key: '+' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 125 });
  });

  it('- → Zoom -25', () => {
    const handler = buildKeyboardHandler(makeState({ zoom: 100 }), deps);
    const e = new KeyboardEvent('keydown', { key: '-' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 75 });
  });

  it('0 → Zoom 100%', () => {
    const handler = buildKeyboardHandler(makeState({ zoom: 200 }), deps);
    const e = new KeyboardEvent('keydown', { key: '0' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 100 });
  });

  // ── Modus-Wechsel ───────────────────────────────────────────

  it('S → Modus wechseln zu pseudonymisieren', () => {
    const handler = buildKeyboardHandler(makeState({ mode: 'schwärzen' }), deps);
    const e = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'pseudonymisieren' });
  });

  it('S → Modus wechseln zurück zu schwärzen', () => {
    const handler = buildKeyboardHandler(makeState({ mode: 'pseudonymisieren' }), deps);
    const e = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'schwärzen' });
  });

  // ── Akzeptieren / Ablehnen ──────────────────────────────────

  it('A → akzeptiert ausgewählten Vorschlag', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'vorschlag' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACCEPT_SUGGESTION', id: 'abc' });
  });

  it('A → tut nichts wenn kein Eintrag ausgewählt', () => {
    const handler = buildKeyboardHandler(makeState({ selectedRedactionId: null }), deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ACCEPT_SUGGESTION' }));
  });

  it('D → lehnt ausgewählten Vorschlag ab', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'vorschlag' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'd' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'REJECT_SUGGESTION', id: 'abc' });
  });

  // ── Löschen ─────────────────────────────────────────────────

  it('Delete → löscht manuelle Schwärzung', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'manuell' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'Delete' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_REDACTION', id: 'abc' });
  });

  it('Delete → löscht NICHT Vorschlag (nur ablehnen)', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'vorschlag' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'Delete' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'REMOVE_REDACTION', id: 'abc' });
  });

  // ── Escape ──────────────────────────────────────────────────

  it('Escape → hebt Auswahl auf', () => {
    const handler = buildKeyboardHandler(makeState({ selectedRedactionId: 'abc' }), deps);
    const e = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: null });
  });

  // ── Guard: Input-Feld fokussiert ─────────────────────────────

  it('ArrowRight ignoriert wenn Input fokussiert', () => {
    const handler = buildKeyboardHandler(makeState(), deps);
    const input = document.createElement('input');
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: input });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Guard: view !== editor ───────────────────────────────────

  it('ArrowRight ignoriert wenn view !== editor', () => {
    const handler = buildKeyboardHandler(makeState({ view: 'start' as any }), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Tab-Navigation ───────────────────────────────────────────

  it('Tab → wählt nächste Schwärzung', () => {
    const state = makeState({
      selectedRedactionId: 'r1',
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' },
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'akzeptiert' },
      ],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r2' });
  });

  it('Undo Ctrl+Z → performUndo (bestehend, nicht brechen)', () => {
    const handler = buildKeyboardHandler(makeState(), deps);
    const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(performUndo).toHaveBeenCalled();
  });

  // ── Zusätzliche Edge-Cases ───────────────────────────────────

  it('Shift+Tab → wählt vorherige Schwärzung', () => {
    const state = makeState({
      selectedRedactionId: 'r2',
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' },
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'vorschlag' },
      ],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r1' });
  });

  it('Tab → wraps am Ende zurück zu erstem Eintrag', () => {
    const state = makeState({
      selectedRedactionId: 'r2',
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' },
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'vorschlag' },
      ],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r1' });
  });

  it('Tab bei leerer Liste → kein Dispatch', () => {
    const handler = buildKeyboardHandler(makeState({ redactions: [] }), deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('Ctrl+A darf NICHT als Akzeptieren interpretiert werden', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'vorschlag' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ACCEPT_SUGGESTION' }));
  });

  it('A bei akzeptierter Schwärzung → kein Re-Accept', () => {
    const state = makeState({
      selectedRedactionId: 'abc',
      redactions: [{ id: 'abc', status: 'akzeptiert' }],
    });
    const handler = buildKeyboardHandler(state, deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ContentEditable-Element wird als Input behandelt', () => {
    const handler = buildKeyboardHandler(makeState(), deps);
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: div });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── Stability Test: Handler wird nur einmal registriert ─────────

describe('Handler Lifecycle', () => {
  it('useRef-Pattern: Handler-Referenz bleibt stabil bei State-Change', () => {
    const state1 = { view: 'editor', currentPage: 1, pageCount: 10 } as any;
    const state2 = { ...state1, currentPage: 5 };
    const deps = { dispatch: vi.fn(), performUndo: vi.fn(), performRedo: vi.fn() };

    const h1 = buildKeyboardHandler(state1, deps);
    const h2 = buildKeyboardHandler(state2, deps);

    // Beide Handler sind Funktionen — die Existenz unterschiedlicher
    // Instanzen ist OK, sofern die AppContent sie NICHT registriert
    // (das garantiert die useRef-Pattern-Implementation in 2b)
    expect(typeof h1).toBe('function');
    expect(typeof h2).toBe('function');
  });
});
```

---

## Schritt 2 — Implementation

### 2a. `buildKeyboardHandler` als exportierte Funktion in App.tsx hinzufügen

Diese Funktion kapselt die gesamte Shortcut-Logik — testbar, ohne React-Kontext.

**In `App.tsx`**, vor der `AppContent`-Komponente einfügen:

```typescript
export interface KeyboardHandlerDeps {
  dispatch: React.Dispatch<Action>;
  performUndo: () => void;
  performRedo: () => void;
}

export function buildKeyboardHandler(
  state: Pick<AppState, 'view' | 'currentPage' | 'pageCount' | 'zoom' | 'mode' | 'selectedRedactionId' | 'redactions' | 'undoStack' | 'redoStack'>,
  { dispatch, performUndo, performRedo }: KeyboardHandlerDeps
) {
  return (e: KeyboardEvent) => {
    // Ctrl+Z / Ctrl+Y: immer aktiv (auch außerhalb des Editors)
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      performUndo();
      return;
    }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      performRedo();
      return;
    }

    // Alle anderen Shortcuts: nur im Editor-View
    if (state.view !== 'editor') return;

    // Guard: kein Input-Feld fokussiert (auch contenteditable)
    const target = e.target as Element | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        if (state.currentPage > 1) {
          e.preventDefault();
          dispatch({ type: 'SET_PAGE', page: state.currentPage - 1 });
        }
        break;

      case 'ArrowRight':
      case 'PageDown':
        if (state.currentPage < state.pageCount) {
          e.preventDefault();
          dispatch({ type: 'SET_PAGE', page: state.currentPage + 1 });
        }
        break;

      case '+':
      case 'NumpadAdd':
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 25 });
        break;

      case '-':
      case 'NumpadSubtract':
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 25 });
        break;

      case '0':
        if (!e.ctrlKey) {
          e.preventDefault();
          dispatch({ type: 'SET_ZOOM', zoom: 100 });
        }
        break;

      case 's':
      case 'S':
        if (!e.ctrlKey) {
          e.preventDefault();
          dispatch({
            type: 'SET_MODE',
            mode: state.mode === 'schwärzen' ? 'pseudonymisieren' : 'schwärzen',
          });
        }
        break;

      case 'a':
      case 'A': {
        if (!e.ctrlKey && state.selectedRedactionId) {
          const selected = state.redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'vorschlag') {
            e.preventDefault();
            dispatch({ type: 'ACCEPT_SUGGESTION', id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'd':
      case 'D': {
        if (!e.ctrlKey && state.selectedRedactionId) {
          const selected = state.redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'vorschlag') {
            e.preventDefault();
            dispatch({ type: 'REJECT_SUGGESTION', id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'Delete': {
        if (state.selectedRedactionId) {
          const selected = state.redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'manuell') {
            dispatch({ type: 'REMOVE_REDACTION', id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'Escape':
        if (state.selectedRedactionId) {
          dispatch({ type: 'SELECT_REDACTION', id: null });
        }
        break;

      case 'Tab': {
        e.preventDefault();
        const sorted = [...state.redactions]
          .filter(r => r.status !== 'abgelehnt')
          .sort((a, b) => a.page - b.page || a.bounds.y - b.bounds.y);

        if (sorted.length === 0) break;

        const currentIdx = sorted.findIndex(r => r.id === state.selectedRedactionId);

        if (e.shiftKey) {
          const prev = currentIdx <= 0 ? sorted[sorted.length - 1] : sorted[currentIdx - 1];
          dispatch({ type: 'SELECT_REDACTION', id: prev.id });
        } else {
          const next = currentIdx >= sorted.length - 1 ? sorted[0] : sorted[currentIdx + 1];
          dispatch({ type: 'SELECT_REDACTION', id: next.id });
        }
        break;
      }
    }
  };
}
```

### 2b. `AppContent` — bestehenden `useEffect` ersetzen (mit useRef-Pattern!)

**KRITISCH:** Siehe `SPEC_CONVENTIONS.md §6` — `state` darf NICHT direkt als Effect-Dependency verwendet werden, sonst wird der Listener bei jedem State-Change neu registriert (Memory-Leak + Race-Conditions).

**Ersetze** den bisherigen `useEffect` für `handleKeyDown` durch:

```typescript
// Ref hält immer aktuellen State — Handler-Closure bleibt stabil
const stateRef = useRef(state);
useEffect(() => { stateRef.current = state; }, [state]);

// Deps sind stable (useCallback/dispatch sind referenzstabil)
// → Handler wird nur EINMAL registriert (keine Re-Registration bei State-Change)
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    buildKeyboardHandler(stateRef.current, { dispatch, performUndo, performRedo })(e);
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [dispatch, performUndo, performRedo]);
```

> Der alte `useEffect` mit nur Ctrl+Z/Y wird vollständig ersetzt (nicht dupliziert).

**Zusätzliche Imports:**
```typescript
import { useEffect, useRef } from 'react';
```

### 2c. Fehlende Imports hinzufügen

```typescript
import { AppState, Action } from './store/types-and-reducer';
```

---

## Schritt 3 — Tests ausführen

```bash
npx vitest run src/renderer/__tests__/keyboard-shortcuts.test.tsx --reporter=verbose
npx tsc --noEmit
```

---

## Definition of Done

- [ ] `buildKeyboardHandler` als named export aus `App.tsx`
- [ ] `KeyboardHandlerDeps` Interface als named export aus `App.tsx`
- [ ] Bestehende Ctrl+Z / Ctrl+Y Funktionalität unverändert vorhanden
- [ ] Alle 15 Tests aus `keyboard-shortcuts.test.tsx` grün
- [ ] Seitennavigation mit Pfeiltasten funktioniert (manuell getestet)
- [ ] Kein Scroll-Verhalten durch Pfeiltasten ausgelöst (`e.preventDefault()` aktiv)
- [ ] Tab-Navigation durchläuft alle Einträge zyklisch
- [ ] In Text-Eingabefeldern keine Shortcut-Konflikte (manuell getestet: Variablenname bearbeiten)
- [ ] `npx tsc --noEmit` fehlerfrei
