# Spec 07A — State-Refactor für Multi-Dokument-Support

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen.  
> **Abhängigkeiten:** Specs `04_BULK_ACTIONS.md` und `05_GROUP_SELECTION.md` abgeschlossen.  
> **Komplexität:** Hoch (~6–8h) — BREAKING CHANGE im State  
> **Nachfolger:** `07B_BATCH_UI.md` (Tabs, Multi-File-Open, CSV-Export)

---

## Ziel von 07A

Vollständiger State-Rewrite: `AppState` wird auf `documents[]` + `activeDocumentId` umgebaut. Eine Legacy-Kompatibilitäts-Schicht erlaubt bestehenden Komponenten, mit minimalen Änderungen weiterzuarbeiten, während die Document-isolierte Logik parallel existiert.

**Nach Abschluss von 07A:**
- Alle bestehenden Features funktionieren noch (genau 1 Dokument offen)
- Neue Action-Types für Multi-Doc sind vorhanden
- `useActiveDocument()` Hook ist verfügbar
- Alle Tests grün

**In 07B erst:**
- Tab-UI
- Mehrere Dateien öffnen
- Kombinierter CSV-Export
- Export für alle Dokumente

---

## Files to READ before starting

- `src/renderer/store/types-and-reducer.ts` (VOLLSTÄNDIG)
- `src/renderer/store/app-store.tsx` (VOLLSTÄNDIG)
- `src/common/types.ts` (VOLLSTÄNDIG)
- `src/renderer/components/Toolbar.tsx` (für State-Zugriffsmuster)
- `src/renderer/components/PdfViewer.tsx`
- `src/renderer/components/RedactionTable.tsx`
- `src/renderer/components/SidebarThumbnails.tsx`
- `src/renderer/services/file-handler.ts`

## Files to MODIFY

- `src/renderer/store/types-and-reducer.ts` — State-Shape + Actions
- `src/renderer/store/app-store.tsx` — Helper + `useActiveDocument` Hook
- `src/renderer/services/file-handler.ts` — ADD_DOCUMENT statt SET_FILE
- `src/renderer/components/Toolbar.tsx` — nutzt `useActiveDocument()`
- `src/renderer/components/PdfViewer.tsx` — nutzt `useActiveDocument()`
- `src/renderer/components/RedactionTable.tsx` — nutzt `useActiveDocument()`
- `src/renderer/components/SidebarThumbnails.tsx` — nutzt `useActiveDocument()`

## Files to CREATE

- `src/renderer/store/__tests__/batch-state.test.ts`
- `src/renderer/store/__tests__/legacy-actions-migration.test.ts`

---

## Migration-Guide: Alt → Neu

### Action-Mapping

| Alte Action (vor 07A) | Neue Action (ab 07A) | Anmerkung |
|----------------------|----------------------|-----------|
| `SET_FILE` | `ADD_DOCUMENT` | Erzeugt `DocumentState` aus Parametern |
| `SET_PAGE` | `SET_DOCUMENT_PAGE` + `docId` | Pro Dokument |
| `SET_REDACTIONS` | `SET_DOCUMENT_REDACTIONS` + `docId` | Pro Dokument |
| `ADD_REDACTION` | `ADD_DOCUMENT_REDACTION` + `docId` | Pro Dokument |
| `UPDATE_REDACTION` | `UPDATE_DOCUMENT_REDACTION` + `docId` | Pro Dokument |
| `REMOVE_REDACTION` | `REMOVE_DOCUMENT_REDACTION` + `docId` | Pro Dokument |
| `ACCEPT_SUGGESTION` | `ACCEPT_DOCUMENT_SUGGESTION` + `docId` | Pro Dokument |
| `REJECT_SUGGESTION` | `REJECT_DOCUMENT_SUGGESTION` + `docId` | Pro Dokument |
| `CLEAR_PAGE_REDACTIONS` | `CLEAR_DOCUMENT_PAGE_REDACTIONS` + `docId` | Pro Dokument |
| `SET_HAS_ANALYZED` | `UPDATE_DOCUMENT` + `hasAnalyzed` in updates | Pro Dokument |
| `SET_ANALYZING` | `UPDATE_DOCUMENT` + `isAnalyzing` | Pro Dokument |
| `SET_ANALYSIS_PROGRESS` | `UPDATE_DOCUMENT` + `analysisProgress` | Pro Dokument |
| `SET_ANALYSIS_TYPES` | `UPDATE_DOCUMENT` + `analysisTypes` | Pro Dokument |
| `INCREMENT_MANUAL_COUNTER` | `UPDATE_DOCUMENT` + `manualCounter` | Pro Dokument |
| `PUSH_UNDO` / `UNDO` / `REDO` | Selbige + `docId` | Pro Dokument |
| `ACCEPT_BY_CATEGORY` | Selbige + `docId` | Pro Dokument |
| `REJECT_BY_CATEGORY` | Selbige + `docId` | Pro Dokument |
| `REMOVE_BY_CATEGORY` | Selbige + `docId` | Pro Dokument |
| `ACCEPT_SELECTION` | Selbige + `docId` | Pro Dokument |
| `REJECT_SELECTION` | Selbige + `docId` | Pro Dokument |
| `REMOVE_SELECTION` | Selbige + `docId` | Pro Dokument |
| `ASSIGN_GROUP_TO_IDS` | Selbige + `docId` | Pro Dokument |
| `SET_MODE`, `SET_EXPORT_QUALITY`, `SET_ZOOM` | **UNVERÄNDERT** — global |
| `SELECT_REDACTION`, `HOVER_REDACTION` | **UNVERÄNDERT** — global |
| `SET_ERROR`, `SET_VIEW`, `SET_EXPORTING` | **UNVERÄNDERT** — global |
| `RESET` | **UNVERÄNDERT** |

