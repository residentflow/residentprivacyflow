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

function makeMockCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context nicht verfügbar in jsdom');
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
    expect(ctx.fillStyle).toMatch(/^#0{3,6}$|^#000000$|^rgb\(0,\s*0,\s*0\)$/i);
  });

  it('zeichnet Text im Pseudonymisieren-Modus', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');
    const fillTextSpy = vi.spyOn(ctx, 'fillText');

    applyRedactionsToCanvas(
      ctx, [makeRedaction('r1', 10, 10, 100, 30, 'Name_1')], 'pseudonymisieren', 1.0
    );

    expect(fillRectSpy).toHaveBeenCalledWith(10, 10, 100, 30);
    expect(fillTextSpy).toHaveBeenCalledWith(
      expect.stringContaining('Name_1'),
      expect.any(Number), expect.any(Number), expect.any(Number)
    );
  });

  it('skaliert Koordinaten korrekt mit scale-Faktor', () => {
    const ctx = makeMockCtx();
    const fillRectSpy = vi.spyOn(ctx, 'fillRect');

    applyRedactionsToCanvas(ctx, [makeRedaction('r1', 10, 10, 50, 20)], 'schwärzen', 2.0);

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
    expect(ctx.font).toContain('30');
  });
});

// ── Integrationstest ─────────────────────────────────────────

describe('Integration: Scale + Mode Kombinationen', () => {
  it.each([
    ['schwärzen', 'high', 300 / 72],
    ['schwärzen', 'compressed', 150 / 72],
    ['pseudonymisieren', 'high', 300 / 72],
    ['pseudonymisieren', 'compressed', 150 / 72],
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
