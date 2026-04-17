# Spec 05 — Gruppenzuweisung über Markierung

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Spec `04_BULK_ACTIONS.md` abgeschlossen.  
> **Komplexität:** Mittel (~4–5h)

---

## Files to READ before starting

- `src/renderer/components/PdfViewer.tsx` (komplette Datei — kritisch für Mouse-Handler!)
- `src/renderer/components/Toolbar.tsx`
- `src/renderer/components/EditorLayout.tsx`
- `src/renderer/store/types-and-reducer.ts`
- `src/renderer/store/app-store.tsx` (für Undo-Pattern)
- `docs/specs/SPEC_CONVENTIONS.md` (§8 Global-Handler-Priorisierung ← KRITISCH)

## Files to MODIFY (EXAKTE Liste)

- `src/renderer/store/types-and-reducer.ts`
- `src/renderer/components/PdfViewer.tsx`
- `src/renderer/components/Toolbar.tsx`
- `src/renderer/components/EditorLayout.tsx`
- `src/renderer/styles/global.css` (CSS für `.group-select`)

## Files to CREATE

- `src/renderer/components/GroupAssignPopup.tsx`
- `src/renderer/components/__tests__/group-assign.test.tsx`

---

## Ziel

User kann einen Bereich im PDF aufziehen, und alle darin enthaltenen Schwärzungen werden auf einmal einer Gruppe zugewiesen. Primärer Anwendungsfall: Empfängeradresse mit einem Zug der Gruppe „Empfänger" zuordnen.

---

## Neue Dateien

| Datei | Typ |
|-------|-----|
| `src/renderer/components/GroupAssignPopup.tsx` | Neu |
| `src/renderer/components/__tests__/group-assign.test.tsx` | Neu (Tests) |

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/renderer/store/types-and-reducer.ts` | 1 neue Action `ASSIGN_GROUP_TO_IDS` |
| `src/renderer/components/PdfViewer.tsx` | `drawMode`-Prop + Gruppenauswahl-Modus |
| `src/renderer/components/Toolbar.tsx` | „Gruppe zuweisen"-Button |
| `src/renderer/components/EditorLayout.tsx` | `drawMode`-State + Weitergabe |

---

## Bestehender Code — vollständig einbetten

### PdfViewer.tsx — komplette Interface-Definitionen (Zeile 1–48)

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppState } from '../store/app-store';
import { BoundingBox, RedactionEntry } from '../../common/types';
import { getPdfjs } from '../services/pdf-init';

interface DrawState {
  isDrawing: boolean; startX: number; startY: number;
  currentX: number; currentY: number;
}

interface DragState {
  isDragging: boolean; redactionId: string; offsetX: number; offsetY: number;
}

interface ResizeState {
  isResizing: boolean; redactionId: string;
  handle: 'nw' | 'ne' | 'sw' | 'se';
  startX: number; startY: number; originalBounds: BoundingBox;
}

export default function PdfViewer() {
  // ... keine Props aktuell
```

### PdfViewer.tsx — handleMouseUp (Zeile 187–217)

```typescript
const handleMouseUp = useCallback(() => {
  if (drawState.isDrawing) {
    const minX = Math.min(drawState.startX, drawState.currentX);
    const minY = Math.min(drawState.startY, drawState.currentY);
    const w = Math.abs(drawState.currentX - drawState.startX);
    const h = Math.abs(drawState.currentY - drawState.startY);

    if (w > 5 && h > 5) {
      const pdfBounds = {
        x: minX / scale,
        y: minY / scale,
        width: w / scale,
        height: h / scale,
      };
      addManualRedaction(pdfBounds, state.currentPage);  // ← wird durch drawMode bedingt
    }

    setDrawState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  }
  // ... drag/resize handling
}, [drawState, dragState, resizeState, scale, state.currentPage, addManualRedaction]);
```

### PdfViewer.tsx — drawingRect visual (Zeile 271–277)

```typescript
const drawingRect = drawState.isDrawing ? {
  left: Math.min(drawState.startX, drawState.currentX),
  top: Math.min(drawState.startY, drawState.currentY),
  width: Math.abs(drawState.currentX - drawState.startX),
  height: Math.abs(drawState.currentY - drawState.startY),
} : null;
```

### EditorLayout.tsx — aktueller Stand (vollständig)

```typescript
import React from 'react';
import Toolbar from './Toolbar';
import SidebarThumbnails from './SidebarThumbnails';
import PdfViewer from './PdfViewer';
import RedactionTable from './RedactionTable';

export default function EditorLayout() {
  return (
    <div className="editor-layout">
      <Toolbar />
      <div className="editor-main">
        <SidebarThumbnails />
        <PdfViewer />
        <RedactionTable />
      </div>
    </div>
  );
}
```

