import React, { useEffect, useRef } from 'react';
import { AppProvider, useAppState, useActiveDocument } from './store/app-store';
import { openPdfFile } from './services/file-handler';
import StartPage from './components/StartPage';
import EditorLayout from './components/EditorLayout';
import AuditLogView from './components/AuditLogView';
import SettingsView from './components/SettingsView';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorBanner from './components/ErrorBanner';
import { AppState, Action, DocumentState } from './store/types-and-reducer';
import './styles/global.css';

export interface KeyboardHandlerDeps {
  dispatch: React.Dispatch<Action>;
  performUndo: () => void;
  performRedo: () => void;
}

export function buildKeyboardHandler(
  state: Pick<AppState, 'view' | 'zoom' | 'mode' | 'selectedRedactionId' | 'documents' | 'activeDocumentId'>,
  activeDoc: DocumentState | null,
  { dispatch, performUndo, performRedo }: KeyboardHandlerDeps
) {
  return (e: KeyboardEvent) => {
    // Ctrl+Z / Ctrl+Y: immer aktiv (auch außerhalb des Editors)
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      performUndo();
      return;
    }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault();
      performRedo();
      return;
    }

    // Alle anderen Shortcuts: nur im Editor-View
    if (state.view !== 'editor') return;

    // Guard: kein Input-Feld fokussiert (auch contenteditable)
    const target = e.target as Element | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute('contenteditable') === 'true'))
    ) return;

    const currentPage = activeDoc?.currentPage ?? 1;
    const pageCount = activeDoc?.pageCount ?? 0;
    const redactions = activeDoc?.redactions ?? [];
    const activeId = state.activeDocumentId;

    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        if (currentPage > 1 && activeId) {
          e.preventDefault();
          dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: currentPage - 1 });
        }
        break;

      case 'ArrowRight':
      case 'PageDown':
        if (currentPage < pageCount && activeId) {
          e.preventDefault();
          dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: currentPage + 1 });
        }
        break;

      case '+':
      case 'NumpadAdd':
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 25 });
        break;

      case '-':
      case 'NumpadSubtract':
        e.preventDefault();
        dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 25 });
        break;

      case '0':
        if (!e.ctrlKey) {
          e.preventDefault();
          dispatch({ type: 'SET_ZOOM', zoom: 100 });
        }
        break;

      case 's':
      case 'S':
        if (!e.ctrlKey) {
          e.preventDefault();
          dispatch({
            type: 'SET_MODE',
            mode: state.mode === 'schwärzen' ? 'pseudonymisieren' : 'schwärzen',
          });
        }
        break;

      case 'a':
      case 'A': {
        if (!e.ctrlKey && state.selectedRedactionId && activeId) {
          const selected = redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'vorschlag') {
            e.preventDefault();
            dispatch({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: activeId, id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'd':
      case 'D': {
        if (!e.ctrlKey && state.selectedRedactionId && activeId) {
          const selected = redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'vorschlag') {
            e.preventDefault();
            dispatch({ type: 'REJECT_DOCUMENT_SUGGESTION', docId: activeId, id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'Delete': {
        if (state.selectedRedactionId && activeId) {
          const selected = redactions.find(r => r.id === state.selectedRedactionId);
          if (selected?.status === 'manuell') {
            dispatch({ type: 'REMOVE_DOCUMENT_REDACTION', docId: activeId, id: state.selectedRedactionId });
          }
        }
        break;
      }

      case 'Escape':
        if (state.selectedRedactionId) {
          dispatch({ type: 'SELECT_REDACTION', id: null });
        }
        break;

      case 'Tab': {
        e.preventDefault();
        const sorted = [...redactions]
          .filter(r => r.status !== 'abgelehnt')
          .sort((a, b) => a.page - b.page || a.bounds.y - b.bounds.y);

        if (sorted.length === 0) break;

        const currentIdx = sorted.findIndex(r => r.id === state.selectedRedactionId);

        if (e.shiftKey) {
          const prev = currentIdx <= 0 ? sorted[sorted.length - 1] : sorted[currentIdx - 1];
          dispatch({ type: 'SELECT_REDACTION', id: prev.id });
        } else {
          const next = currentIdx >= sorted.length - 1 ? sorted[0] : sorted[currentIdx + 1];
          dispatch({ type: 'SELECT_REDACTION', id: next.id });
        }
        break;
      }
    }
  };
}

function AppContent() {
  const { state, dispatch, performUndo, performRedo } = useAppState();
  const activeDoc = useActiveDocument();

  // Keyboard shortcuts — useRef-Pattern
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const activeDocRef = useRef(activeDoc);
  useEffect(() => { activeDocRef.current = activeDoc; }, [activeDoc]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      buildKeyboardHandler(stateRef.current, activeDocRef.current, { dispatch, performUndo, performRedo })(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, performUndo, performRedo]);

  // Menu item listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs = [
      window.electronAPI.onMenuOpenFile(() => {
        openPdfFile(dispatch);
      }),
      window.electronAPI.onMenuGoToSettings(() => {
        dispatch({ type: 'SET_VIEW', view: 'settings' });
      }),
      window.electronAPI.onMenuGoToAudit(() => {
        dispatch({ type: 'SET_VIEW', view: 'audit' });
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [dispatch]);

  const isAnalyzing = state.documents.some(d => d.isAnalyzing);

  return (
    <div className="app-container">
      {state.error && <ErrorBanner />}
      {(isAnalyzing || state.isExporting) && (
        <LoadingOverlay />
      )}

      {state.view === 'start' && <StartPage />}
      {state.view === 'editor' && <EditorLayout />}
      {state.view === 'audit' && <AuditLogView />}
      {state.view === 'settings' && <SettingsView />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
