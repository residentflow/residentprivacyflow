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

  return (
    <div className="editor-layout">
      <TabBar
        documents={state.documents}
        activeDocumentId={state.activeDocumentId}
        onSelectTab={(id) => dispatch({ type: 'SET_ACTIVE_DOCUMENT', id })}
        onCloseTab={(id) => dispatch({ type: 'REMOVE_DOCUMENT', id })}
        onOpenFile={handleOpenFile}
      />
      <Toolbar drawMode={drawMode} onDrawModeChange={setDrawMode} />
      <div className="editor-content">
        <SidebarThumbnails />
        <PdfViewer drawMode={drawMode} onGroupSelect={handleGroupSelect} />
        <RedactionTable />
      </div>
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
