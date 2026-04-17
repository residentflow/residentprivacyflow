import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { findOverlappingRedactions } from '../PdfViewer';
import { reducer, initialState, createDocumentState } from '../../store/types-and-reducer';
import { RedactionEntry } from '../../../common/types';

function makeEntry(id: string, x: number, y: number, w = 100, h = 20): RedactionEntry {
  return {
    id, variableName: `V_${id}`, originalContent: id,
    category: 'Name', page: 1,
    bounds: { x, y, width: w, height: h },
    status: 'vorschlag', groupNumber: 1, source: 'regex',
  };
}

function makeDocWithRedactions(id: string, redactions: RedactionEntry[]) {
  return {
    ...createDocumentState({
      id, filePath: `/path/${id}.pdf`, fileName: `${id}.pdf`,
      fileData: new Uint8Array([1, 2, 3]), pageCount: 5,
    }),
    redactions,
  };
}

// Overlap detection

describe('findOverlappingRedactions', () => {
  const redactions = [
    makeEntry('r1', 10, 10, 50, 20),   // x:10-60, y:10-30
    makeEntry('r2', 100, 100, 50, 20), // x:100-150, y:100-120
    makeEntry('r3', 20, 20, 50, 20),   // x:20-70, y:20-40 — overlaps with r1
  ];

  it('finds entries fully inside the rect', () => {
    const rect = { x: 0, y: 0, width: 200, height: 200 };
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r2', 'r3']);
  });

  it('finds only entries touching the rect', () => {
    const rect = { x: 5, y: 5, width: 70, height: 45 };
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });

  it('finds no entries outside the rect', () => {
    const rect = { x: 200, y: 200, width: 50, height: 50 };
    const result = findOverlappingRedactions(redactions, rect, 1);
    expect(result).toHaveLength(0);
  });

  it('ignores entries on other pages', () => {
    const mixedPages = [
      makeEntry('r1', 10, 10, 50, 20),
      { ...makeEntry('r2', 10, 10, 50, 20), page: 2 },
    ];
    const rect = { x: 0, y: 0, width: 200, height: 200 };
    const result = findOverlappingRedactions(mixedPages, rect, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('r1');
  });

  it('detects partial overlap as a hit', () => {
    const rect = { x: 0, y: 0, width: 20, height: 20 };
    const result = findOverlappingRedactions([makeEntry('r1', 10, 10, 50, 20)], rect, 1);
    expect(result).toHaveLength(1);
  });
});

// Reducer: ASSIGN_GROUP_TO_IDS

describe('Reducer — ASSIGN_GROUP_TO_IDS', () => {
  it('assigns group to all given IDs', () => {
    const doc = makeDocWithRedactions('d1', [
      makeEntry('r1', 0, 0),
      makeEntry('r2', 0, 0),
      makeEntry('r3', 0, 0),
    ]);
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
    const result = reducer(state, { type: 'ASSIGN_GROUP_TO_IDS', docId: 'd1', ids: ['r1', 'r3'], groupNumber: 5 });
    const redactions = result.documents[0].redactions;
    expect(redactions.find(r => r.id === 'r1')?.groupNumber).toBe(5);
    expect(redactions.find(r => r.id === 'r2')?.groupNumber).toBe(1);
    expect(redactions.find(r => r.id === 'r3')?.groupNumber).toBe(5);
  });

  it('does nothing with empty IDs list', () => {
    const doc = makeDocWithRedactions('d1', [makeEntry('r1', 0, 0)]);
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
    const result = reducer(state, { type: 'ASSIGN_GROUP_TO_IDS', docId: 'd1', ids: [], groupNumber: 3 });
    expect(result.documents[0].redactions).toEqual(state.documents[0].redactions);
  });
});

// GroupAssignPopup

import GroupAssignPopup from '../GroupAssignPopup';

describe('GroupAssignPopup', () => {
  it('shows count of affected entries', () => {
    const onAssign = vi.fn();
    const onCancel = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 100, y: 100 }}
        affectedIds={['r1', 'r2', 'r3']}
        existingGroups={[1, 2, 3]}
        onAssign={onAssign}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(/3 Schwärzungen/)).toBeInTheDocument();
  });

  it('calls onAssign when Zuweisen is clicked', () => {
    const onAssign = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 0, y: 0 }}
        affectedIds={['r1']}
        existingGroups={[1, 2]}
        onAssign={onAssign}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Zuweisen/ }));
    expect(onAssign).toHaveBeenCalled();
  });

  it('calls onCancel when Abbrechen is clicked', () => {
    const onCancel = vi.fn();
    render(
      <GroupAssignPopup
        position={{ x: 0, y: 0 }}
        affectedIds={[]}
        existingGroups={[]}
        onAssign={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onCancel).toHaveBeenCalled();
  });
});
