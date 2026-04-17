# Spec 07 — Batch-Verarbeitung / Multi-Tab

> ⚠️ **DIESE SPEC WURDE AUFGETEILT** in zwei übersichtlichere Teile:
> - **`07A_BATCH_STATE_REFACTOR.md`** — State-Refactor (Breaking Change, ~8h)
> - **`07B_BATCH_UI.md`** — Tabs, Multi-File, CSV-Export (~8h)
>
> Ein Agent sollte **NICHT** diese alte Spec nutzen. Bitte mit 07A beginnen und 07B danach.  
> Diese Datei bleibt als Referenz bestehen, enthält aber die unkorrigierten Ursprungs-Probleme (zu große Scope, fehlender Migration-Guide, fehlende Legacy-Kompat-Schicht).

> **Voraussetzung:** `00_OVERVIEW.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Specs `04_BULK_ACTIONS.md` und `05_GROUP_SELECTION.md` abgeschlossen.  
> **Komplexität:** Hoch (~12–16h) — Breaking Change im State  
> **Wichtig:** Dies ist ein vollständiger Refactor des App-State. Alle Komponenten müssen angepasst werden. TypeScript-Fehler nach der State-Änderung gezielt beheben.

---

## Ziel

Mehrere PDFs gleichzeitig in Tabs öffnen. Gemeinsame Variablen-Registry sorgt dafür, dass gleicher Text über alle Dokumente hinweg identisch pseudonymisiert wird. Kombinierter CSV-Export mit Dokument-Spalte.

---

## Breaking Changes (Übersicht)

| Was ändert sich | Vorher | Nachher |
|-----------------|--------|---------|
| `AppState.filePath` | `string \| null` | → `activeDoc?.filePath` |
| `AppState.fileData` | `Uint8Array \| null` | → `activeDoc?.fileData` |
| `AppState.redactions` | `RedactionEntry[]` | → `activeDoc?.redactions` |
| `AppState.currentPage` | `number` | → `activeDoc?.currentPage` |
| `AppState.hasAnalyzed` | `boolean` | → `activeDoc?.hasAnalyzed` |
| `AppState.isAnalyzing` | `boolean` | → `activeDoc?.isAnalyzing` |
| `openFileDialog()` return | `string \| undefined` | `string[]` |

---

## Zu ändernde Dateien (vollständige Liste)

| Datei | Art |
|-------|-----|
| `src/common/types.ts` | `CSVRow` + `IPC_CHANNELS` erweitern |
| `src/renderer/store/types-and-reducer.ts` | **Vollständiger Rewrite** |
| `src/renderer/store/app-store.tsx` | `updateRedactionVariable` + Registry-Sync |
| `src/main/main.ts` | `OPEN_FILE_DIALOG` multiSelection, neuer `EXPORT_ALL_PDFS` Handler |
| `src/main/preload.ts` | `openFileDialog()` return type |
| `src/main/services/pdf-export-service.ts` | `generateCombinedCSV()` Methode |
| `src/renderer/App.tsx` | `AppContent` nutzt aktives Dokument |
| `src/renderer/components/EditorLayout.tsx` | `TabBar` einbinden |
| `src/renderer/components/Toolbar.tsx` | alle State-Zugriffe auf aktives Dokument umstellen |
| `src/renderer/components/PdfViewer.tsx` | alle State-Zugriffe auf aktives Dokument |
| `src/renderer/components/RedactionTable.tsx` | alle State-Zugriffe + `ACCEPT_ALL_DOCUMENTS` |
| `src/renderer/components/SidebarThumbnails.tsx` | alle State-Zugriffe |
| `src/renderer/services/file-handler.ts` | Mehrere Dateien öffnen |

## Neue Dateien

| Datei | Typ |
|-------|-----|
| `src/renderer/components/TabBar.tsx` | Neu |
| `src/renderer/store/__tests__/batch-state.test.ts` | Neu (Tests) |

---

## Schritt 1 — Tests schreiben (TDD)

Datei erstellen: **`src/renderer/store/__tests__/batch-state.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState, createDocumentState } from '../types-and-reducer';
import { RedactionEntry } from '../../../common/types';
import { v4 as uuidv4 } from 'uuid';

