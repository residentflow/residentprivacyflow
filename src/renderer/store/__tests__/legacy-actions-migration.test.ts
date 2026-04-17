import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../types-and-reducer';
import type { Action } from '../types-and-reducer';

describe('Migration: keine Legacy-Actions mehr akzeptiert', () => {
  const legacyActionTypes = [
    'SET_FILE', 'ADD_REDACTION', 'UPDATE_REDACTION', 'REMOVE_REDACTION',
    'SET_REDACTIONS', 'SET_PAGE', 'ACCEPT_SUGGESTION', 'REJECT_SUGGESTION',
    'CLEAR_PAGE_REDACTIONS', 'SET_HAS_ANALYZED', 'INCREMENT_MANUAL_COUNTER',
    'SET_ANALYZING', 'SET_ANALYSIS_PROGRESS', 'SET_ANALYSIS_TYPES',
  ];

  it.each(legacyActionTypes)('Legacy-Action %s wird nicht mehr verarbeitet', (type) => {
    const result = reducer(initialState, { type, foo: 'bar' } as unknown as Action);
    expect(result).toBe(initialState);
  });
});
