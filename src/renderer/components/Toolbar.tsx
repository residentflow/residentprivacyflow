import React, { useCallback } from 'react';
import { useAppState } from '../store/app-store';
import { RedactionMode } from '../../common/types';
import Tooltip from './Tooltip';

export default function Toolbar() {
  const { state, dispatch, performUndo, performRedo } = useAppState();

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

  const handleExport = useCallback(async () => {
    if (!state.filePath) return;

    try {
      const activeRedactions = state.redactions.filter(
        r => r.status === 'akzeptiert' || r.status === 'manuell'
      );

      if (state.redactions.some(r => r.status === 'vorschlag')) {
        dispatch({ 
          type: 'SET_ERROR', 
          error: 'Hinweis: Es gibt noch offene Vorschläge. Diese werden beim Export ignoriert. Nur akzeptierte Markierungen werden verarbeitet.' 
        });
      }

      if (activeRedactions.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'Keine aktiven Schwärzungen zum Exportieren vorhanden.' });
        return;
      }

      const baseName = state.fileName?.replace(/\.pdf$/i, '') || 'document';
      const suffix = state.mode === 'pseudonymisieren' ? '_pseudonymisiert' : '_geschwärzt';
      const defaultName = `${baseName}${suffix}.pdf`;

      const outputPath = await window.electronAPI.saveFileDialog(defaultName);
      if (!outputPath) return;

      dispatch({ type: 'SET_EXPORTING', isExporting: true, progress: 'Export wird vorbereitet…' });

      const { getPdfDocument } = await import('../services/pdf-init');
      const pdf = await getPdfDocument(state.fileData!);
      const dpi = state.exportQuality === 'high' ? 300 : 150;
      const scale = dpi / 72;

      const { jsPDF } = await import('jspdf');

      const firstPage = await pdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1.0 });
      const pdfDoc = new jsPDF({
        orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [firstViewport.width, firstViewport.height],
      });

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
        for (const redaction of pageRedactions) {
          const x = redaction.bounds.x * scale;
          const y = redaction.bounds.y * scale;
          const w = redaction.bounds.width * scale;
          const h = redaction.bounds.height * scale;

          if (state.mode === 'pseudonymisieren') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#1a1a2e';
            ctx.font = `bold ${Math.max(10, h * 0.6)}px Inter, Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.fillText(`[${redaction.variableName}]`, x + 2, y + h / 2, w - 4);
          } else {
            ctx.fillStyle = '#000000';
            ctx.fillRect(x, y, w, h);
          }
        }

        const imgData = canvas.toDataURL('image/jpeg', state.exportQuality === 'high' ? 0.95 : 0.8);

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
      const pdfUint8 = new Uint8Array(pdfBytes);

      await window.electronAPI.exportPdf({
        sourceFilePath: state.filePath,
        redactions: activeRedactions,
        quality: state.exportQuality,
        outputPath,
        csvPath: outputPath.replace(/\.pdf$/i, '_zuordnung.csv'),
        mode: state.mode,
        pdfData: pdfUint8,
      });

      await window.electronAPI.addAuditLog({
        fileName: state.fileName || '',
        pageCount: pdf.numPages,
        redactionCount: state.mode === 'schwärzen' ? activeRedactions.length : 0,
        pseudonymizationCount: state.mode === 'pseudonymisieren' ? activeRedactions.length : 0,
        exportQuality: state.exportQuality,
        analysisTypes: state.analysisTypes || ['textlayer', 'regex', 'heuristic'],
        mode: state.mode,
      });

      dispatch({ type: 'SET_EXPORTING', isExporting: false });
      dispatch({ type: 'SET_ERROR', error: `✅ Export erfolgreich gespeichert: ${outputPath}` });
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: `Exportfehler: ${err.message}` });
      dispatch({ type: 'SET_EXPORTING', isExporting: false });
    }
  }, [state, dispatch]);

  const handleModeChange = useCallback((mode: RedactionMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, [dispatch]);

  const handleNewFile = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return (
    <div className="app-toolbar">
      <div className="toolbar-group">
        <Tooltip content="Zur Auswahl zurückkehren">
          <button className="btn btn-secondary btn-sm" onClick={handleNewFile} id="btn-new-file">
            ← <span className="hide-mobile">Zur Auswahl</span>
          </button>
        </Tooltip>
        <span className="toolbar-filename" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {state.fileName || 'Kein Dokument'}
        </span>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <Tooltip content={state.hasAnalyzed ? 'Erneut analysieren' : 'Analyse starten'}>
          <button className="btn btn-primary btn-sm" onClick={handleAnalyze}
            disabled={state.isAnalyzing || !state.fileData} id="btn-analyze">
            🔍 <span className="hide-tablet">{state.hasAnalyzed ? 'Erneut' : 'Analyse'}</span> <span className="hide-mobile">{state.hasAnalyzed ? 'analysieren' : 'starten'}</span>
          </button>
        </Tooltip>
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
            disabled={state.undoStack.length === 0} id="btn-undo">↩</button>
        </Tooltip>
        <Tooltip content="Wiederholen (Strg+Y)">
          <button className="btn btn-ghost btn-icon btn-sm" onClick={performRedo}
            disabled={state.redoStack.length === 0} id="btn-redo">↪</button>
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
        <Tooltip content="PDF Speichern & Exportieren">
          <button className="btn btn-success btn-sm" onClick={handleExport}
            disabled={state.isExporting || state.redactions.filter(r => r.status === 'akzeptiert' || r.status === 'manuell').length === 0}
            id="btn-export">
            💾 <span className="hide-tablet">Exportieren</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
