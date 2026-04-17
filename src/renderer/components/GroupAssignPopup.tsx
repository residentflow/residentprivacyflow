import React, { useState } from 'react';

interface GroupAssignPopupProps {
  position: { x: number; y: number };
  affectedIds: string[];
  existingGroups: number[];
  onAssign: (groupNumber: number) => void;
  onCancel: () => void;
}

export default function GroupAssignPopup({
  position, affectedIds, existingGroups, onAssign, onCancel,
}: GroupAssignPopupProps) {
  const nextGroup = existingGroups.length > 0 ? Math.max(...existingGroups) + 1 : 1;
  const [selectedGroup, setSelectedGroup] = useState<number>(
    existingGroups.length > 0 ? existingGroups[0] : nextGroup
  );

  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y, window.innerHeight - 200),
    zIndex: 1000,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: 240,
  };

  return (
    <div style={popupStyle}>
      <div style={{ fontWeight: 600, marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
        Gruppe zuweisen
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        {affectedIds.length} Schwärzungen ausgewählt
      </div>

      <label style={{ fontSize: 'var(--font-size-xs)', display: 'block', marginBottom: 'var(--space-xs)' }}>
        Gruppe:
      </label>
      <select
        className="select"
        value={selectedGroup}
        onChange={e => setSelectedGroup(Number(e.target.value))}
        style={{ width: '100%', marginBottom: 'var(--space-md)' }}
      >
        {existingGroups.map(g => (
          <option key={g} value={g}>Gruppe {g}</option>
        ))}
        <option value={nextGroup}>+ Neue Gruppe ({nextGroup})</option>
      </select>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onAssign(selectedGroup)}
          disabled={affectedIds.length === 0}
        >
          Zuweisen
        </button>
      </div>
    </div>
  );
}
