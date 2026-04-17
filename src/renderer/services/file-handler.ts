import { Action } from '../store/app-store';
import { createDocumentState } from '../store/types-and-reducer';
import { v4 as uuidv4 } from 'uuid';

interface OpenResult {
  loaded: number;
  failed: { fileName: string; reason: string }[];
}

/**
 * Öffnet eine oder mehrere PDF-Dateien.
 * Fehlerhafte Dateien werden übersprungen und am Ende zusammengefasst gemeldet —
 * der Rest wird trotzdem geladen.
 */
export async function openPdfFile(
  dispatch: React.Dispatch<Action>,
  filePath?: string,
  browserFallback?: () => void
): Promise<OpenResult> {
  const result: OpenResult = { loaded: 0, failed: [] };

  try {
    let paths: string[] = [];

    if (filePath) {
      paths = [filePath];
    } else if (window.electronAPI) {
      const dialogResult = await window.electronAPI.openFileDialog();
      if (Array.isArray(dialogResult)) {
        paths = dialogResult;
      } else if (dialogResult) {
        paths = [dialogResult];
      }
    } else if (browserFallback) {
      browserFallback();
      return result;
    }

    if (paths.length === 0) return result;

    const validPaths = paths.filter(p => p.toLowerCase().endsWith('.pdf'));
    const invalidExtPaths = paths.filter(p => !p.toLowerCase().endsWith('.pdf'));
    for (const p of invalidExtPaths) {
      result.failed.push({ fileName: fileNameOf(p), reason: 'Keine PDF-Datei' });
    }

    if (validPaths.length === 0) {
      reportResult(dispatch, result);
      return result;
    }

    const { getPdfDocument } = await import('./pdf-init');
    const settings = await window.electronAPI.getSettings();

    for (const selectedPath of validPaths) {
      const fileName = fileNameOf(selectedPath);
      try {
        const analyzeResult = await window.electronAPI.analyzePdf(selectedPath);

        if (!analyzeResult || !analyzeResult.fileData) {
          result.failed.push({ fileName, reason: 'Datei konnte nicht gelesen werden' });
          continue;
        }

        const uint8 = new Uint8Array(analyzeResult.fileData);

        const fileSizeMB = uint8.length / (1024 * 1024);
        if (fileSizeMB > settings.maxFileSizeMB) {
          result.failed.push({
            fileName,
            reason: `Datei zu groß (${fileSizeMB.toFixed(1)} MB, Max: ${settings.maxFileSizeMB} MB)`,
          });
          continue;
        }

        let pdf;
        try {
          pdf = await getPdfDocument(uint8);
        } catch (pdfErr: any) {
          result.failed.push({
            fileName,
            reason: `Ungültige PDF-Struktur: ${pdfErr?.message || 'Unbekannter Fehler'}`,
          });
          continue;
        }

        if (settings.maxPageCount > 0 && pdf.numPages > settings.maxPageCount) {
          result.failed.push({
            fileName,
            reason: `Zu viele Seiten (${pdf.numPages}, Max: ${settings.maxPageCount})`,
          });
          continue;
        }

        const doc = createDocumentState({
          id: uuidv4(),
          filePath: selectedPath,
          fileName,
          fileData: uint8,
          pageCount: pdf.numPages,
        });

        dispatch({ type: 'ADD_DOCUMENT', doc });
        result.loaded++;
      } catch (err: any) {
        result.failed.push({
          fileName,
          reason: err?.message || 'Unbekannter Fehler',
        });
      }
    }

    reportResult(dispatch, result);
  } catch (err: any) {
    dispatch({ type: 'SET_ERROR', error: `Fehler beim Laden: ${err?.message || err}` });
  }

  return result;
}

function fileNameOf(p: string): string {
  return p.split(/[/\\]/).pop() || 'dokument.pdf';
}

function reportResult(dispatch: React.Dispatch<Action>, result: OpenResult): void {
  if (result.failed.length === 0) return;

  const lines = result.failed.map(f => `• ${f.fileName}: ${f.reason}`).join('\n');
  const header = result.loaded > 0
    ? `${result.loaded} Datei(en) geöffnet, ${result.failed.length} fehlgeschlagen:`
    : `${result.failed.length} Datei(en) konnten nicht geöffnet werden:`;

  dispatch({ type: 'SET_ERROR', error: `${header}\n${lines}` });
}
