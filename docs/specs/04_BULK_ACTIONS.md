# Spec 04 — Bulk-Aktionen

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Spec `01_PII_CATEGORIES.md` abgeschlossen (neue Kategorien im Dropdown).  
> **Komplexität:** Mittel (~3–4h)

---

## Files to READ before starting

- `src/renderer/store/types-and-reducer.ts` (komplette Datei)
- `src/renderer/components/RedactionTable.tsx` (komplette Datei)
- `src/common/types.ts` (für `PIICategory`, `RedactionStatus`)
- `docs/specs/SPEC_CONVENTIONS.md` (§6 React-Patterns, §10 Integrationstest)

## Files to MODIFY (EXAKTE Liste)

- `src/renderer/store/types-and-reducer.ts` — Actions + Reducer-Cases
- `src/renderer/components/RedactionTable.tsx` — UI-Erweiterungen

## Files to CREATE

- `src/renderer/store/__tests__/bulk-actions.test.ts`
- `src/renderer/components/__tests__/redaction-table-bulk.test.tsx`

---

## Ziel

Massenoperationen auf Schwärzungen: Akzeptieren/Ablehnen pro Kategorie, Mehrfachauswahl mit Checkboxen und Aktionsleiste.

---

## Zu ändernde Dateien

| Datei | Änderung |
|-------|----------|
| `src/renderer/store/types-and-reducer.ts` | 6 neue Actions + Reducer-Cases |
| `src/renderer/components/RedactionTable.tsx` | Kategorie-Bulk-Buttons + Checkboxen + Aktionsleiste |

---

## Bestehender Code — vollständig einbetten

### types-and-reducer.ts — Actions-Union (Zeile 78–105)

```typescript
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

### RedactionTable.tsx — bestehende Bulk-Handler (Zeile 101–115)

```typescript
const handleAcceptOpen = useCallback(() => {
  state.redactions
    .filter(r => r.status === 'vorschlag')
    .forEach(r => dispatch({ type: 'ACCEPT_SUGGESTION', id: r.id }));
}, [state.redactions, dispatch]);

const handleRejectOpen = useCallback(() => {
  state.redactions
    .filter(r => r.status === 'vorschlag')
    .forEach(r => dispatch({ type: 'REJECT_SUGGESTION', id: r.id }));
}, [state.redactions, dispatch]);
```

### RedactionTable.tsx — Filter-Chips (Zeile 139–149)

```typescript
<div className="table-filters">
  {(['alle', 'vorschlag', 'akzeptiert', 'manuell', 'abgelehnt'] as FilterStatus[]).map(status => (
    <button
      key={status}
      className={`filter-chip ${filter === status ? 'active' : ''}`}
      onClick={() => setFilter(status)}
    >
      {status === 'alle' ? 'Alle' : STATUS_LABELS[status as RedactionStatus]} ({counts[status] || 0})
    </button>
  ))}
</div>
```

---

## Schritt 1 — Tests schreiben (TDD)

### 1a. Reducer-Tests

Datei erstellen: **`src/renderer/store/__tests__/bulk-actions.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../types-and-reducer';
import { RedactionEntry, PIICategory } from '../../../common/types';
import { v4 as uuidv4 } from 'uuid';

function makeEntry(id: string, category: PIICategory, status: any = 'vorschlag'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: 'test',
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status, groupNumber: 1, source: 'regex',
  };
}

