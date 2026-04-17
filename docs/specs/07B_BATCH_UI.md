# Spec 07B — Batch-UI: Tabs, Multi-File-Open, Kombinierter CSV-Export

> **Voraussetzung:** `00_OVERVIEW.md`, `SPEC_CONVENTIONS.md`, `07A_BATCH_STATE_REFACTOR.md` abgeschlossen.  
> **Abhängigkeiten:** 07A (State-Refactor) MUSS komplett fertig und alle Tests grün sein.  
> **Komplexität:** Mittel (~6–8h)

---

## Ziel

Auf dem neuen State aus 07A die eigentlichen User-Features aufbauen:
1. Mehrere PDFs gleichzeitig öffnen
2. Tab-UI zum Wechseln zwischen Dokumenten
3. Variable-Konsistenz über Dokumente hinweg
4. Cross-Dokument Bulk-Aktionen („Alle akzeptieren")
5. Kombinierter CSV-Export mit `dokument`-Spalte
6. Export-Auswahl-Dialog (einzelnes vs. alle Dokumente)

---

## Files to READ before starting

- `docs/specs/07A_BATCH_STATE_REFACTOR.md` (abgeschlossen)
- `src/renderer/store/types-and-reducer.ts` (nach 07A)
- `src/renderer/store/app-store.tsx` (nach 07A)
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/main/services/pdf-export-service.ts`
- `src/common/types.ts`
- `src/renderer/services/file-handler.ts`

## Files to MODIFY

- `src/common/types.ts` — `CSVRow.dokument?`, `IPC_CHANNELS.EXPORT_ALL_PDFS`
- `src/main/main.ts` — `OPEN_FILE_DIALOG` → `multiSelections`, neuer `EXPORT_ALL_PDFS` Handler
- `src/main/preload.ts` — `openFileDialog()` Rückgabetyp → `string[]`
- `src/main/services/pdf-export-service.ts` — `generateCombinedCSV()`
- `src/renderer/components/EditorLayout.tsx` — TabBar einbinden
- `src/renderer/components/Toolbar.tsx` — Export-Auswahl-Dialog
- `src/renderer/components/RedactionTable.tsx` — `ACCEPT_ALL_DOCUMENTS` Button
- `src/renderer/services/file-handler.ts` — Loop über Multi-Paths
- `src/renderer/store/app-store.tsx` — Variable-Registry-Sync in `updateRedactionVariable`

## Files to CREATE

- `src/renderer/components/TabBar.tsx`
- `src/renderer/components/ExportAllDialog.tsx`
- `src/renderer/components/__tests__/tab-bar.test.tsx`
- `src/main/services/__tests__/pdf-export-service.test.ts` (falls nicht vorhanden)

---

## Schritt 1 — Tests schreiben (TDD)

### 1a. TabBar Tests

**`src/renderer/components/__tests__/tab-bar.test.tsx`:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TabBar from '../TabBar';
import { createDocumentState } from '../../store/types-and-reducer';

function makeDoc(id: string, fileName = `${id}.pdf`) {
  return createDocumentState({
    id, filePath: `/path/${fileName}`, fileName,
    fileData: new Uint8Array(), pageCount: 5,
  });
}

describe('TabBar', () => {
  it('rendert nichts wenn documents leer', () => {
    const { container } = render(
      <TabBar documents={[]} activeDocumentId={null}
        onSelectTab={vi.fn()} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('zeigt alle Dokumente als Tabs', () => {
    render(
      <TabBar documents={[makeDoc('d1', 'erstes.pdf'), makeDoc('d2', 'zweites.pdf')]}
        activeDocumentId="d1" onSelectTab={vi.fn()} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    expect(screen.getByText('erstes.pdf')).toBeInTheDocument();
    expect(screen.getByText('zweites.pdf')).toBeInTheDocument();
  });

  it('ruft onSelectTab bei Tab-Klick auf', () => {
    const onSelect = vi.fn();
    render(
      <TabBar documents={[makeDoc('d1', 'a.pdf'), makeDoc('d2', 'b.pdf')]}
        activeDocumentId="d1" onSelectTab={onSelect} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    fireEvent.click(screen.getByText('b.pdf'));
    expect(onSelect).toHaveBeenCalledWith('d2');
  });

  it('Schließen-Button stoppt Event-Propagation', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TabBar documents={[makeDoc('d1', 'a.pdf')]}
        activeDocumentId="d1" onSelectTab={onSelect} onCloseTab={onClose} onOpenFile={vi.fn()} />
    );
    const closeBtn = screen.getAllByTitle('Tab schließen')[0];
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith('d1');
    expect(onSelect).not.toHaveBeenCalled();  // Tab-Select NICHT ausgelöst
  });
});
```

### 1b. CSV-Combined-Export Tests

**`src/main/services/__tests__/pdf-export-service.test.ts`** (neu oder ergänzen):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PdfExportService } from '../pdf-export-service';
import type { CSVRow } from '../../../common/types';

