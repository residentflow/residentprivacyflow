import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppState } from '../store/app-store';
import { BoundingBox, RedactionEntry } from '../../common/types';
import { getPdfjs } from '../services/pdf-init';

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface DragState {
  isDragging: boolean;
  redactionId: string;
  offsetX: number;
  offsetY: number;
}

interface ResizeState {
  isResizing: boolean;
  redactionId: string;
  handle: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startY: number;
  originalBounds: BoundingBox;
}

export default function PdfViewer() {
  const { state, dispatch, addManualRedaction } = useAppState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [drawState, setDrawState] = useState<DrawState>({
    isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0,
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false, redactionId: '', offsetX: 0, offsetY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false, redactionId: '', handle: 'se', startX: 0, startY: 0,
    originalBounds: { x: 0, y: 0, width: 0, height: 0 },
  });
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  const scale = state.zoom / 100;

  // Render the current page
  useEffect(() => {
    const renderPage = async () => {
      if (!state.fileData || !canvasRef.current) return;

      try {
        const { getPdfDocument } = await import('../services/pdf-init');
        const pdf = await getPdfDocument(state.fileData);
        const page = await pdf.getPage(state.currentPage);
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: scale * devicePixelRatio });

        const canvas = canvasRef.current;
        if (!canvas) return; // Add check here to prevent crash if unmounted
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // The canvas display size remains according to the CSS scale
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const baseViewport = page.getViewport({ scale: 1.0 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });
      } catch (err) {
        console.error('Failed to render page:', err);
      }
    };

    renderPage();
  }, [state.fileData, state.currentPage, scale]);

  // Get redactions for current page
  const pageRedactions = state.redactions.filter(
    r => r.page === state.currentPage && r.status !== 'abgelehnt'
  );

  const toScreenCoords = (bounds: BoundingBox) => ({
    left: bounds.x * scale,
    top: bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  });

  const toPdfCoords = (screenX: number, screenY: number) => ({
    x: screenX / scale,
    y: screenY / scale,
  });

  // ─── Drawing manual redaction ────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragState.isDragging || resizeState.isResizing) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedRedaction = pageRedactions.find(r => {
      const screen = toScreenCoords(r.bounds);
      return (
        x >= screen.left && x <= screen.left + screen.width &&
        y >= screen.top && y <= screen.top + screen.height
      );
    });

    if (clickedRedaction) {
      dispatch({ type: 'SELECT_REDACTION', id: clickedRedaction.id });
      return;
    }

    dispatch({ type: 'SELECT_REDACTION', id: null });
    setDrawState({ isDrawing: true, startX: x, startY: y, currentX: x, currentY: y });
  }, [pageRedactions, dragState.isDragging, resizeState.isResizing, scale, dispatch]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawState.isDrawing) {
      setDrawState(prev => ({ ...prev, currentX: x, currentY: y }));
    }

    if (dragState.isDragging) {
      const pdfCoords = toPdfCoords(x - dragState.offsetX, y - dragState.offsetY);
      const entry = state.redactions.find(r => r.id === dragState.redactionId);
      if (entry) {
        dispatch({
          type: 'UPDATE_REDACTION',
          id: dragState.redactionId,
          updates: { bounds: { ...entry.bounds, x: pdfCoords.x, y: pdfCoords.y } },
        });
      }
    }

    if (resizeState.isResizing) {
      const dx = (x - resizeState.startX) / scale;
      const dy = (y - resizeState.startY) / scale;
      const ob = resizeState.originalBounds;
      let newBounds = { ...ob };

      switch (resizeState.handle) {
        case 'se':
          newBounds.width = Math.max(10, ob.width + dx);
          newBounds.height = Math.max(10, ob.height + dy);
          break;
        case 'sw':
          newBounds.x = ob.x + dx;
          newBounds.width = Math.max(10, ob.width - dx);
          newBounds.height = Math.max(10, ob.height + dy);
          break;
        case 'ne':
          newBounds.width = Math.max(10, ob.width + dx);
          newBounds.y = ob.y + dy;
          newBounds.height = Math.max(10, ob.height - dy);
          break;
        case 'nw':
          newBounds.x = ob.x + dx;
          newBounds.y = ob.y + dy;
          newBounds.width = Math.max(10, ob.width - dx);
          newBounds.height = Math.max(10, ob.height - dy);
          break;
      }

      dispatch({ type: 'UPDATE_REDACTION', id: resizeState.redactionId, updates: { bounds: newBounds } });
    }
  }, [drawState.isDrawing, dragState, resizeState, scale, dispatch, state.redactions]);

  const handleMouseUp = useCallback(() => {
    if (drawState.isDrawing) {
      const minX = Math.min(drawState.startX, drawState.currentX);
      const minY = Math.min(drawState.startY, drawState.currentY);
      const w = Math.abs(drawState.currentX - drawState.startX);
      const h = Math.abs(drawState.currentY - drawState.startY);

      if (w > 5 && h > 5) {
        const pdfBounds = {
          x: minX / scale,
          y: minY / scale,
          width: w / scale,
          height: h / scale,
        };
        addManualRedaction(pdfBounds, state.currentPage);
      }

      setDrawState({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
    }

    if (dragState.isDragging) {
      setDragState({ isDragging: false, redactionId: '', offsetX: 0, offsetY: 0 });
    }

    if (resizeState.isResizing) {
      setResizeState({
        isResizing: false, redactionId: '', handle: 'se',
        startX: 0, startY: 0, originalBounds: { x: 0, y: 0, width: 0, height: 0 },
      });
    }
  }, [drawState, dragState, resizeState, scale, state.currentPage, addManualRedaction]);

  const handleRedactionDragStart = useCallback((e: React.MouseEvent, redactionId: string) => {
    e.stopPropagation();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const entry = state.redactions.find(r => r.id === redactionId);
    if (!entry) return;

    const screen = toScreenCoords(entry.bounds);
    const offsetX = (e.clientX - rect.left) - screen.left;
    const offsetY = (e.clientY - rect.top) - screen.top;

    dispatch({ type: 'SELECT_REDACTION', id: redactionId });
    setDragState({ isDragging: true, redactionId, offsetX, offsetY });
  }, [state.redactions, scale, dispatch]);

  const handleResizeStart = useCallback((e: React.MouseEvent, redactionId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    const entry = state.redactions.find(r => r.id === redactionId);
    if (!entry) return;

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    setResizeState({
      isResizing: true, redactionId, handle,
      startX: e.clientX - rect.left, startY: e.clientY - rect.top,
      originalBounds: { ...entry.bounds },
    });
  }, [state.redactions]);

  const handleAccept = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'ACCEPT_SUGGESTION', id });
  }, [dispatch]);

  const handleReject = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: 'REJECT_SUGGESTION', id });
  }, [dispatch]);

  const getOverlayClass = (entry: RedactionEntry): string => {
    const classes = ['redaction-overlay'];
    if (entry.status === 'vorschlag') classes.push('suggestion');
    else if (entry.status === 'manuell') classes.push('manual');
    else if (state.mode === 'pseudonymisieren') classes.push('pseudo');
    else classes.push('accepted');
    if (entry.id === state.selectedRedactionId) classes.push('selected');
    if (entry.id === state.hoveredRedactionId) classes.push('hovered');
    return classes.join(' ');
  };

  const drawingRect = drawState.isDrawing ? {
    left: Math.min(drawState.startX, drawState.currentX),
    top: Math.min(drawState.startY, drawState.currentY),
    width: Math.abs(drawState.currentX - drawState.startX),
    height: Math.abs(drawState.currentY - drawState.startY),
  } : null;

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-viewer-scroll" ref={containerRef}>
        <div
          className="pdf-canvas-wrapper"
          style={{
            width: pageSize.width * scale || 'auto',
            height: pageSize.height * scale || 'auto',
          }}
        >
          <canvas ref={canvasRef} className="pdf-canvas" />

          <div
            ref={overlayRef}
            className="overlay-layer interactive"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: 'crosshair' }}
          >
            {pageRedactions.map((entry) => {
              const screen = toScreenCoords(entry.bounds);
              return (
                <div
                  key={entry.id}
                  className={getOverlayClass(entry)}
                  style={{
                    left: screen.left, top: screen.top,
                    width: screen.width, height: screen.height,
                  }}
                  onMouseDown={(e) => handleRedactionDragStart(e, entry.id)}
                  onMouseEnter={() => dispatch({ type: 'HOVER_REDACTION', id: entry.id })}
                  onMouseLeave={() => dispatch({ type: 'HOVER_REDACTION', id: null })}
                >
                  <div className="redaction-label">
                    {state.mode === 'pseudonymisieren' ? `[${entry.variableName}]` : entry.variableName}
                  </div>

                  {entry.status === 'vorschlag' && (
                    <div className="suggestion-actions">
                      <button className="suggestion-btn accept" onClick={(e) => handleAccept(e, entry.id)} title="Akzeptieren">✓</button>
                      <button className="suggestion-btn reject" onClick={(e) => handleReject(e, entry.id)} title="Ablehnen">✕</button>
                    </div>
                  )}

                  {entry.id === state.selectedRedactionId && (
                    <>
                      <div className="resize-handle nw" onMouseDown={(e) => handleResizeStart(e, entry.id, 'nw')} />
                      <div className="resize-handle ne" onMouseDown={(e) => handleResizeStart(e, entry.id, 'ne')} />
                      <div className="resize-handle sw" onMouseDown={(e) => handleResizeStart(e, entry.id, 'sw')} />
                      <div className="resize-handle se" onMouseDown={(e) => handleResizeStart(e, entry.id, 'se')} />
                    </>
                  )}
                </div>
              );
            })}

            {drawingRect && (
              <div
                className="drawing-rect"
                style={{
                  left: drawingRect.left, top: drawingRect.top,
                  width: drawingRect.width, height: drawingRect.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Page navigation bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 'var(--space-md)', padding: 'var(--space-sm) var(--space-lg)',
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', fontSize: 13,
      }}>
        <button className="btn btn-ghost btn-sm" disabled={state.currentPage <= 1}
          onClick={() => dispatch({ type: 'SET_PAGE', page: state.currentPage - 1 })} id="btn-prev-page">◀</button>
        <span style={{ color: 'var(--text-secondary)' }}>
          Seite {state.currentPage} von {state.pageCount}
        </span>
        <button className="btn btn-ghost btn-sm" disabled={state.currentPage >= state.pageCount}
          onClick={() => dispatch({ type: 'SET_PAGE', page: state.currentPage + 1 })} id="btn-next-page">▶</button>
      </div>
    </div>
  );
}
