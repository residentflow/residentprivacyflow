import { RedactionEntry, RedactionMode, ExportQuality, BoundingBox, RedactionStatus } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

// ─── State ──────────────────────────────────────────────────

export interface AppState {
  // File
  filePath: string | null;
  fileName: string | null;
  fileData: Uint8Array | null;
  pageCount: number;
  currentPage: number;

  // Redactions
  redactions: RedactionEntry[];
  selectedRedactionId: string | null;
  hoveredRedactionId: string | null;

  // Mode
  mode: RedactionMode;
  exportQuality: ExportQuality;

  // Zoom
  zoom: number;

  // Analysis
  isAnalyzing: boolean;
  analysisProgress: string;
  isExporting: boolean;
  exportProgress: string;
  hasAnalyzed: boolean;
  analysisTypes: string[];

  // UI
  view: 'start' | 'editor' | 'audit' | 'settings';
  error: string | null;
  manualCounter: number;

  // Undo/Redo
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

export interface UndoAction {
  type: string;
  description: string;
  undo: () => RedactionEntry[];
  redo: () => RedactionEntry[];
}

export const initialState: AppState = {
  filePath: null,
  fileName: null,
  fileData: null,
  pageCount: 0,
  currentPage: 1,
  redactions: [],
  selectedRedactionId: null,
  hoveredRedactionId: null,
  mode: 'schwärzen',
  exportQuality: 'high',
  zoom: 100,
  isAnalyzing: false,
  analysisProgress: '',
  isExporting: false,
  exportProgress: '',
  hasAnalyzed: false,
  analysisTypes: [],
  view: 'start',
  error: null,
  manualCounter: 0,
  undoStack: [],
  redoStack: [],
};

// ─── Actions ────────────────────────────────────────────────

export type Action =
  | { type: 'SET_FILE'; filePath: string; fileName: string; fileData: Uint8Array; pageCount: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_MODE'; mode: RedactionMode }
  | { type: 'SET_EXPORT_QUALITY'; quality: ExportQuality }
  | { type: 'SET_VIEW'; view: 'start' | 'editor' | 'audit' | 'settings' }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ANALYZING'; isAnalyzing: boolean; progress?: string }
  | { type: 'SET_EXPORTING'; isExporting: boolean; progress?: string }
  | { type: 'SET_ANALYSIS_PROGRESS'; progress: string }
  | { type: 'SET_EXPORT_PROGRESS'; progress: string }
  | { type: 'SET_ANALYSIS_TYPES'; types: string[] }
  | { type: 'SET_REDACTIONS'; redactions: RedactionEntry[] }
  | { type: 'ADD_REDACTION'; redaction: RedactionEntry }
  | { type: 'UPDATE_REDACTION'; id: string; updates: Partial<RedactionEntry> }
  | { type: 'REMOVE_REDACTION'; id: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string }
  | { type: 'REJECT_SUGGESTION'; id: string }
  | { type: 'SELECT_REDACTION'; id: string | null }
  | { type: 'HOVER_REDACTION'; id: string | null }
  | { type: 'CLEAR_PAGE_REDACTIONS'; page: number }
  | { type: 'SET_HAS_ANALYZED'; value: boolean }
  | { type: 'INCREMENT_MANUAL_COUNTER' }
  | { type: 'PUSH_UNDO'; action: UndoAction }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...initialState,
        filePath: action.filePath,
        fileName: action.fileName,
        fileData: action.fileData,
        pageCount: action.pageCount,
        view: 'editor',
      };

    case 'SET_PAGE':
      return { ...state, currentPage: Math.max(1, Math.min(action.page, state.pageCount)) };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(25, Math.min(400, action.zoom)) };

    case 'SET_MODE':
      return { ...state, mode: action.mode };

    case 'SET_EXPORT_QUALITY':
      return { ...state, exportQuality: action.quality };

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.isAnalyzing, analysisProgress: action.progress || '' };

    case 'SET_EXPORTING':
      return { ...state, isExporting: action.isExporting, exportProgress: action.progress || '' };

    case 'SET_ANALYSIS_PROGRESS':
      return { ...state, analysisProgress: action.progress };

    case 'SET_EXPORT_PROGRESS':
      return { ...state, exportProgress: action.progress };

    case 'SET_ANALYSIS_TYPES':
      return { ...state, analysisTypes: action.types };

    case 'SET_REDACTIONS':
      return { ...state, redactions: action.redactions };

    case 'ADD_REDACTION':
      return { ...state, redactions: [...state.redactions, action.redaction] };

    case 'UPDATE_REDACTION':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          r.id === action.id ? { ...r, ...action.updates } : r
        ),
      };

    case 'REMOVE_REDACTION':
      return {
        ...state,
        redactions: state.redactions.filter(r => r.id !== action.id),
        selectedRedactionId: state.selectedRedactionId === action.id ? null : state.selectedRedactionId,
      };

    case 'ACCEPT_SUGGESTION':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          r.id === action.id ? { ...r, status: 'akzeptiert' as RedactionStatus } : r
        ),
      };

    case 'REJECT_SUGGESTION':
      return {
        ...state,
        redactions: state.redactions.map(r =>
          r.id === action.id ? { ...r, status: 'abgelehnt' as RedactionStatus } : r
        ),
      };

    case 'SELECT_REDACTION':
      return { ...state, selectedRedactionId: action.id };

    case 'HOVER_REDACTION':
      return { ...state, hoveredRedactionId: action.id };

    case 'CLEAR_PAGE_REDACTIONS':
      return {
        ...state,
        redactions: state.redactions.filter(r => r.page !== action.page),
      };

    case 'SET_HAS_ANALYZED':
      return { ...state, hasAnalyzed: action.value };

    case 'INCREMENT_MANUAL_COUNTER':
      return { ...state, manualCounter: state.manualCounter + 1 };

    case 'PUSH_UNDO':
      return {
        ...state,
        undoStack: [...state.undoStack, action.action],
        redoStack: [],
      };

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const undoAction = state.undoStack[state.undoStack.length - 1];
      const newRedactions = undoAction.undo();
      return {
        ...state,
        redactions: newRedactions,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, undoAction],
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const redoAction = state.redoStack[state.redoStack.length - 1];
      const newRedactions = redoAction.redo();
      return {
        ...state,
        redactions: newRedactions,
        undoStack: [...state.undoStack, redoAction],
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}