describe('Reducer — Bulk-Aktionen', () => {
  // ── ACCEPT_BY_CATEGORY ────────────────────────────────────

  describe('ACCEPT_BY_CATEGORY', () => {
    it('akzeptiert alle Vorschläge der Kategorie', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'IBAN', 'vorschlag'),
          makeEntry('2', 'IBAN', 'vorschlag'),
          makeEntry('3', 'E-Mail', 'vorschlag'),
        ],
      };
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', category: 'IBAN' });
      expect(result.redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
      expect(result.redactions.find(r => r.id === '2')?.status).toBe('akzeptiert');
      expect(result.redactions.find(r => r.id === '3')?.status).toBe('vorschlag'); // unberührt
    });

    it('ignoriert bereits akzeptierte Einträge', () => {
      const state = {
        ...initialState,
        redactions: [makeEntry('1', 'IBAN', 'akzeptiert')],
      };
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', category: 'IBAN' });
      expect(result.redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
    });

    it('ändert nichts wenn keine Vorschläge der Kategorie vorhanden', () => {
      const state = {
        ...initialState,
        redactions: [makeEntry('1', 'E-Mail', 'vorschlag')],
      };
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', category: 'IBAN' });
      expect(result.redactions).toEqual(state.redactions);
    });
  });

  // ── REJECT_BY_CATEGORY ────────────────────────────────────

  describe('REJECT_BY_CATEGORY', () => {
    it('lehnt alle Vorschläge der Kategorie ab', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'Name', 'vorschlag'),
          makeEntry('2', 'Name', 'vorschlag'),
          makeEntry('3', 'IBAN', 'vorschlag'),
        ],
      };
      const result = reducer(state, { type: 'REJECT_BY_CATEGORY', category: 'Name' });
      expect(result.redactions.find(r => r.id === '1')?.status).toBe('abgelehnt');
      expect(result.redactions.find(r => r.id === '2')?.status).toBe('abgelehnt');
      expect(result.redactions.find(r => r.id === '3')?.status).toBe('vorschlag');
    });
  });

  // ── REMOVE_BY_CATEGORY ────────────────────────────────────

  describe('REMOVE_BY_CATEGORY', () => {
    it('entfernt ALLE Einträge der Kategorie unabhängig vom Status', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'IBAN', 'akzeptiert'),
          makeEntry('2', 'IBAN', 'manuell'),
          makeEntry('3', 'E-Mail', 'vorschlag'),
        ],
      };
      const result = reducer(state, { type: 'REMOVE_BY_CATEGORY', category: 'IBAN' });
      expect(result.redactions.length).toBe(1);
      expect(result.redactions[0].id).toBe('3');
    });
  });

  // ── ACCEPT_SELECTION ──────────────────────────────────────

  describe('ACCEPT_SELECTION', () => {
    it('akzeptiert nur die übergebenen IDs', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'IBAN', 'vorschlag'),
          makeEntry('2', 'E-Mail', 'vorschlag'),
          makeEntry('3', 'Name', 'vorschlag'),
        ],
      };
      const result = reducer(state, { type: 'ACCEPT_SELECTION', ids: ['1', '3'] });
      expect(result.redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
      expect(result.redactions.find(r => r.id === '2')?.status).toBe('vorschlag'); // unberührt
      expect(result.redactions.find(r => r.id === '3')?.status).toBe('akzeptiert');
    });
  });

  // ── REJECT_SELECTION ─────────────────────────────────────

  describe('REJECT_SELECTION', () => {
    it('lehnt nur die übergebenen IDs ab', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'IBAN', 'vorschlag'),
          makeEntry('2', 'E-Mail', 'vorschlag'),
        ],
      };
      const result = reducer(state, { type: 'REJECT_SELECTION', ids: ['2'] });
      expect(result.redactions.find(r => r.id === '1')?.status).toBe('vorschlag');
      expect(result.redactions.find(r => r.id === '2')?.status).toBe('abgelehnt');
    });
  });

  // ── REMOVE_SELECTION ─────────────────────────────────────

  describe('REMOVE_SELECTION', () => {
    it('entfernt genau die übergebenen IDs', () => {
      const state = {
        ...initialState,
        redactions: [
          makeEntry('1', 'IBAN', 'manuell'),
          makeEntry('2', 'E-Mail', 'akzeptiert'),
          makeEntry('3', 'Name', 'manuell'),
        ],
      };
      const result = reducer(state, { type: 'REMOVE_SELECTION', ids: ['1', '3'] });
      expect(result.redactions.length).toBe(1);
      expect(result.redactions[0].id).toBe('2');
    });

    it('löscht selectedRedactionId wenn enthalten', () => {
      const state = {
        ...initialState,
        selectedRedactionId: '1',
        redactions: [makeEntry('1', 'IBAN', 'manuell')],
      };
      const result = reducer(state, { type: 'REMOVE_SELECTION', ids: ['1'] });
      expect(result.selectedRedactionId).toBeNull();
    });
  });
});
```

### 1b. Komponenten-Tests

Datei erstellen: **`src/renderer/components/__tests__/redaction-table-bulk.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Wir testen die Kategorie-Bulk-Buttons via gemockte Dispatch
// (vollständige Komponente benötigt AppProvider — vereinfachter Test hier)

