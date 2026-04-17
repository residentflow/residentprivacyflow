# Spec 06 — Export-Vorschau

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Keine (unabhängig von anderen Features).  
> **Komplexität:** Mittel (~3–4h)

---

## Files to READ before starting

- `src/renderer/components/Toolbar.tsx` (kritisch — `handleExport`-Funktion)
- `src/common/types.ts` (für `RedactionEntry`, `RedactionMode`, `ExportQuality`)
- `docs/specs/SPEC_CONVENTIONS.md` (§5 Test-Framework Regeln — Canvas-Tests in jsdom ← KRITISCH)

## Files to MODIFY (EXAKTE Liste)

- `src/renderer/components/Toolbar.tsx`

## Files to CREATE

- `src/renderer/services/pdf-renderer.ts`
- `src/renderer/components/ExportPreviewModal.tsx`
- `src/renderer/services/__tests__/pdf-renderer.test.ts`

---

## Ziel

Vor dem finalen Export kann der User eine gerenderte Vorschau der aktuellen Seite sehen — mit allen aktiven Schwärzungen eingeblendet. Verhindert Überraschungen beim Export.

---

## Neue Dateien

| Datei | Typ |
|-------|-----|
| `src/renderer/services/pdf-renderer.ts` | Neu — extrahierte Render-Logik |
| `src/renderer/components/ExportPreviewModal.tsx` | Neu — Modal-Komponente |
| `src/renderer/services/__tests__/pdf-renderer.test.ts` | Neu (Tests) |

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/renderer/components/Toolbar.tsx` | Render-Logik auslagern, Vorschau-Button |

---

## Bestehender Code — vollständig einbetten

### Toolbar.tsx — Export-Rendering-Logik die extrahiert wird (Zeile 126–174)

```typescript
// Diese Logik steht aktuell in handleExport und wird nach pdf-renderer.ts ausgelagert:

const { getPdfDocument } = await import('../services/pdf-init');
const pdf = await getPdfDocument(state.fileData!);
const dpi = state.exportQuality === 'high' ? 300 : 150;
const scale = dpi / 72;

const { jsPDF } = await import('jspdf');

