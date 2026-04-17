import { RedactionEntry, RedactionMode, ExportQuality, BoundingBox, RedactionStatus, PIICategory } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

// ─── DocumentState ────────────────────────────────────────────

export interface DocumentState {
  id: string;
  filePath: string;
  fileName: string;
  fileData: Uint8Array;
  pageCount: number;
  currentPage: number;
  redactions: RedactionEntry[];
  hasAnalyzed: boolean;
  analysisTypes: string[];
  isAnalyzing: boolean;
  analysisProgress: string;
  manualCounter: number;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

export interface UndoAction {
  type: string;
  description: string;
  undo: () => RedactionEntry[];
  redo: () => RedactionEntry[];
}

export function createDocumentState(params: Pick<DocumentState,
  'id' | 'filePath' | 'fileName' | 'fileData' | 'pageCount'
>): DocumentState {
  return {
    ...params,
    currentPage: 1,
    redactions: [],
    hasAnalyzed: false,
    analysisTypes: [],
    isAnalyzing: false,
    analysisProgress: '',
    manualCounter: 0,
    undoStack: [],
    redoStack: [],
  };
}

// ─── Registries ───────────────────────────────────────────────

export type VariableRegistry = Record<string, string>; // key: `${content}|${category}`
export type GroupRegistry = Record<string, number>;

// ─── AppState ─────────────────────────────────────────────────

export interface AppState {
  documents: DocumentState[];
  activeDocumentId: string | null;
  variableRegistry: VariableRegistry;
  groupRegistry: GroupRegistry;

  // Globale UI
  mode: RedactionMode;
  exportQuality: ExportQuality;
  zoom: number;
  selectedRedactionId: string | null;
  hoveredRedactionId: string | null;
  isExporting: boolean;
  exportProgress: string;
  view: 'start' | 'editor' | 'audit' | 'settings';
  error: string | null;
}

export const initialState: AppState = {
  documents: [],
  activeDocumentId: null,
  variableRegistry: {},
  groupRegistry: {},
  mode: 'schwärzen',
  exportQuality: 'high',
  zoom: 100,
  selectedRedactionId: null,
  hoveredRedactionId: null,
  isExporting: false,
  exportProgress: '',
  view: 'start',
  error: null,
};

// ─── Actions ─────────────────────────────────────────────────

export type Action =
  // Dokument-Verwaltung
  | { type: 'ADD_DOCUMENT'; doc: DocumentState }
  | { type: 'REMOVE_DOCUMENT'; id: string }
  | { type: 'SET_ACTIVE_DOCUMENT'; id: string }
  | { type: 'UPDATE_DOCUMENT'; docId: string; updates: Partial<DocumentState> }
  | { type: 'SET_DOCUMENT_PAGE'; docId: string; page: number }
  | { type: 'SET_DOCUMENT_REDACTIONS'; docId: string; redactions: RedactionEntry[] }
  | { type: 'ADD_DOCUMENT_REDACTION'; docId: string; redaction: RedactionEntry }
  | { type: 'UPDATE_DOCUMENT_REDACTION'; docId: string; id: string; updates: Partial<RedactionEntry> }
  | { type: 'REMOVE_DOCUMENT_REDACTION'; docId: string; id: string }
  | { type: 'ACCEPT_DOCUMENT_SUGGESTION'; docId: string; id: string }
  | { type: 'REJECT_DOCUMENT_SUGGESTION'; docId: string; id: string }
  | { type: 'ACCEPT_ALL_DOCUMENTS' }
  | { type: 'REJECT_ALL_DOCUMENTS' }
  | { type: 'CLEAR_DOCUMENT_PAGE_REDACTIONS'; docId: string; page: number }
  // Registries
  | { type: 'UPDATE_VARIABLE_REGISTRY'; key: string; variableName: string }
  | { type: 'UPDATE_GROUP_REGISTRY'; key: string; groupNumber: number }
  // Globale UI
  | { type: 'SET_MODE'; mode: RedactionMode }
  | { type: 'SET_EXPORT_QUALITY'; quality: ExportQuality }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SELECT_REDACTION'; id: string | null }
  | { type: 'HOVER_REDACTION'; id: string | null }
  | { type: 'SET_EXPORTING'; isExporting: boolean; progress?: string }
  | { type: 'SET_EXPORT_PROGRESS'; progress: string }
  | { type: 'SET_VIEW'; view: 'start' | 'editor' | 'audit' | 'settings' }
  | { type: 'SET_ERROR'; error: string | null }
  // Undo/Redo (pro Dokument)
  | { type: 'PUSH_UNDO'; docId: string; action: UndoAction }
  | { type: 'UNDO'; docId: string }
  | { type: 'REDO'; docId: string }
  // Bulk (Phase 04)
  | { type: 'ACCEPT_BY_CATEGORY'; docId: string; category: PIICategory }
  | { type: 'REJECT_BY_CATEGORY'; docId: string; category: PIICategory }
  | { type: 'REMOVE_BY_CATEGORY'; docId: string; category: PIICategory }
  | { type: 'ACCEPT_SELECTION'; docId: string; ids: string[] }
  | { type: 'REJECT_SELECTION'; docId: string; ids: string[] }
  | { type: 'REMOVE_SELECTION'; docId: string; ids: string[] }
  // Gruppe (Phase 05)
  | { type: 'ASSIGN_GROUP_TO_IDS'; docId: string; ids: string[]; groupNumber: number }
  | { type: 'RESET' };

// ─── Helpers ─────────────────────────────────────────────────

function updateDoc(
  docs: DocumentState[],
  docId: string,
  updater: (doc: DocumentState) => DocumentState
): DocumentState[] {
  return docs.map(d => d.id === docId ? updater(d) : d);
}

function updateDocRedactions(
  docs: DocumentState[],
  docId: string,
  updater: (redactions: RedactionEntry[]) => RedactionEntry[]
): DocumentState[] {
  return updateDoc(docs, docId, d => ({ ...d, redactions: updater(d.redactions) }));
}

// ─── Reducer ─────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {

