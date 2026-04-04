import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState } from '../store/app-store';
import { RedactionEntry, PIICategory, RedactionStatus } from '../../common/types';

type FilterStatus = 'alle' | RedactionStatus;

const STATUS_LABELS: Record<RedactionStatus, string> = {
  vorschlag: 'Vorschlag',
  akzeptiert: 'Akzeptiert',
  abgelehnt: 'Abgelehnt',
  manuell: 'Manuell',
};

const STATUS_BADGES: Record<RedactionStatus, string> = {
  vorschlag: 'badge-suggestion',
  akzeptiert: 'badge-accepted',
  abgelehnt: 'badge-rejected',
  manuell: 'badge-manual',
};

export default function RedactionTable() {
  const { state, dispatch, updateRedactionVariable } = useAppState();
  const [filter, setFilter] = useState<FilterStatus>('alle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Filter entries
  const filteredEntries = state.redactions.filter(entry => {
    if (filter === 'alle') return entry.status !== 'abgelehnt';
    return entry.status === filter;
  });

  // Sort: current page first, then by page, then by y position
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const aOnPage = a.page === state.currentPage ? -1 : 1;
    const bOnPage = b.page === state.currentPage ? -1 : 1;
    if (aOnPage !== bOnPage) return aOnPage - bOnPage;
    if (a.page !== b.page) return a.page - b.page;
    return a.bounds.y - b.bounds.y;
  });

  // Scroll selected entry into view
  useEffect(() => {
    if (state.selectedRedactionId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [state.selectedRedactionId]);

  const handleEntryClick = useCallback((entry: RedactionEntry) => {
    dispatch({ type: 'SELECT_REDACTION', id: entry.id });
    if (entry.page !== state.currentPage) {
      dispatch({ type: 'SET_PAGE', page: entry.page });
    }
  }, [dispatch, state.currentPage]);

  const handleVariableChange = useCallback((id: string, value: string) => {
    updateRedactionVariable(id, value);
  }, [updateRedactionVariable]);

  const handleOriginalChange = useCallback((id: string, value: string) => {
    dispatch({ type: 'UPDATE_REDACTION', id, updates: { originalContent: value } });
  }, [dispatch]);

  const handleGroupChange = useCallback((id: string, groupValue: string) => {
    const groupNumber = parseInt(groupValue, 10);
    if (isNaN(groupNumber)) return;

    const entry = state.redactions.find(r => r.id === id);
    if (!entry) return;

    const updates: Partial<RedactionEntry> = { groupNumber };

    // If the variable name follows the pattern Category_N, update the N to match the group
    if (entry.variableName.includes('_')) {
      const parts = entry.variableName.split('_');
      // Check if last part is a number
      if (!isNaN(parseInt(parts[parts.length - 1], 10))) {
        parts[parts.length - 1] = groupNumber.toString();
        updates.variableName = parts.join('_');
      }
    }

    dispatch({ type: 'UPDATE_REDACTION', id, updates });
  }, [dispatch, state.redactions]);

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_REDACTION', id });
  }, [dispatch]);

  const handleAccept = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'ACCEPT_SUGGESTION', id });
  }, [dispatch]);

  const handleReject = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'REJECT_SUGGESTION', id });
  }, [dispatch]);

  const handleAcceptOpen = useCallback(() => {
    state.redactions
      .filter(r => r.status === 'vorschlag')
      .forEach(r => dispatch({ type: 'ACCEPT_SUGGESTION', id: r.id }));
  }, [state.redactions, dispatch]);

  const handleRejectOpen = useCallback(() => {
    state.redactions
      .filter(r => r.status === 'vorschlag')
      .forEach(r => dispatch({ type: 'REJECT_SUGGESTION', id: r.id }));
  }, [state.redactions, dispatch]);

  const handleClearPage = useCallback(() => {
    dispatch({ type: 'CLEAR_PAGE_REDACTIONS', page: state.currentPage });
  }, [dispatch, state.currentPage]);

  const counts = {
    alle: state.redactions.filter(r => r.status !== 'abgelehnt').length,
    vorschlag: state.redactions.filter(r => r.status === 'vorschlag').length,
    akzeptiert: state.redactions.filter(r => r.status === 'akzeptiert').length,
    abgelehnt: state.redactions.filter(r => r.status === 'abgelehnt').length,
    manuell: state.redactions.filter(r => r.status === 'manuell').length,
  };

  // Group options logic
  const allGroups = Array.from(new Set(state.redactions.map(r => r.groupNumber))).sort((a, b) => a - b);
  const maxGroup = allGroups.length > 0 ? Math.max(...allGroups) : 0;
  const nextGroup = maxGroup + 1;

  return (
    <div className="redaction-table-panel">
      {/* Header */}
      <div className="table-header">
        <span className="table-header-title">Markierungen</span>
        <span className="table-header-count">{counts.alle} Einträge</span>
      </div>

      {/* Filter chips */}
      <div className="table-filters">
        {(['alle', 'vorschlag', 'akzeptiert', 'manuell', 'abgelehnt'] as FilterStatus[]).map(status => (
          <button
            key={status}
            className={`filter-chip ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status === 'alle' ? 'Alle' : STATUS_LABELS[status as RedactionStatus]} ({counts[status] || 0})
          </button>
        ))}
      </div>

      {/* Action buttons */}
      {counts.vorschlag > 0 && (
        <div style={{
          display: 'flex', gap: 'var(--space-xs)',
          padding: 'var(--space-sm) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <button className="btn btn-success btn-sm" onClick={handleAcceptOpen} style={{ flex: 1 }}>
            ✓ Offene Akzeptieren ({counts.vorschlag})
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleRejectOpen} style={{ flex: 1 }}>
            ✕ Offene Ablehnen ({counts.vorschlag})
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleClearPage}>
            🗑 Seite leeren
          </button>
        </div>
      )}

      {/* Entries */}
      <div className="table-entries">
        {sortedEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              {state.hasAnalyzed
                ? 'Keine Markierungen gefunden.'
                : 'Starten Sie die Analyse, um PII-Vorschläge zu erhalten.'}
            </div>
          </div>
        ) : (
          sortedEntries.map(entry => (
            <div
              key={entry.id}
              ref={entry.id === state.selectedRedactionId ? selectedRef : undefined}
              className={`table-entry ${entry.id === state.selectedRedactionId ? 'selected' : ''} ${entry.id === state.hoveredRedactionId ? 'highlighted' : ''}`}
              onClick={() => handleEntryClick(entry)}
              onMouseEnter={() => dispatch({ type: 'HOVER_REDACTION', id: entry.id })}
              onMouseLeave={() => dispatch({ type: 'HOVER_REDACTION', id: null })}
              id={`entry-${entry.id}`}
            >
              {/* Row 1: Variable name + status + actions */}
              <div className="entry-row">
                {editingId === entry.id ? (
                  <input
                    className="entry-var-input"
                    defaultValue={entry.variableName}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onChange={e => handleVariableChange(entry.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setEditingId(null);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="entry-var-name"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(entry.id); }}
                    title="Doppelklick zum Bearbeiten"
                  >
                    {state.mode === 'pseudonymisieren' ? `[${entry.variableName}]` : entry.variableName}
                  </span>
                )}

                <span className={`badge ${STATUS_BADGES[entry.status]}`}>
                  {STATUS_LABELS[entry.status]}
                </span>

                <div className="entry-actions">
                  {entry.status === 'vorschlag' && (
                    <>
                      <button
                        className="btn btn-success btn-icon btn-sm"
                        onClick={e => handleAccept(e, entry.id)}
                        title="Akzeptieren"
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={e => handleReject(e, entry.id)}
                        title="Ablehnen"
                      >
                        ✕
                      </button>
                    </>
                  )}
                  {editingId === entry.id ? (
                    <button
                      className="btn btn-success btn-icon btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      title="Fertig"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        setEditingId(entry.id);
                      }}
                      title="Bearbeiten"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={e => handleDelete(e, entry.id)}
                    title="Löschen"
                    style={{ color: 'var(--accent-danger)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Row 2: Original content */}
              <div className="entry-row">
                {editingId === entry.id ? (
                  <input
                    className="entry-original-input"
                    defaultValue={entry.originalContent}
                    onClick={e => e.stopPropagation()}
                    onChange={e => handleOriginalChange(entry.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setEditingId(null);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="entry-original"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(entry.id); }}
                    title={entry.originalContent || '(kein Inhalt – Doppelklick zum Bearbeiten)'}
                  >
                    {entry.originalContent || '(kein Inhalt)'}
                  </span>
                )}
              </div>

              {/* Row 3: Meta (category, page, source) */}
              <div className="entry-meta">
                <span className="badge" style={{
                  background: 'var(--bg-overlay)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  {entry.category}
                </span>
                <span className="entry-page">S. {entry.page}</span>
                
                {editingId === entry.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Gruppe:</span>
                    <select
                      className="group-select"
                      value={entry.groupNumber}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleGroupChange(entry.id, e.target.value)}
                    >
                      {allGroups.map(g => (
                        <option key={g} value={g}>Gruppe {g}</option>
                      ))}
                      {!allGroups.includes(nextGroup) && (
                        <option value={nextGroup}>+ Neue Gruppe ({nextGroup})</option>
                      )}
                    </select>
                  </div>
                ) : (
                  entry.groupNumber > 0 && (
                    <span 
                      className="entry-page" 
                      style={{ color: 'var(--brand-primary-light)', cursor: 'pointer' }}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingId(entry.id); }}
                      title="Doppelklick zum Bearbeiten der Gruppe"
                    >
                      Gruppe {entry.groupNumber}
                    </span>
                  )
                )}
                
                {editingId !== entry.id && entry.groupNumber === 0 && (
                   <span 
                    className="entry-page" 
                    style={{ color: 'var(--text-muted)', cursor: 'pointer', fontStyle: 'italic' }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditingId(entry.id); }}
                    title="Doppelklick zum Zuweisen einer Gruppe"
                  >
                    (keine Gruppe)
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
