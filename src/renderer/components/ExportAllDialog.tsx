import React from 'react';
import { DocumentState } from '../store/types-and-reducer';

interface ExportAllDialogProps {
  documents: DocumentState[];
  onExportSingle: (docId: string) => void;
  onExportAll: () => void;
  onClose: () => void;
}

export default function ExportAllDialog({ documents, onExportSingle, onExportAll, onClose }: ExportAllDialogProps) {
  const activeCount = documents.filter(
    d => d.redactions.some(r => r.status === 'akzeptiert' || r.status === 'manuell')
  ).length;

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
        width: 480, maxWidth: '90vw',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: 'var(--space-md) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
          fontWeight: 600,
        }}>
          Export – {documents.length} Dokumente geöffnet ({activeCount} mit aktiven Markierungen)
        </div>

        <div style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <button className="btn btn-primary" onClick={onExportAll}
            disabled={activeCount === 0}
            style={{ width: '100%', padding: '10px', fontSize: 14 }}>
            💾 Alle Dokumente exportieren ({activeCount} PDFs + kombinierte CSV)
          </button>

          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            — oder einzelnes Dokument —
          </div>

          {documents.map(doc => {
            const hasActive = doc.redactions.some(r => r.status === 'akzeptiert' || r.status === 'manuell');
            return (
              <button
                key={doc.id}
                className="btn btn-secondary"
                disabled={!hasActive}
                onClick={() => onExportSingle(doc.id)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13 }}
              >
                📄 {doc.fileName}
                {!hasActive && <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-sm)' }}>(keine aktiven Markierungen)</span>}
              </button>
            );
          })}
        </div>

        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: 'var(--space-sm) var(--space-lg)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