const firstPage = await pdf.getPage(1);
const firstViewport = firstPage.getViewport({ scale: 1.0 });
const pdfDoc = new jsPDF({
  orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
  unit: 'pt',
  format: [firstViewport.width, firstViewport.height],
});

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const pageRedactions = activeRedactions.filter(r => r.page === i);
  for (const redaction of pageRedactions) {
    const x = redaction.bounds.x * scale;
    const y = redaction.bounds.y * scale;
    const w = redaction.bounds.width * scale;
    const h = redaction.bounds.height * scale;

    if (state.mode === 'pseudonymisieren') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `bold ${Math.max(10, h * 0.6)}px Inter, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${redaction.variableName}]`, x + 2, y + h / 2, w - 4);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h);
    }
  }

  const imgData = canvas.toDataURL('image/jpeg', state.exportQuality === 'high' ? 0.95 : 0.8);
  // ... jsPDF.addImage(...)
  canvas.remove();
}
```

---

## Schritt 1 — Tests schreiben (TDD)

Datei erstellen: **`src/renderer/services/__tests__/pdf-renderer.test.ts`**

**KRITISCH:** jsdom liefert nur rudimentäres Canvas-Support — `getImageData` ist unreliable. Siehe `SPEC_CONVENTIONS.md §5`. Tests nutzen `vi.spyOn` statt Pixel-Readback.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScaleForDpi, getJpegQuality, applyRedactionsToCanvas } from '../pdf-renderer';
import { RedactionEntry } from '../../../common/types';

// ── Hilfsfunktionen ──────────────────────────────────────────

describe('getScaleForDpi', () => {
  it('gibt 300/72 für high zurück', () => {
    expect(getScaleForDpi('high')).toBeCloseTo(300 / 72);
  });

  it('gibt 150/72 für compressed zurück', () => {
    expect(getScaleForDpi('compressed')).toBeCloseTo(150 / 72);
  });
});

describe('getJpegQuality', () => {
  it('gibt 0.95 für high zurück', () => {
    expect(getJpegQuality('high')).toBe(0.95);
  });

  it('gibt 0.8 für compressed zurück', () => {
    expect(getJpegQuality('compressed')).toBe(0.8);
  });
});

// ── Canvas-Rendering ─────────────────────────────────────────

/**
 * Mock-Canvas-Context für jsdom (Canvas 2D ist in jsdom minimal).
 * Wir verifizieren Aufrufe statt Pixel-Output.
 */
function makeMockCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context nicht verfügbar in jsdom — vitest-canvas-mock installieren falls nötig');
  return ctx;
}

function makeRedaction(id: string, x: number, y: number, w: number, h: number,
  variableName = 'TEST_1'): RedactionEntry {
  return {
    id, variableName, originalContent: 'secret', category: 'Name', page: 1,
    bounds: { x, y, width: w, height: h },
    status: 'akzeptiert', groupNumber: 1, source: 'regex',
  };
}

describe('applyRedactionsToCanvas', () => {
  it('ruft fillRect mit schwarzem Style im Schwärzen-Modus', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const redactions = [makeRedaction('r1', 10, 10, 50, 20)];

    applyRedactionsToCanvas(ctx, redactions, 'schwärzen', 1.0);

    expect(fillRectSpy).toHaveBeenCalledWith(10, 10, 50, 20);
    // fillStyle wurde auf schwarz gesetzt (letzte Zuweisung bleibt)
    expect(ctx.fillStyle).toMatch(/^#0{3,6}$|^#000000$|^rgb\(0,\s*0,\s*0\)$/i);
  });

  it('zeichnet Text im Pseudonymisieren-Modus', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const fillTextSpy = vi.spyOn(ctx, 'fillText');

    applyRedactionsToCanvas(
      ctx, [makeRedaction('r1', 10, 10, 100, 30, 'Name_1')], 'pseudonymisieren', 1.0
    );

    // Erstes fillRect: weiße Fläche
    expect(fillRectSpy).toHaveBeenCalledWith(10, 10, 100, 30);
    // fillText mit dem Variablennamen in Klammern
    expect(fillTextSpy).toHaveBeenCalledWith(
      expect.stringContaining('Name_1'),
      expect.any(Number), expect.any(Number), expect.any(Number)
    );
  });

  it('skaliert Koordinaten korrekt mit scale-Faktor', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');

    applyRedactionsToCanvas(ctx, [makeRedaction('r1', 10, 10, 50, 20)], 'schwärzen', 2.0);

    // scale=2: alle Koordinaten verdoppelt
    expect(fillRectSpy).toHaveBeenCalledWith(20, 20, 100, 40);
  });

  it('rendert mehrere Schwärzungen in gegebener Reihenfolge', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');

    applyRedactionsToCanvas(ctx, [
      makeRedaction('r1', 10, 10, 20, 20),
      makeRedaction('r2', 50, 50, 30, 30),
    ], 'schwärzen', 1.0);

    expect(fillRectSpy).toHaveBeenCalledTimes(2);
    expect(fillRectSpy).toHaveBeenNthCalledWith(1, 10, 10, 20, 20);
    expect(fillRectSpy).toHaveBeenNthCalledWith(2, 50, 50, 30, 30);
  });

  it('leere Redaction-Liste → keine fillRect-Calls', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    applyRedactionsToCanvas(ctx, [], 'schwärzen', 1.0);
    expect(fillRectSpy).not.toHaveBeenCalled();
  });

  it('Font-Size passt sich an Schwärzungshöhe an', () => {
    const ctx = makeMockCtx();
    applyRedactionsToCanvas(
      ctx, [makeRedaction('r1', 0, 0, 200, 50)], 'pseudonymisieren', 1.0
    );
    // Font sollte proportional zur Höhe sein (h*0.6 = 30)
    expect(ctx.font).toContain('30');
  });
});

// ── Integrationstest (Pflicht laut SPEC_CONVENTIONS §10) ─────

describe('Integration: Scale + Mode Kombinationen', () => {
  it.each([
    ['schwärzen',           'high',       300/72],
    ['schwärzen',           'compressed', 150/72],
    ['pseudonymisieren',    'high',       300/72],
    ['pseudonymisieren',    'compressed', 150/72],
  ] as const)('Mode=%s Quality=%s → scale=%s', (mode, quality, expectedScale) => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const scale = getScaleForDpi(quality);

    expect(scale).toBeCloseTo(expectedScale);

    applyRedactionsToCanvas(ctx, [makeRedaction('r1', 10, 10, 20, 20)], mode, scale);
    expect(fillRectSpy).toHaveBeenCalledWith(
      10 * expectedScale, 10 * expectedScale,
      20 * expectedScale, 20 * expectedScale
    );
  });
});
```

> **Falls jsdom-Canvas-Probleme auftreten:** installiere `vitest-canvas-mock` und füge in `src/test-setup.ts` hinzu:
> ```typescript
> import 'vitest-canvas-mock';
> ```
> Dann funktioniert auch `getImageData` in Tests. Dies ist OPTIONAL — die obigen Tests nutzen nur `vi.spyOn` und brauchen den Mock NICHT.

---

## Schritt 2 — Implementation

### 2a. Neue Datei: `src/renderer/services/pdf-renderer.ts`

