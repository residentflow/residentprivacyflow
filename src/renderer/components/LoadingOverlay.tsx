import React from 'react';
import { useAppState, useActiveDocument } from '../store/app-store';

export default function LoadingOverlay() {
  const { state } = useAppState();
  const activeDoc = useActiveDocument();

  const isAnalyzing = activeDoc?.isAnalyzing ?? false;
  const analysisProgress = activeDoc?.analysisProgress ?? '';
  const progress = isAnalyzing ? analysisProgress : state.exportProgress;
  const label = isAnalyzing ? 'Analyse läuft…' : 'Export läuft…';

  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">{label}</div>
      {progress && <div className="loading-subtext">{progress}</div>}
    </div>
  );
}
