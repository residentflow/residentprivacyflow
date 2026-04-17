import React, { useCallback, useState } from 'react';
import { useAppState, useActiveDocument } from '../store/app-store';
import { RedactionMode } from '../../common/types';
import Tooltip from './Tooltip';
import { applyRedactionsToCanvas, getScaleForDpi, getJpegQuality } from '../services/pdf-renderer';
import ExportPreviewModal from './ExportPreviewModal';
import ExportAllDialog from './ExportAllDialog';
import { OcrService, filterByConfidence } from '../services/ocr-service';

export function buildCleanDocumentProperties() {
  return {
    title: '',
    subject: '',
    author: '',
    keywords: '',
    creator: 'ResidentPrivacyFlow',
  };
}

export function neutralizePdfProducer(bytes: Uint8Array): Uint8Array {
  const str = bytesToLatin1(bytes);

  let result = str;
  result = replacePaddedField(result, 'Producer', 'ResidentPrivacyFlow');
  result = replacePaddedField(result, 'CreationDate', '');
  result = replacePaddedField(result, 'ModDate', '');

  return latin1ToBytes(result);
}

function replacePaddedField(pdfStr: string, fieldName: string, newContent: string): string {
  const pattern = new RegExp(`/${fieldName}\\s*\\(([^)]*)\\)`);
  const match = pdfStr.match(pattern);
  if (!match) return pdfStr;

  const originalContent = match[1];
  const padded = newContent.length <= originalContent.length
    ? newContent.padEnd(originalContent.length, ' ')
    : newContent.slice(0, originalContent.length);

  return pdfStr.replace(pattern, `/${fieldName} (${padded})`);
}

