/**
 * Centralized pdf.js initialization.
 * Worker is loaded LOCALLY (no CDN) to enable full offline operation.
 */

let pdfjsInitialized = false;
let pdfjsModule: typeof import('pdfjs-dist') | null = null;
let currentDocument: any = null;
let lastData: Uint8Array | null = null;
let loadPromise: Promise<any> | null = null;

export async function getPdfjs() {
  if (pdfjsModule && pdfjsInitialized) return pdfjsModule;
  pdfjsModule = await import('pdfjs-dist');
  pdfjsModule.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
  pdfjsInitialized = true;
  return pdfjsModule;
}

/**
 * Returns a PDF document promise. Caches the document to avoid re-opening it
 * and prevents ArrayBuffer detachment issues by only calling getDocument once.
 * Uses a singleton promise to handle concurrent requests.
 */
export async function getPdfDocument(data: Uint8Array) {
  // If we already have the document for this exact data reference, return it
  if (currentDocument && lastData === data) {
    return currentDocument;
  }

  // If a load is already in progress for this data, wait for it
  if (loadPromise && lastData === data) {
    return loadPromise;
  }

  // Otherwise, start a new load (and clear old cache if it's different data)
  const load = async () => {
    const pdfjs = await getPdfjs();
    
    // We use a clone to ensure we don't detach the store's buffer
    const doc = await pdfjs.getDocument({ 
      data: data.slice(),
      disableRange: true,
      disableStream: true
    }).promise;
    
    currentDocument = doc;
    lastData = data;
    loadPromise = null;
    return doc;
  };

  loadPromise = load();
  lastData = data; // Set lastData immediately to catch concurrent requests
  return loadPromise;
}

export function clearPdfCache() {
  currentDocument = null;
  lastData = null;
  loadPromise = null;
}
