/**
 * Centralized pdf.js initialization.
 * Worker is loaded LOCALLY (no CDN) to enable full offline operation.
 */

let pdfjsInitialized = false;
let pdfjsModule: typeof import('pdfjs-dist') | null = null;

// Per-data-reference cache: each Uint8Array-instance gets its own PDFDocument.
// Prevents cross-document mixups when multiple PDFs are open simultaneously.
const documentCache = new WeakMap<Uint8Array, Promise<any>>();

export async function getPdfjs() {
  if (pdfjsModule && pdfjsInitialized) return pdfjsModule;
  pdfjsModule = await import('pdfjs-dist');
  pdfjsModule.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
  pdfjsInitialized = true;
  return pdfjsModule;
}

/**
 * Returns a PDF document for the given data buffer.
 * Caches per-instance via WeakMap — each Uint8Array gets its own document,
 * so concurrent rendering of different documents never mixes up content.
 */
export async function getPdfDocument(data: Uint8Array) {
  const cached = documentCache.get(data);
  if (cached) return cached;

  const loadPromise = (async () => {
    const pdfjs = await getPdfjs();
    // Use a clone so we don't detach the store's buffer.
    const doc = await pdfjs.getDocument({
      data: data.slice(),
      disableRange: true,
      disableStream: true,
    }).promise;
    return doc;
  })();

  documentCache.set(data, loadPromise);

  // If load fails, remove from cache so retry is possible.
  loadPromise.catch(() => {
    documentCache.delete(data);
  });

  return loadPromise;
}

export function clearPdfCache() {
  // WeakMap entries are GC'd automatically when the Uint8Array is unreferenced.
  // This function is kept for API compatibility but does nothing explicit.
}
