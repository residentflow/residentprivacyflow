import React, { useState, useCallback, useEffect } from 'react';
import Toolbar from './Toolbar';
import SidebarThumbnails from './SidebarThumbnails';
import PdfViewer from './PdfViewer';
import RedactionTable from './RedactionTable';
import GroupAssignPopup from './GroupAssignPopup';
import TabBar from './TabBar';
import { useAppState, useActiveDocument } from '../store/app-store';
import { openPdfFile } from '../services/file-handler';

export default function EditorLayout() {
  const { state, dispatch } = useAppState();
  const activeDoc = useActiveDocument();
  const [drawMode, setDrawMode] = useState<'redaction' | 'groupselect'>('redaction');
  const [groupPopup, setGroupPopup] = useState<{
    affectedIds: string[];
    position: { x: number; y: number };
  } | null>(null);

  const redactions = activeDoc?.redactions ?? [];
  const allGroups = Array.from(new Set(redactions.map(r => r.groupNumber))).sort((a, b) => a - b);

  const handleGroupSelect = useCallback((affectedIds: string[], position: { x: number; y: number }) => {
    setGroupPopup({ affectedIds, position });
    setDrawMode('redaction');
  }, []);

  const handleGroupAssign = useCallback((groupNumber: number) => {
    if (!groupPopup || !state.activeDocumentId) return;
    const prevRedactions = [...redactions];
    dispatch({ type: 'ASSIGN_GROUP_TO_IDS', docId: state.activeDocumentId, ids: groupPopup.affectedIds, groupNumber });
    dispatch({
      type: 'PUSH_UNDO',
      docId: state.activeDocumentId,
      action: {
        type: 'assign_group',
        description: `Gruppe ${groupNumber} zugewiesen`,
        undo: () => prevRedactions,
        redo: () => redactions.map(r =>
          groupPopup.affectedIds.includes(r.id) ? { ...r, groupNumber } : r
        ),
      },
    });
    setGroupPopup(null);
  }, [groupPopup, redactions, dispatch, state.activeDocumentId]);

  const handleOpenFile = useCallback(() => {
    openPdfFile(dispatch);
  }, [dispatch]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (drawMode === 'groupselect' || groupPopup !== null)) {
        e.stopImmediatePropagation();
        setDrawMode('redaction');
        setGroupPopup(null);
      }
    };
    window.addEventListener('keydown', handleEscape, { capture: true });
    return () => window.removeEventListener('keydown', handleEscape, { capture: true });
  }, [drawMode, groupPopup]);

  const hasDocuments = state.documents.length > 0;

  return (
    <div className="editor-layout">
      <TabBar
        documents={state.documents}
        activeDocumentId={state.activeDocumentId}
        onSelectTab={(id) => dispatch({ type: 'SET_ACTIVE_DOCUMENT', id })}
        onCloseTab={(id) => dispatch({ type: 'REMOVE_DOCUMENT', id })}
        onOpenFile={handleOpenFile}
      />
      {hasDocuments ? (
        <>
          <Toolbar drawMode={drawMode} onDrawModeChange={setDrawMode} />
          <div className="editor-content">
            <SidebarThumbnails />
            <PdfViewer drawMode={drawMode} onGroupSelect={handleGroupSelect} />
            <RedactionTable />
          </div>
        </>
      ) : (
        <EmptyState onOpenFile={handleOpenFile} onOpenSettings={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
          onOpenAudit={() => dispatch({ type: 'SET_VIEW', view: 'audit' })} />
      )}
      {groupPopup && (
        <GroupAssignPopup
          position={groupPopup.position}
          affectedIds={groupPopup.affectedIds}
          existingGroups={allGroups}
          onAssign={handleGroupAssign}
          onCancel={() => setGroupPopup(null)}
        />
      )}
    </div>
  );
}

function EmptyState({
  onOpenFile, onOpenSettings, onOpenAudit,
}: { onOpenFile: () => void; onOpenSettings: () => void; onOpenAudit: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-xl)', background: 'var(--bg-canvas)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-md)' }}>📄</div>
        <h2 style={{ margin: '0 0 var(--space-sm)', color: 'var(--text-primary)' }}>
          Keine Dokumente geöffnet
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
          Öffne eine oder mehrere PDF-Dateien, um mit der Analyse und Schwärzung zu beginnen.
          Mehrere Dateien können im Dialog gleichzeitig ausgewählt werden.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={onOpenFile}
          id="btn-open-file-empty"
          style={{ padding: '14px 28px', fontSize: 16, fontWeight: 600 }}
        >
          + PDF-Datei(en) öffnen
        </button>
        <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
            ⚙️ Einstellungen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenAudit}>
            📋 Verarbeitungsprotokoll
          </button>
        </div>
      </div>
    </div>
  );
}