import { getCategoryBulkActions } from '../RedactionTable';
import { RedactionEntry, PIICategory } from '../../../common/types';

function makeEntry(id: string, category: PIICategory, status: any = 'vorschlag'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: 'test',
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status, groupNumber: 1, source: 'regex',
  };
}

describe('getCategoryBulkActions', () => {
  it('gibt Vorschlag-Anzahl pro Kategorie zurück', () => {
    const redactions = [
      makeEntry('1', 'IBAN', 'vorschlag'),
      makeEntry('2', 'IBAN', 'vorschlag'),
      makeEntry('3', 'E-Mail', 'akzeptiert'),
    ];
    const result = getCategoryBulkActions(redactions);
    expect(result.get('IBAN')?.vorschlagCount).toBe(2);
    expect(result.get('E-Mail')?.vorschlagCount).toBe(0);
  });

  it('enthält alle Kategorien die in redactions vorkommen', () => {
    const redactions = [
      makeEntry('1', 'IBAN', 'vorschlag'),
      makeEntry('2', 'Name', 'akzeptiert'),
    ];
    const result = getCategoryBulkActions(redactions);
    expect(result.has('IBAN')).toBe(true);
    expect(result.has('Name')).toBe(true);
  });
});
```

---

## Schritt 2 — Implementation

### 2a. Neue Actions in `types-and-reducer.ts` hinzufügen

**In der `Action`-Union** (nach `REJECT_SUGGESTION`) folgende Zeilen einfügen:

```typescript
  | { type: 'ACCEPT_BY_CATEGORY'; category: PIICategory }
  | { type: 'REJECT_BY_CATEGORY'; category: PIICategory }
  | { type: 'REMOVE_BY_CATEGORY'; category: PIICategory }
  | { type: 'ACCEPT_SELECTION'; ids: string[] }
  | { type: 'REJECT_SELECTION'; ids: string[] }
  | { type: 'REMOVE_SELECTION'; ids: string[] }
```

### 2b. Reducer-Cases hinzufügen

**Im `reducer()`**, nach dem `REJECT_SUGGESTION`-Case und vor `SELECT_REDACTION`:

```typescript
    case 'ACCEPT_BY_CATEGORY':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          r.category === action.category && r.status === 'vorschlag'
            ? { ...r, status: 'akzeptiert' as RedactionStatus }
            : r
        ),
      };

    case 'REJECT_BY_CATEGORY':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          r.category === action.category && r.status === 'vorschlag'
            ? { ...r, status: 'abgelehnt' as RedactionStatus }
            : r
        ),
      };

    case 'REMOVE_BY_CATEGORY':
      return {
        ...state,
        redactions: state.redactions.filter(r => r.category !== action.category),
        selectedRedactionId: state.redactions.find(
          r => r.id === state.selectedRedactionId && r.category === action.category
        ) ? null : state.selectedRedactionId,
      };

    case 'ACCEPT_SELECTION':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          action.ids.includes(r.id) && r.status === 'vorschlag'
            ? { ...r, status: 'akzeptiert' as RedactionStatus }
            : r
        ),
      };

    case 'REJECT_SELECTION':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          action.ids.includes(r.id) && r.status === 'vorschlag'
            ? { ...r, status: 'abgelehnt' as RedactionStatus }
            : r
        ),
      };

    case 'REMOVE_SELECTION':
      return {
        ...state,
        redactions: state.redactions.filter(r => !action.ids.includes(r.id)),
        selectedRedactionId: action.ids.includes(state.selectedRedactionId ?? '')
          ? null
          : state.selectedRedactionId,
      };