describe('PdfExportService.generateCombinedCSV', () => {
  let svc: PdfExportService;
  beforeEach(() => { svc = new PdfExportService(); });

  function row(bezeichnung: string, inhalt: string, extras: Partial<CSVRow> = {}): CSVRow {
    return { bezeichnung, inhalt, typ: 'Name', gruppe: '1', status: 'akzeptiert', seite: '1', ...extras };
  }

  it('fügt dokument-Spalte zum Header hinzu', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max')] },
    ]);
    expect(csv.split('\n')[0]).toContain('Dokument');
  });

  it('dedupliziert Einträge gleicher Bezeichnung — Dokument-Spalte listet alle', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max')] },
      { fileName: 'b.pdf', rows: [row('Name_1', 'Max')] },
      { fileName: 'c.pdf', rows: [row('Name_1', 'Max')] },
    ]);
    const lines = csv.split('\n').filter(l => l.includes('Name_1'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('a.pdf');
    expect(lines[0]).toContain('b.pdf');
    expect(lines[0]).toContain('c.pdf');
  });

  it('unterschiedliche Bezeichnungen erhalten getrennte Zeilen', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max'), row('IBAN_1', 'DE89')] },
    ]);
    const dataLines = csv.split('\n').slice(1).filter(l => l.trim());
    expect(dataLines).toHaveLength(2);
  });

  it('leere Liste → nur Header', () => {
    const csv = svc.generateCombinedCSV([]);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });

  it('CSV-Injection verhindern: führende =+-@ werden escaped', () => {
    // Extras-Security (empfohlen) — siehe Sektion „CSV-Injection" unten
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', '=SUM(A1:A10)')] },
    ]);
    // Erwartung: Zelle beginnt NICHT mit `=` direkt (zumindest mit Präfix-Quote)
    expect(csv).not.toMatch(/;"=SUM/);
  });
});
```

### 1c. Variable-Konsistenz-Sync Test

**In `batch-state.test.ts` ergänzen:**

```typescript
describe('Batch State — Cross-Dokument Variable-Konsistenz', () => {
  it('Variable-Name in Doc A wird für gleichen Content in Doc B übernommen', () => {
    // Simuliert: User hat in Doc A „Max Mustermann" → Name_1 gesetzt
    // Dann wird Doc B analysiert und findet auch „Max Mustermann"
    // → Doc B soll auch Name_1 zeigen

    const d1 = { ...makeDoc('d1'),
      redactions: [{ ...makeEntry('r1', 'Max Mustermann'), variableName: 'Name_1' }],
    };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });

    // Registry befüllt sich (passiert im app-store-Helper):
    state = reducer(state, {
      type: 'UPDATE_VARIABLE_REGISTRY',
      key: 'Max Mustermann|Name',
      variableName: 'Name_1',
    });

    // Neues Dokument mit gleichem Inhalt
    const d2 = makeDoc('d2');
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    // Simuliert enrichSuggestion-Schritt im Analyse-Flow:
    const rawSuggestion = { ...makeEntry('r2', 'Max Mustermann'), variableName: 'Name_1' };
    const key = `${rawSuggestion.originalContent}|${rawSuggestion.category}`;
    const existingName = state.variableRegistry[key];
    const enriched = existingName ? { ...rawSuggestion, variableName: existingName } : rawSuggestion;

    expect(enriched.variableName).toBe('Name_1');
  });
});
```

---

## Schritt 2 — Implementation

Die vollständige Implementation (Komponenten, Main-Process-Änderungen, CSV-Service) ist in der ursprünglichen Spec 07 dokumentiert. Hier die kritischen Punkte:

### 2a. `TabBar.tsx`

Siehe Original-Spec 07, Abschnitt 2e.

### 2b. `main.ts` — multiSelections

```typescript
// ÄNDERUNG in OPEN_FILE_DIALOG handler:
const result = await dialog.showOpenDialog({
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
  properties: ['openFile', 'multiSelections'],  // ← NEU
  defaultPath: settings.lastOpenDirectory,
});
return result.canceled ? [] : result.filePaths;  // immer string[]
```

### 2c. `preload.ts` — Return-Typ

```typescript
openFileDialog: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_DIALOG) as Promise<string[]>,
```

### 2d. `file-handler.ts` — Loop

```typescript
export async function openPdfFiles(dispatch: React.Dispatch<Action>) {
  const paths = await window.electronAPI.openFileDialog();
  if (paths.length === 0) return;

  for (const path of paths) {
    try {
      const { fileData, fileName, pageCount } = await readAndValidatePdf(path);
      const doc = createDocumentState({
        id: uuidv4(),
        filePath: path,
        fileName,
        fileData,
        pageCount,
      });
      dispatch({ type: 'ADD_DOCUMENT', doc });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: `Fehler beim Öffnen von ${path}` });
    }
  }
}
```

### 2e. `pdf-export-service.ts` — CSV-Injection-Safe

```typescript
/** CSV-Injection-Sicher: führendes =, +, -, @, TAB, CR mit Apostroph prefixen */
function sanitizeCsvCell(value: string): string {
  if (!value) return '';
  const first = value.charAt(0);
  if (['=', '+', '-', '@', '\t', '\r'].includes(first)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvValue(v: string): string {
  const sanitized = sanitizeCsvCell(v);
  return `"${sanitized.replace(/"/g, '""')}"`;
}

generateCombinedCSV(exports: { fileName: string; rows: CSVRow[] }[]): string {
  const header = ['Bezeichnung', 'Inhalt', 'Typ', 'Gruppe', 'Status', 'Seite', 'Dokument']
    .map(escapeCsvValue).join(';');

  const merged = new Map<string, CSVRow & { dokumente: Set<string> }>();
  for (const { fileName, rows } of exports) {
    for (const row of rows) {
      const existing = merged.get(row.bezeichnung);
      if (existing) existing.dokumente.add(fileName);
      else merged.set(row.bezeichnung, { ...row, dokumente: new Set([fileName]) });
    }
  }

  const lines = Array.from(merged.values()).map(row =>
    [row.bezeichnung, row.inhalt, row.typ, row.gruppe, row.status, row.seite,
     [...row.dokumente].join(', ')]
    .map(escapeCsvValue).join(';')
  );

  return [header, ...lines].join('\n');
}
```

### 2f. Variable-Registry Sync in `app-store.tsx`

**Wichtig:** Die Sync-Logik läuft AUSSERHALB des Reducers (als Helper, der mehrere Dispatches orchestriert):

```typescript
const updateRedactionVariable = useCallback((docId: string, id: string, newName: string): boolean => {
  const doc = state.documents.find(d => d.id === docId);
  const entry = doc?.redactions.find(r => r.id === id);
  if (!entry) return false;

  // Konflikt-Check im Ziel-Dokument
  const conflict = doc!.redactions.find(r =>
    r.id !== id && r.variableName === newName && r.originalContent !== entry.originalContent
  );
  if (conflict) {
    dispatch({ type: 'SET_ERROR', error: `Konflikt: „${newName}" wird bereits für „${conflict.originalContent}" verwendet.` });
    return false;
  }

  const key = `${entry.originalContent}|${entry.category}`;

  // 1. Registry-Eintrag updaten
  dispatch({ type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: newName });

  // 2. In ALLEN Dokumenten synchronisieren
  for (const d of state.documents) {
    for (const r of d.redactions) {
      if (r.originalContent === entry.originalContent && r.category === entry.category) {
        dispatch({
          type: 'UPDATE_DOCUMENT_REDACTION',
          docId: d.id, id: r.id,
          updates: { variableName: newName },
        });
      }
    }
  }

  return true;
}, [state.documents, dispatch]);
```

---

## Definition of Done (07B)

- [ ] `TabBar.tsx` erstellt und eingebunden
- [ ] TabBar-Tests grün (4+)
- [ ] `main.ts` akzeptiert `multiSelections`
- [ ] `preload.ts` Return-Typ `string[]`
- [ ] `file-handler.ts` loop über Multi-Paths
- [ ] `generateCombinedCSV()` implementiert + CSV-Injection-safe
- [ ] 5+ CSV-Tests grün
- [ ] `updateRedactionVariable` synchronisiert Registry über Dokumente
- [ ] Cross-Dokument-Konsistenz-Test grün
- [ ] `EXPORT_ALL_PDFS` IPC-Channel funktional
- [ ] Export-Auswahl-Dialog bei mehreren Dokumenten
- [ ] `ExportAllDialog.tsx` oder Integration in `handleExport`
- [ ] **Manuell:** 3 PDFs öffnen → 3 Tabs
- [ ] **Manuell:** Tab-Wechsel funktioniert, Undo ist Tab-spezifisch
- [ ] **Manuell:** Gleicher Name in Doc A/B → gleiche Variable
- [ ] **Manuell:** Kombinierter Export erzeugt 1 CSV + N PDFs
- [ ] **Manuell:** CSV-Datei öffnet ohne Formel-Ausführung in Excel (Injection-Check)
- [ ] Universal-Checks aus `SPEC_CONVENTIONS.md §9` erfüllt
