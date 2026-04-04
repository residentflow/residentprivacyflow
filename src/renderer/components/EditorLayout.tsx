import React from 'react';
import Toolbar from './Toolbar';
import SidebarThumbnails from './SidebarThumbnails';
import PdfViewer from './PdfViewer';
import RedactionTable from './RedactionTable';

export default function EditorLayout() {
  return (
    <div className="editor-layout">
      <Toolbar />
      <div className="editor-content">
        <SidebarThumbnails />
        <PdfViewer />
        <RedactionTable />
      </div>
    </div>
  );
}