### Undo-Muster aus app-store.tsx (Referenz)

```typescript
// Muster für undo-fähige Aktionen (aus addManualRedaction):
const prevRedactions = [...state.redactions];
dispatch({ type: 'ASSIGN_GROUP_TO_IDS', ids: affectedIds, groupNumber });
dispatch({
  type: 'PUSH_UNDO',
  action: {
    type: 'assign_group',
    description: `Gruppe ${groupNumber} ${affectedIds.length} Einträgen zugewiesen`,
    undo: () => prevRedactions,
    redo: () => state.redactions.map(r =>
      affectedIds.includes(r.id) ? { ...r, groupNumber } : r
    ),
  },
});
```

---

## Schritt 1 — Tests schreiben (TDD)

Datei erstellen: **`src/renderer/components/__tests__/group-assign.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Pure-Logik Tests ─────────────────────────────────────────

import { findOverlappingRedactions } from '../PdfViewer';
import { reducer, initialState } from '../../store/types-and-reducer';
import { RedactionEntry } from '../../../common/types';

function makeEntry(id: string, x: number, y: number, w = 100, h = 20): RedactionEntry {
  return {
    id, variableName: `V_${id}`, originalContent: id,
    category: 'Name', page: 1,
    bounds: { x, y, width: w, height: h },
    status: 'vorschlag', groupNumber: 1, source: 'regex',
  };
}

// ── Überlappungserkennung ─────────────────────────────────────

describe('findOverlappingRedactions', () => {
  const redactions = [
    makeEntry('r1', 10, 10, 50, 20),   // x:10-60, y:10-30
    makeEntry('r2', 100, 100, 50, 20), // x:100-150, y:100-120
    makeEntry('r3', 20, 20, 50, 20),   // x:20-70, y:20-40 — überlappt mit r1
  ];

  it('findet Einträge die vollständig im Rechteck liegen', () => {
    const rect = { x: 0, y: 0, width: 200, height: 200 }; // deckt alles ab
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('findet nur Einträge die das Rechteck berühren', () => {
    const rect = { x: 5, y: 5, width: 70, height: 45 }; // überlappt r1 und r3, nicht r2
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('findet keine Einträge außerhalb des Rechtecks', () => {
    const rect = { x: 200, y: 200, width: 50, height: 50 };
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result).toHaveLength(0);
  });

  it('ignoriert Einträge auf anderen Seiten', () => {
    const mixedPages = [
      makeEntry('r1', 10, 10, 50, 20),                         // page 1
      { ...makeEntry('r2', 10, 10, 50, 20), page: 2 },         // page 2
    ];
    const rect = { x: 0, y: 0, width: 200, height: 200 };
    const result = findOverlappingRedactions(mixedPages, rect, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('erkennt partielle Überschneidung als Treffer', () => {
    // r1 liegt bei x:10-60, y:10-30
    // Rechteck deckt nur x:0-20, y:0-20 ab — berührt r1
    const rect = { x: 0, y: 0, width: 20, height: 20 };
    const result = findOverlappingRedactions([makeEntry('r1', 10, 10, 50, 20)], rect, 1);
    expect(result).toHaveLength(1);
  });
});

// ── Reducer: ASSIGN_GROUP_TO_IDS ─────────────────────────────

describe('Reducer — ASSIGN_GROUP_TO_IDS', () => {
  it('weist Gruppe allen IDs zu', () => {
    const state = {
      ...initialState,
      redactions: [
        makeEntry('r1', 0, 0),
        makeEntry('r2', 0, 0),
        makeEntry('r3', 0, 0),
      ],
    };
    const result = reducer(state, { type: 'ASSIGN_GROUP_TO_IDS', ids: ['r1', 'r3'], groupNumber: 5 });
    expect(result.redactions.find(r => r.id === 'r1')?.groupNumber).toBe(5);
    expect(result.redactions.find(r => r.id === 'r2')?.groupNumber).toBe(1); // unberührt
    expect(result.redactions.find(r => r.id === 'r3')?.groupNumber).toBe(5);
  });

  it('ändert nichts bei leerer IDs-Liste', () => {
    const state = { ...initialState, redactions: [makeEntry('r1', 0, 0)] };
    const result = reducer(state, { type: 'ASSIGN_GROUP_TO_IDS', ids: [], groupNumber: 3 });
    expect(result.redactions).toEqual(state.redactions);
  });
});

// ── GroupAssignPopup ─────────────────────────────────────────

import GroupAssignPopup from '../GroupAssignPopup';

describe('GroupAssignPopup', () => {
  it('zeigt Anzahl der betroffenen Einträge', () => {
    const onAssign = vi.fn();
    const onCancel = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 100, y: 100 }}
        affectedIds={['r1', 'r2', 'r3']}
        existingGroups={[1, 2, 3]}
        onAssign={onAssign}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(/3 Schwärzungen/)).toBeInTheDocument();
  });

  it('ruft onAssign mit gewählter Gruppe auf', () => {
    const onAssign = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 0, y: 0 }}
        affectedIds={['r1']}
        existingGroups={[1, 2]}
        onAssign={onAssign}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Zuweisen/ }));
    expect(onAssign).toHaveBeenCalled();
  });

  it('ruft onCancel auf bei Abbrechen', () => {
    const onCancel = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 0, y: 0 }}
        affectedIds={[]}
        existingGroups={[]}
        onAssign={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

---

## Schritt 2 — Implementation

### 2a. Neue Action in `types-and-reducer.ts`

**In der `Action`-Union** nach `CLEAR_PAGE_REDACTIONS`:

```typescript
  | { type: 'ASSIGN_GROUP_TO_IDS'; ids: string[]; groupNumber: number }
