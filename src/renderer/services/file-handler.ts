import { Action } from '../store/app-store';
import { createDocumentState } from '../store/types-and-reducer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Open one or more PDF files via dialog or given path.
 */
export async function openPdfFile(dispatch: React.Dispatch<Action>, filePath?: string, browserFallback?: () => void) {
  try {
    let paths: string[] = [];

    if (filePath) {
      paths = [filePath];
    } else {
      if (window.electronAPI) {
        const result = await window.electronAPI.openFileDialog();
        if (Array.isArray(result)) {
          paths = result;
        } else if (result) {
          paths = [result];
        }
      } else if (browserFallback) {
        browserFallback();
        return;
      }
    }

    if (paths.length === 0) return;

    // Validate extensions
    const validPaths = paths.filter(p => p.toLowerCase().endsWith('.pdf'));
    if (validPaths.length === 0) {
      dispatch({ type: 'SET_ERROR', error: 'Nur PDF-Dateien werden unterstützt.' });
      return;
    }

    const { clearPdfCache, getPdfDocument } = await import('./pdf-init');
    clearPdfCache();

    for (const selectedPath of validPaths) {
      dispatch({ type: 'UPDATE_DOCUMENT', docId: '__loading__', updates: { isAnalyzing: true, analysisProgress: 'PDF wird geladen…' } });

      const result = await window.electronAPI.analyzePdf(selectedPath);

      if (result.fileData) {
        const uint8 = new Uint8Array(result.fileData);

        const settings = await window.electronAPI.getSettings();
        const fileSizeMB = uint8.length / (1024 * 1024);
        if (fileSizeMB > settings.maxFileSizeMB) {
          dispatch({
            type: 'SET_ERROR',
            error: `Datei zu groß: ${fileSizeMB.toFixed(1)} MB (Maximum: ${settings.maxFileSizeMB} MB).`,
          });
          continue;
        }

        const pdf = await getPdfDocument(uint8);

        if (settings.maxPageCount > 0 && pdf.numPages > settings.maxPageCount) {
          dispatch({
            type: 'SET_ERROR',
            error: `Zu viele Seiten: ${pdf.numPages} (Maximum: ${settings.maxPageCount}).`,
          });
          continue;
        }

        const fileName = selectedPath.split(/[/\\]/).pop() || 'document.pdf';

        const doc = createDocumentState({
          id: uuidv4(),
          filePath: selectedPath,
          fileName,
          fileData: uint8,
          pageCount: pdf.numPages,
        });

        dispatch({ type: 'ADD_DOCUMENT', doc });
      }
    }
  } catch (err: any) {
    dispatch({ type: 'SET_ERROR', error: `Fehler beim Laden: ${err.message}` });
  }
}