```typescript
import { RedactionEntry, RedactionMode, ExportQuality } from '../../common/types';

export function getScaleForDpi(quality: ExportQuality): number {
  return (quality === 'high' ? 300 : 150) / 72;
}

export function getJpegQuality(quality: ExportQuality): number {
  return quality === 'high' ? 0.95 : 0.8;
}

/**
 * Zeichnet alle Schwärzungen auf einen Canvas-Context.
 * Koordinaten sind in PDF-Punkten, scale konvertiert zu Canvas-Pixeln.
 */
export function applyRedactionsToCanvas(
  ctx: CanvasRenderingContext2D,
  redactions: RedactionEntry[],
  mode: RedactionMode,
  scale: number
): void {
  for (const r of redactions) {
    const x = r.bounds.x * scale;
    const y = r.bounds.y * scale;
    const w = r.bounds.width * scale;
    const h = r.bounds.height * scale;

    if (mode === 'pseudonymisieren') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `bold ${Math.max(10, h * 0.6)}px Inter, Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(`[${r.variableName}]`, x + 2, y + h / 2, w - 4);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, w, h);
    }
  }
}

/**
 * Rendert eine einzelne PDF-Seite auf einen neu erstellten Canvas und gibt
 * die Data URL zurück. Für Vorschau und Export verwendbar.
 */
export async function renderPageToDataUrl(
  fileData: Uint8Array,
  pageNumber: number,
  redactions: RedactionEntry[],
  mode: RedactionMode,
  quality: ExportQuality
): Promise<string> {
  const { getPdfDocument } = await import('./pdf-init');
  const pdf = await getPdfDocument(fileData);
  const page = await pdf.getPage(pageNumber);
  const scale = getScaleForDpi(quality);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const pageRedactions = redactions.filter(
    r => r.page === pageNumber && (r.status === 'akzeptiert' || r.status === 'manuell')
  );
  applyRedactionsToCanvas(ctx, pageRedactions, mode, scale);

  const dataUrl = canvas.toDataURL('image/jpeg', getJpegQuality(quality));
  canvas.remove();
  return dataUrl;
}
```

### 2b. Neue Datei: `src/renderer/components/ExportPreviewModal.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { RedactionEntry, RedactionMode, ExportQuality } from '../../common/types';
import { renderPageToDataUrl } from '../services/pdf-renderer';

interface ExportPreviewModalProps {
  fileData: Uint8Array;
  pageCount: number;
  initialPage: number;
  redactions: RedactionEntry[];
  initialMode: RedactionMode;
  initialQuality: ExportQuality;
  onExport: (mode: RedactionMode, quality: ExportQuality) => void;
  onClose: () => void;
}

export default function ExportPreviewModal({
  fileData, pageCount, initialPage, redactions,
  initialMode, initialQuality, onExport, onClose,
}: ExportPreviewModalProps) {
  const [previewPage, setPreviewPage] = useState(initialPage);
  const [previewMode, setPreviewMode] = useState<RedactionMode>(initialMode);
  const [previewQuality, setPreviewQuality] = useState<ExportQuality>(initialQuality);
  const [isRendering, setIsRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [renderError, setRenderError] = useState<string | null>(null);

  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const url = await renderPageToDataUrl(fileData, previewPage, redactions, previewMode, previewQuality);
      setPreviewUrl(url);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setPreviewUrl(null);
    } finally {
      setIsRendering(false);
    }
  }, [fileData, previewPage, redactions, previewMode, previewQuality]);

  // Cleanup: alte dataURL freigeben beim Unmount
  useEffect(() => {
    return () => {
      setPreviewUrl(null);
    };
  }, []);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  // Escape-Taste schließt Modal (Capture-Phase + stopImmediatePropagation,
  // damit globaler App.tsx-Escape-Handler nicht greift — siehe SPEC_CONVENTIONS §8)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="modal-content" style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        maxWidth: '90vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', width: 800,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontWeight: 600 }}>
            Vorschau: Seite {previewPage} von {pageCount}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-icon btn-sm"
              disabled={previewPage <= 1}
              onClick={() => setPreviewPage(p => p - 1)}>◀</button>
            <button className="btn btn-ghost btn-icon btn-sm"
              disabled={previewPage >= pageCount}
              onClick={() => setPreviewPage(p => p + 1)}>▶</button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Schließen (Escape)">✕</button>
          </div>
        </div>

        {/* Canvas-Bereich */}
        <div style={{
          flex: 1, overflow: 'auto', background: '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-lg)', minHeight: 300,
        }}>
          {isRendering ? (
            <div style={{ color: 'var(--text-secondary)' }}>Vorschau wird gerendert…</div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`Vorschau Seite ${previewPage}`}
              style={{ maxWidth: '100%', maxHeight: '60vh', boxShadow: 'var(--shadow-md)' }}
            />
          ) : null}
        </div>

        {/* Footer — Einstellungen + Aktionen */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-md) var(--space-lg)',
          display: 'flex', gap: 'var(--space-lg)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-mode" value="schwärzen"
                checked={previewMode === 'schwärzen'}
                onChange={() => setPreviewMode('schwärzen')} />
              Schwärzen
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-mode" value="pseudonymisieren"
                checked={previewMode === 'pseudonymisieren'}
                onChange={() => setPreviewMode('pseudonymisieren')} />
              Pseudonymisieren
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-quality" value="high"
                checked={previewQuality === 'high'}
                onChange={() => setPreviewQuality('high')} />
              300 DPI
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-quality" value="compressed"
                checked={previewQuality === 'compressed'}
                onChange={() => setPreviewQuality('compressed')} />
              150 DPI
            </label>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Abbrechen
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => { onClose(); onExport(previewMode, previewQuality); }}
            >
              So exportieren →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 2c. `Toolbar.tsx` — Rendering auslagern + Vorschau-Button