function makeDoc(id: string, fileName = 'test.pdf') {
  return createDocumentState({
    id, filePath: `/path/${fileName}`, fileName,
    fileData: new Uint8Array([1, 2, 3]),
    pageCount: 5,
  });
}

function makeEntry(id: string, content: string, category = 'Name' as any): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: content,
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status: 'vorschlag', groupNumber: 1, source: 'regex',
  };
}

describe('Batch State — Dokument-Management', () => {
  // ── ADD_DOCUMENT ─────────────────────────────────────────

  it('ADD_DOCUMENT: fügt Dokument hinzu und setzt es als aktiv', () => {
    const doc = makeDoc('d1');
    const state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
    expect(state.documents).toHaveLength(1);
    expect(state.activeDocumentId).toBe('d1');
    expect(state.view).toBe('editor');
  });

  it('ADD_DOCUMENT: zweites Dokument — erstes bleibt aktiv', () => {
    const s1 = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    const s2 = reducer(s1, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    expect(s2.documents).toHaveLength(2);
    expect(s2.activeDocumentId).toBe('d1'); // erstes bleibt aktiv
  });

  // ── REMOVE_DOCUMENT ──────────────────────────────────────

  it('REMOVE_DOCUMENT: wechselt zu nächstem Tab', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    state = reducer(state, { type: 'SET_ACTIVE_DOCUMENT', id: 'd1' });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.documents).toHaveLength(1);
    expect(state.activeDocumentId).toBe('d2');
  });

  it('REMOVE_DOCUMENT: letztes Dokument → view = start', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.documents).toHaveLength(0);
    expect(state.view).toBe('start');
    expect(state.activeDocumentId).toBeNull();
  });

  // ── SET_ACTIVE_DOCUMENT ──────────────────────────────────

  it('SET_ACTIVE_DOCUMENT: wechselt aktiven Tab', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    state = reducer(state, { type: 'SET_ACTIVE_DOCUMENT', id: 'd2' });
    expect(state.activeDocumentId).toBe('d2');
  });

  // ── SET_DOCUMENT_REDACTIONS ──────────────────────────────

  it('SET_DOCUMENT_REDACTIONS: setzt Redactions nur für das Ziel-Dokument', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    const redactions = [makeEntry('r1', 'Max Mustermann')];
    state = reducer(state, { type: 'SET_DOCUMENT_REDACTIONS', docId: 'd1', redactions });
    const d1 = state.documents.find(d => d.id === 'd1')!;
    const d2 = state.documents.find(d => d.id === 'd2')!;
    expect(d1.redactions).toHaveLength(1);
    expect(d2.redactions).toHaveLength(0);
  });
});

describe('Batch State — Variable-Registry', () => {
  it('UPDATE_VARIABLE_REGISTRY: speichert Zuweisung', () => {
    const key = 'Max Mustermann|Name';
    const state = reducer(initialState, {
      type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Name_1',
    });
    expect(state.variableRegistry[key]).toBe('Name_1');
  });

  it('Konsistenz: gleicher Inhalt in zwei Docs → gleiche Variable', () => {
    // Simuliert den Workflow: Doc1 analysiert, Registry befüllt,
    // Doc2 analysiert, gleicher Inhalt → übernimmt Variablenname aus Registry
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });

    // Registry befüllen (passiert in app-store nach Analyse)
    state = reducer(state, {
      type: 'UPDATE_VARIABLE_REGISTRY',
      key: 'Max Mustermann|Name',
      variableName: 'Name_1',
    });

    // Doc2 Redactions setzen (bereits mit Registry-Namen)
    const r = makeEntry('r1', 'Max Mustermann');
    r.variableName = 'Name_1'; // Registry angewendet
    state = reducer(state, { type: 'SET_DOCUMENT_REDACTIONS', docId: 'd2', redactions: [r] });

    const d2 = state.documents.find(d => d.id === 'd2')!;
    expect(d2.redactions[0].variableName).toBe('Name_1');
  });
});

