import React, { useCallback, useEffect } from 'react';
import { useAppState } from '../store/app-store';

export default function ErrorBanner() {
  const { state, dispatch } = useAppState();

  const isSuccess = state.error?.startsWith('✅') || false;

  // Auto-dismiss success messages after 5s
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => dispatch({ type: 'SET_ERROR', error: null }), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, dispatch]);

  const handleDismiss = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, [dispatch]);

  if (!state.error) return null;

  return (
    <div className="error-banner" onClick={handleDismiss}>
      <div className={`error-message ${isSuccess ? 'success' : ''}`}>
        <span style={{ flex: 1 }}>{state.error}</span>
        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', minWidth: 'auto' }}>✕</button>
      </div>
    </div>
  );
}
