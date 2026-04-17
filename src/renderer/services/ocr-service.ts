import { createWorker, type Worker as TesseractWorker, type Word as TesseractWord } from 'tesseract.js';
import { TextItem, BoundingBox } from '../../common/types';

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

export class OcrService {
  private worker: TesseractWorker | null = null;
  private aborted = false;

  async initialize(languages: string[] = ['deu', 'eng']): Promise<void> {
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

  abort(): void {
    this.aborted = true;
  }

  async terminate(): Promise<void> {
    if (!this.worker) return;
    try {
      await this.worker.terminate();
    } catch {
      // Worker bereits terminiert — ignorieren
    }
    this.worker = null;
  }
}
