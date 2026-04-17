import { describe, it, expect } from 'vitest';
import { reducer, initialState, createDocumentState } from '../types-and-reducer';
import { RedactionEntry, PIICategory } from '../../../common/types';

function makeEntry(id: string, category: PIICategory, status: RedactionEntry['status'] = 'vorschlag'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: 'test',
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status, groupNumber: 1, source: 'regex',
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

function stateWithDoc(redactions: RedactionEntry[], docId = 'd1') {
  const doc = makeDocWithRedactions(docId, redactions);
  let state = reducer(initialState, { type: 'ADD_DOCUMENT', doc });
  return state;
}

describe('Reducer — Bulk-Aktionen', () => {
  // ── ACCEPT_BY_CATEGORY ────────────────────────────────────

  describe('ACCEPT_BY_CATEGORY', () => {
    it('akzeptiert alle Vorschläge der Kategorie', () => {
      const state = stateWithDoc([
        makeEntry('1', 'IBAN', 'vorschlag'),
        makeEntry('2', 'IBAN', 'vorschlag'),
        makeEntry('3', 'E-Mail', 'vorschlag'),
      ]);
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', docId: 'd1', category: 'IBAN' });
      const redactions = result.documents[0].redactions;
      expect(redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
      expect(redactions.find(r => r.id === '2')?.status).toBe('akzeptiert');
      expect(redactions.find(r => r.id === '3')?.status).toBe('vorschlag');
    });

    it('ignoriert bereits akzeptierte Einträge', () => {
      const state = stateWithDoc([makeEntry('1', 'IBAN', 'akzeptiert')]);
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', docId: 'd1', category: 'IBAN' });
      expect(result.documents[0].redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
    });

    it('ändert nichts wenn keine Vorschläge der Kategorie vorhanden', () => {
      const state = stateWithDoc([makeEntry('1', 'E-Mail', 'vorschlag')]);
      const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', docId: 'd1', category: 'IBAN' });
      expect(result.documents[0].redactions).toEqual(state.documents[0].redactions);
    });
  });

  // ── REJECT_BY_CATEGORY ────────────────────────────────────

  describe('REJECT_BY_CATEGORY', () => {
    it('lehnt alle Vorschläge der Kategorie ab', () => {
      const state = stateWithDoc([
        makeEntry('1', 'Name', 'vorschlag'),
        makeEntry('2', 'Name', 'vorschlag'),
        makeEntry('3', 'IBAN', 'vorschlag'),
      ]);
      const result = reducer(state, { type: 'REJECT_BY_CATEGORY', docId: 'd1', category: 'Name' });
      const redactions = result.documents[0].redactions;
      expect(redactions.find(r => r.id === '1')?.status).toBe('abgelehnt');
      expect(redactions.find(r => r.id === '2')?.status).toBe('abgelehnt');
      expect(redactions.find(r => r.id === '3')?.status).toBe('vorschlag');
    });
  });

  // ── REMOVE_BY_CATEGORY ────────────────────────────────────

  describe('REMOVE_BY_CATEGORY', () => {
    it('entfernt ALLE Einträge der Kategorie unabhängig vom Status', () => {
      const state = stateWithDoc([
        makeEntry('1', 'IBAN', 'akzeptiert'),
        makeEntry('2', 'IBAN', 'manuell'),
        makeEntry('3', 'E-Mail', 'vorschlag'),
      ]);
      const result = reducer(state, { type: 'REMOVE_BY_CATEGORY', docId: 'd1', category: 'IBAN' });
      const redactions = result.documents[0].redactions;
      expect(redactions.length).toBe(1);
      expect(redactions[0].id).toBe('3');
    });
  });

  // ── ACCEPT_SELECTION ──────────────────────────────────────

  describe('ACCEPT_SELECTION', () => {
    it('akzeptiert nur die übergebenen IDs', () => {
      const state = stateWithDoc([
        makeEntry('1', 'IBAN', 'vorschlag'),
        makeEntry('2', 'E-Mail', 'vorschlag'),
        makeEntry('3', 'Name', 'vorschlag'),
      ]);
      const result = reducer(state, { type: 'ACCEPT_SELECTION', docId: 'd1', ids: ['1', '3'] });
      const redactions = result.documents[0].redactions;
      expect(redactions.find(r => r.id === '1')?.status).toBe('akzeptiert');
      expect(redactions.find(r => r.id === '2')?.status).toBe('vorschlag');
      expect(redactions.find(r => r.id === '3')?.status).toBe('akzeptiert');
    });
  });

  // ── REJECT_SELECTION ─────────────────────────────────────

  describe('REJECT_SELECTION', () => {
    it('lehnt nur die übergebenen IDs ab', () => {
      const state = stateWithDoc([
        makeEntry('1', 'IBAN', 'vorschlag'),
        makeEntry('2', 'E-Mail', 'vorschlag'),
      ]);
      const result = reducer(state, { type: 'REJECT_SELECTION', docId: 'd1', ids: ['2'] });
      const redactions = result.documents[0].redactions;
      expect(redactions.find(r => r.id === '1')?.status).toBe('vorschlag');
      expect(redactions.find(r => r.id === '2')?.status).toBe('abgelehnt');
    });
  });

  // ── REMOVE_SELECTION ─────────────────────────────────────

  describe('REMOVE_SELECTION', () => {
    it('entfernt genau die übergebenen IDs', () => {
      const state = stateWithDoc([
        makeEntry('1', 'IBAN', 'manuell'),
        makeEntry('2', 'E-Mail', 'akzeptiert'),
        makeEntry('3', 'Name', 'manuell'),
      ]);
      const result = reducer(state, { type: 'REMOVE_SELECTION', docId: 'd1', ids: ['1', '3'] });
      const redactions = result.documents[0].redactions;
      expect(redactions.length).toBe(1);
      expect(redactions[0].id).toBe('2');
    });

    it('löscht selectedRedactionId wenn enthalten', () => {
      let state = stateWithDoc([makeEntry('1', 'IBAN', 'manuell')]);
      state = { ...state, selectedRedactionId: '1' };
      const result = reducer(state, { type: 'REMOVE_SELECTION', docId: 'd1', ids: ['1'] });
      expect(result.selectedRedactionId).toBeNull();
    });
  });

  // ── Integration ──────────────────────────────────────────

  describe('Integration: Kompletter Bulk-Workflow', () => {
    it('User-Flow: alle IBAN akzeptieren, dann 2 ausgewählte löschen', () => {
      let state = stateWithDoc([
        makeEntry('1', 'IBAN', 'vorschlag'),
        makeEntry('2', 'IBAN', 'vorschlag'),
        makeEntry('3', 'Name', 'vorschlag'),
        makeEntry('4', 'Name', 'vorschlag'),
      ]);

      // Schritt 1: alle IBAN akzeptieren
      state = reducer(state, { type: 'ACCEPT_BY_CATEGORY', docId: 'd1', category: 'IBAN' });
      const redactions1 = state.documents[0].redactions;
      expect(redactions1.filter(r => r.status === 'akzeptiert')).toHaveLength(2);

      // Schritt 2: 2 Namen ausgewählt löschen
      state = reducer(state, { type: 'REMOVE_SELECTION', docId: 'd1', ids: ['3', '4'] });
      const redactions2 = state.documents[0].redactions;
      expect(redactions2).toHaveLength(2);
      expect(redactions2.every(r => r.category === 'IBAN')).toBe(true);

      // Schritt 3: Rest ablehnen via SELECTION (sind bereits akzeptiert → keine Änderung)
      state = reducer(state, { type: 'REJECT_SELECTION', docId: 'd1', ids: ['1', '2'] });
      expect(state.documents[0].redactions.filter(r => r.status === 'akzeptiert')).toHaveLength(2);
    });
  });
});
