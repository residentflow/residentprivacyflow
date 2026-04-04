import React, { useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../store/app-store';
import { getPdfDocument } from '../services/pdf-init';

export default function SidebarThumbnails() {
  const { state, dispatch } = useAppState();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedPages = useRef<Set<string>>(new Set());
  const activeRenderRequests = useRef<Set<string>>(new Set());

  const renderThumbnail = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!state.fileData || !state.fileName) return;
    
    const renderKey = `${state.fileName}-${pageNum}`;
    // If already rendered or CURRENTLY rendering, don't start another task
    if (renderedPages.current.has(renderKey) || activeRenderRequests.current.has(renderKey)) return;

    activeRenderRequests.current.add(renderKey);
    
    try {
      const pdf = await getPdfDocument(state.fileData);
      const page = await pdf.getPage(pageNum);
      
      const baseScale = 0.2;
      const dpr = window.devicePixelRatio || 1;
      // MATCH PdfViewer logic: scale * dpr handles rotation and HiDPI correctly
      const viewport = page.getViewport({ scale: baseScale * dpr });

      // Always ensure dimensions are set before rendering
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        activeRenderRequests.current.delete(renderKey);
        return;
      }

      // Initial clear to white
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ 
        canvasContext: ctx, 
        viewport: viewport
      }).promise;
      
      renderedPages.current.add(renderKey);
      console.log(`Successfully rendered thumbnail for page ${pageNum}`);
    } catch (err) {
      console.error(`Failed to render thumbnail for page ${pageNum}:`, err);
    } finally {
      activeRenderRequests.current.delete(renderKey);
    }
  }, [state.fileData, state.fileName]);

  // Clean the rendered tracking when fileData changes
  useEffect(() => {
    renderedPages.current.clear();
    activeRenderRequests.current.clear();
    canvasRefs.current.clear();
  }, [state.fileData]);

  // Effect to trigger rendering when the component mounts or file changes
  useEffect(() => {
    if (!state.fileData) return;
    
    const triggerRenders = () => {
      for (let i = 1; i <= state.pageCount; i++) {
        const canvas = canvasRefs.current.get(i);
        if (canvas) {
          renderThumbnail(i, canvas);
        }
      }
    };

    // Small delay to ensure the DOM is settled
    const timeoutId = setTimeout(triggerRenders, 100);
    return () => clearTimeout(timeoutId);
  }, [state.pageCount, state.fileData, renderThumbnail]);

  useEffect(() => {
    const activeEl = containerRef.current?.querySelector('.thumbnail-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [state.currentPage]);

  const getPageRedactionCount = (page: number): number => {
    return state.redactions.filter(
      r => r.page === page && r.status !== 'abgelehnt'
    ).length;
  };

  return (
    <div className="sidebar-thumbnails" ref={containerRef}>
      <div className="sidebar-header">
        Seiten ({state.pageCount})
      </div>
      {Array.from({ length: state.pageCount }, (_, i) => i + 1).map((pageNum) => {
        const redactionCount = getPageRedactionCount(pageNum);
        // Using fileName in key forces a re-mount when a new file is loaded
        const itemKey = `${state.fileName || 'no-file'}-${pageNum}`;
        
        return (
          <div
            key={itemKey}
            className={`thumbnail-item ${pageNum === state.currentPage ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_PAGE', page: pageNum })}
            id={`thumbnail-page-${pageNum}`}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
                  // Also trigger render directly as soon as the ref is available
                  renderThumbnail(pageNum, el);
                }
              }}
              className="thumbnail-canvas"
            />
            <div className="thumbnail-label">Seite {pageNum}</div>
            {redactionCount > 0 && (
              <div className="thumbnail-badge">{redactionCount}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
