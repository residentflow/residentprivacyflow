import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SettingsService } from './services/settings-service';
import { AuditService } from './services/audit-service';
import { PdfExportService } from './services/pdf-export-service';
import { IPC_CHANNELS, AppSettings, ExportOptions } from '../common/types';
import { createMenu } from './menu';

let mainWindow: BrowserWindow | null = null;
const settingsService = new SettingsService();
const auditService = new AuditService();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ResidentPrivacyFlow',
    icon: path.join(__dirname, '../../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    show: false,
    backgroundColor: '#0f0f13',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (mainWindow) {
      createMenu(mainWindow);
    }
  });

  // Load the renderer
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────

function registerIpcHandlers(): void {
  // File dialog
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE_DIALOG, async () => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'PDF-Datei öffnen',
      filters: [{ name: 'PDF-Dateien', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections'],
      defaultPath: settingsService.get('lastOpenDirectory') || app.getPath('documents'),
    });
    if (!result.canceled && result.filePaths.length > 0) {
      settingsService.set('lastOpenDirectory', path.dirname(result.filePaths[0]));
      return result.filePaths;
    }
    return [];
  });

  // Save dialog
  ipcMain.handle(IPC_CHANNELS.SAVE_FILE_DIALOG, async (_event, defaultName: string) => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportierte PDF speichern',
      defaultPath: path.join(
        settingsService.get('lastExportDirectory') || app.getPath('documents'),
        defaultName
      ),
      filters: [{ name: 'PDF-Dateien', extensions: ['pdf'] }],
    });
    if (!result.canceled && result.filePath) {
      settingsService.set('lastExportDirectory', path.dirname(result.filePath));
      return result.filePath;
    }
    return null;
  });

  // PDF Analysis – just reads file and returns buffer to renderer
  ipcMain.handle(IPC_CHANNELS.ANALYZE_PDF, async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error('Datei nicht gefunden: ' + filePath);
    }

    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    mainWindow?.webContents.send(IPC_CHANNELS.ANALYZE_PROGRESS, {
      phase: 'loading',
      currentPage: 0,
      totalPages: 0,
      message: `PDF wird geladen (${fileSizeMB.toFixed(1)} MB)...`,
    });

    const fileBuffer = fs.readFileSync(filePath);
    return {
      pages: [],
      totalSuggestions: 0,
      analysisTypes: [],
      fileData: fileBuffer, // Electron can send Buffers directly
    };
  });

  // PDF Export – saves PDF bytes + generates CSV
  ipcMain.handle(IPC_CHANNELS.EXPORT_PDF, async (_event, options: ExportOptions & {
    sourceFilePath: string;
    redactions: any[];
    pdfData?: Uint8Array;
    combinedCsvExports?: { fileName: string; rows: any[] }[];
  }) => {
    const exportService = new PdfExportService();

    // Combined CSV export (no PDF data)
    if (options.combinedCsvExports && options.combinedCsvExports.length > 0 && !options.pdfData?.length) {
      const csvContent = exportService.generateCombinedCSV(options.combinedCsvExports);
      fs.writeFileSync(options.outputPath, '\uFEFF' + csvContent, 'utf-8');
      return { pdfPath: '', csvPath: options.outputPath };
    }

    return exportService.exportPdf(
      options.sourceFilePath,
      options.redactions,
      options,
      (progress) => {
        mainWindow?.webContents.send(IPC_CHANNELS.EXPORT_PROGRESS, progress);
      }
    );
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    return settingsService.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SET_SETTINGS, (_event, settings: Partial<AppSettings>) => {
    settingsService.setMultiple(settings);
    return settingsService.getAll();
  });

  // Audit log
  ipcMain.handle(IPC_CHANNELS.GET_AUDIT_LOG, () => {
    return auditService.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.ADD_AUDIT_LOG, (_event, entry: any) => {
    return auditService.add(entry);
  });

  // App paths
  ipcMain.handle(IPC_CHANNELS.GET_APP_PATH, (_event, name: string) => {
    return app.getPath(name as any);
  });

  // Clean temp files
  ipcMain.handle(IPC_CHANNELS.CLEAN_TEMP, () => {
    const tempDir = settingsService.get('tempDirectory') || path.join(app.getPath('temp'), 'rpf-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    return true;
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean temp on exit
  try {
    const tempDir = settingsService.get('tempDirectory') || path.join(app.getPath('temp'), 'rpf-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Failed to clean temp directory:', e);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Disable telemetry
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess');