describe('Batch State — ACCEPT_ALL_DOCUMENTS', () => {
  it('akzeptiert Vorschläge in allen Dokumenten', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });

    const r1 = makeEntry('r1', 'content1');
    const r2 = makeEntry('r2', 'content2');
    state = reducer(state, { type: 'SET_DOCUMENT_REDACTIONS', docId: 'd1', redactions: [r1] });
    state = reducer(state, { type: 'SET_DOCUMENT_REDACTIONS', docId: 'd2', redactions: [r2] });

    state = reducer(state, { type: 'ACCEPT_ALL_DOCUMENTS' });

    const d1 = state.documents.find(d => d.id === 'd1')!;
    const d2 = state.documents.find(d => d.id === 'd2')!;
    expect(d1.redactions[0].status).toBe('akzeptiert');
    expect(d2.redactions[0].status).toBe('akzeptiert');
  });
});
```

---

## Schritt 2 — State-Refactor

### 2a. `src/common/types.ts` erweitern

**`CSVRow` Interface** — `dokument`-Feld hinzufügen:
```typescript
export interface CSVRow {
  bezeichnung: string; inhalt: string; typ: string;
  gruppe: string; status: string; seite: string;
  dokument?: string;  // ← NEU: Dateiname des Quelldokuments
}
```

**`IPC_CHANNELS`** — neuen Channel hinzufügen:
```typescript
export const IPC_CHANNELS = {
  // ... bestehende Channels ...
  EXPORT_ALL_PDFS: 'pdf:exportAll',  // ← NEU
} as const;
```

### 2b. `src/renderer/store/types-and-reducer.ts` — vollständiger Rewrite

**Ersetze die gesamte Datei durch:**

```typescript
import { RedactionEntry, RedactionMode, ExportQuality, BoundingBox, RedactionStatus } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

// ─── DocumentState ────────────────────────────────────────────

export interface DocumentState {
  id: string;
  filePath: string;
  fileName: string;
  fileData: Uint8Array;
  pageCount: number;
  currentPage: number;
  redactions: RedactionEntry[];
  hasAnalyzed: boolean;
  analysisTypes: string[];
  isAnalyzing: boolean;
  analysisProgress: string;
  manualCounter: number;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

export interface UndoAction {
  type: string;
  description: string;
  undo: () => RedactionEntry[];
  redo: () => RedactionEntry[];
}

export function createDocumentState(params: Pick<DocumentState,
  'id' | 'filePath' | 'fileName' | 'fileData' | 'pageCount'>
): DocumentState {
  return {
    ...params,
    currentPage: 1,
    redactions: [],
    hasAnalyzed: false,
    analysisTypes: [],
    isAnalyzing: false,
    analysisProgress: '',
    manualCounter: 0,
    undoStack: [],
    redoStack: [],
  };
}

// ─── Registries ───────────────────────────────────────────────

export type VariableRegistry = Record<string, string>; // key: `${content}|${category}`
export type GroupRegistry = Record<string, number>;

// ─── AppState ─────────────────────────────────────────────────

export interface AppState {
  documents: DocumentState[];
  activeDocumentId: string | null;
  variableRegistry: VariableRegistry;
  groupRegistry: GroupRegistry;