```

### 2c. `RedactionTable.tsx` erweitern

#### Neue exportierte Hilfsfunktion (für Tests)

**Am Anfang der Datei** (nach den Imports, vor der Komponente):

```typescript
/** Gibt für jede Kategorie die Anzahl der Vorschläge zurück. */
export function getCategoryBulkActions(
  redactions: RedactionEntry[]
): Map<PIICategory, { vorschlagCount: number }> {
  const map = new Map<PIICategory, { vorschlagCount: number }>();
  for (const r of redactions) {
    if (!map.has(r.category)) {
      map.set(r.category, { vorschlagCount: 0 });
    }
    if (r.status === 'vorschlag') {
      map.get(r.category)!.vorschlagCount++;
    }
  }
  return map;
}
```

#### Neuer State in der Komponente

Nach `const [editingId, setEditingId] = useState<string | null>(null);`:

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
```

**Reset bei Filteränderung:**
```typescript
const handleFilterChange = useCallback((newFilter: FilterStatus) => {
  setFilter(newFilter);
  setSelectedIds(new Set());
  setLastClickedIdx(null);
}, []);
```

**WICHTIG — Filter-Chips-Wiring anpassen:**

Die bestehenden Filter-Chips rufen `setFilter(status)` direkt auf. Das MUSS auf `handleFilterChange(status)` umgestellt werden, sonst funktioniert der Selection-Reset nicht.

```tsx
// ALT:
<button
  className={`filter-chip ${filter === status ? 'active' : ''}`}
  onClick={() => setFilter(status)}   // ← direkt
>

// NEU:
<button
  className={`filter-chip ${filter === status ? 'active' : ''}`}
  onClick={() => handleFilterChange(status)}   // ← durch Wrapper
>
```

#### Checkbox-Interaktion

**KRITISCH:** `sortedEntries.indexOf(entry)` ist O(n²) und unreliable (siehe `SPEC_CONVENTIONS.md §6`). Der Index MUSS aus der `.map((entry, idx) => ...)` Schleife kommen — siehe Render-Block unten.

Neue Handler nach `handleClearPage`:

```typescript
// Shift+Click-Detection via onMouseDown (stabiler als onChange→nativeEvent)
const shiftPressedRef = useRef(false);

const handleRowMouseDown = useCallback((e: React.MouseEvent) => {
  shiftPressedRef.current = e.shiftKey;
}, []);

const handleCheckboxChange = useCallback((
  _e: React.ChangeEvent<HTMLInputElement>,
  id: string,
  idx: number
) => {
  if (shiftPressedRef.current && lastClickedIdx !== null) {
    // Shift+Click: Bereich auswählen
    const from = Math.min(lastClickedIdx, idx);
    const to = Math.max(lastClickedIdx, idx);
    const rangeIds = sortedEntries.slice(from, to + 1).map(r => r.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      rangeIds.forEach(rid => next.add(rid));
      return next;
    });
  } else {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  setLastClickedIdx(idx);
  shiftPressedRef.current = false;
}, [lastClickedIdx, sortedEntries]);

const handleSelectAll = useCallback((checked: boolean) => {
  if (checked) setSelectedIds(new Set(sortedEntries.map(r => r.id)));
  else setSelectedIds(new Set());
}, [sortedEntries]);

const handleBulkAcceptSelection = useCallback(() => {
  dispatch({ type: 'ACCEPT_SELECTION', ids: [...selectedIds] });
  setSelectedIds(new Set());
}, [selectedIds, dispatch]);

const handleBulkRejectSelection = useCallback(() => {
  dispatch({ type: 'REJECT_SELECTION', ids: [...selectedIds] });
  setSelectedIds(new Set());
}, [selectedIds, dispatch]);

const handleBulkRemoveSelection = useCallback(() => {
  dispatch({ type: 'REMOVE_SELECTION', ids: [...selectedIds] });
  setSelectedIds(new Set());
}, [selectedIds, dispatch]);
```

