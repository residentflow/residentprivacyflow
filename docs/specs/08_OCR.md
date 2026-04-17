# Spec 08 — OCR für bildbasierte PDFs

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Spec `01_PII_CATEGORIES.md` (PII-Kategorien); Specs `07A`/`07B` OPTIONAL (OCR funktioniert mit und ohne Multi-Doc).  
> **Komplexität:** Hoch (~6–8h) — neue npm-Abhängigkeit, Worker-Lifecycle  
> **Installation erforderlich:** `npm install tesseract.js@^5.0.0` (kompatibel mit Electron 28)

---

## Files to READ before starting

- `src/renderer/components/Toolbar.tsx` (kompletter `handleAnalyze`)
- `src/common/types.ts` (`AppSettings`, `TextItem`, `PageAnalysis`)
- `src/main/services/settings-service.ts`
- `package.json` (Abhängigkeiten-Liste)
- `docs/specs/SPEC_CONVENTIONS.md` (§5 Test-Framework)
- **`node_modules/tesseract.js/package.json`** nach Installation — Version verifizieren

## Files to MODIFY

- `src/renderer/components/Toolbar.tsx` — OCR-Integration in Analyse-Flow
- `src/common/types.ts` — `AppSettings.ocrConfidenceThreshold` + `ocrLanguages`
- `src/main/services/settings-service.ts` — Default-Werte für OCR-Settings
- `package.json` — `tesseract.js` als dependency (durch `npm install` automatisch)

## Files to CREATE

- `src/renderer/services/ocr-service.ts`
- `src/renderer/services/__tests__/ocr-service.test.ts`
- `src/renderer/services/__mocks__/tesseract.js.ts` (für Tests)

---

## Ziel

Gescannte PDFs ohne eingebetteten Textlayer können aktuell nicht analysiert werden. Mit OCR (Tesseract.js) werden Seiten ohne Textlayer erkannt und trotzdem PII-Vorschläge generiert.

---

## Technologieentscheidung

**Tesseract.js v4/v5** — reines JavaScript, kein nativer Code, 100% offline.
- Läuft im **Renderer-Prozess** (konsistent mit pdf.js-Architektur)
- Sprachdaten lazy geladen: `deu.traineddata` (~4 MB, einmalig gecacht)
- `TextItem.confidence` bereits im Typ vorhanden → direkt nutzbar

---

## Neue Dateien