function bytesToLatin1(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

function latin1ToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

interface ToolbarProps {
  drawMode: 'redaction' | 'groupselect';
  onDrawModeChange: (mode: 'redaction' | 'groupselect') => void;
}

export default function Toolbar({ drawMode, onDrawModeChange }: ToolbarProps) {
  const { state, dispatch, performUndo, performRedo } = useAppState();
  const activeDoc = useActiveDocument();
  const [showPreview, setShowPreview] = useState(false);
  const [showExportAll, setShowExportAll] = useState(false);

  const activeId = state.activeDocumentId;
  const fileData = activeDoc?.fileData ?? null;
  const filePath = activeDoc?.filePath ?? null;
  const fileName = activeDoc?.fileName ?? null;
  const pageCount = activeDoc?.pageCount ?? 0;
  const currentPage = activeDoc?.currentPage ?? 1;
  const redactions = activeDoc?.redactions ?? [];
  const hasAnalyzed = activeDoc?.hasAnalyzed ?? false;
  const isAnalyzing = activeDoc?.isAnalyzing ?? false;
  const undoStack = activeDoc?.undoStack ?? [];
  const redoStack = activeDoc?.redoStack ?? [];

  const handleAnalyze = useCallback(async () => {
    if (!fileData || !filePath || !activeId) return;

    let ocrService: OcrService | null = null;

    try {
      dispatch({ type: 'UPDATE_DOCUMENT', docId: activeId, updates: { isAnalyzing: true, analysisProgress: 'Text wird extrahiert…' } });

      const settings = await window.electronAPI.getSettings().catch(() => null);

      const { getPdfDocument } = await import('../services/pdf-init');
      const pdf = await getPdfDocument(fileData);
      const allTextItems: any[] = [];
      const analysisTypes: string[] = [];
      let usedOcr = false;

      for (let i = 1; i <= pdf.numPages; i++) {
        dispatch({
          type: 'UPDATE_DOCUMENT',
          docId: activeId,
          updates: { analysisProgress: `Seite ${i} von ${pdf.numPages} wird analysiert…` },
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
          if (!ocrService) {
            dispatch({ type: 'UPDATE_DOCUMENT', docId: activeId, updates: { analysisProgress: 'OCR-Engine wird geladen…' } });
            ocrService = new OcrService();
            const ocrLanguages = settings?.ocrLanguages ?? ['deu', 'eng'];
            await ocrService.initialize(ocrLanguages);
          }

          dispatch({
            type: 'UPDATE_DOCUMENT',
            docId: activeId,
            updates: { analysisProgress: `Seite ${i} von ${pdf.numPages} — OCR läuft…` },
          });

          const ocrCanvas = document.createElement('canvas');
          const ocrScale = 2.0;
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
      }

      if (!analysisTypes.includes('textlayer') && allTextItems.some(t => !t.ocrSource)) {
        analysisTypes.push('textlayer');
      }
      if (usedOcr) analysisTypes.push('ocr');

      dispatch({ type: 'UPDATE_DOCUMENT', docId: activeId, updates: { analysisProgress: 'PII-Erkennung läuft…' } });

      const { PIIDetectionClient } = await import('../services/pii-detection-client');
      const detector = new PIIDetectionClient();
      const suggestions = detector.detectAll(allTextItems);

      analysisTypes.push('regex', 'heuristic');

      const manualRedactions = redactions.filter(r => r.source === 'manual');
      dispatch({ type: 'SET_DOCUMENT_REDACTIONS', docId: activeId, redactions: [...manualRedactions, ...suggestions] });

      dispatch({ type: 'UPDATE_DOCUMENT', docId: activeId, updates: { hasAnalyzed: true, analysisTypes, isAnalyzing: false } });
    } catch (err: any) {
      if (ocrService) ocrService.abort();
      dispatch({ type: 'SET_ERROR', error: `Analysefehler: ${err.message}` });
    } finally {
      if (ocrService) {
        try { await ocrService.terminate(); } catch { /* ignore */ }
        ocrService = null;
      }
      dispatch({ type: 'UPDATE_DOCUMENT', docId: activeId!, updates: { isAnalyzing: false } });
    }
  }, [fileData, filePath, activeId, redactions, dispatch]);

  const handleExport = useCallback(async () => {
    if (!filePath || !activeId) return;

    try {
      const activeRedactions = redactions.filter(
        r => r.status === 'akzeptiert' || r.status === 'manuell'
      );

      if (redactions.some(r => r.status === 'vorschlag')) {
        dispatch({
          type: 'SET_ERROR',
          error: 'Hinweis: Es gibt noch offene Vorschläge. Diese werden beim Export ignoriert. Nur akzeptierte Markierungen werden verarbeitet.'
        });
      }

      if (activeRedactions.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'Keine aktiven Schwärzungen zum Exportieren vorhanden.' });
        return;
      }

      const baseName = fileName?.replace(/\.pdf$/i, '') || 'document';
      const suffix = state.mode === 'pseudonymisieren' ? '_pseudonymisiert' : '_geschwärzt';
      const defaultName = `${baseName}${suffix}.pdf`;

      const outputPath = await window.electronAPI.saveFileDialog(defaultName);
      if (!outputPath) return;

      dispatch({ type: 'SET_EXPORTING', isExporting: true, progress: 'Export wird vorbereitet…' });

      const { getPdfDocument } = await import('../services/pdf-init');
      const pdf = await getPdfDocument(fileData!);
      const scale = getScaleForDpi(state.exportQuality);

      const { jsPDF } = await import('jspdf');

      const firstPage = await pdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1.0 });
      const pdfDoc = new jsPDF({
        orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [firstViewport.width, firstViewport.height],
      });
      pdfDoc.setDocumentProperties(buildCleanDocumentProperties());

      for (let i = 1; i <= pdf.numPages; i++) {
        dispatch({
          type: 'SET_EXPORT_PROGRESS',
          progress: `Seite ${i} von ${pdf.numPages} wird gerendert (${state.exportQuality === 'high' ? '300' : '150'} DPI)…`,
        });

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const pageRedactions = activeRedactions.filter(r => r.page === i);
        applyRedactionsToCanvas(ctx, pageRedactions, state.mode, scale);

        const imgData = canvas.toDataURL('image/jpeg', getJpegQuality(state.exportQuality));

        if (i > 1) {
          const pViewport = page.getViewport({ scale: 1.0 });
          pdfDoc.addPage([pViewport.width, pViewport.height],
            pViewport.width > pViewport.height ? 'landscape' : 'portrait'
          );
        }

        const pViewport = page.getViewport({ scale: 1.0 });
        pdfDoc.addImage(imgData, 'JPEG', 0, 0, pViewport.width, pViewport.height);
        canvas.remove();
      }

      dispatch({ type: 'SET_EXPORT_PROGRESS', progress: 'PDF wird gespeichert…' });

      const pdfBytes = pdfDoc.output('arraybuffer');
      const pdfUint8 = neutralizePdfProducer(new Uint8Array(pdfBytes));

      await window.electronAPI.exportPdf({
        sourceFilePath: filePath,
        redactions: activeRedactions,
        quality: state.exportQuality,
        outputPath,
        csvPath: outputPath.replace(/\.pdf$/i, '_zuordnung.csv'),
        mode: state.mode,
        pdfData: pdfUint8,
      });

      await window.electronAPI.addAuditLog({
        fileName: fileName || '',
        pageCount: pdf.numPages,
        redactionCount: state.mode === 'schwärzen' ? activeRedactions.length : 0,
        pseudonymizationCount: state.mode === 'pseudonymisieren' ? activeRedactions.length : 0,
        exportQuality: state.exportQuality,
        analysisTypes: activeDoc?.analysisTypes || ['textlayer', 'regex', 'heuristic'],
        mode: state.mode,
      });

      dispatch({ type: 'SET_EXPORTING', isExporting: false });
      dispatch({ type: 'SET_ERROR', error: `✅ Export erfolgreich gespeichert: ${outputPath}` });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: `Exportfehler: ${err.message}` });
      dispatch({ type: 'SET_EXPORTING', isExporting: false });
    }
  }, [filePath, activeId, redactions, fileName, fileData, state.mode, state.exportQuality, activeDoc, dispatch]);

  const handleModeChange = useCallback((mode: RedactionMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, [dispatch]);

  const handleNewFile = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const handleExportAllDocuments = useCallback(async () => {
    dispatch({ type: 'SET_EXPORTING', isExporting: true, progress: 'Alle Dokumente werden exportiert…' });

    try {
      const { getPdfDocument } = await import('../services/pdf-init');
      const { jsPDF } = await import('jspdf');

      const csvExports: { fileName: string; rows: any[] }[] = [];

      for (const doc of state.documents) {
        const activeRedactions = doc.redactions.filter(
          r => r.status === 'akzeptiert' || r.status === 'manuell'
        );
        if (activeRedactions.length === 0) continue;

        const baseName = doc.fileName.replace(/\.pdf$/i, '');
        const suffix = state.mode === 'pseudonymisieren' ? '_pseudonymisiert' : '_geschwärzt';
        const defaultName = `${baseName}${suffix}.pdf`;

        const outputPath = await window.electronAPI.saveFileDialog(defaultName);
        if (!outputPath) continue;

        dispatch({ type: 'SET_EXPORT_PROGRESS', progress: `${doc.fileName} wird exportiert…` });

        const pdf = await getPdfDocument(doc.fileData);
        const scale = getScaleForDpi(state.exportQuality);
        const firstPage = await pdf.getPage(1);
        const firstViewport = firstPage.getViewport({ scale: 1.0 });
        const pdfDoc = new jsPDF({
          orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
          unit: 'pt', format: [firstViewport.width, firstViewport.height],
        });
        pdfDoc.setDocumentProperties(buildCleanDocumentProperties());

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const pageRedactions = activeRedactions.filter(r => r.page === i);
          applyRedactionsToCanvas(ctx, pageRedactions, state.mode, scale);
          const imgData = canvas.toDataURL('image/jpeg', getJpegQuality(state.exportQuality));
          if (i > 1) {
            const pv = page.getViewport({ scale: 1.0 });
            pdfDoc.addPage([pv.width, pv.height], pv.width > pv.height ? 'landscape' : 'portrait');
          }
          const pv = page.getViewport({ scale: 1.0 });
          pdfDoc.addImage(imgData, 'JPEG', 0, 0, pv.width, pv.height);
          canvas.remove();
        }

        const pdfBytes = pdfDoc.output('arraybuffer');
        const pdfUint8 = neutralizePdfProducer(new Uint8Array(pdfBytes));
        await window.electronAPI.exportPdf({
          sourceFilePath: doc.filePath,
          redactions: activeRedactions,
          quality: state.exportQuality,
          outputPath,
          csvPath: outputPath.replace(/\.pdf$/i, '_zuordnung.csv'),
          mode: state.mode,
          pdfData: pdfUint8,
        });

        await window.electronAPI.addAuditLog({
          fileName: doc.fileName,
          pageCount: pdf.numPages,
          redactionCount: state.mode === 'schwärzen' ? activeRedactions.length : 0,
          pseudonymizationCount: state.mode === 'pseudonymisieren' ? activeRedactions.length : 0,
          exportQuality: state.exportQuality,
          analysisTypes: doc.analysisTypes || ['textlayer', 'regex', 'heuristic'],
          mode: state.mode,
        });

        csvExports.push({ fileName: doc.fileName, rows: activeRedactions.map(r => ({
          bezeichnung: state.mode === 'pseudonymisieren' ? `[${r.variableName}]` : r.variableName,
          inhalt: r.originalContent, typ: r.category,
          gruppe: r.groupNumber > 0 ? `Gruppe ${r.groupNumber}` : '-',
          status: r.status === 'manuell' ? 'Manuell' : 'Akzeptiert',
          seite: String(r.page),
        })) });
      }

      // Combined CSV if more than one document was exported
      if (csvExports.length > 1) {
        const csvPath = await window.electronAPI.saveFileDialog('kombinierte_zuordnung.csv');
        if (csvPath) {
          await window.electronAPI.exportPdf({
            sourceFilePath: '',
            redactions: [],
            quality: state.exportQuality,
            outputPath: csvPath,
            csvPath,
            mode: state.mode,
            pdfData: new Uint8Array(),
            combinedCsvExports: csvExports,
          } as any);
        }
      }

      dispatch({ type: 'SET_EXPORTING', isExporting: false });
      dispatch({ type: 'SET_ERROR', error: `✅ Export erfolgreich: ${csvExports.length} Dokumente exportiert.` });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: `Exportfehler: ${err.message}` });
      dispatch({ type: 'SET_EXPORTING', isExporting: false });
    }
  }, [state.documents, state.mode, state.exportQuality, dispatch]);

  return (
    <div className="app-toolbar">
      <div className="toolbar-group">
        <Tooltip content="Zur Auswahl zurückkehren">
          <button className="btn btn-secondary btn-sm" onClick={handleNewFile} id="btn-new-file">
            ← <span className="hide-mobile">Zur Auswahl</span>
          </button>
        </Tooltip>
        <span className="toolbar-filename" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName || 'Kein Dokument'}
        </span>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <Tooltip content={hasAnalyzed ? 'Erneut analysieren' : 'Analyse starten'}>
          <button className="btn btn-primary btn-sm" onClick={handleAnalyze}
            disabled={isAnalyzing || !fileData} id="btn-analyze">
            🔍 <span className="hide-tablet">{hasAnalyzed ? 'Erneut' : 'Analyse'}</span> <span className="hide-mobile">{hasAnalyzed ? 'analysieren' : 'starten'}</span>
          </button>
        </Tooltip>
        {hasAnalyzed && (activeDoc?.analysisTypes ?? []).includes('ocr') && (
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
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <span className="toolbar-label">Modus:</span>
        <div className="mode-toggle">
          <Tooltip content="Schwärzen">
            <button className={`mode-toggle-btn ${state.mode === 'schwärzen' ? 'active' : ''}`}
              onClick={() => handleModeChange('schwärzen')} id="btn-mode-redact">
              ██ <span className="hide-mobile">Schwärzen</span>
            </button>
          </Tooltip>
          <Tooltip content="Pseudonymisieren">
            <button className={`mode-toggle-btn ${state.mode === 'pseudonymisieren' ? 'active' : ''}`}
              onClick={() => handleModeChange('pseudonymisieren')} id="btn-mode-pseudo">
              [P] <span className="hide-mobile">Pseudonymisieren</span>
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <Tooltip content="Rückgängig (Strg+Z)">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={performUndo}
            disabled={undoStack.length === 0} id="btn-undo">↩</button>
        </Tooltip>
        <Tooltip content="Wiederholen (Strg+Y)">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={performRedo}
            disabled={redoStack.length === 0} id="btn-redo">↪</button>
        </Tooltip>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <Tooltip content={drawMode === 'groupselect' ? 'Normaler Modus (Escape)' : 'Gruppe über Markierung zuweisen'}>
          <button
            className={`btn btn-ghost btn-sm ${drawMode === 'groupselect' ? 'active' : ''}`}
            onClick={() => onDrawModeChange(drawMode === 'groupselect' ? 'redaction' : 'groupselect')}
            disabled={!fileData}
            id="btn-group-select"
          >
            ⊡ <span className="hide-mobile">Gruppe</span>
          </button>
        </Tooltip>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 25 })}
          disabled={state.zoom <= 25} id="btn-zoom-out">−</button>
        <span className="zoom-display">{state.zoom}%</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 25 })}
          disabled={state.zoom >= 400} id="btn-zoom-in">+</button>
        <Tooltip content="Zoom zurücksetzen">
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_ZOOM', zoom: 100 })} id="btn-zoom-reset">
            <span className="hide-tablet">Zurücksetzen</span>
            <span className="hide-mobile">⟲</span>
          </button>
        </Tooltip>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <span className="toolbar-label">Qualität:</span>
        <Tooltip content="Export-Qualität einstellen">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select className="select" value={state.exportQuality}
              onChange={(e) => dispatch({ type: 'SET_EXPORT_QUALITY', quality: e.target.value as any })} id="select-quality">
              <option value="high">Hohe Qualität (300 DPI)</option>
              <option value="compressed">Komprimiert (150 DPI)</option>
            </select>
          </div>
        </Tooltip>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <Tooltip content="Vorschau vor dem Export">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowPreview(true)}
            disabled={redactions.filter(r => r.status === 'akzeptiert' || r.status === 'manuell').length === 0}
            id="btn-preview"
          >
            👁 <span className="hide-mobile">Vorschau</span>
          </button>
        </Tooltip>
        <Tooltip content="PDF Speichern & Exportieren">
          <button className="btn btn-success btn-sm"
            onClick={() => {
              if (state.documents.length > 1) {
                setShowExportAll(true);
              } else {
                handleExport();
              }
            }}
            disabled={state.isExporting || redactions.filter(r => r.status === 'akzeptiert' || r.status === 'manuell').length === 0}
            id="btn-export">
            💾 <span className="hide-tablet">Exportieren</span>
          </button>
        </Tooltip>
      </div>

      {showPreview && fileData && (
        <ExportPreviewModal
          fileData={fileData}
          pageCount={pageCount}
          initialPage={currentPage}
          redactions={redactions}
          initialMode={state.mode}
          initialQuality={state.exportQuality}
          onExport={(mode, quality) => {
            dispatch({ type: 'SET_MODE', mode });
            dispatch({ type: 'SET_EXPORT_QUALITY', quality });
            handleExport();
          }}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showExportAll && (
        <ExportAllDialog
          documents={state.documents}
          onExportSingle={(docId) => {
            setShowExportAll(false);
            dispatch({ type: 'SET_ACTIVE_DOCUMENT', id: docId });
            // Need to wait for state to settle, then export
            setTimeout(() => handleExport(), 50);
          }}
          onExportAll={() => {
            setShowExportAll(false);
            handleExportAllDocuments();
          }}
          onClose={() => setShowExportAll(false)}
        />
      )}
    </div>
  );
}