#### UI-Änderungen

**1. Filter-Chips** — nach den bestehenden Chips: wenn Filter auf eine konkrete Kategorie gesetzt ist (nicht 'alle', nicht Statusfilter), Bulk-Buttons hinzufügen.

Da der aktuelle Filter Status-basiert ist, fügen wir **Kategorie-Bulk-Buttons** als eigene Sektion nach den Bulk-Vorschlag-Buttons ein:

```tsx
{/* Kategorie-Bulk-Aktionen — zeige immer wenn Vorschläge vorhanden */}
{counts.vorschlag > 0 && (
  <details style={{ padding: 'var(--space-sm) var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
    <summary style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
      Bulk nach Kategorie…
    </summary>
    <div style={{ marginTop: 'var(--space-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
      {Array.from(getCategoryBulkActions(state.redactions).entries())
        .filter(([, v]) => v.vorschlagCount > 0)
        .map(([cat, v]) => (
          <div key={cat} style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}>{cat} ({v.vorschlagCount})</span>
            <button className="btn btn-success btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
              onClick={() => dispatch({ type: 'ACCEPT_BY_CATEGORY', category: cat })}>
              ✓
            </button>
            <button className="btn btn-danger btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
              onClick={() => dispatch({ type: 'REJECT_BY_CATEGORY', category: cat })}>
              ✕
            </button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
              onClick={() => dispatch({ type: 'REMOVE_BY_CATEGORY', category: cat })}
              title="Alle dieser Kategorie entfernen">
              🗑
            </button>
          </div>
        ))}
    </div>
  </details>
)}
```

**2. Checkboxen in Zeilen** — `idx` MUSS aus `.map((entry, idx) => ...)` kommen (O(n) statt O(n²)):

```tsx
{sortedEntries.map((entry, idx) => (
  <div
    key={entry.id}
    className={`table-entry ...`}
    onMouseDown={handleRowMouseDown}
    // bestehende Attribute behalten
  >
    {/* NEU: Checkbox mit idx aus map() */}
    <input
      type="checkbox"
      className="entry-checkbox"
      checked={selectedIds.has(entry.id)}
      onChange={e => handleCheckboxChange(e, entry.id, idx)}   // ← idx statt indexOf
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}  // verhindert row-mousedown
      style={{ marginRight: 'var(--space-xs)', flexShrink: 0 }}
    />
    {/* Rest der Zeile unverändert */}
  </div>
))}
```

**3. Alle-auswählen Checkbox** im Header:

```tsx
<div className="table-header">
  <input
    type="checkbox"
    checked={sortedEntries.length > 0 && sortedEntries.every(r => selectedIds.has(r.id))}
    onChange={e => handleSelectAll(e.target.checked)}
    title="Alle auswählen"
    style={{ marginRight: 'var(--space-xs)' }}
  />
  <span className="table-header-title">Markierungen</span>
  <span className="table-header-count">{counts.alle} Einträge</span>
</div>
```

**4. Fixierte Aktionsleiste** — am Ende des `redaction-table-panel`, nach `.table-entries`:

```tsx
{selectedIds.size > 0 && (
  <div className="bulk-action-bar" style={{
    position: 'sticky', bottom: 0,
    background: 'var(--bg-surface)',
    borderTop: '2px solid var(--brand-primary)',
    padding: 'var(--space-sm) var(--space-lg)',
    display: 'flex', gap: 'var(--space-sm)', alignItems: 'center',
  }}>
    <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
      {selectedIds.size} ausgewählt
    </span>
    <button className="btn btn-success btn-sm" onClick={handleBulkAcceptSelection}>
      ✓ Akzeptieren
    </button>
    <button className="btn btn-danger btn-sm" onClick={handleBulkRejectSelection}>
      ✕ Ablehnen
    </button>
    <button className="btn btn-ghost btn-sm" onClick={handleBulkRemoveSelection}
      style={{ color: 'var(--accent-danger)' }}>
      🗑 Löschen
    </button>
    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
      ✕
    </button>
  </div>
)}
```

