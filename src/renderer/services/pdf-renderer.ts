import { RedactionEntry, RedactionMode, ExportQuality } from '../../common/types';

export function getScaleForDpi(quality: ExportQuality): number {
  return (quality === 'high' ? 300 : 150) / 72;
}

export function getJpegQuality(quality: ExportQuality): number {
  return quality === 'high' ? 0.95 : 0.8;
}

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
