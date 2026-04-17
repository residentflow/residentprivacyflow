import React, { useEffect, useRef, useCallback } from 'react';
import { useAppState, useActiveDocument } from '../store/app-store';
import { getPdfDocument } from '../services/pdf-init';

export default function SidebarThumbnails() {
  const { state, dispatch } = useAppState();
  const activeDoc = useActiveDocument();
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedPages = useRef<Set<string>>(new Set());
  const activeRenderRequests = useRef<Set<string>>(new Set());

  const activeId = state.activeDocumentId;
  const fileData = activeDoc?.fileData ?? null;
  const fileName = activeDoc?.fileName ?? null;
  const pageCount = activeDoc?.pageCount ?? 0;
  const currentPage = activeDoc?.currentPage ?? 1;
  const redactions = activeDoc?.redactions ?? [];

  const renderThumbnail = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!fileData || !fileName) return;

    const renderKey = `${fileName}-${pageNum}`;
    if (renderedPages.current.has(renderKey) || activeRenderRequests.current.has(renderKey)) return;

    activeRenderRequests.current.add(renderKey);

    try {
      const pdf = await getPdfDocument(fileData);
      const page = await pdf.getPage(pageNum);

      const baseScale = 0.2;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: baseScale * dpr });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        activeRenderRequests.current.delete(renderKey);
        return;
      }

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      renderedPages.current.add(renderKey);
    } catch (err) {
      console.error(`Failed to render thumbnail for page ${pageNum}:`, err);
    } finally {
      activeRenderRequests.current.delete(renderKey);
    }
  }, [fileData, fileName]);

  useEffect(() => {
    renderedPages.current.clear();
    activeRenderRequests.current.clear();
    canvasRefs.current.clear();
  }, [fileData]);

  useEffect(() => {
    if (!fileData) return;

    const triggerRenders = () => {
      for (let i = 1; i <= pageCount; i++) {
        const canvas = canvasRefs.current.get(i);
        if (canvas) {
          renderThumbnail(i, canvas);
        }
      }
    };

    const timeoutId = setTimeout(triggerRenders, 100);
    return () => clearTimeout(timeoutId);
  }, [pageCount, fileData, renderThumbnail]);

  useEffect(() => {
    const activeEl = containerRef.current?.querySelector('.thumbnail-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  const getPageRedactionCount = (page: number): number => {
    return redactions.filter(
      r => r.page === page && r.status !== 'abgelehnt'
    ).length;
  };

  return (
    <div className="sidebar-thumbnails" ref={containerRef}>
      <div className="sidebar-header">
        Seiten ({pageCount})
      </div>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
        const redactionCount = getPageRedactionCount(pageNum);
        const itemKey = `${fileName || 'no-file'}-${pageNum}`;

        return (
          <div
            key={itemKey}
            className={`thumbnail-item ${pageNum === currentPage ? 'active' : ''}`}
            onClick={() => activeId && dispatch({ type: 'SET_DOCUMENT_PAGE', docId: activeId, page: pageNum })}
            id={`thumbnail-page-${pageNum}`}
          >
            <canvas
              ref={(el) => {
                if (el) {
                  canvasRefs.current.set(pageNum, el);
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
