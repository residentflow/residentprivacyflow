import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult, TextItem, RedactionEntry, BoundingBox, PIICategory, PageAnalysis } from '../../common/types';
import { PIIDetectionService } from './pii-detection-service';

interface AnalysisProgress {
  phase: string;
  currentPage: number;
  totalPages: number;
  message: string;
}

export class PdfAnalysisService {
  private piiService: PIIDetectionService;

  constructor() {
    this.piiService = new PIIDetectionService();
  }

  async analyzePdf(
    filePath: string,
    onProgress: (progress: AnalysisProgress) => void
  ): Promise<AnalysisResult> {
    // Read the PDF file and return raw buffer to renderer for pdf.js processing
    // The actual text extraction happens in the renderer via pdf.js
    // Here we just validate and return file info
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Datei nicht gefunden: ' + filePath);
    }

    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    onProgress({
      phase: 'loading',
      currentPage: 0,
      totalPages: 0,
      message: `PDF wird geladen (${fileSizeMB.toFixed(1)} MB)...`,
    });

    // Return file data for renderer to process with pdf.js
    const fileBuffer = fs.readFileSync(filePath);
    
    return {
      pages: [],
      totalSuggestions: 0,
      analysisTypes: [],
      fileData: Array.from(new Uint8Array(fileBuffer)),
    } as any;
  }

  /**
   * Analyze extracted text items from the renderer and generate PII suggestions.
   * Called from renderer after pdf.js text extraction.
   */
  analyzeTextItems(textItems: TextItem[], pageCount: number): RedactionEntry[] {
    return this.piiService.detectAll(textItems);
  }
}
