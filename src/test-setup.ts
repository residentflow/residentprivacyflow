import '@testing-library/jest-dom';
import { vi } from 'vitest';

beforeEach(() => {
  (window as any).electronAPI = {
    openFileDialog: vi.fn().mockResolvedValue([]),
    saveFileDialog: vi.fn().mockResolvedValue(undefined),
    analyzePdf: vi.fn(),
    exportPdf: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    setSettings: vi.fn(),
    getAuditLog: vi.fn().mockResolvedValue([]),
    addAuditLog: vi.fn(),
    getAppPath: vi.fn().mockResolvedValue(''),
    cleanTemp: vi.fn(),
    onMenuOpenFile: vi.fn().mockReturnValue(() => {}),
    onMenuGoToSettings: vi.fn().mockReturnValue(() => {}),
    onMenuGoToAudit: vi.fn().mockReturnValue(() => {}),
    onAnalyzeProgress: vi.fn().mockReturnValue(() => {}),
    onExportProgress: vi.fn().mockReturnValue(() => {}),
  };
});
