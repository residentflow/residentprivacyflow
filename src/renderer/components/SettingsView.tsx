import React, { useEffect, useState } from 'react';
import { useAppState } from '../store/app-store';
import { AppSettings } from '../../common/types';

export default function SettingsView() {
  const { dispatch } = useAppState();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (window.electronAPI) {
        const s = await window.electronAPI.getSettings();
        setSettings(s);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!settings || !window.electronAPI) return;
    setSaving(true);
    try {
      const updated = await window.electronAPI.setSettings(settings);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
    setSaving(false);
  };

  if (!settings) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="app-toolbar">
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_VIEW', view: 'editor' })}>← Zurück</button>
        </div>
        <div className="audit-panel"><div className="empty-state"><div className="loading-spinner" /><div className="empty-state-text">Wird geladen…</div></div></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="app-toolbar">
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_VIEW', view: 'editor' })}>
          ← Zurück
        </button>
        <div className="toolbar-separator" />
        <span style={{ fontWeight: 600, fontSize: 14 }}>Einstellungen</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Wird gespeichert…' : '💾 Speichern'}
        </button>
      </div>

      <div className="audit-panel" style={{ padding: 'var(--space-xl)' }}>
        <div className="settings-section">
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-md)', fontSize: 16 }}>
            Dateiverarbeitung
          </h3>

          <div className="settings-row">
            <label className="settings-label">
              Maximale Dateigröße (MB)
              <span className="settings-hint">Standard: 20 MB. Auf 0 setzen für unbegrenzt.</span>
            </label>
            <input
              type="number"
              className="settings-input"
              value={settings.maxFileSizeMB}
              min={0}
              max={500}
              onChange={e => setSettings({ ...settings, maxFileSizeMB: Number(e.target.value) })}
            />
          </div>

          <div className="settings-row">
            <label className="settings-label">
              Maximale Seitenanzahl
              <span className="settings-hint">Auf 0 setzen für unbegrenzt.</span>
            </label>
            <input
              type="number"
              className="settings-input"
              value={settings.maxPageCount}
              min={0}
              max={1000}
              onChange={e => setSettings({ ...settings, maxPageCount: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="settings-section">
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-md)', fontSize: 16 }}>
            Export
          </h3>

          <div className="settings-row">
            <label className="settings-label">Standard-Exportqualität</label>
            <select
              className="select"
              value={settings.defaultExportQuality}
              onChange={e => setSettings({ ...settings, defaultExportQuality: e.target.value as any })}
            >
              <option value="high">Hohe Qualität (300 DPI)</option>
              <option value="compressed">Komprimiert (150 DPI)</option>
            </select>
          </div>

          <div className="settings-row">
            <label className="settings-label">Standard-Modus</label>
            <select
              className="select"
              value={settings.defaultMode}
              onChange={e => setSettings({ ...settings, defaultMode: e.target.value as any })}
            >
              <option value="schwärzen">Schwärzen</option>
              <option value="pseudonymisieren">Pseudonymisieren</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-md)', fontSize: 16 }}>
            Speicherorte
          </h3>

          <div className="settings-row">
            <label className="settings-label">
              Temporäres Verzeichnis
              <span className="settings-hint">Leer = Systemstandard</span>
            </label>
            <input
              type="text"
              className="settings-input"
              value={settings.tempDirectory}
              placeholder="(Systemstandard)"
              onChange={e => setSettings({ ...settings, tempDirectory: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--bg-overlay)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 12, margin: 0 }}>
            ⚠️ <strong>Datenschutzhinweis:</strong> Alle Verarbeitung erfolgt lokal auf diesem Gerät.
            Exportierte CSV-Zuordnungstabellen enthalten Originaldaten und müssen vom Nutzer geschützt werden.
            Pseudonymisierung und Schwärzung haben unterschiedliche Datenschutzwirkungen.
          </p>
        </div>
      </div>
    </div>
  );
}
