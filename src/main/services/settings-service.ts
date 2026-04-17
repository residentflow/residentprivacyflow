import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AppSettings } from '../../common/types';

const DEFAULT_SETTINGS: AppSettings = {
  maxFileSizeMB: 20,
  maxPageCount: 200,
  tempDirectory: '',
  defaultExportQuality: 'high',
  defaultMode: 'schwärzen',
  lastOpenDirectory: '',
  lastExportDirectory: '',
  ocrConfidenceThreshold: 0.5,
  ocrLanguages: ['deu', 'eng'],
};

export class SettingsService {
  private settingsPath: string;
  private settings: AppSettings;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  setMultiple(partial: Partial<AppSettings>): void {
    Object.assign(this.settings, partial);
    this.save();
  }

  getAll(): AppSettings {
    return { ...this.settings };
  }
}
