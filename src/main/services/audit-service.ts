import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { AuditLogEntry } from '../../common/types';

export class AuditService {
  private logPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logPath = path.join(userDataPath, 'audit-log.json');
  }

  private loadAll(): AuditLogEntry[] {
    try {
      if (fs.existsSync(this.logPath)) {
        const data = fs.readFileSync(this.logPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load audit log:', e);
    }
    return [];
  }

  private saveAll(entries: AuditLogEntry[]): void {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.logPath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save audit log:', e);
    }
  }

  getAll(): AuditLogEntry[] {
    return this.loadAll().sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  add(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const entries = this.loadAll();
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    entries.push(fullEntry);
    this.saveAll(entries);
    return fullEntry;
  }
}