```

**Reducer-Case** nach `CLEAR_PAGE_REDACTIONS`:

```typescript
    case 'ASSIGN_GROUP_TO_IDS':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          action.ids.includes(r.id) ? { ...r, groupNumber: action.groupNumber } : r
        ),
      };
```

### 2b. Neue Datei: `src/renderer/components/GroupAssignPopup.tsx`

```typescript
import React, { useState } from 'react';

interface GroupAssignPopupProps {
  position: { x: number; y: number };
  affectedIds: string[];
  existingGroups: number[];
  onAssign: (groupNumber: number) => void;
  onCancel: () => void;
}

export default function GroupAssignPopup({
  position, affectedIds, existingGroups, onAssign, onCancel,
}: GroupAssignPopupProps) {
  const nextGroup = existingGroups.length > 0 ? Math.max(...existingGroups) + 1 : 1;
  const [selectedGroup, setSelectedGroup] = useState<number>(
    existingGroups.length > 0 ? existingGroups[0] : nextGroup
  );

  // Popup innerhalb des Viewports halten
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y, window.innerHeight - 200),
    zIndex: 1000,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: 240,
  };

  return (
    <div style={popupStyle}>
      <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
        Gruppe zuweisen
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        {affectedIds.length} Schwärzungen ausgewählt
      </div>

      <label style={{ fontSize: 'var(--font-size-xs)', display: 'block', marginBottom: 'var(--space-xs)' }}>
        Gruppe:
      </label>
      <select
        className="select"
        value={selectedGroup}
        onChange={e => setSelectedGroup(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
      >
        {existingGroups.map(g => (
          <option key={g} value={g}>Gruppe {g}</option>
        ))}
        <option value={nextGroup}>+ Neue Gruppe ({nextGroup})</option>
      </select>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onAssign(selectedGroup)}
          disabled={affectedIds.length === 0}
        >
          Zuweisen
        </button>
      </div>
    </div>
  );
}
```

### 2c. `PdfViewer.tsx` — exportierte Hilfsfunktion + drawMode-Prop

**Am Anfang** der Datei (nach Imports, vor der Komponente) **neue exportierte Funktion**:

```typescript
import { BoundingBox, RedactionEntry } from '../../common/types';

/** Gibt alle Redactions zurück die das gegebene Rechteck berühren (auf der aktuellen Seite). */
export function findOverlappingRedactions(
  redactions: RedactionEntry[],
  rect: BoundingBox,
  page: number
): RedactionEntry[] {
  return redactions.filter(r => {
    if (r.page !== page) return false;
    const b = r.bounds;
    return !(
      rect.x + rect.width < b.x ||
      b.x + b.width < rect.x ||
      rect.y + rect.height < b.y ||
      b.y + b.height < rect.y
    );
  });
}
```

**Komponenten-Signatur** ändern — Props hinzufügen:

```typescript
interface PdfViewerProps {
  drawMode: 'redaction' | 'groupselect';
  onGroupSelect?: (affectedIds: string[], position: { x: number; y: number }) => void;
}

