import React from 'react';
import { DocumentState } from '../store/types-and-reducer';

interface TabBarProps {
  documents: DocumentState[];
  activeDocumentId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpenFile: () => void;
}

export default function TabBar({ documents, activeDocumentId, onSelectTab, onCloseTab, onOpenFile }: TabBarProps) {
  if (documents.length === 0) return null;

  return (
    <div className="tab-bar" style={{
      display: 'flex', alignItems: 'center',
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto', whiteSpace: 'nowrap',
      padding: '0 var(--space-sm)',
    }}>
      {documents.map(doc => (
        <div
          key={doc.id}
          className={`tab ${doc.id === activeDocumentId ? 'active' : ''}`}
          onClick={() => onSelectTab(doc.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)',
            padding: 'var(--space-sm) var(--space-md)',
            cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            borderBottom: doc.id === activeDocumentId ? '2px solid var(--brand-primary)' : '2px solid transparent',
            color: doc.id === activeDocumentId ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <span>📄</span>
          <span title={doc.fileName} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {doc.fileName}
          </span>
          {doc.isAnalyzing && <span style={{ fontSize: 10 }}>⏳</span>}
          <button
            className="btn btn-ghost btn-icon"
            onClick={e => { e.stopPropagation(); onCloseTab(doc.id); }}
            style={{ fontSize: 10, padding: '0 2px', lineHeight: 1, color: 'var(--text-muted)' }}
            title="Tab schließen"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={onOpenFile}
        style={{ marginLeft: 'var(--space-xs)', fontSize: 'var(--font-size-xs)' }}
        title="Weitere Datei öffnen"
      >
        + Öffnen
      </button>
    </div>
  );
}
