import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createMockWorker } = vi.hoisted(() => ({
  createMockWorker: vi.fn(async () => ({
    recognize: vi.fn(async () => ({
      data: {
        text: 'Mock-Text',
        words: [
          { text: 'Max', confidence: 92, bbox: { x0: 10, y0: 10, x1: 50, y1: 30 } },
          { text: 'Mustermann', confidence: 88, bbox: { x0: 55, y0: 10, x1: 150, y1: 30 } },
        ],
      },
    })),
    terminate: vi.fn(async () => undefined),
    reinitialize: vi.fn(),
  })),
}));

vi.mock('tesseract.js', () => ({
  createWorker: createMockWorker,
}));

import {
  OcrService,
  pixelBoundsToPoints,
  filterByConfidence,
  buildTextItemsFromWords,
} from '../ocr-service';
import { TextItem } from '../../../common/types';

// -- Koordinaten-Transformation -------------------------------------------

describe('pixelBoundsToPoints', () => {
  it('konvertiert Pixel zu PDF-Punkten bei scale=2', () => {
    const result = pixelBoundsToPoints({ x0: 20, y0: 40, x1: 60, y1: 60 }, 2);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
  });

  it('gibt korrekte Werte bei scale=1 zurueck', () => {
    const result = pixelBoundsToPoints({ x0: 10, y0: 10, x1: 100, y1: 30 }, 1);
    expect(result.x).toBe(10);
    expect(result.width).toBe(90);
    expect(result.height).toBe(20);
  });
});

// -- Confidence-Filter ----------------------------------------------------

describe('filterByConfidence', () => {
  const makeItem = (text: string, confidence: number): TextItem => ({
    text, bounds: { x: 0, y: 0, width: 10, height: 10 }, page: 1, confidence,
  });

  it('filtert Items unter dem Schwellenwert heraus', () => {
    const items = [
      makeItem('klar', 0.9),
      makeItem('unsicher', 0.3),
      makeItem('grenzwertig', 0.5),
    ];
    const result = filterByConfidence(items, 0.5);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.text)).toContain('klar');
    expect(result.map(i => i.text)).toContain('grenzwertig');
  });

  it('gibt alle zurueck wenn threshold=0', () => {
    const items = [makeItem('a', 0.1), makeItem('b', 0.9)];
    expect(filterByConfidence(items, 0)).toHaveLength(2);
  });

  it('gibt leeres Array wenn alle unter threshold', () => {
    const items = [makeItem('a', 0.1)];
    expect(filterByConfidence(items, 0.5)).toHaveLength(0);
  });
});

// -- TextItem-Mapping -----------------------------------------------------

describe('buildTextItemsFromWords', () => {
  it('konvertiert Tesseract-Words zu TextItems', () => {
    const mockWords = [
      { text: 'Hallo', confidence: 95, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
      { text: 'Welt', confidence: 80, bbox: { x0: 70, y0: 20, x1: 110, y1: 40 } },
    ];
    const items = buildTextItemsFromWords(mockWords as any, 2, 1);
    expect(items).toHaveLength(2);
    expect(items[0].text).toBe('Hallo');
    expect(items[0].confidence).toBeCloseTo(0.95);
    expect(items[0].bounds.x).toBe(5);
    expect(items[0].page).toBe(1);
    expect(items[1].text).toBe('Welt');
  });

  it('ignoriert leere Woerter', () => {
    const mockWords = [
      { text: '', confidence: 90, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { text: '  ', confidence: 80, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } },
      { text: 'Text', confidence: 85, bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
    ];
    const items = buildTextItemsFromWords(mockWords as any, 1, 1);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('Text');
  });
});

// -- OcrService Interface und Lifecycle -----------------------------------

describe('OcrService — Interface und Lifecycle', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('hat initialize, recognizePage, terminate Methoden', () => {
    const svc = new OcrService();
    expect(typeof svc.initialize).toBe('function');
    expect(typeof svc.recognizePage).toBe('function');
    expect(typeof svc.terminate).toBe('function');
  });

  it('wirft wenn recognizePage ohne initialize aufgerufen', async () => {
    const svc = new OcrService();
    const canvas = document.createElement('canvas');
    await expect(svc.recognizePage(canvas, 1, 1)).rejects.toThrow(/initialisiert/i);
  });

  it('initialize + recognizePage + terminate: Happy Path mit Mock', async () => {
    const svc = new OcrService();
    await svc.initialize(['deu']);

    const canvas = document.createElement('canvas');
    const items = await svc.recognizePage(canvas, 1, 1);

    expect(items.length).toBe(2);
    expect(items[0].text).toBe('Max');
    expect(items[0].page).toBe(1);
    expect(items[0].confidence).toBeCloseTo(0.92);

    await svc.terminate();
  });

  it('terminate auf nicht-initialisiertem Service ist no-op', async () => {
    const svc = new OcrService();
    await expect(svc.terminate()).resolves.toBeUndefined();
  });

  it('zweites terminate() ist idempotent', async () => {
    const svc = new OcrService();
    await svc.initialize();
    await svc.terminate();
    await expect(svc.terminate()).resolves.toBeUndefined();
  });

  it('nach terminate() neuer Aufruf wirft', async () => {
    const svc = new OcrService();
    await svc.initialize();
    await svc.terminate();
    await expect(svc.recognizePage(document.createElement('canvas'), 1, 1))
      .rejects.toThrow(/initialisiert/i);
  });
});

// -- Integrationstest (Pflicht laut SPEC_CONVENTIONS §10) ----------------

describe('Integration: OCR-Pipeline', () => {
  it('End-to-End: initialize → recognize → scale → filter', async () => {
    const svc = new OcrService();
    await svc.initialize(['deu', 'eng']);

    const canvas = document.createElement('canvas');
    const items = await svc.recognizePage(canvas, 5, 2.0);

    expect(items[0].bounds.x).toBe(5);
    expect(items[0].bounds.width).toBe(20);
    expect(items[0].page).toBe(5);

    const filtered = filterByConfidence(items, 0.9);
    expect(filtered).toHaveLength(1);

    await svc.terminate();
  });
});
