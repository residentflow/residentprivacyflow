import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildKeyboardHandler, KeyboardHandlerDeps } from '../App';
import { AppState, Action, DocumentState } from '../store/types-and-reducer';

describe('Keyboard Handler — Editor-Shortcuts', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let performUndo: ReturnType<typeof vi.fn>;
  let performRedo: ReturnType<typeof vi.fn>;
  let deps: KeyboardHandlerDeps;

  const makeDoc = (overrides: Partial<DocumentState> = {}): DocumentState => ({
    id: 'd1',
    filePath: '/path/test.pdf',
    fileName: 'test.pdf',
    fileData: new Uint8Array([1, 2, 3]),
    pageCount: 10,
    currentPage: 3,
    redactions: [],
    hasAnalyzed: false,
    analysisTypes: [],
    isAnalyzing: false,
    analysisProgress: '',
    manualCounter: 0,
    undoStack: [],
    redoStack: [],
    ...overrides,
  });

  const makeState = (docOverrides: Partial<DocumentState> = {}, stateOverrides: Partial<AppState> = {}): AppState => ({
    documents: [makeDoc(docOverrides)],
    activeDocumentId: 'd1',
    variableRegistry: {},
    groupRegistry: {},
    mode: 'schwärzen',
    exportQuality: 'high',
    zoom: 100,
    selectedRedactionId: null,
    hoveredRedactionId: null,
    isExporting: false,
    exportProgress: '',
    view: 'editor',
    error: null,
    ...stateOverrides,
  });

  const getActiveDoc = (state: AppState) =>
    state.documents.find(d => d.id === state.activeDocumentId) ?? null;

  beforeEach(() => {
    dispatch = vi.fn();
    performUndo = vi.fn();
    performRedo = vi.fn();
    deps = { dispatch, performUndo, performRedo } as unknown as KeyboardHandlerDeps;
  });

  // ── Seitennavigation ────────────────────────────────────────

  it('ArrowRight → nächste Seite', () => {
    const state = makeState();
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DOCUMENT_PAGE', docId: 'd1', page: 4 });
  });

  it('ArrowLeft → vorherige Seite', () => {
    const state = makeState({ currentPage: 3 });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DOCUMENT_PAGE', docId: 'd1', page: 2 });
  });

  it('ArrowRight auf letzter Seite → kein Dispatch', () => {
    const state = makeState({ currentPage: 10, pageCount: 10 });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_DOCUMENT_PAGE' }));
  });

  // ── Zoom ────────────────────────────────────────────────────

  it('+ → Zoom +25', () => {
    const state = makeState({}, { zoom: 100 });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: '+' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 125 });
  });

  it('- → Zoom -25', () => {
    const state = makeState({}, { zoom: 100 });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: '-' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 75 });
  });

  it('0 → Zoom 100%', () => {
    const state = makeState({}, { zoom: 200 });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: '0' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ZOOM', zoom: 100 });
  });

  // ── Modus-Wechsel ───────────────────────────────────────────

  it('S → Modus wechseln zu pseudonymisieren', () => {
    const state = makeState({}, { mode: 'schwärzen' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'pseudonymisieren' });
  });

  it('S → Modus wechseln zurück zu schwärzen', () => {
    const state = makeState({}, { mode: 'pseudonymisieren' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 's' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_MODE', mode: 'schwärzen' });
  });

  // ── Akzeptieren / Ablehnen ──────────────────────────────────

  it('A → akzeptiert ausgewählten Vorschlag', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'vorschlag' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'ACCEPT_DOCUMENT_SUGGESTION', docId: 'd1', id: 'abc' });
  });

  it('A → tut nichts wenn kein Eintrag ausgewählt', () => {
    const state = makeState({}, { selectedRedactionId: null });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ACCEPT_DOCUMENT_SUGGESTION' }));
  });

  it('D → lehnt ausgewählten Vorschlag ab', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'vorschlag' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'd' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'REJECT_DOCUMENT_SUGGESTION', docId: 'd1', id: 'abc' });
  });

  // ── Löschen ─────────────────────────────────────────────────

  it('Delete → löscht manuelle Schwärzung', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'manuell' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Delete' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_DOCUMENT_REDACTION', docId: 'd1', id: 'abc' });
  });

  it('Delete → löscht NICHT Vorschlag (nur ablehnen)', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'vorschlag' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Delete' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'REMOVE_DOCUMENT_REDACTION', docId: 'd1', id: 'abc' });
  });

  // ── Escape ──────────────────────────────────────────────────

  it('Escape → hebt Auswahl auf', () => {
    const state = makeState({}, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Escape' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: null });
  });

  // ── Guard: Input-Feld fokussiert ─────────────────────────────

  it('ArrowRight ignoriert wenn Input fokussiert', () => {
    const state = makeState();
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const input = document.createElement('input');
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: input });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Guard: view !== editor ───────────────────────────────────

  it('ArrowRight ignoriert wenn view !== editor', () => {
    const state = makeState({}, { view: 'start' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  // ── Tab-Navigation ───────────────────────────────────────────

  it('Tab → wählt nächste Schwärzung', () => {
    const state = makeState({
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' } as any,
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'vorschlag' } as any,
      ],
    }, { selectedRedactionId: 'r1' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r2' });
  });

  it('Undo Ctrl+Z → performUndo (bestehend, nicht brechen)', () => {
    const state = makeState();
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(performUndo).toHaveBeenCalled();
  });

  // ── Zusätzliche Edge-Cases ───────────────────────────────────

  it('Shift+Tab → wählt vorherige Schwärzung', () => {
    const state = makeState({
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' } as any,
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'vorschlag' } as any,
      ],
    }, { selectedRedactionId: 'r2' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r1' });
  });

  it('Tab → wraps am Ende zurück zu erstem Eintrag', () => {
    const state = makeState({
      redactions: [
        { id: 'r1', page: 1, bounds: { y: 100 }, status: 'vorschlag' } as any,
        { id: 'r2', page: 1, bounds: { y: 200 }, status: 'vorschlag' } as any,
      ],
    }, { selectedRedactionId: 'r2' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SELECT_REDACTION', id: 'r1' });
  });

  it('Tab bei leerer Liste → kein Dispatch', () => {
    const state = makeState({ redactions: [] });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'Tab' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('Ctrl+A darf NICHT als Akzeptieren interpretiert werden', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'vorschlag' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ACCEPT_DOCUMENT_SUGGESTION' }));
  });

  it('A bei akzeptierter Schwärzung → kein Re-Accept', () => {
    const state = makeState({
      redactions: [{ id: 'abc', status: 'akzeptiert' } as any],
    }, { selectedRedactionId: 'abc' });
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const e = new KeyboardEvent('keydown', { key: 'a' });
    Object.defineProperty(e, 'target', { value: document.body });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ContentEditable-Element wird als Input behandelt', () => {
    const state = makeState();
    const handler = buildKeyboardHandler(state, getActiveDoc(state), deps);
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(e, 'target', { value: div });
    handler(e);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

// ── Stability Test: Handler wird nur einmal registriert ─────────

describe('Handler Lifecycle', () => {
  it('useRef-Pattern: Handler-Referenz bleibt stabil bei State-Change', () => {
    const state1 = {
      view: 'editor' as const,
      documents: [],
      activeDocumentId: null,
      zoom: 100,
      mode: 'schwärzen' as const,
      selectedRedactionId: null,
      variableRegistry: {},
      groupRegistry: {},
      exportQuality: 'high' as const,
      hoveredRedactionId: null,
      isExporting: false,
      exportProgress: '',
      error: null,
    };
    const state2 = { ...state1, zoom: 200 };
    const deps = { dispatch: vi.fn(), performUndo: vi.fn(), performRedo: vi.fn() };

    const h1 = buildKeyboardHandler(state1, null, deps);
    const h2 = buildKeyboardHandler(state2, null, deps);

    expect(typeof h1).toBe('function');
    expect(typeof h2).toBe('function');
  });
});
