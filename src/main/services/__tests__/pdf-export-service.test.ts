import { describe, it, expect, beforeEach } from 'vitest';
import { PdfExportService } from '../pdf-export-service';
import type { CSVRow } from '../../../common/types';

describe('PdfExportService.generateCombinedCSV', () => {
  let svc: PdfExportService;
  beforeEach(() => { svc = new PdfExportService(); });

  function row(bezeichnung: string, inhalt: string, extras: Partial<CSVRow> = {}): CSVRow {
    return { bezeichnung, inhalt, typ: 'Name', gruppe: '1', status: 'akzeptiert', seite: '1', ...extras };
  }

  it('fügt Dokument-Spalte zum Header hinzu', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max')] },
    ]);
    expect(csv.split('\n')[0]).toContain('Dokument');
  });

  it('dedupliziert Einträge gleicher Bezeichnung — Dokument-Spalte listet alle', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max')] },
      { fileName: 'b.pdf', rows: [row('Name_1', 'Max')] },
      { fileName: 'c.pdf', rows: [row('Name_1', 'Max')] },
    ]);
    const lines = csv.split('\n').filter(l => l.includes('Name_1'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('a.pdf');
    expect(lines[0]).toContain('b.pdf');
    expect(lines[0]).toContain('c.pdf');
  });

  it('unterschiedliche Bezeichnungen erhalten getrennte Zeilen', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', 'Max'), row('IBAN_1', 'DE89')] },
    ]);
    const dataLines = csv.split('\n').slice(1).filter(l => l.trim());
    expect(dataLines).toHaveLength(2);
  });

  it('leere Liste → nur Header', () => {
    const csv = svc.generateCombinedCSV([]);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });

  it('CSV-Injection verhindern: führende =+-@ werden escaped', () => {
    const csv = svc.generateCombinedCSV([
      { fileName: 'a.pdf', rows: [row('Name_1', '=SUM(A1:A10)')] },
    ]);
    expect(csv).not.toMatch(/;"=SUM/);
  });
});
