import React, { useState, useEffect, useCallback } from 'react';
import { RedactionEntry, RedactionMode, ExportQuality } from '../../common/types';
import { renderPageToDataUrl } from '../services/pdf-renderer';

interface ExportPreviewModalProps {
  fileData: Uint8Array;
  pageCount: number;
  initialPage: number;
  redactions: RedactionEntry[];
  initialMode: RedactionMode;
  initialQuality: ExportQuality;
  onExport: (mode: RedactionMode, quality: ExportQuality) => void;
  onClose: () => void;
}

export default function ExportPreviewModal({
  fileData, pageCount, initialPage, redactions,
  initialMode, initialQuality, onExport, onClose,
}: ExportPreviewModalProps) {
  const [previewPage, setPreviewPage] = useState(initialPage);
  const [previewMode, setPreviewMode] = useState<RedactionMode>(initialMode);
  const [previewQuality, setPreviewQuality] = useState<ExportQuality>(initialQuality);
  const [isRendering, setIsRendering] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const renderPreview = useCallback(async () => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const url = await renderPageToDataUrl(fileData, previewPage, redactions, previewMode, previewQuality);
      setPreviewUrl(url);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setPreviewUrl(null);
    } finally {
      setIsRendering(false);
    }
  }, [fileData, previewPage, redactions, previewMode, previewQuality]);

  useEffect(() => {
    return () => {
      setPreviewUrl(null);
    };
  }, []);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div className="modal-content" style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        maxWidth: '90vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', width: 800,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontWeight: 600 }}>
            Vorschau: Seite {previewPage} von {pageCount}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-icon btn-sm"
              disabled={previewPage <= 1}
              onClick={() => setPreviewPage(p => p - 1)}>◀</button>
            <button className="btn btn-ghost btn-icon btn-sm"
              disabled={previewPage >= pageCount}
              onClick={() => setPreviewPage(p => p + 1)}>▶</button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="Schließen (Escape)">✕</button>
          </div>
        </div>

        {/* Canvas-Bereich */}
        <div style={{
          flex: 1, overflow: 'auto', background: '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-lg)', minHeight: 300,
        }}>
          {isRendering ? (
            <div style={{ color: 'var(--text-secondary)' }}>Vorschau wird gerendert…</div>
          ) : renderError ? (
            <div style={{ color: 'var(--text-error)' }}>Fehler: {renderError}</div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`Vorschau Seite ${previewPage}`}
              style={{ maxWidth: '100%', maxHeight: '60vh', boxShadow: 'var(--shadow-md)' }}
            />
          ) : null}
        </div>

        {/* Footer — Einstellungen + Aktionen */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-md) var(--space-lg)',
          display: 'flex', gap: 'var(--space-lg)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-mode" value="schwärzen"
                checked={previewMode === 'schwärzen'}
                onChange={() => setPreviewMode('schwärzen')} />
              Schwärzen
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-mode" value="pseudonymisieren"
                checked={previewMode === 'pseudonymisieren'}
                onChange={() => setPreviewMode('pseudonymisieren')} />
              Pseudonymisieren
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-quality" value="high"
                checked={previewQuality === 'high'}
                onChange={() => setPreviewQuality('high')} />
              300 DPI
            </label>
            <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <input type="radio" name="preview-quality" value="compressed"
                checked={previewQuality === 'compressed'}
                onChange={() => setPreviewQuality('compressed')} />
              150 DPI
            </label>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Abbrechen
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => { onClose(); onExport(previewMode, previewQuality); }}
            >
              So exportieren →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
