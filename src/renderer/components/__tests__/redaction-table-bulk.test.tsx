import { describe, it, expect } from 'vitest';
import { getCategoryBulkActions } from '../RedactionTable';
import { RedactionEntry, PIICategory } from '../../../common/types';

function makeEntry(id: string, category: PIICategory, status: RedactionEntry['status'] = 'vorschlag'): RedactionEntry {
  return {
    id, variableName: `${category}_1`, originalContent: 'test',
    category, page: 1, bounds: { x: 0, y: 0, width: 10, height: 10 },
    status, groupNumber: 1, source: 'regex',
  };
}

describe('getCategoryBulkActions', () => {
  it('gibt Vorschlag-Anzahl pro Kategorie zurück', () => {
    const redactions = [
      makeEntry('1', 'IBAN', 'vorschlag'),
      makeEntry('2', 'IBAN', 'vorschlag'),
      makeEntry('3', 'E-Mail', 'akzeptiert'),
    ];
    const result = getCategoryBulkActions(redactions);
    expect(result.get('IBAN')?.vorschlagCount).toBe(2);
    expect(result.get('E-Mail')?.vorschlagCount).toBe(0);
  });

  it('enthält alle Kategorien die in redactions vorkommen', () => {
    const redactions = [
      makeEntry('1', 'IBAN', 'vorschlag'),
      makeEntry('2', 'Name', 'akzeptiert'),
    ];
    const result = getCategoryBulkActions(redactions);
    expect(result.has('IBAN')).toBe(true);
    expect(result.has('Name')).toBe(true);
  });
});