  // Globale UI
  mode: RedactionMode;
  exportQuality: ExportQuality;
  zoom: number;
  selectedRedactionId: string | null;
  hoveredRedactionId: string | null;
  isExporting: boolean;
  exportProgress: string;
  view: 'start' | 'editor' | 'audit' | 'settings';
  error: string | null;
}

export const initialState: AppState = {
  documents: [],
  activeDocumentId: null,
  variableRegistry: {},
  groupRegistry: {},
  mode: 'schwärzen',
  exportQuality: 'high',
  zoom: 100,
  selectedRedactionId: null,
  hoveredRedactionId: null,
  isExporting: false,
  exportProgress: '',
  view: 'start',
  error: null,
};

// ─── Actions ─────────────────────────────────────────────────

export type Action =
  // Dokument-Verwaltung
  | { type: 'ADD_DOCUMENT'; doc: DocumentState }
  | { type: 'REMOVE_DOCUMENT'; id: string }
  | { type: 'SET_ACTIVE_DOCUMENT'; id: string }
  | { type: 'UPDATE_DOCUMENT'; docId: string; updates: Partial<DocumentState> }
  | { type: 'SET_DOCUMENT_REDACTIONS'; docId: string; redactions: RedactionEntry[] }
  | { type: 'ADD_DOCUMENT_REDACTION'; docId: string; redaction: RedactionEntry }
  | { type: 'UPDATE_DOCUMENT_REDACTION'; docId: string; id: string; updates: Partial<RedactionEntry> }
  | { type: 'REMOVE_DOCUMENT_REDACTION'; docId: string; id: string }
  | { type: 'ACCEPT_DOCUMENT_SUGGESTION'; docId: string; id: string }
  | { type: 'REJECT_DOCUMENT_SUGGESTION'; docId: string; id: string }
  | { type: 'ACCEPT_ALL_DOCUMENTS' }
  | { type: 'REJECT_ALL_DOCUMENTS' }
  // Registries
  | { type: 'UPDATE_VARIABLE_REGISTRY'; key: string; variableName: string }
  | { type: 'UPDATE_GROUP_REGISTRY'; key: string; groupNumber: number }
  // Globale UI
  | { type: 'SET_MODE'; mode: RedactionMode }
  | { type: 'SET_EXPORT_QUALITY'; quality: ExportQuality }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SELECT_REDACTION'; id: string | null }
  | { type: 'HOVER_REDACTION'; id: string | null }
  | { type: 'SET_EXPORTING'; isExporting: boolean; progress?: string }
  | { type: 'SET_EXPORT_PROGRESS'; progress: string }
  | { type: 'SET_VIEW'; view: 'start' | 'editor' | 'audit' | 'settings' }
  | { type: 'SET_ERROR'; error: string | null }
  // Undo/Redo (pro Dokument)
  | { type: 'PUSH_UNDO'; docId: string; action: UndoAction }
  | { type: 'UNDO'; docId: string }
  | { type: 'REDO'; docId: string }
  // Bulk (Phase 04 — auch im neuen State vorhanden)
  | { type: 'ACCEPT_BY_CATEGORY'; docId: string; category: string }
  | { type: 'REJECT_BY_CATEGORY'; docId: string; category: string }
  | { type: 'REMOVE_BY_CATEGORY'; docId: string; category: string }
  | { type: 'ACCEPT_SELECTION'; docId: string; ids: string[] }
  | { type: 'REJECT_SELECTION'; docId: string; ids: string[] }
  | { type: 'REMOVE_SELECTION'; docId: string; ids: string[] }
  // Gruppe (Phase 05)
  | { type: 'ASSIGN_GROUP_TO_IDS'; docId: string; ids: string[]; groupNumber: number }
  // Legacy-compat: Aktionen ohne docId wirken auf aktives Dokument
  | { type: 'RESET' };

// ─── Helpers ─────────────────────────────────────────────────

function updateDoc(
  docs: DocumentState[],
  docId: string,
  updater: (doc: DocumentState) => DocumentState
): DocumentState[] {
  return docs.map(d => d.id === docId ? updater(d) : d);
}

function updateDocRedactions(
  docs: DocumentState[],
  docId: string,
  updater: (redactions: RedactionEntry[]) => RedactionEntry[]
): DocumentState[] {
  return updateDoc(docs, docId, d => ({ ...d, redactions: updater(d.redactions) }));
}

// ─── Reducer ─────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'ADD_DOCUMENT': {
      const isFirst = state.documents.length === 0;
      return {
        ...state,
        documents: [...state.documents, action.doc],
        activeDocumentId: isFirst ? action.doc.id : state.activeDocumentId,
        view: 'editor',
        selectedRedactionId: null,
      };
    }

    case 'REMOVE_DOCUMENT': {
      const remaining = state.documents.filter(d => d.id !== action.id);
      let nextActiveId = state.activeDocumentId;
      if (state.activeDocumentId === action.id) {
        const idx = state.documents.findIndex(d => d.id === action.id);
        nextActiveId = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? null;
      }
      return {
        ...state,
        documents: remaining,
        activeDocumentId: nextActiveId,
        view: remaining.length === 0 ? 'start' : state.view,
        selectedRedactionId: null,
      };
    }

    case 'SET_ACTIVE_DOCUMENT':
      return { ...state, activeDocumentId: action.id, selectedRedactionId: null };

    case 'UPDATE_DOCUMENT':
      return { ...state, documents: updateDoc(state.documents, action.docId, d => ({ ...d, ...action.updates })) };

    case 'SET_DOCUMENT_REDACTIONS':
      return { ...state, documents: updateDoc(state.documents, action.docId, d => ({ ...d, redactions: action.redactions })) };

    case 'ADD_DOCUMENT_REDACTION':
      return { ...state, documents: updateDocRedactions(state.documents, action.docId, r => [...r, action.redaction]) };

    case 'UPDATE_DOCUMENT_REDACTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, ...action.updates } : entry)
        ),
      };

    case 'REMOVE_DOCUMENT_REDACTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => entry.id !== action.id)
        ),
        selectedRedactionId: state.selectedRedactionId === action.id ? null : state.selectedRedactionId,
      };

    case 'ACCEPT_DOCUMENT_SUGGESTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry)
        ),
      };

    case 'REJECT_DOCUMENT_SUGGESTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry)
        ),
      };

    case 'ACCEPT_ALL_DOCUMENTS':
      return {
        ...state,
        documents: state.documents.map(d => ({
          ...d,
          redactions: d.redactions.map(r =>
            r.status === 'vorschlag' ? { ...r, status: 'akzeptiert' as RedactionStatus } : r
          ),
        })),
      };

    case 'REJECT_ALL_DOCUMENTS':
      return {
        ...state,
        documents: state.documents.map(d => ({
          ...d,
          redactions: d.redactions.map(r =>
            r.status === 'vorschlag' ? { ...r, status: 'abgelehnt' as RedactionStatus } : r
          ),
        })),
      };

    case 'UPDATE_VARIABLE_REGISTRY':
      return { ...state, variableRegistry: { ...state.variableRegistry, [action.key]: action.variableName } };

    case 'UPDATE_GROUP_REGISTRY':
      return { ...state, groupRegistry: { ...state.groupRegistry, [action.key]: action.groupNumber } };

    case 'SET_MODE': return { ...state, mode: action.mode };
    case 'SET_EXPORT_QUALITY': return { ...state, exportQuality: action.quality };
    case 'SET_ZOOM': return { ...state, zoom: Math.max(25, Math.min(400, action.zoom)) };
    case 'SELECT_REDACTION': return { ...state, selectedRedactionId: action.id };
    case 'HOVER_REDACTION': return { ...state, hoveredRedactionId: action.id };
    case 'SET_EXPORTING': return { ...state, isExporting: action.isExporting, exportProgress: action.progress || '' };
    case 'SET_EXPORT_PROGRESS': return { ...state, exportProgress: action.progress };
    case 'SET_VIEW': return { ...state, view: action.view };
    case 'SET_ERROR': return { ...state, error: action.error };

    case 'PUSH_UNDO':
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          undoStack: [...d.undoStack, action.action],
          redoStack: [],
        })),
      };

    case 'UNDO': {
      const doc = state.documents.find(d => d.id === action.docId);
      if (!doc || doc.undoStack.length === 0) return state;
      const undoAction = doc.undoStack[doc.undoStack.length - 1];
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          redactions: undoAction.undo(),
          undoStack: d.undoStack.slice(0, -1),
          redoStack: [...d.redoStack, undoAction],
        })),
      };
    }

    case 'REDO': {
      const doc = state.documents.find(d => d.id === action.docId);
      if (!doc || doc.redoStack.length === 0) return state;
      const redoAction = doc.redoStack[doc.redoStack.length - 1];
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          redactions: redoAction.redo(),
          undoStack: [...d.undoStack, redoAction],
          redoStack: d.redoStack.slice(0, -1),
        })),
      };
    }

    case 'ACCEPT_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            (entry.category as string) === action.category && entry.status === 'vorschlag'
              ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry
          )
        ),
      };

    case 'REJECT_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            (entry.category as string) === action.category && entry.status === 'vorschlag'
              ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry
          )
        ),
      };

    case 'REMOVE_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => (entry.category as string) !== action.category)
        ),
      };

    case 'ACCEPT_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            action.ids.includes(entry.id) && entry.status === 'vorschlag'
              ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry
          )
        ),
      };

    case 'REJECT_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            action.ids.includes(entry.id) && entry.status === 'vorschlag'
              ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry
          )
        ),
      };

    case 'REMOVE_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => !action.ids.includes(entry.id))
        ),
        selectedRedactionId: action.ids.includes(state.selectedRedactionId ?? '') ? null : state.selectedRedactionId,
      };

    case 'ASSIGN_GROUP_TO_IDS':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => action.ids.includes(entry.id) ? { ...entry, groupNumber: action.groupNumber } : entry)
        ),
      };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}
