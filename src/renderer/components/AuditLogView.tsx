import React, { useEffect, useState, useCallback } from 'react';
import { useAppState } from '../store/app-store';
import { AuditLogEntry } from '../../common/types';

export default function AuditLogView() {
  const { dispatch } = useAppState();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      try {
        if (window.electronAPI) {
          const log = await window.electronAPI.getAuditLog();
          setEntries(log);
        }
      } catch (err) {
        console.error('Failed to load audit log:', err);
      } finally {
        setLoading(false);
      }
    };
    loadEntries();
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="app-toolbar">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'SET_VIEW', view: 'start' })}
        >
          ← Zurück
        </button>
        <div className="toolbar-separator" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Verarbeitungsprotokoll</span>
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {entries.length} Einträge
        </span>
      </div>

      <div className="audit-panel">
        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" />
            <div className="empty-state-text">Wird geladen…</div>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">Noch keine Verarbeitungen protokolliert.</div>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="audit-entry">
              <span className="audit-timestamp">{formatDate(entry.timestamp)}</span>
              <span className="audit-filename">{entry.fileName}</span>
              <span className="audit-stat">{entry.pageCount} Seiten</span>
              <span className="audit-stat">
                {entry.redactionCount > 0 && `${entry.redactionCount} Schwärzungen`}
                {entry.pseudonymizationCount > 0 && `${entry.pseudonymizationCount} Pseudonymisierungen`}
              </span>
              <span className="audit-stat">
                {entry.exportQuality === 'high' ? '300 DPI' : '150 DPI'}
              </span>
              <span className="badge" style={{
                background: 'var(--bg-overlay)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}>
                {entry.mode === 'schwärzen' ? 'Schwärzen' : 'Pseudonymisieren'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
