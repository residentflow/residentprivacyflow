import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { RedactionEntry, BoundingBox } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';
import { AppState, Action, initialState, reducer } from './types-and-reducer';

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
    const counter = state.manualCounter + 1;
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

    const prevRedactions = [...state.redactions];
    dispatch({ type: 'ADD_REDACTION', redaction: newRedaction });
    dispatch({ type: 'INCREMENT_MANUAL_COUNTER' });
    dispatch({
      type: 'PUSH_UNDO',
      action: {
        type: 'add_manual',
        description: 'Manuelle Schwärzung hinzugefügt',
        undo: () => prevRedactions,
        redo: () => [...prevRedactions, newRedaction],
      },
    });
  }, [state.manualCounter, state.redactions]);

  const updateRedactionVariable = useCallback((id: string, newName: string): boolean => {
    const entry = state.redactions.find(r => r.id === id);
    if (!entry) return false;

    const conflict = state.redactions.find(
      r => r.id !== id && r.variableName === newName && r.originalContent !== entry.originalContent
    );

    if (conflict) {
      dispatch({
        type: 'SET_ERROR',
        error: `Konflikt: „${newName}" wird bereits für „${conflict.originalContent}" verwendet.`,
      });
      return false;
    }

    const prevRedactions = [...state.redactions];
    state.redactions.forEach(r => {
      if (r.originalContent === entry.originalContent && r.category === entry.category) {
        dispatch({ type: 'UPDATE_REDACTION', id: r.id, updates: { variableName: newName } });
      }
    });

    dispatch({
      type: 'PUSH_UNDO',
      action: {
        type: 'update_variable',
        description: `Variable umbenannt: ${entry.variableName} → ${newName}`,
        undo: () => prevRedactions,
        redo: () => state.redactions.map(r =>
          r.originalContent === entry.originalContent && r.category === entry.category
            ? { ...r, variableName: newName }
            : r
        ),
      },
    });

    return true;
  }, [state.redactions]);

  const performUndo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const performRedo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

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

export type { AppState, Action };