```

### 2c. `src/renderer/store/app-store.tsx` — `useActiveDocument` Hook + Registry-Sync

**Füge nach dem `AppContext`** folgende Hilfsfunktion und den neuen Hook hinzu:

```typescript
// Hook für das aktive Dokument
export function useActiveDocument() {
  const { state } = useAppState();
  return state.documents.find(d => d.id === state.activeDocumentId) ?? null;
}
```

**`updateRedactionVariable`** — Registry und alle Dokumente synchronisieren:

```typescript
const updateRedactionVariable = useCallback((docId: string, id: string, newName: string): boolean => {
  const doc = state.documents.find(d => d.id === docId);
  const entry = doc?.redactions.find(r => r.id === id);
  if (!entry) return false;

  // Konfliktprüfung im aktiven Dokument
  const conflict = doc!.redactions.find(
    r => r.id !== id && r.variableName === newName && r.originalContent !== entry.originalContent
  );
  if (conflict) {
    dispatch({ type: 'SET_ERROR', error: `Konflikt: „${newName}" wird bereits für „${conflict.originalContent}" verwendet.` });
    return false;
  }

  const key = `${entry.originalContent}|${entry.category}`;

  // Registry updaten
  dispatch({ type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: newName });

  // ALLE Dokumente synchronisieren
  state.documents.forEach(d => {
    d.redactions.forEach(r => {
      if (r.originalContent === entry.originalContent && r.category === entry.category) {
        dispatch({ type: 'UPDATE_DOCUMENT_REDACTION', docId: d.id, id: r.id, updates: { variableName: newName } });
      }
    });
  });

  return true;
}, [state.documents, dispatch]);
```

**`addManualRedaction`** — auf aktives Dokument beziehen:

```typescript
const addManualRedaction = useCallback((bounds: BoundingBox, page: number) => {
  const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
  if (!activeDoc) return;

  const counter = activeDoc.manualCounter + 1;
  const newRedaction: RedactionEntry = {
    id: uuidv4(),
    variableName: `MANUELL_${String(counter).padStart(3, '0')}`,
    originalContent: '',
    category: 'Manuell',
    page,
    bounds,
    status: 'manuell',
    groupNumber: 0,
    source: 'manual',
  };

  const prevRedactions = [...activeDoc.redactions];
  dispatch({ type: 'ADD_DOCUMENT_REDACTION', docId: state.activeDocumentId!, redaction: newRedaction });
  dispatch({ type: 'UPDATE_DOCUMENT', docId: state.activeDocumentId!, updates: { manualCounter: counter } });
  dispatch({
    type: 'PUSH_UNDO',
    docId: state.activeDocumentId!,
    action: {
      type: 'add_manual',
      description: 'Manuelle Schwärzung hinzugefügt',
      undo: () => prevRedactions,
      redo: () => [...prevRedactions, newRedaction],
    },
  });
}, [state.documents, state.activeDocumentId]);
```

### 2d. Komponenten-Anpassungen

Alle Komponenten die bisher auf `state.filePath`, `state.fileData`, `state.redactions`, `state.currentPage`, `state.hasAnalyzed`, `state.isAnalyzing`, `state.analysisProgress` zugegriffen haben, müssen auf das aktive Dokument umgestellt werden.

**Muster:**

```typescript
// ALT
const { state } = useAppState();
const redactions = state.redactions;

