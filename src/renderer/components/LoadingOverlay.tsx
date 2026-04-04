import React from 'react';
import { useAppState } from '../store/app-store';

export default function LoadingOverlay() {
  const { state } = useAppState();

  const progress = state.isAnalyzing ? state.analysisProgress : state.exportProgress;
  const label = state.isAnalyzing ? 'Analyse läuft…' : 'Export läuft…';

  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">{label}</div>
      {progress && <div className="loading-subtext">{progress}</div>}
    </div>
  );
}
