import React, { useEffect } from 'react';
import { AppProvider, useAppState } from './store/app-store';
import { openPdfFile } from './services/file-handler';
import StartPage from './components/StartPage';
import EditorLayout from './components/EditorLayout';
import AuditLogView from './components/AuditLogView';
import SettingsView from './components/SettingsView';
import LoadingOverlay from './components/LoadingOverlay';
import ErrorBanner from './components/ErrorBanner';
import './styles/global.css';

function AppContent() {
  const { state, dispatch, performUndo, performRedo } = useAppState();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        performRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo]);

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

  return (
    <div className="app-container">
      {state.error && <ErrorBanner />}
      {(state.isAnalyzing || state.isExporting) && (
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