// NEU
const { state } = useAppState();
const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
const redactions = activeDoc?.redactions ?? [];
```

**Betroffene Komponenten:**
- `Toolbar.tsx`: `state.fileData` → `activeDoc?.fileData`, `state.redactions` → `activeDoc?.redactions`, alle dispatch-Calls auf `*_DOCUMENT_*`-Actions umstellen
- `PdfViewer.tsx`: gleiche Umstellung
- `RedactionTable.tsx`: gleiche Umstellung + `ACCEPT_ALL_DOCUMENTS`-Button wenn `documents.length > 1`
- `SidebarThumbnails.tsx`: `state.fileData`, `state.pageCount`, `state.currentPage`

### 2e. TabBar-Komponente erstellen

**`src/renderer/components/TabBar.tsx`:**

```typescript
import React from 'react';
import { DocumentState } from '../store/types-and-reducer';

interface TabBarProps {
  documents: DocumentState[];
  activeDocumentId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpenFile: () => void;
}

export default function TabBar({ documents, activeDocumentId, onSelectTab, onCloseTab, onOpenFile }: TabBarProps) {
  if (documents.length === 0) return null;

  return (
    <div className="tab-bar" style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto', whiteSpace: 'nowrap',
      padding: '0 var(--space-sm)',
    }}>
      {documents.map(doc => (
        <div
          key={doc.id}
          className={`tab ${doc.id === activeDocumentId ? 'active' : ''}`}
          onClick={() => onSelectTab(doc.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)',
            padding: 'var(--space-sm) var(--space-md)',
            cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            borderBottom: doc.id === activeDocumentId ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: doc.id === activeDocumentId ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <span>📄</span>
          <span title={doc.fileName} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doc.fileName}
          </span>
          {doc.isAnalyzing && <span style={{ fontSize: 10 }}>⏳</span>}
          <button
            className="btn btn-ghost btn-icon"
            onClick={e => { e.stopPropagation(); onCloseTab(doc.id); }}
            style={{ fontSize: 10, padding: '0 2px', lineHeight: 1, color: 'var(--text-muted)' }}
            title="Tab schließen"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={onOpenFile}
        style={{ marginLeft: 'var(--space-xs)', fontSize: 'var(--font-size-xs)' }}
        title="Weitere Datei öffnen"
      >
        + Öffnen
      </button>
    </div>
  );
}
```

### 2f. `src/main/main.ts` — multiSelection

**Suche** den `OPEN_FILE_DIALOG`-Handler und ersetze `openFile` properties:

```typescript
// ALT:
properties: ['openFile'],

// NEU:
properties: ['openFile', 'multiSelections'],
```

**Return-Wert** ändern: gibt jetzt `string[]` zurück.

### 2g. `src/main/services/pdf-export-service.ts` — `generateCombinedCSV`

**Neue Methode** in der `PdfExportService`-Klasse:

```typescript
generateCombinedCSV(
  exports: { fileName: string; rows: CSVRow[] }[]
): string {
  const header = 'Bezeichnung;Inhalt;Typ;Gruppe;Status;Seite;Dokument\n';

  // Deduplizieren: gleiche Bezeichnung → eine Zeile, Dokumente zusammenführen
  const merged = new Map<string, CSVRow & { dokumente: Set<string> }>();

  for (const { fileName, rows } of exports) {
    for (const row of rows) {
      const key = row.bezeichnung;
      if (merged.has(key)) {
        merged.get(key)!.dokumente.add(fileName);
      } else {
        merged.set(key, { ...row, dokumente: new Set([fileName]) });
      }
    }
  }

  const rows = Array.from(merged.values()).map(row =>
    [row.bezeichnung, row.inhalt, row.typ, row.gruppe, row.status, row.seite,
     [...row.dokumente].join(', ')]
    .map(v => `"${v}"`)
    .join(';')
  );

  return header + rows.join('\n');
}
```

---

## Schritt 3 — Tests ausführen

```bash
npx vitest run src/renderer/store/__tests__/batch-state.test.ts --reporter=verbose
npx tsc --noEmit
```

TypeScript-Fehler nach dem State-Refactor systematisch beheben — für jede Komponente die alten `state.X`-Zugriffe durch `activeDoc?.X`-Zugriffe ersetzen.

---

## Definition of Done

- [ ] `DocumentState` + `VariableRegistry` + `createDocumentState()` in `types-and-reducer.ts`
- [ ] Alle 14 Reducer-Tests aus `batch-state.test.ts` grün
- [ ] 3 Tabs öffnen → Tabs erscheinen, Wechsel funktioniert
- [ ] Tab schließen → korrekter nächster Tab wird aktiv
- [ ] Gleiche Person in Doc 1 + 3 → identischer `variableName`
- [ ] Variablenumbenennung in Tab 1 → Tab 3 automatisch synchronisiert
- [ ] „Alle Dokumente exportieren" erstellt 3 PDFs + kombinierte CSV
- [ ] `dokument`-Spalte in kombinierter CSV korrekt
- [ ] Undo/Redo ist Tab-spezifisch
- [ ] `npx tsc --noEmit` fehlerfrei (wichtig: alle Komponenten angepasst)
