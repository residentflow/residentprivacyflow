import React, { useCallback, useState, useRef } from 'react';
import { useAppState } from '../store/app-store';
import { openPdfFile } from '../services/file-handler';
import icon from '../../../assets/icon.png';

export default function StartPage() {
  const { state, dispatch } = useAppState();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (filePath?: string) => {
    await openPdfFile(dispatch, filePath, () => fileInputRef.current?.click());
  }, [dispatch]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if ((file as any).path) {
        handleFileSelect((file as any).path);
      }
    }
  }, [handleFileSelect]);

  return (
    <div className="start-page">
      <div className="start-content">
        <div className="start-icon" style={{ padding: '20px 0' }}>
          {/* Using the building-blocks logo from assets as requested */}
          <img 
            src={icon} 
            alt="ResidentFlow Logo" 
            style={{ width: '100%', maxWidth: '320px', height: 'auto', display: 'block', objectFit: 'contain' }} 
          />
        </div>
        <h1 className="start-title">ResidentPrivacyFlow</h1>
        <p className="start-subtitle">
          Datenschutzkonforme PDF-Schwärzung und Pseudonymisierung –<br />
          vollständig lokal, sicher und zuverlässig.
        </p>

        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => handleFileSelect()}
          id="drop-zone"
        >
          <div className="drop-zone-icon">📄</div>
          <div className="drop-zone-text">
            PDF-Datei hierher ziehen oder klicken
          </div>
          <div className="drop-zone-hint">
            Unterstützt: PDF-Dateien bis 20 MB
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => handleFileSelect()}
          id="btn-open-file"
          style={{ width: '100%', padding: '12px', fontSize: '15px' }}
        >
          📂 PDF auswählen
        </button>

        <div className="start-instructions">
          <h3>So funktioniert's:</h3>
          <ol>
            <li><strong>PDF öffnen</strong> – Datei per Drag & Drop oder Dateidialog laden.</li>
            <li><strong>Analyse starten</strong> – Automatische Erkennung personenbezogener Daten.</li>
            <li><strong>Vorschläge prüfen</strong> – Treffer bestätigen, ablehnen oder manuell ergänzen.</li>
            <li><strong>Modus wählen</strong> – Schwärzen oder Pseudonymisieren.</li>
            <li><strong>Exportieren</strong> – Neues PDF + CSV-Zuordnungstabelle speichern.</li>
          </ol>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'settings' })}
            id="btn-settings"
          >
            ⚙️ Einstellungen
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'SET_VIEW', view: 'audit' })}
            id="btn-audit-log"
          >
            📋 Verarbeitungsprotokoll
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && (file as any).path) {
            handleFileSelect((file as any).path);
          }
        }}
      />
    </div>
  );
}