    case 'ADD_DOCUMENT': {
      const isFirst = state.documents.length === 0;
      return {
        ...state,
        documents: [...state.documents, action.doc],
        activeDocumentId: isFirst ? action.doc.id : state.activeDocumentId,
        view: 'editor',
        selectedRedactionId: null,
      };
    }

    case 'REMOVE_DOCUMENT': {
      const remaining = state.documents.filter(d => d.id !== action.id);
      let nextActiveId = state.activeDocumentId;
      if (state.activeDocumentId === action.id) {
        const idx = state.documents.findIndex(d => d.id === action.id);
        nextActiveId = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? null;
      }
      return {
        ...state,
        documents: remaining,
        activeDocumentId: nextActiveId,
        view: remaining.length === 0 ? 'start' : state.view,
        selectedRedactionId: null,
      };
    }

    case 'SET_ACTIVE_DOCUMENT': {
      if (!state.documents.some(d => d.id === action.id)) return state;
      return { ...state, activeDocumentId: action.id, selectedRedactionId: null };
    }

    case 'UPDATE_DOCUMENT':
      return { ...state, documents: updateDoc(state.documents, action.docId, d => ({ ...d, ...action.updates })) };

    case 'SET_DOCUMENT_PAGE':
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          currentPage: Math.max(1, Math.min(action.page, d.pageCount)),
        })),
      };

    case 'SET_DOCUMENT_REDACTIONS':
      return { ...state, documents: updateDoc(state.documents, action.docId, d => ({ ...d, redactions: action.redactions })) };

    case 'ADD_DOCUMENT_REDACTION':
      return { ...state, documents: updateDocRedactions(state.documents, action.docId, r => [...r, action.redaction]) };

    case 'UPDATE_DOCUMENT_REDACTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, ...action.updates } : entry)
        ),
      };

    case 'REMOVE_DOCUMENT_REDACTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => entry.id !== action.id)
        ),
        selectedRedactionId: state.selectedRedactionId === action.id ? null : state.selectedRedactionId,
      };

    case 'ACCEPT_DOCUMENT_SUGGESTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry)
        ),
      };

    case 'REJECT_DOCUMENT_SUGGESTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => entry.id === action.id ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry)
        ),
      };

    case 'ACCEPT_ALL_DOCUMENTS':
      return {
        ...state,
        documents: state.documents.map(d => ({
          ...d,
          redactions: d.redactions.map(r =>
            r.status === 'vorschlag' ? { ...r, status: 'akzeptiert' as RedactionStatus } : r
          ),
        })),
      };

    case 'REJECT_ALL_DOCUMENTS':
      return {
        ...state,
        documents: state.documents.map(d => ({
          ...d,
          redactions: d.redactions.map(r =>
            r.status === 'vorschlag' ? { ...r, status: 'abgelehnt' as RedactionStatus } : r
          ),
        })),
      };

    case 'CLEAR_DOCUMENT_PAGE_REDACTIONS':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => entry.page !== action.page)
        ),
      };

    case 'UPDATE_VARIABLE_REGISTRY':
      return { ...state, variableRegistry: { ...state.variableRegistry, [action.key]: action.variableName } };

    case 'UPDATE_GROUP_REGISTRY':
      return { ...state, groupRegistry: { ...state.groupRegistry, [action.key]: action.groupNumber } };

    case 'SET_MODE': return { ...state, mode: action.mode };
    case 'SET_EXPORT_QUALITY': return { ...state, exportQuality: action.quality };
    case 'SET_ZOOM': return { ...state, zoom: Math.max(25, Math.min(400, action.zoom)) };
    case 'SELECT_REDACTION': return { ...state, selectedRedactionId: action.id };
    case 'HOVER_REDACTION': return { ...state, hoveredRedactionId: action.id };
    case 'SET_EXPORTING': return { ...state, isExporting: action.isExporting, exportProgress: action.progress || '' };
    case 'SET_EXPORT_PROGRESS': return { ...state, exportProgress: action.progress };
    case 'SET_VIEW': return { ...state, view: action.view };
    case 'SET_ERROR': return { ...state, error: action.error };

    case 'PUSH_UNDO':
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          undoStack: [...d.undoStack, action.action],
          redoStack: [],
        })),
      };

    case 'UNDO': {
      const doc = state.documents.find(d => d.id === action.docId);
      if (!doc || doc.undoStack.length === 0) return state;
      const undoAction = doc.undoStack[doc.undoStack.length - 1];
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          redactions: undoAction.undo(),
          undoStack: d.undoStack.slice(0, -1),
          redoStack: [...d.redoStack, undoAction],
        })),
      };
    }

    case 'REDO': {
      const doc = state.documents.find(d => d.id === action.docId);
      if (!doc || doc.redoStack.length === 0) return state;
      const redoAction = doc.redoStack[doc.redoStack.length - 1];
      return {
        ...state,
        documents: updateDoc(state.documents, action.docId, d => ({
          ...d,
          redactions: redoAction.redo(),
          undoStack: [...d.undoStack, redoAction],
          redoStack: d.redoStack.slice(0, -1),
        })),
      };
    }

    case 'ACCEPT_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            entry.category === action.category && entry.status === 'vorschlag'
              ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry
          )
        ),
      };

    case 'REJECT_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            entry.category === action.category && entry.status === 'vorschlag'
              ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry
          )
        ),
      };

    case 'REMOVE_BY_CATEGORY':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => entry.category !== action.category)
        ),
      };

    case 'ACCEPT_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            action.ids.includes(entry.id) && entry.status === 'vorschlag'
              ? { ...entry, status: 'akzeptiert' as RedactionStatus } : entry
          )
        ),
      };

    case 'REJECT_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry =>
            action.ids.includes(entry.id) && entry.status === 'vorschlag'
              ? { ...entry, status: 'abgelehnt' as RedactionStatus } : entry
          )
        ),
      };

    case 'REMOVE_SELECTION':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.filter(entry => !action.ids.includes(entry.id))
        ),
        selectedRedactionId: action.ids.includes(state.selectedRedactionId ?? '') ? null : state.selectedRedactionId,
      };

    case 'ASSIGN_GROUP_TO_IDS':
      return {
        ...state,
        documents: updateDocRedactions(state.documents, action.docId, r =>
          r.map(entry => action.ids.includes(entry.id) ? { ...entry, groupNumber: action.groupNumber } : entry)
        ),
      };

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}
