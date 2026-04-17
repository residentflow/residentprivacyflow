import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppState, useActiveDocument } from '../store/app-store';
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

export function getCategoryBulkActions(
  redactions: RedactionEntry[]
): Map<PIICategory, { vorschlagCount: number }> {
  const map = new Map<PIICategory, { vorschlagCount: number }>();
  for (const r of redactions) {
    if (!map.has(r.category)) {
      map.set(r.category, { vorschlagCount: 0 });
    }
    if (r.status === 'vorschlag') {
      map.get(r.category)!.vorschlagCount++;
    }
  }
  return map;
}

export default function RedactionTable() {
  const { state, dispatch, updateRedactionVariable } = useAppState();
  const activeDoc = useActiveDocument();
  const [filter, setFilter] = useState<FilterStatus>('alle');
  const [localEditingId, setLocalEditingId] = useState<string | null>(null);
  // Externer Auto-Edit-Trigger (z.B. nach manueller Schwärzung) hat Vorrang
  const editingId = state.editingRedactionId ?? localEditingId;
  const setEditingId = useCallback((id: string | null) => {
    setLocalEditingId(id);
    if (state.editingRedactionId) {
      dispatch({ type: 'SET_EDITING_REDACTION', id: null });
    }
  }, [state.editingRedactionId, dispatch]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const shiftPressedRef = useRef(false);
  const selectedRef = useRef<HTMLDivElement>(null);

  const activeId = state.activeDocumentId;
  const redactions = activeDoc?.redactions ?? [];
  const currentPage = activeDoc?.currentPage ?? 1;
  const hasAnalyzed = activeDoc?.hasAnalyzed ?? false;

  // Filter entries
  const filteredEntries = redactions.filter(entry => {
    if (filter === 'alle') return entry.status !== 'abgelehnt';
    return entry.status === filter;
  });

  // Sort: current page first, then by page, then by y position
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const aOnPage = a.page === currentPage ? -1 : 1;
    const bOnPage = b.page === currentPage ? -1 : 1;
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
    if (entry.page !== currentPage && activeId) {
      dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: entry.page });
    }
  }, [dispatch, currentPage, activeId]);

  const handleVariableChange = useCallback((id: string, value: string) => {
    updateRedactionVariable(id, value);
  }, [updateRedactionVariable]);

  const handleOriginalChange = useCallback((id: string, value: string) => {
    if (!activeId) return;
    dispatch({ type: 'UPDATE_DOCUMENT_REDACTION', docId: activeId, id, updates: { originalContent: value } });
  }, [dispatch, activeId]);

  const handleGroupChange = useCallback((id: string, groupValue: string) => {
    if (!activeId) return;
    const groupNumber = parseInt(groupValue, 10);
    if (isNaN(groupNumber)) return;

    const entry = redactions.find(r => r.id === id);
    if (!entry) return;

    const updates: Partial<RedactionEntry> = { groupNumber };

    if (entry.variableName.includes('_')) {
      const parts = entry.variableName.split('_');
      if (!isNaN(parseInt(parts[parts.length - 1], 10))) {
        parts[parts.length - 1] = groupNumber.toString();
        updates.variableName = parts.join('_');
      }
    }

    dispatch({ type: 'UPDATE_DOCUMENT_REDACTION', docId: activeId, id, updates });
  }, [dispatch, redactions, activeId]);

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!activeId) return;
    dispatch({ type: 'REMOVE_DOCUMENT_REDACTION', docId: activeId, id });
  }, [dispatch, activeId]);

  const handleAccept = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!activeId) return;
    dispatch({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: activeId, id });
  }, [dispatch, activeId]);

  const handleReject = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!activeId) return;
    dispatch({ type: 'REJECT_DOCUMENT_SUGGESTION', docId: activeId, id });
  }, [dispatch, activeId]);

  const handleAcceptOpen = useCallback(() => {
    if (!activeId) return;
    redactions
      .filter(r => r.status === 'vorschlag')
      .forEach(r => dispatch({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: activeId, id: r.id }));
  }, [redactions, dispatch, activeId]);

  const handleRejectOpen = useCallback(() => {
    if (!activeId) return;
    redactions
      .filter(r => r.status === 'vorschlag')
      .forEach(r => dispatch({ type: 'REJECT_DOCUMENT_SUGGESTION', docId: activeId, id: r.id }));
  }, [redactions, dispatch, activeId]);

  const handleClearPage = useCallback(() => {
    if (!activeId) return;
    dispatch({ type: 'CLEAR_DOCUMENT_PAGE_REDACTIONS', docId: activeId, page: currentPage });
  }, [dispatch, currentPage, activeId]);

  const handleFilterChange = useCallback((newFilter: FilterStatus) => {
    setFilter(newFilter);
    setSelectedIds(new Set());
    setLastClickedIdx(null);
  }, []);

  const handleRowMouseDown = useCallback((e: React.MouseEvent) => {
    shiftPressedRef.current = e.shiftKey;
  }, []);

  const handleCheckboxChange = useCallback((
    _e: React.ChangeEvent<HTMLInputElement>,
    id: string,
    idx: number
  ) => {
    if (shiftPressedRef.current && lastClickedIdx !== null) {
      const from = Math.min(lastClickedIdx, idx);
      const to = Math.max(lastClickedIdx, idx);
      const rangeIds = sortedEntries.slice(from, to + 1).map(r => r.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(rid => next.add(rid));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    setLastClickedIdx(idx);
    shiftPressedRef.current = false;
  }, [lastClickedIdx, sortedEntries]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) setSelectedIds(new Set(sortedEntries.map(r => r.id)));
    else setSelectedIds(new Set());
  }, [sortedEntries]);

  const handleBulkAcceptSelection = useCallback(() => {
    if (!activeId) return;
    dispatch({ type: 'ACCEPT_SELECTION', docId: activeId, ids: [...selectedIds] });
    setSelectedIds(new Set());
  }, [selectedIds, dispatch, activeId]);

  const handleBulkRejectSelection = useCallback(() => {
    if (!activeId) return;
    dispatch({ type: 'REJECT_SELECTION', docId: activeId, ids: [...selectedIds] });
    setSelectedIds(new Set());
  }, [selectedIds, dispatch, activeId]);

  const handleBulkRemoveSelection = useCallback(() => {
    if (!activeId) return;
    dispatch({ type: 'REMOVE_SELECTION', docId: activeId, ids: [...selectedIds] });
    setSelectedIds(new Set());
  }, [selectedIds, dispatch, activeId]);

  const counts = {
    alle: redactions.filter(r => r.status !== 'abgelehnt').length,
    vorschlag: redactions.filter(r => r.status === 'vorschlag').length,
    akzeptiert: redactions.filter(r => r.status === 'akzeptiert').length,
    abgelehnt: redactions.filter(r => r.status === 'abgelehnt').length,
    manuell: redactions.filter(r => r.status === 'manuell').length,
  };

  const allGroups = Array.from(new Set(redactions.map(r => r.groupNumber))).sort((a, b) => a - b);
  const maxGroup = allGroups.length > 0 ? Math.max(...allGroups) : 0;
  const nextGroup = maxGroup + 1;

  return (
    <div className="redaction-table-panel">
      {/* Header */}
      <div className="table-header">
        <input
          type="checkbox"
          checked={sortedEntries.length > 0 && sortedEntries.every(r => selectedIds.has(r.id))}
          onChange={e => handleSelectAll(e.target.checked)}
          title="Alle auswählen"
          style={{ marginRight: 'var(--space-xs)' }}
        />
        <span className="table-header-title">Markierungen</span>
        <span className="table-header-count">{counts.alle} Einträge</span>
      </div>

      {/* Filter chips */}
      <div className="table-filters">
        {(['alle', 'vorschlag', 'akzeptiert', 'manuell', 'abgelehnt'] as FilterStatus[]).map(status => (
          <button
            key={status}
            className={`filter-chip ${filter === status ? 'active' : ''}`}
            onClick={() => handleFilterChange(status)}
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

      {/* Cross-document bulk when multiple documents are open */}
      {state.documents.length > 1 && counts.vorschlag > 0 && (
        <div style={{
          display: 'flex', gap: 'var(--space-xs)',
          padding: 'var(--space-xs) var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
        }}>
          <button className="btn btn-success btn-sm" style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
            onClick={() => dispatch({ type: 'ACCEPT_ALL_DOCUMENTS' })}>
            ✓ Alle Dokumente akzeptieren
          </button>
          <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
            onClick={() => dispatch({ type: 'REJECT_ALL_DOCUMENTS' })}>
            ✕ Alle Dokumente ablehnen
          </button>
        </div>
      )}

      {/* Kategorie-Bulk-Aktionen */}
      {counts.vorschlag > 0 && (
        <details style={{ padding: 'var(--space-sm) var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
          <summary style={{ cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Bulk nach Kategorie…
          </summary>
          <div style={{ marginTop: 'var(--space-xs)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {Array.from(getCategoryBulkActions(redactions).entries())
              .filter(([, v]) => v.vorschlagCount > 0)
              .map(([cat, v]) => (
                <div key={cat} style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
                  <span style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}>{cat} ({v.vorschlagCount})</span>
                  <button className="btn btn-success btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
                    onClick={() => activeId && dispatch({ type: 'ACCEPT_BY_CATEGORY', docId: activeId, category: cat })}>
                    ✓
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
                    onClick={() => activeId && dispatch({ type: 'REJECT_BY_CATEGORY', docId: activeId, category: cat })}>
                    ✕
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px' }}
                    onClick={() => activeId && dispatch({ type: 'REMOVE_BY_CATEGORY', docId: activeId, category: cat })}
                    title="Alle dieser Kategorie entfernen">
                    🗑
                  </button>
                </div>
              ))}
          </div>
        </details>
      )}

      {/* Entries */}
      <div className="table-entries">
        {sortedEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              {hasAnalyzed
                ? 'Keine Markierungen gefunden.'
                : 'Starten Sie die Analyse, um PII-Vorschläge zu erhalten.'}
            </div>
          </div>
        ) : (
          sortedEntries.map((entry, idx) => (
            <div
              key={entry.id}
              ref={entry.id === state.selectedRedactionId ? selectedRef : undefined}
              className={`table-entry ${entry.id === state.selectedRedactionId ? 'selected' : ''} ${entry.id === state.hoveredRedactionId ? 'highlighted' : ''}`}
              onClick={() => handleEntryClick(entry)}
              onMouseDown={handleRowMouseDown}
              onMouseEnter={() => dispatch({ type: 'HOVER_REDACTION', id: entry.id })}
              onMouseLeave={() => dispatch({ type: 'HOVER_REDACTION', id: null })}
              id={`entry-${entry.id}`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                className="entry-checkbox"
                checked={selectedIds.has(entry.id)}
                onChange={e => handleCheckboxChange(e, entry.id, idx)}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                style={{ marginRight: 'var(--space-xs)', flexShrink: 0 }}
              />
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

      {/* Sticky action bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar" style={{
          position: 'sticky', bottom: 0,
          background: 'var(--bg-surface)',
          borderTop: '2px solid var(--brand-primary)',
          padding: 'var(--space-sm) var(--space-lg)',
          display: 'flex', gap: 'var(--space-sm)', alignItems: 'center',
        }}>
          <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            {selectedIds.size} ausgewählt
          </span>
          <button className="btn btn-success btn-sm" onClick={handleBulkAcceptSelection}>
            ✓ Akzeptieren
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleBulkRejectSelection}>
            ✕ Ablehnen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleBulkRemoveSelection}
            style={{ color: 'var(--accent-danger)' }}>
            🗑 Löschen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