---

## Schritt 3 — Tests ausführen

```bash
npx vitest run src/renderer/store/__tests__/bulk-actions.test.ts --reporter=verbose
npx vitest run src/renderer/components/__tests__/redaction-table-bulk.test.tsx --reporter=verbose
npx tsc --noEmit
```

---

## Definition of Done

- [ ] 6 neue Action-Typen in `Action`-Union
- [ ] 6 neue Reducer-Cases korrekt implementiert
- [ ] `getCategoryBulkActions()` als named export aus `RedactionTable.tsx`
- [ ] Alle 13 Reducer-Tests grün
- [ ] Checkboxen erscheinen in jeder Zeile
- [ ] Shift+Klick wählt Bereich aus
- [ ] Aktionsleiste erscheint sobald ≥1 Checkbox aktiv
- [ ] Aktionsleiste verschwindet nach Bulk-Aktion
- [ ] Kategorie-Bulk-Sektion zeigt nur Kategorien mit Vorschlägen
- [ ] `npx tsc --noEmit` fehlerfrei

---

## Integrationstest (Pflicht laut SPEC_CONVENTIONS §10)

Füge in `bulk-actions.test.ts` hinzu:

```typescript
describe('Integration: Kompletter Bulk-Workflow', () => {
  it('User-Flow: alle IBAN akzeptieren, dann 2 ausgewählte löschen', () => {
    let state = {
      ...initialState,
      redactions: [
        makeEntry('1', 'IBAN', 'vorschlag'),
        makeEntry('2', 'IBAN', 'vorschlag'),
        makeEntry('3', 'Name', 'vorschlag'),
        makeEntry('4', 'Name', 'vorschlag'),
      ],
    };

    // Schritt 1: alle IBAN akzeptieren
    state = reducer(state, { type: 'ACCEPT_BY_CATEGORY', category: 'IBAN' });
    expect(state.redactions.filter(r => r.status === 'akzeptiert')).toHaveLength(2);

    // Schritt 2: 2 Namen ausgewählt löschen (auch Vorschläge)
    state = reducer(state, { type: 'REMOVE_SELECTION', ids: ['3', '4'] });
    expect(state.redactions).toHaveLength(2);
    expect(state.redactions.every(r => r.category === 'IBAN')).toBe(true);

    // Schritt 3: Rest ablehnen via SELECTION (sind bereits akzeptiert → keine Änderung)
    state = reducer(state, { type: 'REJECT_SELECTION', ids: ['1', '2'] });
    expect(state.redactions.filter(r => r.status === 'akzeptiert')).toHaveLength(2);
    // REJECT_SELECTION wirkt nur auf 'vorschlag' → akzeptierte bleiben
  });
});
```

---

## Bekannte Tücken

1. **`sortedEntries.indexOf(entry)` vermeiden:** Nutze `idx` aus `.map((entry, idx) => ...)` — siehe SPEC_CONVENTIONS §6.

2. **Checkboxen vs. Klick-Handler:** `onClick={e => e.stopPropagation()}` UND `onMouseDown={e => e.stopPropagation()}` nötig, damit weder Row-Klick noch Row-MouseDown feuert.

3. **REMOVE_BY_CATEGORY:** Entfernt auch akzeptierte und manuelle Einträge — das ist gewollt (vollständige Bereinigung). Im UI Tooltip hinweisen: „Alle Einträge dieser Kategorie entfernen (unabhängig vom Status)".

4. **Shift+Click-Detection:** Verwende `useRef` + `onMouseDown` statt `e.nativeEvent.shiftKey` im `onChange` — letzteres ist browser-inkonsistent (Firefox vs. Chrome).
