import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, AppSettings } from '../common/types';

/**
 * Secure IPC bridge exposed to the renderer process.
 * No direct Node.js APIs are exposed.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFileDialog: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_DIALOG),

  saveFileDialog: (defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_FILE_DIALOG, defaultName),

  // PDF operations
  analyzePdf: (filePath: string): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.ANALYZE_PDF, filePath),

  onAnalyzeProgress: (callback: (progress: any) => void): (() => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.ANALYZE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ANALYZE_PROGRESS, handler);
  },

  exportPdf: (options: any): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_PDF, options),

  onExportProgress: (callback: (progress: any) => void): (() => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on(IPC_CHANNELS.EXPORT_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.EXPORT_PROGRESS, handler);
  },

  // Settings
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_SETTINGS, settings),

  // Audit log
  getAuditLog: (): Promise<any[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIT_LOG),

  addAuditLog: (entry: any): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_AUDIT_LOG, entry),

  // App
  getAppPath: (name: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_APP_PATH, name),

  cleanTemp: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAN_TEMP),

  // Menu events
  onMenuOpenFile: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_FILE, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_FILE, handler);
  },

  onMenuGoToSettings: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.MENU_GO_TO_SETTINGS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_GO_TO_SETTINGS, handler);
  },

  onMenuGoToAudit: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.MENU_GO_TO_AUDIT, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_GO_TO_AUDIT, handler);
  },
});
