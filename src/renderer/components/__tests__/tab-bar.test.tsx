import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TabBar from '../TabBar';
import { createDocumentState } from '../../store/types-and-reducer';

function makeDoc(id: string, fileName = `${id}.pdf`) {
  return createDocumentState({
    id, filePath: `/path/${fileName}`, fileName,
    fileData: new Uint8Array(), pageCount: 5,
  });
}

describe('TabBar', () => {
  it('rendert nichts wenn documents leer', () => {
    const { container } = render(
      <TabBar documents={[]} activeDocumentId={null}
        onSelectTab={vi.fn()} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('zeigt alle Dokumente als Tabs', () => {
    render(
      <TabBar documents={[makeDoc('d1', 'erstes.pdf'), makeDoc('d2', 'zweites.pdf')]}
        activeDocumentId="d1" onSelectTab={vi.fn()} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    expect(screen.getByText('erstes.pdf')).toBeInTheDocument();
    expect(screen.getByText('zweites.pdf')).toBeInTheDocument();
  });

  it('ruft onSelectTab bei Tab-Klick auf', () => {
    const onSelect = vi.fn();
    render(
      <TabBar documents={[makeDoc('d1', 'a.pdf'), makeDoc('d2', 'b.pdf')]}
        activeDocumentId="d1" onSelectTab={onSelect} onCloseTab={vi.fn()} onOpenFile={vi.fn()} />
    );
    fireEvent.click(screen.getByText('b.pdf'));
    expect(onSelect).toHaveBeenCalledWith('d2');
  });

  it('Schließen-Button stoppt Event-Propagation', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TabBar documents={[makeDoc('d1', 'a.pdf')]}
        activeDocumentId="d1" onSelectTab={onSelect} onCloseTab={onClose} onOpenFile={vi.fn()} />
    );
    const closeBtn = screen.getAllByTitle('Tab schließen')[0];
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith('d1');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
