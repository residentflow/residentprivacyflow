import { Action } from '../store/app-store';

/**
 * Common logic to handle opening a PDF file.
 */
export async function openPdfFile(dispatch: React.Dispatch<Action>, filePath?: string, browserFallback?: () => void) {
  try {
    let selectedPath = filePath;

    if (!selectedPath) {
      if (window.electronAPI) {
        selectedPath = await window.electronAPI.openFileDialog() || undefined;
      } else if (browserFallback) {
        browserFallback();
        return;
      }
    }

    if (!selectedPath) return;

    // Validate extension
    if (!selectedPath.toLowerCase().endsWith('.pdf')) {
      dispatch({ type: 'SET_ERROR', error: 'Nur PDF-Dateien werden unterstützt.' });
      return;
    }

    const { clearPdfCache, getPdfDocument } = await import('./pdf-init');
    clearPdfCache();
    dispatch({ type: 'SET_ANALYZING', isAnalyzing: true, progress: 'PDF wird geladen…' });

    // Load via main process (reads file + returns buffer)
    const result = await window.electronAPI.analyzePdf(selectedPath);

    if (result.fileData) {
      const uint8 = new Uint8Array(result.fileData);

      // Validate file size
      const settings = await window.electronAPI.getSettings();
      const fileSizeMB = uint8.length / (1024 * 1024);
      if (fileSizeMB > settings.maxFileSizeMB) {
        dispatch({
          type: 'SET_ERROR',
          error: `Datei zu groß: ${fileSizeMB.toFixed(1)} MB (Maximum: ${settings.maxFileSizeMB} MB).`,
        });
        dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
        return;
      }

      const { getPdfDocument } = await import('./pdf-init');
      const pdf = await getPdfDocument(uint8);

      // Validate page count
      if (settings.maxPageCount > 0 && pdf.numPages > settings.maxPageCount) {
        dispatch({
          type: 'SET_ERROR',
          error: `Zu viele Seiten: ${pdf.numPages} (Maximum: ${settings.maxPageCount}).`,
        });
        dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
        return;
      }

      const fileName = selectedPath.split(/[/\\]/).pop() || 'document.pdf';

      dispatch({
        type: 'SET_FILE',
        filePath: selectedPath,
        fileName,
        fileData: uint8,
        pageCount: pdf.numPages,
      });
    }
  } catch (err: any) {
    dispatch({ type: 'SET_ERROR', error: `Fehler beim Laden: ${err.message}` });
  } finally {
    dispatch({ type: 'SET_ANALYZING', isAnalyzing: false });
  }
}