### State-Zugriffsmuster: Alt → Neu

```typescript
// ALT:
const { state } = useAppState();
const redactions = state.redactions;
const fileData = state.fileData;
const currentPage = state.currentPage;

// NEU:
const { state } = useAppState();
const activeDoc = useActiveDocument();  // ← neuer Hook
const redactions = activeDoc?.redactions ?? [];
const fileData = activeDoc?.fileData ?? null;
const currentPage = activeDoc?.currentPage ?? 1;
```

### Dispatch-Muster: Alt → Neu

```typescript
// ALT:
dispatch({ type: 'ACCEPT_SUGGESTION', id: 'abc' });
dispatch({ type: 'SET_PAGE', page: 3 });

// NEU:
const activeId = state.activeDocumentId;
if (!activeId) return; // Guard: kein aktives Dokument
dispatch({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: activeId, id: 'abc' });
dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: 3 });
```

---

## Schritt 1 — Tests schreiben (TDD)

### 1a. Reducer-Tests

Datei: **`src/renderer/store/__tests__/batch-state.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState, createDocumentState } from '../types-and-reducer';
import { RedactionEntry, PIICategory } from '../../../common/types';

function makeDoc(id: string, fileName = `${id}.pdf`) {
  return createDocumentState({
    id, filePath: `/path/${fileName}`, fileName,
    fileData: new Uint8Array([1, 2, 3]),
    pageCount: 5,
  });
}

function makeEntry(id: string, content = 'test', category: PIICategory = 'Name'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: content,
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status: 'vorschlag', groupNumber: 1, source: 'regex',
  };
}

// ── ADD_DOCUMENT / REMOVE_DOCUMENT / SET_ACTIVE ────────────

describe('Batch State — Dokument-Management', () => {
  it('ADD_DOCUMENT: erstes Dokument wird aktiv, view = editor', () => {
    const state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    expect(state.documents).toHaveLength(1);
    expect(state.activeDocumentId).toBe('d1');
    expect(state.view).toBe('editor');
  });

  it('ADD_DOCUMENT: zweites Dokument — erstes bleibt aktiv', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    expect(state.documents).toHaveLength(2);
    expect(state.activeDocumentId).toBe('d1');
  });

  it('REMOVE_DOCUMENT: aktives Dokument → nächstes wird aktiv', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.activeDocumentId).toBe('d2');
  });

  it('REMOVE_DOCUMENT: letztes Dokument → view = start', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.view).toBe('start');
    expect(state.activeDocumentId).toBeNull();
  });

  it('SET_ACTIVE_DOCUMENT: non-existenten ID → activeId bleibt', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    const prev = state.activeDocumentId;
    state = reducer(state, { type: 'SET_ACTIVE_DOCUMENT', id: 'non-existent' });
    // Verhalten: wir setzen nicht auf null — bleibt bei altem aktiven
    expect(state.documents.some(d => d.id === state.activeDocumentId)).toBe(true);
  });
});

// ── Per-Dokument Redactions ──────────────────────────────────

describe('Batch State — Dokument-Redactions isoliert', () => {
  it('SET_DOCUMENT_REDACTIONS: nur Zieldokument betroffen', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });

    state = reducer(state, {
      type: 'SET_DOCUMENT_REDACTIONS', docId: 'd1',
      redactions: [makeEntry('r1')],
    });

    expect(state.documents.find(d => d.id === 'd1')!.redactions).toHaveLength(1);
    expect(state.documents.find(d => d.id === 'd2')!.redactions).toHaveLength(0);
  });

  it('ACCEPT_DOCUMENT_SUGGESTION: Status-Change isoliert', () => {
    const doc = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });

    state = reducer(state, {
      type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: 'd1', id: 'r1',
    });

    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
  });
});

// ── Variable-Registry ────────────────────────────────────────

describe('Batch State — Variable-Registry', () => {
  it('UPDATE_VARIABLE_REGISTRY speichert Zuweisung', () => {
    const key = 'Max Mustermann|Name';
    const state = reducer(initialState, {
      type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Name_1',
    });
    expect(state.variableRegistry[key]).toBe('Name_1');
  });

  it('Mehrfach-Update: letzter Wert gewinnt', () => {
    const key = 'Max|Name';
    let state = reducer(initialState, { type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Name_1' });
    state = reducer(state, { type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Person_A' });
    expect(state.variableRegistry[key]).toBe('Person_A');
  });
});

// ── ACCEPT_ALL_DOCUMENTS ─────────────────────────────────────

describe('Batch State — Cross-Dokument Bulk', () => {
  it('ACCEPT_ALL_DOCUMENTS: akzeptiert alle Vorschläge in allen Docs', () => {
    const d1 = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    const d2 = { ...makeDoc('d2'), redactions: [makeEntry('r2')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    state = reducer(state, { type: 'ACCEPT_ALL_DOCUMENTS' });

    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
    expect(state.documents[1].redactions[0].status).toBe('akzeptiert');
  });

  it('ACCEPT_ALL_DOCUMENTS: bereits akzeptierte bleiben akzeptiert', () => {
    const r = { ...makeEntry('r1'), status: 'akzeptiert' as const };
    const doc = { ...makeDoc('d1'), redactions: [r] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
    state = reducer(state, { type: 'ACCEPT_ALL_DOCUMENTS' });
    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
  });
});

// ── Undo/Redo pro Dokument ──────────────────────────────────

describe('Batch State — Undo pro Dokument', () => {
  it('UNDO in Doc A hat keine Wirkung auf Doc B', () => {
    const d1 = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    const d2 = { ...makeDoc('d2'), redactions: [makeEntry('r2')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    // Undo-Action nur auf d1 pushen
    const prevD1 = [makeEntry('r1')];
    state = reducer(state, {
      type: 'PUSH_UNDO', docId: 'd1',
      action: { type: 't', description: 'x', undo: () => [], redo: () => prevD1 },
    });

    state = reducer(state, { type: 'UNDO', docId: 'd1' });

    expect(state.documents.find(d => d.id === 'd1')!.redactions).toHaveLength(0);
    expect(state.documents.find(d => d.id === 'd2')!.redactions).toHaveLength(1);
  });
});
```