export default function PdfViewer({ drawMode, onGroupSelect }: PdfViewerProps) {
```

**Neuer lokaler State** für Gruppenauswahl-Vorschau in der Komponente:

```typescript
const [groupSelectPreview, setGroupSelectPreview] = useState<string[]>([]);
```

**`handleMouseUp`** — WICHTIG: Signatur bleibt OHNE Parameter (bestehender Code hat kein `e`), wir lesen Position aus `drawState`:

```typescript
// ⚠️ Bestehender handleMouseUp hat KEIN e-Parameter.
// Nicht die Signatur ändern — sonst brechen onMouseUp/onMouseLeave Bindings.
const handleMouseUp = useCallback(() => {
  if (drawState.isDrawing) {
    const minX = Math.min(drawState.startX, drawState.currentX);
    const minY = Math.min(drawState.startY, drawState.currentY);
    const w = Math.abs(drawState.currentX - drawState.startX);
    const h = Math.abs(drawState.currentY - drawState.startY);

    if (w > 5 && h > 5) {
      const pdfBounds = {
        x: minX / scale, y: minY / scale,
        width: w / scale, height: h / scale,
      };

      if (drawMode === 'groupselect' && onGroupSelect) {
        // Gruppenauswahl-Modus: überlappende Schwärzungen finden
        const overlapping = findOverlappingRedactions(state.redactions, pdfBounds, state.currentPage);
        if (overlapping.length > 0) {
          const rect = overlayRef.current?.getBoundingClientRect();
          const screenPos = rect
            ? { x: rect.left + drawState.currentX, y: rect.top + drawState.currentY }
            : { x: drawState.currentX, y: drawState.currentY };
          onGroupSelect(overlapping.map(r => r.id), screenPos);
        }
      } else {
        // Normaler Schwärzungs-Modus
        addManualRedaction(pdfBounds, state.currentPage);
      }
    }
    setDrawState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  }
  // ... restliche drag/resize handling unverändert
}, [drawState, dragState, resizeState, scale, state.currentPage, state.redactions,
    addManualRedaction, drawMode, onGroupSelect]);
```

**Visuelles Rechteck** — im Render, `drawingRect` mit unterschiedlichem Style:

```tsx
{drawingRect && (
  <div
    className={drawMode === 'groupselect' ? 'drawing-rect group-select' : 'drawing-rect'}
    style={{
      left: drawingRect.left, top: drawingRect.top,
      width: drawingRect.width, height: drawingRect.height,
      // group-select: gestrichelt blau statt durchgezogen
    }}
  />
)}
```

**CSS** in `global.css` hinzufügen:
```css
.drawing-rect.group-select {
  border: 2px dashed var(--brand-primary);
  background: rgba(99, 102, 241, 0.08);
}
```

**Cursor** — im overlay-layer style:
```tsx
style={{ cursor: drawMode === 'groupselect' ? 'crosshair' : 'crosshair' }}
```
> Beide Modi nutzen Crosshair — optional kann für `groupselect` ein eigener Cursor-Style hinzugefügt werden.

### 2d. `EditorLayout.tsx` — `drawMode`-State verwalten

```typescript
import React, { useState, useCallback } from 'react';
import Toolbar from './Toolbar';
import SidebarThumbnails from './SidebarThumbnails';
import PdfViewer from './PdfViewer';
import RedactionTable from './RedactionTable';
import GroupAssignPopup from './GroupAssignPopup';
import { useAppState } from '../store/app-store';

export default function EditorLayout() {
  const { state, dispatch } = useAppState();
  const [drawMode, setDrawMode] = useState<'redaction' | 'groupselect'>('redaction');
  const [groupPopup, setGroupPopup] = useState<{
    affectedIds: string[];
    position: { x: number; y: number };
  } | null>(null);

  const allGroups = Array.from(new Set(state.redactions.map(r => r.groupNumber))).sort((a, b) => a - b);

  const handleGroupSelect = useCallback((affectedIds: string[], position: { x: number; y: number }) => {
    setGroupPopup({ affectedIds, position });
    setDrawMode('redaction'); // Zurück zu normalem Modus nach Auswahl
  }, []);

  const handleGroupAssign = useCallback((groupNumber: number) => {
    if (!groupPopup) return;
    const prevRedactions = [...state.redactions];
    dispatch({ type: 'ASSIGN_GROUP_TO_IDS', ids: groupPopup.affectedIds, groupNumber });
    dispatch({
      type: 'PUSH_UNDO',
      action: {
        type: 'assign_group',
        description: `Gruppe ${groupNumber} zugewiesen`,
        undo: () => prevRedactions,
        redo: () => state.redactions.map(r =>
          groupPopup.affectedIds.includes(r.id) ? { ...r, groupNumber } : r
        ),
      },
    });
    setGroupPopup(null);
  }, [groupPopup, state.redactions, dispatch]);

  return (
    <div className="editor-layout">
      <Toolbar drawMode={drawMode} onDrawModeChange={setDrawMode} />
      <div className="editor-main">
        <SidebarThumbnails />
        <PdfViewer drawMode={drawMode} onGroupSelect={handleGroupSelect} />
        <RedactionTable />
      </div>
      {groupPopup && (
        <GroupAssignPopup
          position={groupPopup.position}
          affectedIds={groupPopup.affectedIds}
          existingGroups={allGroups}
          onAssign={handleGroupAssign}
          onCancel={() => setGroupPopup(null)}
        />
      )}
    </div>
  );
}
```

### 2e. `Toolbar.tsx` — neue Props + Button

**Props-Interface** am Anfang der Datei (vor der Komponente):

```typescript
interface ToolbarProps {
  drawMode: 'redaction' | 'groupselect';
  onDrawModeChange: (mode: 'redaction' | 'groupselect') => void;
}

export default function Toolbar({ drawMode, onDrawModeChange }: ToolbarProps) {
```

**Button** in der Toolbar, nach den Undo/Redo-Buttons (vor dem Zoom-Bereich):

```tsx
<div className="toolbar-separator" />

<div className="toolbar-group">
  <Tooltip content={drawMode === 'groupselect' ? 'Normaler Modus (Escape)' : 'Gruppe über Markierung zuweisen'}>
    <button
      className={`btn btn-ghost btn-sm ${drawMode === 'groupselect' ? 'active' : ''}`}
      onClick={() => onDrawModeChange(drawMode === 'groupselect' ? 'redaction' : 'groupselect')}
      disabled={!state.fileData}
      id="btn-group-select"
    >
      ⊡ <span className="hide-mobile">Gruppe</span>
    </button>
  </Tooltip>
</div>
```

**Escape-Taste-Koordination** — siehe `SPEC_CONVENTIONS.md §8`:

Spec 03 registriert einen globalen Escape-Handler für „Auswahl aufheben". Wir dürfen diesen NICHT überschreiben, aber in `groupselect`-Modus muss Escape VORHER den Modus zurücksetzen. Lösung: Capture-Phase + `stopImmediatePropagation`.

```typescript
// In EditorLayout.tsx:
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    // Nur wenn groupselect aktiv ODER Popup offen
    if (e.key === 'Escape' && (drawMode === 'groupselect' || groupPopup !== null)) {
      e.stopImmediatePropagation();  // ← Spec 03 Handler nicht mehr ausführen
      setDrawMode('redaction');
      setGroupPopup(null);
    }
  };
  // Capture-Phase: unser Handler läuft VOR dem globalen App.tsx-Handler
  window.addEventListener('keydown', handleEscape, { capture: true });
  return () => window.removeEventListener('keydown', handleEscape, { capture: true });
}, [drawMode, groupPopup]);
```

> Durch `{ capture: true }` läuft unser Handler in der Capture-Phase (vor der Bubble-Phase des Spec-03-Handlers). `stopImmediatePropagation` verhindert weitere Ausführung. Resultat: Escape schließt erst Group-Select, erst dann (beim zweiten Escape) die Auswahl.

---

## Schritt 3 — Tests ausführen

```bash
npx vitest run src/renderer/components/__tests__/group-assign.test.tsx --reporter=verbose
npx tsc --noEmit
```

---

## Definition of Done

- [ ] `findOverlappingRedactions()` als named export aus `PdfViewer.tsx`
- [ ] `ASSIGN_GROUP_TO_IDS` Action + Reducer-Case vorhanden
- [ ] `GroupAssignPopup.tsx` korrekt implementiert
- [ ] `EditorLayout.tsx` verwaltet `drawMode` und `groupPopup`
- [ ] `Toolbar.tsx` hat neuen Button „Gruppe zuweisen"
- [ ] Alle 8 Tests aus `group-assign.test.tsx` grün
- [ ] Manuell: Rechteck über 3 Schwärzungen → Popup erscheint mit „3 Schwärzungen ausgewählt"
- [ ] Manuell: Gruppe zuweisen → alle 3 erhalten neue Gruppen-Nummer
- [ ] Manuell: Undo hebt Zuweisung auf
- [ ] Manuell: Escape schließt Popup und setzt Modus zurück
- [ ] Leeres Rechteck (keine Treffer) → kein Popup
- [ ] `npx tsc --noEmit` fehlerfrei
