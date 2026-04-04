import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { RedactionEntry, ExportOptions, ExportProgress, RedactionMode, CSVRow } from '../../common/types';

export class PdfExportService {
  /**
   * Export PDF with redactions applied as image-based pages.
   * Receives pre-rendered PDF bytes from the renderer + generates CSV.
   */
  async exportPdf(
    sourceFilePath: string,
    redactions: RedactionEntry[],
    options: ExportOptions & { pdfData?: Uint8Array },
    onProgress: (progress: ExportProgress) => void
  ): Promise<{ pdfPath: string; csvPath: string }> {
    const outputDir = path.dirname(options.outputPath);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ─── Save PDF bytes to disk ────────────────────────────
    if (options.pdfData && options.pdfData.length > 0) {
      onProgress({
        currentPage: 0,
        totalPages: 0,
        phase: 'saving',
        message: 'PDF wird gespeichert…',
      });

      const pdfBuffer = Buffer.from(options.pdfData);
      fs.writeFileSync(options.outputPath, pdfBuffer);
    } else {
      throw new Error('Keine PDF-Daten zum Speichern vorhanden.');
    }

    // ─── Generate CSV ──────────────────────────────────────
    onProgress({
      currentPage: 0,
      totalPages: 0,
      phase: 'csv',
      message: 'CSV-Zuordnungstabelle wird erstellt…',
    });

    const csvContent = this.generateCSV(redactions, options.mode);
    const csvPath = options.csvPath || options.outputPath.replace(/\.pdf$/i, '_zuordnung.csv');
    fs.writeFileSync(csvPath, '\uFEFF' + csvContent, 'utf-8'); // BOM for Excel

    onProgress({
      currentPage: 0,
      totalPages: 0,
      phase: 'done',
      message: 'Export abgeschlossen.',
    });

    return {
      pdfPath: options.outputPath,
      csvPath,
    };
  }

  /**
   * Generate CSV mapping table.
   */
  private generateCSV(redactions: RedactionEntry[], mode: RedactionMode): string {
    const rows: CSVRow[] = [];
    const seen = new Set<string>();

    const activeRedactions = redactions.filter(
      r => r.status === 'akzeptiert' || r.status === 'manuell'
    );

    for (const entry of activeRedactions) {
      const key = `${entry.variableName}::${entry.originalContent}::${entry.page}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const designation = mode === 'pseudonymisieren'
        ? `[${entry.variableName}]`
        : entry.variableName;

      rows.push({
        bezeichnung: designation,
        inhalt: entry.originalContent,
        typ: entry.category,
        gruppe: entry.groupNumber > 0 ? `Gruppe ${entry.groupNumber}` : '-',
        status: entry.status === 'manuell' ? 'Manuell' : 'Akzeptiert',
        seite: String(entry.page),
      });
    }

    // CSV header with semicolon delimiter
    let csv = '"Bezeichnung";"Inhalt";"Typ";"Gruppe";"Status";"Seite"\n';

    for (const row of rows) {
      csv += `"${this.escapeCSV(row.bezeichnung)}";"${this.escapeCSV(row.inhalt)}";"${this.escapeCSV(row.typ)}";"${this.escapeCSV(row.gruppe)}";"${this.escapeCSV(row.status)}";"${this.escapeCSV(row.seite)}"\n`;
    }

    return csv;
  }

  private escapeCSV(value: string): string {
    return value.replace(/"/g, '""');
  }
}