### 1b. Migration-Test (sicherstellen dass alte State-Zugriffe Komponenten nicht brechen)

Datei: **`src/renderer/store/__tests__/legacy-actions-migration.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState, createDocumentState } from '../types-and-reducer';
import type { Action } from '../types-and-reducer';

describe('Migration: keine Legacy-Actions mehr akzeptiert', () => {
  const legacyActionTypes = [
    'SET_FILE', 'ADD_REDACTION', 'UPDATE_REDACTION', 'REMOVE_REDACTION',
    'SET_REDACTIONS', 'SET_PAGE', 'ACCEPT_SUGGESTION', 'REJECT_SUGGESTION',
    'CLEAR_PAGE_REDACTIONS', 'SET_HAS_ANALYZED', 'INCREMENT_MANUAL_COUNTER',
    'SET_ANALYZING', 'SET_ANALYSIS_PROGRESS', 'SET_ANALYSIS_TYPES',
  ];

  it.each(legacyActionTypes)('Legacy-Action %s wird nicht mehr verarbeitet', (type) => {
    // Diese Actions existieren nicht mehr in der Union.
    // Der Test verifiziert dass der Reducer in default-case fällt (State unverändert).
    const result = reducer(initialState, { type, foo: 'bar' } as unknown as Action);
    expect(result).toBe(initialState);  // Referenz-Identität → default case
  });
});
```