| Datei | Typ |
|-------|-----|
| `src/renderer/services/ocr-service.ts` | Neu |
| `src/renderer/services/__tests__/ocr-service.test.ts` | Neu (Tests) |

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/renderer/components/Toolbar.tsx` | OCR-Integration im Analyse-Flow |
| `src/common/types.ts` | `AppSettings.ocrConfidenceThreshold` + `ocrLanguages` |

---

## Bestehender Code — vollständig einbetten

### Toolbar.tsx — handleAnalyze (vollständig, Zeile 9–80)

```typescript
const handleAnalyze = useCallback(async () => {
  if (!state.fileData || !state.filePath) return;

  try {
    dispatch({ type: 'SET_ANALYZING', isAnalyzing: true, progress: 'Text wird extrahiert…' });

    const { getPdfDocument } = await import('../services/pdf-init');
    const pdf = await getPdfDocument(state.fileData);
    const allTextItems: any[] = [];
    const analysisTypes: string[] = [];
    let usedOcr = false;

    for (let i = 1; i <= pdf.numPages; i++) {
      dispatch({
        type: 'SET_ANALYSIS_PROGRESS',
        progress: `Seite ${i} von ${pdf.numPages} wird analysiert…`,
      });

      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });

      let pageHasText = false;

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
          const tx = (item as any).transform;
          if (tx) {
            pageHasText = true;
            allTextItems.push({
              text: item.str,
              bounds: {
                x: tx[4],
                y: viewport.height - tx[5] - ((item as any).height || 12),
                width: (item as any).width || item.str.length * 6,
                height: (item as any).height || 12,
              },
              page: i,
            });
          }
        }
      }

      if (!pageHasText) {
        // ← HIER: OCR-Logik einfügen (Schritt 2c)
        console.warn(`Seite ${i}: Kein Textlayer gefunden. OCR ist in dieser Version deaktiviert.`);
      }
    }

    if (!analysisTypes.includes('textlayer') && allTextItems.some(t => !t.ocrSource)) {
      analysisTypes.push('textlayer');
    }
    if (usedOcr) analysisTypes.push('ocr');

    dispatch({ type: 'SET_ANALYSIS_PROGRESS', progress: 'PII-Erkennung läuft…' });

    const { PIIDetectionClient } = await import('../services/pii-detection-client');
    const detector = new PIIDetectionClient();
    const suggestions = detector.detectAll(allTextItems);

    analysisTypes.push('regex', 'heuristic');

    const manualRedactions = state.redactions.filter(r => r.source === 'manual');
    dispatch({ type: 'SET_REDACTIONS', redactions: [...manualRedactions, ...suggestions] });

    dispatch({ type: 'SET_HAS_ANALYZED', value: true });
    dispatch({ type: 'SET_ANALYSIS_TYPES', types: analysisTypes });
    dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
  } catch (err: any) {
    dispatch({ type: 'SET_ERROR', error: `Analysefehler: ${err.message}` });
    dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
  }
}, [state.fileData, state.filePath, state.redactions, dispatch]);
```

**Hinweis:** Nach Abschluss von Spec 07 (Batch-Processing) sind diese State-Zugriffe bereits auf `activeDoc` umgestellt. Dieser Analyse-Flow gilt für `activeDoc.fileData` und dispatcht auf das aktive Dokument.

### AppSettings (aus types.ts — aktuell)

```typescript
export interface AppSettings {
  maxFileSizeMB: number;
  maxPageCount: number;
  tempDirectory: string;
  defaultExportQuality: ExportQuality;
  defaultMode: RedactionMode;
  lastOpenDirectory: string;
  lastExportDirectory: string;
  // ← hier neue Felder einfügen
}
```

---

## Schritt 1 — npm-Paket installieren & Version verifizieren

```bash
# Tesseract.js v5 (neueste API) installieren
npm install tesseract.js@^5.0.0

# Installierte Version verifizieren (KRITISCH — v4 und v5 haben unterschiedliche APIs!)
node -p "require('./node_modules/tesseract.js/package.json').version"
# Erwartet: "5.x.x"

# TypeScript-Compile prüfen
npx tsc --noEmit
```

**⚠️ Warum Version-Check wichtig:**

| Version | API |
|---------|-----|
| **v5.x (empfohlen)** | `Tesseract.createWorker('deu+eng')` — gibt direkt funktionsfähigen Worker zurück |
| v4.x | `await worker.loadLanguage('deu+eng'); await worker.initialize('deu+eng');` — drei Schritte |
| v2–v3 | legacy, nicht nutzen |

Diese Spec zeigt **v5 API**. Falls Installation v4 ergibt, entsprechend anpassen oder explizit v5 installieren: `npm install tesseract.js@5.0.4`.

---

## Schritt 2 — Tests schreiben (TDD)

**Mock-File zuerst anlegen** (wird von Vitest vor den Tests geladen):

Datei: **`src/renderer/services/__mocks__/tesseract.js.ts`**

```typescript
import { vi } from 'vitest';

// Mock für Tesseract-Worker in Tests — keine echte OCR-Initialisierung
export const createWorker = vi.fn(async (_langs: string) => {
  return {
    recognize: vi.fn(async (_canvas: HTMLCanvasElement) => ({
      data: {
        text: 'Mock-Text',
        words: [
          {
            text: 'Max',
            confidence: 92,
            bbox: { x0: 10, y0: 10, x1: 50, y1: 30 },
          },
          {
            text: 'Mustermann',
            confidence: 88,
            bbox: { x0: 55, y0: 10, x1: 150, y1: 30 },
          },
        ],
      },
    })),
    terminate: vi.fn(async () => undefined),
    reinitialize: vi.fn(),
  };
});