**Import hinzufügen:**
```typescript
import { applyRedactionsToCanvas, getScaleForDpi, getJpegQuality } from '../services/pdf-renderer';
import ExportPreviewModal from './ExportPreviewModal';
```

**Neuer State:**
```typescript
const [showPreview, setShowPreview] = useState(false);
```

**In `handleExport`**, Rendering-Schleife refaktorieren um `applyRedactionsToCanvas` zu nutzen:**

Ersetze im Loop:
```typescript
// ALT (inline):
for (const redaction of pageRedactions) {
  const x = redaction.bounds.x * scale;
  // ... manuelle Zeichenlogik
}

// NEU (aus pdf-renderer):
applyRedactionsToCanvas(ctx, pageRedactions, state.mode, scale);
```

**Vorschau-Button** in JSX, direkt vor dem Export-Button:

```tsx
<div className="toolbar-separator" />

<div className="toolbar-group">
  <Tooltip content="Vorschau vor dem Export">
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => setShowPreview(true)}
      disabled={state.redactions.filter(r => r.status === 'akzeptiert' || r.status === 'manuell').length === 0}
      id="btn-preview"
    >
      👁 <span className="hide-mobile">Vorschau</span>
    </button>
  </Tooltip>
  <Tooltip content="PDF Speichern & Exportieren">
    <button className="btn btn-success btn-sm" onClick={handleExport}
      // ... bestehende Attribute
    >
      💾 <span className="hide-tablet">Exportieren</span>
    </button>
  </Tooltip>
</div>
```

**Modal im JSX** der Toolbar-Komponente:

```tsx
{showPreview && state.fileData && (
  <ExportPreviewModal
    fileData={state.fileData}
    pageCount={state.pageCount}
    initialPage={state.currentPage}
    redactions={state.redactions}
    initialMode={state.mode}
    initialQuality={state.exportQuality}
    onExport={(mode, quality) => {
      dispatch({ type: 'SET_MODE', mode });
      dispatch({ type: 'SET_EXPORT_QUALITY', quality });
      handleExport();
    }}
    onClose={() => setShowPreview(false)}
  />
)}
```

---

## Schritt 3 — Tests ausführen

```bash
npx vitest run src/renderer/services/__tests__/pdf-renderer.test.ts --reporter=verbose
npx tsc --noEmit
```

> `renderPageToDataUrl` ist jsdom-inkompatibel (benötigt echtes Canvas + pdf.js WebWorker) und wird nur manuell getestet.

---

## Manuelle Verifikation

1. `npm run dev` starten
2. PDF öffnen, Analyse, mindestens 1 Schwärzung akzeptieren
3. „Vorschau"-Button klicken → Modal erscheint
4. Seitenwechsel im Modal funktioniert
5. Modus/Qualität umschalten → Canvas re-rendert sichtbar
6. „So exportieren" → Modal schließt, Export startet mit gewählten Einstellungen
7. Escape schließt Modal

---

## Definition of Done

- [ ] `pdf-renderer.ts` mit 3 exportierten Funktionen: `getScaleForDpi`, `getJpegQuality`, `applyRedactionsToCanvas`
- [ ] `ExportPreviewModal.tsx` vollständig implementiert
- [ ] `Toolbar.tsx` nutzt `applyRedactionsToCanvas` statt inline-Rendering
- [ ] `Toolbar.tsx` hat „Vorschau"-Button (disabled wenn keine aktiven Schwärzungen)
- [ ] Alle Unit-Tests grün (4 Tests)
- [ ] Manuell: Vorschau zeigt Schwärzungen korrekt
- [ ] Manuell: Einstellungen im Modal werden für Export übernommen
- [ ] `npx tsc --noEmit` fehlerfrei
