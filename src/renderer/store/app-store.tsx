import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { RedactionEntry, BoundingBox } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Action, initialState, reducer, DocumentState } from './types-and-reducer';

// ─── Context ────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addManualRedaction: (bounds: BoundingBox, page: number) => void;
  updateRedactionVariable: (id: string, variableName: string) => boolean;
  performUndo: () => void;
  performRedo: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addManualRedaction = useCallback((bounds: BoundingBox, page: number) => {
    const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
    if (!activeDoc) return;

    const counter = activeDoc.manualCounter + 1;
    const newRedaction: RedactionEntry = {
      id: uuidv4(),
      variableName: `MANUELL_${String(counter).padStart(3, '0')}`,
      originalContent: '',
      category: 'Manuell',
      page,
      bounds,
      status: 'manuell',
      groupNumber: 0,
      source: 'manual',
    };

    const prevRedactions = [...activeDoc.redactions];
    const docId = state.activeDocumentId!;

    dispatch({ type: 'ADD_DOCUMENT_REDACTION', docId, redaction: newRedaction });
    dispatch({ type: 'UPDATE_DOCUMENT', docId, updates: { manualCounter: counter } });
    // Auto-Select + Auto-Edit: neuer Eintrag wird sofort markiert und im Editiermodus geöffnet
    dispatch({ type: 'SELECT_REDACTION', id: newRedaction.id });
    dispatch({ type: 'SET_EDITING_REDACTION', id: newRedaction.id });
    dispatch({
      type: 'PUSH_UNDO',
      docId,
      action: {
        type: 'add_manual',
        description: 'Manuelle Schwärzung hinzugefügt',
        undo: () => prevRedactions,
        redo: () => [...prevRedactions, newRedaction],
      },
    });
  }, [state.documents, state.activeDocumentId]);

  const updateRedactionVariable = useCallback((id: string, newName: string): boolean => {
    const activeDoc = state.documents.find(d => d.id === state.activeDocumentId);
    if (!activeDoc) return false;

    const entry = activeDoc.redactions.find(r => r.id === id);
    if (!entry) return false;

    // Conflict check within the active document
    const conflict = activeDoc.redactions.find(
      r => r.id !== id && r.variableName === newName && r.originalContent !== entry.originalContent
    );
    if (conflict) {
      dispatch({
        type: 'SET_ERROR',
        error: `Konflikt: „${newName}" wird bereits für „${conflict.originalContent}" verwendet.`,
      });
      return false;
    }

    const key = `${entry.originalContent}|${entry.category}`;

    // 1. Update registry
    dispatch({ type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: newName });

    // 2. Sync across ALL documents
    for (const d of state.documents) {
      for (const r of d.redactions) {
        if (r.originalContent === entry.originalContent && r.category === entry.category) {
          dispatch({
            type: 'UPDATE_DOCUMENT_REDACTION',
            docId: d.id, id: r.id,
            updates: { variableName: newName },
          });
        }
      }
    }

    // 3. Push undo for the active doc
    const prevRedactions = [...activeDoc.redactions];
    dispatch({
      type: 'PUSH_UNDO',
      docId: state.activeDocumentId!,
      action: {
        type: 'update_variable',
        description: `Variable umbenannt: ${entry.variableName} → ${newName}`,
        undo: () => prevRedactions,
        redo: () => activeDoc.redactions.map(r =>
          r.originalContent === entry.originalContent && r.category === entry.category
            ? { ...r, variableName: newName }
            : r
        ),
      },
    });

    return true;
  }, [state.documents, state.activeDocumentId]);

  const performUndo = useCallback(() => {
    if (state.activeDocumentId) {
      dispatch({ type: 'UNDO', docId: state.activeDocumentId });
    }
  }, [state.activeDocumentId]);

  const performRedo = useCallback(() => {
    if (state.activeDocumentId) {
      dispatch({ type: 'REDO', docId: state.activeDocumentId });
    }
  }, [state.activeDocumentId]);

  return (
    <AppContext.Provider value={{ state, dispatch, addManualRedaction, updateRedactionVariable, performUndo, performRedo }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}

export function useActiveDocument(): DocumentState | null {
  const { state } = useAppState();
  return state.documents.find(d => d.id === state.activeDocumentId) ?? null;
}

export type { AppState, Action };