export default { createWorker };
```

**Test-Datei:**

Datei: **`src/renderer/services/__tests__/ocr-service.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tesseract-Worker wird gemockt — siehe __mocks__/tesseract.js.ts
vi.mock('tesseract.js');

import {
  OcrService,
  pixelBoundsToPoints,
  filterByConfidence,
  buildTextItemsFromWords,
} from '../ocr-service';
import { TextItem } from '../../../common/types';

// ── Koordinaten-Transformation ────────────────────────────────

describe('pixelBoundsToPoints', () => {
  it('konvertiert Pixel zu PDF-Punkten bei scale=2', () => {
    const result = pixelBoundsToPoints({ x0: 20, y0: 40, x1: 60, y1: 60 }, 2);
    expect(result.x).toBe(10);    // 20 / 2
    expect(result.y).toBe(20);    // 40 / 2
    expect(result.width).toBe(20);  // (60-20) / 2
    expect(result.height).toBe(10); // (60-40) / 2
  });

  it('gibt korrekte Werte bei scale=1 zurück', () => {
    const result = pixelBoundsToPoints({ x0: 10, y0: 10, x1: 100, y1: 30 }, 1);
    expect(result.x).toBe(10);
    expect(result.width).toBe(90);
    expect(result.height).toBe(20);
  });
});

// ── Confidence-Filter ─────────────────────────────────────────

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

  it('gibt alle zurück wenn threshold=0', () => {
    const items = [makeItem('a', 0.1), makeItem('b', 0.9)];
    expect(filterByConfidence(items, 0)).toHaveLength(2);
  });

  it('gibt leeres Array wenn alle unter threshold', () => {
    const items = [makeItem('a', 0.1)];
    expect(filterByConfidence(items, 0.5)).toHaveLength(0);
  });
});

// ── TextItem-Mapping ──────────────────────────────────────────