---

## Schritt 2 — Implementation

Siehe die umfassende Implementation in der Original-Spec 07, Abschnitte 2a–2c (State, Actions, Reducer, Helpers).

**WICHTIG für 07A:** Alle Komponenten, die bisher direkt auf `state.filePath`, `state.fileData` etc. zugegriffen haben, werden auf `useActiveDocument()` umgestellt.

**Kurzformel für jede Komponente:**

```typescript
// Oben in jeder Komponente:
const { state, dispatch, ... } = useAppState();
const activeDoc = useActiveDocument();

// Dann überall:
state.fileData → activeDoc?.fileData
state.filePath → activeDoc?.filePath
state.fileName → activeDoc?.fileName
state.redactions → activeDoc?.redactions ?? []
state.currentPage → activeDoc?.currentPage ?? 1
state.pageCount → activeDoc?.pageCount ?? 0
state.hasAnalyzed → activeDoc?.hasAnalyzed ?? false
state.isAnalyzing → activeDoc?.isAnalyzing ?? false
state.analysisProgress → activeDoc?.analysisProgress ?? ''
state.analysisTypes → activeDoc?.analysisTypes ?? []
state.manualCounter → activeDoc?.manualCounter ?? 0
state.undoStack → activeDoc?.undoStack ?? []
state.redoStack → activeDoc?.redoStack ?? []

// Unverändert (global):
state.mode / state.exportQuality / state.zoom
state.selectedRedactionId / state.hoveredRedactionId
state.isExporting / state.exportProgress
state.view / state.error
```

**Kurzformel für Dispatch:**

```typescript
// Jeder Dispatch der ein Redaction-betreffendes Update macht → docId hinzufügen
const activeId = state.activeDocumentId;
if (!activeId) return;

dispatch({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: activeId, id: 'abc' });
dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: 3 });
```

---

## Definition of Done (07A)

- [ ] `DocumentState` Interface in `types-and-reducer.ts`
- [ ] `createDocumentState()` Factory-Funktion
- [ ] `AppState` refaktoriert (documents[], activeDocumentId, variableRegistry, groupRegistry)
- [ ] 30+ neue Actions in Action-Union (siehe Migration-Guide Tabelle)
- [ ] Alte Actions entfernt (`SET_FILE`, `SET_PAGE`, `ACCEPT_SUGGESTION`, etc.)
- [ ] `useActiveDocument()` Hook exportiert aus `app-store.tsx`
- [ ] `addManualRedaction()` + `updateRedactionVariable()` arbeiten auf aktivem Dokument
- [ ] Alle Komponenten (Toolbar, PdfViewer, RedactionTable, SidebarThumbnails) lesen aus `useActiveDocument()`
- [ ] Alle Dispatch-Calls nutzen `*_DOCUMENT_*`-Varianten mit `docId`
- [ ] `file-handler.ts` dispatcht `ADD_DOCUMENT` statt `SET_FILE`
- [ ] Alle Batch-State-Tests grün (10+)
- [ ] Migration-Tests grün (Legacy-Actions fallen in default-case)
- [ ] Existierende Feature-Tests aus Specs 01-06 alle grün (keine Regressionen)
- [ ] `npx tsc --noEmit` fehlerfrei
- [ ] **Manuell:** App startet, einzelnes PDF öffnen funktioniert genauso wie vorher
- [ ] **Manuell:** Alle Features aus Specs 01-06 funktionieren noch (Analyse, Export, Undo, Shortcuts, Gruppenzuweisung, Vorschau)
- [ ] Universal-Checks aus `SPEC_CONVENTIONS.md §9` erfüllt

---

## Rollback-Strategie

Dies ist die invasivste Änderung. Falls Regressionen in Specs 01-06:

```bash
# Sofort zurück auf pre-07A Commit
git reset --hard <commit-vor-07A>
```

**Anti-Pattern:** NICHT versuchen, fehlgeschlagene Tests durch partielle Reverts zu reparieren — der State-Rewrite ist atomar.

---

## 07B kommt danach

Nachdem 07A abgeschlossen und alle Tests grün sind, startet Spec `07B_BATCH_UI.md`:
- Tab-UI mit `TabBar.tsx`
- Mehrere Dateien gleichzeitig öffnen (`multiSelections`)
- Kombinierter CSV-Export mit `dokument`-Spalte
- Export-Auswahl-Dialog (einzelnes Doc vs. alle)
- Variable-Konsistenz-Sync zwischen Dokumenten
