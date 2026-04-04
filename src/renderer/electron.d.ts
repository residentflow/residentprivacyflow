import { AppSettings, ExportOptions } from '../common/types';

/** TypeScript declaration for the preload-exposed API */
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: () => Promise<string | null>;
      saveFileDialog: (defaultName: string) => Promise<string | null>;
      analyzePdf: (filePath: string) => Promise<any>;
      onAnalyzeProgress: (callback: (progress: any) => void) => () => void;
      exportPdf: (options: any) => Promise<any>;
      onExportProgress: (callback: (progress: any) => void) => () => void;
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
      getAuditLog: () => Promise<any[]>;
      addAuditLog: (entry: any) => Promise<void>;
      getAppPath: (name: string) => Promise<string>;
      cleanTemp: () => Promise<boolean>;

      // Menu events
      onMenuOpenFile: (callback: () => void) => () => void;
      onMenuGoToSettings: (callback: () => void) => () => void;
      onMenuGoToAudit: (callback: () => void) => () => void;
    };
  }
}

export {};

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}
