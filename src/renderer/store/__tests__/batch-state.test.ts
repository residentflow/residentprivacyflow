import { describe, it, expect } from 'vitest';
import { reducer, initialState, createDocumentState } from '../types-and-reducer';
import { RedactionEntry, PIICategory } from '../../../common/types';

function makeDoc(id: string, fileName = `${id}.pdf`) {
  return createDocumentState({
    id, filePath: `/path/${fileName}`, fileName,
    fileData: new Uint8Array([1, 2, 3]),
    pageCount: 5,
  });
}

function makeEntry(id: string, content = 'test', category: PIICategory = 'Name'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: content,
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status: 'vorschlag', groupNumber: 1, source: 'regex',
  };
}

// ── ADD_DOCUMENT / REMOVE_DOCUMENT / SET_ACTIVE ────────────

describe('Batch State — Dokument-Management', () => {
  it('ADD_DOCUMENT: erstes Dokument wird aktiv, view = editor', () => {
    const state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    expect(state.documents).toHaveLength(1);
    expect(state.activeDocumentId).toBe('d1');
    expect(state.view).toBe('editor');
  });

  it('ADD_DOCUMENT: zweites Dokument — erstes bleibt aktiv', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    expect(state.documents).toHaveLength(2);
    expect(state.activeDocumentId).toBe('d1');
  });

  it('REMOVE_DOCUMENT: aktives Dokument → nächstes wird aktiv', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.activeDocumentId).toBe('d2');
  });

  it('REMOVE_DOCUMENT: letztes Dokument → view bleibt editor (EmptyState), activeId null', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'REMOVE_DOCUMENT', id: 'd1' });
    expect(state.view).toBe('editor');
    expect(state.activeDocumentId).toBeNull();
  });

  it('SET_ACTIVE_DOCUMENT: non-existenten ID → activeId bleibt', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'SET_ACTIVE_DOCUMENT', id: 'non-existent' });
    expect(state.documents.some(d => d.id === state.activeDocumentId)).toBe(true);
  });
});

// ── Per-Dokument Redactions ──────────────────────────────────

describe('Batch State — Dokument-Redactions isoliert', () => {
  it('SET_DOCUMENT_REDACTIONS: nur Zieldokument betroffen', () => {
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: makeDoc('d1') });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: makeDoc('d2') });

    state = reducer(state, {
      type: 'SET_DOCUMENT_REDACTIONS', docId: 'd1',
      redactions: [makeEntry('r1')],
    });

    expect(state.documents.find(d => d.id === 'd1')!.redactions).toHaveLength(1);
    expect(state.documents.find(d => d.id === 'd2')!.redactions).toHaveLength(0);
  });

  it('ACCEPT_DOCUMENT_SUGGESTION: Status-Change isoliert', () => {
    const doc = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });

    state = reducer(state, {
      type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: 'd1', id: 'r1',
    });

    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
  });
});

// ── Variable-Registry ────────────────────────────────────────

describe('Batch State — Variable-Registry', () => {
  it('UPDATE_VARIABLE_REGISTRY speichert Zuweisung', () => {
    const key = 'Max Mustermann|Name';
    const state = reducer(initialState, {
      type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Name_1',
    });
    expect(state.variableRegistry[key]).toBe('Name_1');
  });

  it('Mehrfach-Update: letzter Wert gewinnt', () => {
    const key = 'Max|Name';
    let state = reducer(initialState, { type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Name_1' });
    state = reducer(state, { type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: 'Person_A' });
    expect(state.variableRegistry[key]).toBe('Person_A');
  });
});

// ── ACCEPT_ALL_DOCUMENTS ─────────────────────────────────────

describe('Batch State — Cross-Dokument Bulk', () => {
  it('ACCEPT_ALL_DOCUMENTS: akzeptiert alle Vorschläge in allen Docs', () => {
    const d1 = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    const d2 = { ...makeDoc('d2'), redactions: [makeEntry('r2')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    state = reducer(state, { type: 'ACCEPT_ALL_DOCUMENTS' });

    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
    expect(state.documents[1].redactions[0].status).toBe('akzeptiert');
  });

  it('ACCEPT_ALL_DOCUMENTS: bereits akzeptierte bleiben akzeptiert', () => {
    const r = { ...makeEntry('r1'), status: 'akzeptiert' as const };
    const doc = { ...makeDoc('d1'), redactions: [r] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
    state = reducer(state, { type: 'ACCEPT_ALL_DOCUMENTS' });
    expect(state.documents[0].redactions[0].status).toBe('akzeptiert');
  });
});

// ── Undo/Redo pro Dokument ──────────────────────────────────

describe('Batch State — Undo pro Dokument', () => {
  it('UNDO in Doc A hat keine Wirkung auf Doc B', () => {
    const d1 = { ...makeDoc('d1'), redactions: [makeEntry('r1')] };
    const d2 = { ...makeDoc('d2'), redactions: [makeEntry('r2')] };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    const prevD1 = [makeEntry('r1')];
    state = reducer(state, {
      type: 'PUSH_UNDO', docId: 'd1',
      action: { type: 't', description: 'x', undo: () => [], redo: () => prevD1 },
    });

    state = reducer(state, { type: 'UNDO', docId: 'd1' });

    expect(state.documents.find(d => d.id === 'd1')!.redactions).toHaveLength(0);
    expect(state.documents.find(d => d.id === 'd2')!.redactions).toHaveLength(1);
  });
});

// ── Cross-Dokument Variable-Konsistenz ──────────────────────

describe('Batch State — Cross-Dokument Variable-Konsistenz', () => {
  it('Variable-Name in Doc A wird für gleichen Content in Doc B übernommen', () => {
    const d1 = { ...makeDoc('d1'),
      redactions: [{ ...makeEntry('r1', 'Max Mustermann'), variableName: 'Name_1' }],
    };
    let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc: d1 });

    state = reducer(state, {
      type: 'UPDATE_VARIABLE_REGISTRY',
      key: 'Max Mustermann|Name',
      variableName: 'Name_1',
    });

    const d2 = makeDoc('d2');
    state = reducer(state, { type: 'ADD_DOCUMENT', doc: d2 });

    const rawSuggestion = { ...makeEntry('r2', 'Max Mustermann'), variableName: 'Name_1' };
    const key = `${rawSuggestion.originalContent}|${rawSuggestion.category}`;
    const existingName = state.variableRegistry[key];
    const enriched = existingName ? { ...rawSuggestion, variableName: existingName } : rawSuggestion;

    expect(enriched.variableName).toBe('Name_1');
  });
});
