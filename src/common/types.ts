// ============================================================
// Common Types shared between Main and Renderer processes
// ============================================================

/** Status of a redaction entry */
export type RedactionStatus = 'vorschlag' | 'akzeptiert' | 'abgelehnt' | 'manuell';

/** PII Category */
export type PIICategory =
  | 'Name'
  | 'Adresse'
  | 'IBAN'
  | 'E-Mail'
  | 'Telefon'
  | 'Mobilfunk'
  | 'Fax'
  | 'Datum'
  | 'Steuer-ID'
  | 'URL'
  | 'Kontonummer'
  | 'Manuell'
  | 'Unbekannt';

/** Operating mode */
export type RedactionMode = 'schwärzen' | 'pseudonymisieren';

/** Export quality */
export type ExportQuality = 'high' | 'compressed';

/** Bounding box in PDF coordinates (points) */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single redaction entry */
export interface RedactionEntry {
  id: string;
  /** Variable name / placeholder, e.g. NAME_1, MANUELL_001 */
  variableName: string;
  /** Original text content */
  originalContent: string;
  /** PII category */
  category: PIICategory;
  /** Page number (1-based) */
  page: number;
  /** Bounding box on the page */
  bounds: BoundingBox;
  /** Current status */
  status: RedactionStatus;
  /** Group number for spatial grouping */
  groupNumber: number;
  /** Source of detection */
  source: 'regex' | 'heuristic' | 'manual' | 'ner';
}

/** Page analysis result */
export interface PageAnalysis {
  pageNumber: number;
  hasTextLayer: boolean;
  ocrUsed: boolean;
  textItems: TextItem[];
  suggestions: RedactionEntry[];
}

/** Text item with position */
export interface TextItem {
  text: string;
  bounds: BoundingBox;
  page: number;
  confidence?: number;
}

/** Full document analysis result */
export interface AnalysisResult {
  pages: PageAnalysis[];
  totalSuggestions: number;
  analysisTypes: string[];
}

/** Export options */
export interface ExportOptions {
  quality: ExportQuality;
  outputPath: string;
  csvPath: string;
  mode: RedactionMode;
}

/** Export progress */
export interface ExportProgress {
  currentPage: number;
  totalPages: number;
  phase: 'rendering' | 'compositing' | 'saving' | 'csv' | 'done';
  message: string;
}

/** Audit log entry */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  fileName: string;
  pageCount: number;
  redactionCount: number;
  pseudonymizationCount: number;
  exportQuality: ExportQuality;
  analysisTypes: string[];
  mode: RedactionMode;
}

/** CSV row for mapping table */
export interface CSVRow {
  bezeichnung: string;
  inhalt: string;
  typ: string;
  gruppe: string;
  status: string;
  seite: string;
}

/** App settings */
export interface AppSettings {
  maxFileSizeMB: number;
  maxPageCount: number;
  tempDirectory: string;
  defaultExportQuality: ExportQuality;
  defaultMode: RedactionMode;
  lastOpenDirectory: string;
  lastExportDirectory: string;
}

/** IPC Channel names */
export const IPC_CHANNELS = {
  // File operations
  OPEN_FILE_DIALOG: 'dialog:openFile',
  SAVE_FILE_DIALOG: 'dialog:saveFile',
  
  // PDF operations
  ANALYZE_PDF: 'pdf:analyze',
  ANALYZE_PROGRESS: 'pdf:analyzeProgress',
  EXPORT_PDF: 'pdf:export',
  EXPORT_PROGRESS: 'pdf:exportProgress',
  
  // Settings
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  
  // Audit log
  GET_AUDIT_LOG: 'audit:getAll',
  ADD_AUDIT_LOG: 'audit:add',
  
  // App
  GET_APP_PATH: 'app:getPath',
  CLEAN_TEMP: 'app:cleanTemp',

  // Menu-triggered events (Main -> Renderer)
  MENU_OPEN_FILE: 'menu:open-file',
  MENU_GO_TO_SETTINGS: 'menu:go-to-settings',
  MENU_GO_TO_AUDIT: 'menu:go-to-audit',
} as const;