describe('buildTextItemsFromWords', () => {
  it('konvertiert Tesseract-Words zu TextItems', () => {
    const mockWords = [
      { text: 'Hallo', confidence: 95, bbox: { x0: 10, y0: 20, x1: 60, y1: 40 } },
      { text: 'Welt', confidence: 80, bbox: { x0: 70, y0: 20, x1: 110, y1: 40 } },
    ];
    const items = buildTextItemsFromWords(mockWords as any, 2, 1);
    expect(items).toHaveLength(2);
    expect(items[0].text).toBe('Hallo');
    expect(items[0].confidence).toBeCloseTo(0.95);   // 95 / 100
    expect(items[0].bounds.x).toBe(5);               // 10 / 2 (scale=2)
    expect(items[0].page).toBe(1);
    expect(items[1].text).toBe('Welt');
  });

  it('ignoriert leere Wörter', () => {
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

// ── OcrService Interface ──────────────────────────────────────

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

    // Mock liefert 2 Worte
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

// ── Integrationstest (Pflicht laut SPEC_CONVENTIONS §10) ─────

describe('Integration: OCR-Pipeline', () => {
  it('End-to-End: initialize → recognize → scale → filter', async () => {
    const svc = new OcrService();
    await svc.initialize(['deu', 'eng']);

    // Mock liefert 2 Worte mit Confidence 0.92 und 0.88
    const canvas = document.createElement('canvas');
    const items = await svc.recognizePage(canvas, 5, 2.0); // scale=2, page=5

    // Scale-Mapping: Mock-Bbox 10-50 bei scale=2 → PDF-Punkte 5-25
    expect(items[0].bounds.x).toBe(5);  // 10 / 2
    expect(items[0].bounds.width).toBe(20);  // (50-10) / 2
    expect(items[0].page).toBe(5);

    // Confidence-Filter
    const filtered = filterByConfidence(items, 0.9);
    expect(filtered).toHaveLength(1);  // nur „Max" (0.92), nicht „Mustermann" (0.88)

    await svc.terminate();
  });
});
```

---

## Schritt 3 — Implementation

### 3a. Neue Datei: `src/renderer/services/ocr-service.ts`

**Tesseract.js v5 API** (für v4 siehe Kompatibilitäts-Block unten):

```typescript
import { createWorker, type Worker as TesseractWorker, type Word as TesseractWord } from 'tesseract.js';
import { TextItem, BoundingBox } from '../../common/types';

// ── Exportierte Hilfsfunktionen (testbar ohne Worker) ─────────

export function pixelBoundsToPoints(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  scale: number
): BoundingBox {
  return {
    x: bbox.x0 / scale,
    y: bbox.y0 / scale,
    width: (bbox.x1 - bbox.x0) / scale,
    height: (bbox.y1 - bbox.y0) / scale,
  };
}

export function filterByConfidence(items: TextItem[], threshold: number): TextItem[] {
  return items.filter(item => (item.confidence ?? 1) >= threshold);
}

export function buildTextItemsFromWords(
  words: TesseractWord[],
  scale: number,
  pageNumber: number
): TextItem[] {
  return words
    .filter(word => word.text.trim().length > 0)
    .map(word => ({
      text: word.text,
      bounds: pixelBoundsToPoints(word.bbox, scale),
      page: pageNumber,
      confidence: word.confidence / 100,
    }));
}

// ── OCR-Service ───────────────────────────────────────────────

export class OcrService {
  private worker: TesseractWorker | null = null;
  private aborted = false;

  async initialize(languages: string[] = ['deu', 'eng']): Promise<void> {
    // Tesseract.js v5: createWorker akzeptiert direkt Sprach-String
    this.worker = await createWorker(languages.join('+'));
    this.aborted = false;
  }

  async recognizePage(
    canvas: HTMLCanvasElement,
    pageNumber: number,
    scale: number
  ): Promise<TextItem[]> {
    if (!this.worker) {
      throw new Error('OCR-Worker nicht initialisiert. initialize() zuerst aufrufen.');
    }
    if (this.aborted) {
      throw new Error('OCR-Vorgang wurde abgebrochen.');
    }

    const { data } = await this.worker.recognize(canvas);
    return buildTextItemsFromWords(data.words, scale, pageNumber);
  }

  /** Markiert Service als abgebrochen. Laufende recognize() wird noch zu Ende geführt, aber nachfolgende werfen. */
  abort(): void {
    this.aborted = true;
  }

  async terminate(): Promise<void> {
    if (!this.worker) return;  // idempotent
    try {
      await this.worker.terminate();
    } catch {
      // Worker bereits terminiert — ignorieren
    }
    this.worker = null;
  }
}
```

### Kompatibilität zu Tesseract.js v4

Falls aus irgendeinem Grund v4 installiert ist (nicht empfohlen), muss `initialize` angepasst werden:

```typescript
// v4 API — dreischrittig:
async initialize(languages: string[] = ['deu', 'eng']): Promise<void> {
  this.worker = await createWorker() as unknown as TesseractWorker;
  await (this.worker as any).loadLanguage(languages.join('+'));
  await (this.worker as any).initialize(languages.join('+'));
  this.aborted = false;
}
```

### 3b. `src/common/types.ts` — `AppSettings` erweitern

```typescript
export interface AppSettings {
  maxFileSizeMB: number;
  maxPageCount: number;
  tempDirectory: string;
  defaultExportQuality: ExportQuality;
  defaultMode: RedactionMode;
  lastOpenDirectory: string;
  lastExportDirectory: string;
  ocrConfidenceThreshold: number;   // ← NEU: Standard 0.5
  ocrLanguages: string[];            // ← NEU: Standard ['deu', 'eng']
}
```

### 3c. `src/renderer/components/Toolbar.tsx` — OCR in den Analyse-Flow integrieren

**Hinweis zur Spec-07-Kompatibilität:** Falls Spec 07 bereits implementiert ist, ersetze `state.fileData` durch `activeDoc?.fileData` und dispatch-Calls entsprechend.

**Import hinzufügen:**
```typescript
import { OcrService, filterByConfidence } from '../services/ocr-service';
```

**In `handleAnalyze`**, den bestehenden Block:
```typescript
if (!pageHasText) {
  console.warn(`Seite ${i}: Kein Textlayer gefunden. OCR ist in dieser Version deaktiviert.`);
}
```

**Ersetzen durch:**
```typescript
if (!pageHasText) {
  // OCR für Seiten ohne Textlayer
  if (!ocrService) {
    dispatch({ type: 'SET_ANALYSIS_PROGRESS', progress: 'OCR-Engine wird geladen…' });
    ocrService = new OcrService();
    const ocrLanguages = settings?.ocrLanguages ?? ['deu', 'eng'];
    await ocrService.initialize(ocrLanguages);
  }

  dispatch({
    type: 'SET_ANALYSIS_PROGRESS',
    progress: `Seite ${i} von ${pdf.numPages} — OCR läuft…`,
  });

  const ocrCanvas = document.createElement('canvas');
  const ocrScale = 2.0; // Höhere Auflösung für bessere OCR-Qualität
  const ocrViewport = page.getViewport({ scale: ocrScale });
  ocrCanvas.width = ocrViewport.width;
  ocrCanvas.height = ocrViewport.height;
  const ocrCtx = ocrCanvas.getContext('2d')!;
  await page.render({ canvasContext: ocrCtx, viewport: ocrViewport }).promise;

  const rawOcrItems = await ocrService.recognizePage(ocrCanvas, i, ocrScale);
  const threshold = settings?.ocrConfidenceThreshold ?? 0.5;
  const filteredItems = filterByConfidence(rawOcrItems, threshold);
  allTextItems.push(...filteredItems);

  usedOcr = true;
  ocrCanvas.remove();
}
```

**Vor der Page-Loop** initialisieren:
```typescript
let ocrService: OcrService | null = null;
```

**Nach der Page-Loop** aufräumen:
```typescript
if (ocrService) {
  await ocrService.terminate();
  ocrService = null;
}
```

**Settings laden** (am Anfang von `handleAnalyze`):
```typescript
const settings = await window.electronAPI.getSettings().catch(() => null);
```

### 3d. OCR-Hinweis im UI

**In Toolbar.tsx JSX**, nach dem Analyse-Button:

```tsx
{state.hasAnalyzed && (activeDoc?.analysisTypes ?? state.analysisTypes ?? []).includes('ocr') && (
  <span
    className="ocr-hint"
    title="OCR-Ergebnisse können weniger präzise sein als eingebetteter Text"
    style={{
      fontSize: 'var(--font-size-xs)',
      color: 'var(--accent-warning)',
      padding: '2px 6px',
      background: 'rgba(245, 158, 11, 0.1)',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    ⚠ OCR
  </span>
)}
```

### 3e. Settings-Service — Standardwerte ergänzen

**`src/main/services/settings-service.ts`** — in den Default-Settings:
```typescript
ocrConfidenceThreshold: 0.5,
ocrLanguages: ['deu', 'eng'],
```

---

## Schritt 4 — Tests ausführen

```bash
npx vitest run src/renderer/services/__tests__/ocr-service.test.ts --reporter=verbose
npx tsc --noEmit
```

---

## Manuelle Verifikation

Da Tesseract.js einen echten Browser-Kontext benötigt:

1. `npm run dev` starten
2. Bildbasiertes PDF öffnen (gescanntes Dokument ohne Textlayer)
3. Analyse starten
4. Erwartetes Verhalten:
   - Progressanzeige zeigt „OCR-Engine wird geladen…" dann „Seite X — OCR läuft…"
   - Nach Analyse: PII-Vorschläge vorhanden (abhängig von Scan-Qualität)
   - OCR-Hinweis-Badge erscheint neben Analyse-Button
5. Normales PDF (mit Textlayer) öffnen → kein OCR ausgelöst, kein OCR-Badge

### Testdokument erstellen
```bash
# Word-Dokument als Bild-PDF exportieren (alle Fonts als Bitmaps):
# In Word: Datei → Exportieren → PDF → Optionen → Alle Seiten als Bild
```

---

## Bekannte Einschränkungen

| Einschränkung | Auswirkung |
|--------------|------------|
| Handschrift | Schlecht erkannt (kein Ziel v1.1) |
| Scan < 150 DPI | Unzuverlässige Ergebnisse — User-Hinweis empfohlen |
| Erstes Laden | Sprachdaten (deu: ~4 MB) beim ersten OCR-Einsatz geladen → Wartezeit |
| Worker-Lifecycle | Bei Analyse-Abbruch (Ctrl+C) könnte Worker im Hintergrund laufen — `terminate()` im Catch-Block |

### Fehlerbehandlung und Cancelation im Analyse-Flow

```typescript
// handleAnalyze sollte in try/catch/finally gekapselt sein:
let ocrService: OcrService | null = null;
try {
  // ... analyse-loop mit ocrService.recognizePage() ...
} catch (err: any) {
  // Abort und Worker terminieren
  if (ocrService) ocrService.abort();
  dispatch({ type: 'SET_ERROR', error: `Analysefehler: ${err.message}` });
} finally {
  // IMMER aufräumen — auch bei Erfolg, Fehler oder Abort
  if (ocrService) {
    try { await ocrService.terminate(); } catch { /* ignore */ }
    ocrService = null;
  }
  dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
}
```

### Cancelation via „Abbrechen"-Button (optional, empfohlen)

Für lange OCR-Läufe (20+ Seiten) sollte der User abbrechen können:

```typescript
// In Toolbar.tsx, neuer State:
const [cancelRequested, setCancelRequested] = useState(false);
const ocrServiceRef = useRef<OcrService | null>(null);

// In handleAnalyze vor OCR-Loop:
if (cancelRequested) {
  ocrServiceRef.current?.abort();
  throw new Error('Analyse abgebrochen');
}

// Button im UI wenn isAnalyzing:
{state.isAnalyzing && (
  <button onClick={() => setCancelRequested(true)}>Abbrechen</button>
)}
```

---

## Definition of Done

- [ ] `tesseract.js` v5.x in `package.json` dependencies (Version via `node -p` verifiziert)
- [ ] `__mocks__/tesseract.js.ts` Mock-Datei vorhanden
- [ ] `ocr-service.ts` mit 4 exports: `OcrService`, `pixelBoundsToPoints`, `filterByConfidence`, `buildTextItemsFromWords`
- [ ] Alle 14+ Tests aus `ocr-service.test.ts` grün (Lifecycle + Integration)
- [ ] `OcrService.abort()` Methode vorhanden
- [ ] `terminate()` ist idempotent
- [ ] `ocrConfidenceThreshold` + `ocrLanguages` in `AppSettings`
- [ ] Settings-Service liefert korrekte Standardwerte (`0.5` + `['deu', 'eng']`)
- [ ] `handleAnalyze` hat `try/catch/finally` mit Worker-Cleanup
- [ ] Normales PDF → kein OCR ausgelöst (Performance: kein Worker initialisiert)
- [ ] **Manuell:** Bild-PDF (gescannt ohne Textlayer) → OCR läuft → PII-Vorschläge vorhanden
- [ ] **Manuell:** OCR-Hinweis-Badge erscheint nach OCR-Nutzung
- [ ] **Manuell:** Worker wird nach Analyse korrekt terminiert (im Task-Manager kein hängender Prozess)
- [ ] **Manuell:** Analyse-Fehler während OCR → kein Zombie-Worker
- [ ] `npx tsc --noEmit` fehlerfrei
- [ ] Universal-Checks aus `SPEC_CONVENTIONS.md §9` erfüllt

---

## Kompatibilität mit Spec 07A/07B

**Wenn Spec 07A/07B bereits implementiert:**
- State-Zugriffe in `Toolbar.tsx` sind auf `activeDoc` umgestellt
- `analysisTypes`, `hasAnalyzed`, `isAnalyzing` sind Teil von `DocumentState`
- OCR-Status wird pro Dokument geführt (`activeDoc.analysisTypes.includes('ocr')`)

**Wenn Spec 07A/07B NICHT implementiert:**
- Original-State wird genutzt (`state.analysisTypes`, `state.hasAnalyzed`, etc.)
- Diese Spec funktioniert in beiden Fällen — die Code-Beispiele zeigen den einfacheren Pre-07A-Fall.
