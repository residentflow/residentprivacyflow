import { TextItem, RedactionEntry, PIICategory, BoundingBox } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Client-side PII detection that runs in the renderer process.
 * Mirrors the main process service but operates on text items extracted by pdf.js.
 */

interface RegexRule {
  name: string;
  category: PIICategory;
  pattern: RegExp;
  priority: number;
}

const REGEX_RULES: RegexRule[] = [
  {
    name: 'IBAN',
    category: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2,4}\b/gi,
    priority: 10,
  },
  {
    name: 'E-Mail',
    category: 'E-Mail',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    priority: 10,
  },
  {
    name: 'Mobilfunknummer',
    category: 'Mobilfunk',
    pattern: /\b(?:(?:\+49|0049)\s?)?(?:0?1[567]\d)\s?[\d\s/\-]{6,12}\b/g,
    priority: 9,
  },
  {
    name: 'Telefonnummer',
    category: 'Telefon',
    pattern: /\b(?:(?:\+49|0049)\s?)?(?:0\d{1,5})\s?[\d\s/\-]{4,12}\b/g,
    priority: 7,
  },
  {
    name: 'Faxnummer',
    category: 'Fax',
    pattern: /(?:Fax|Telefax)[:\s]*(?:(?:\+49|0049)\s?)?(?:0?\d{1,5})\s?[\d\s/\-]{4,12}/gi,
    priority: 8,
  },
  {
    name: 'Datum',
    category: 'Datum',
    pattern: /\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?:19|20)\d{2}\b/g,
    priority: 6,
  },
  {
    name: 'Steuer-ID',
    category: 'Steuer-ID',
    pattern: /\b\d{2,3}\s?[\/\s]\s?\d{3}\s?[\/\s]\s?\d{4,5}\b/g,
    priority: 8,
  },
  {
    name: 'URL',
    category: 'URL',
    pattern: /\b(?:https?:\/\/|www\.)[^\s,;)}\]]+/gi,
    priority: 5,
  },
  {
    name: 'Kontonummer',
    category: 'Kontonummer',
    pattern: /(?:Konto(?:nummer|nr\.?)?|Kto\.?\s*(?:Nr\.?)?)[:\s]*(\d{5,10})/gi,
    priority: 7,
  },
];

const NAME_KEYWORDS = [
  'name', 'vorname', 'nachname', 'familienname',
  'herr', 'frau', 'mieter', 'mieterin',
  'vermieter', 'vermieterin', 'eigentümer',
  'auftraggeber', 'auftragnehmer', 'bevollmächtigter',
  'ansprechpartner', 'kontaktperson',
];

const ADDRESS_KEYWORDS = [
  'adresse', 'anschrift', 'straße', 'str.', 'strasse',
  'hausnummer', 'hnr', 'plz', 'postleitzahl', 'ort', 'stadt', 'wohnort',
];

const STREET_PATTERN = /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|allee|platz|gasse|ring|damm|ufer|chaussee|boulevard)\s+\d{1,4}\s*[a-zA-Z]?\b/g;
const PLZ_ORT_PATTERN = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+){0,2}\b/g;

export class PIIDetectionClient {
  private categoryCounters: Map<PIICategory, number> = new Map();
  private valueToVariable: Map<string, string> = new Map();

  detectAll(textItems: TextItem[]): RedactionEntry[] {
    this.categoryCounters.clear();
    this.valueToVariable.clear();

    const allEntries: RedactionEntry[] = [];

    // Regex detection
    const regexEntries = this.detectRegex(textItems);
    allEntries.push(...regexEntries);

    // Heuristic detection
    const heuristicEntries = this.detectHeuristic(textItems, allEntries);
    allEntries.push(...heuristicEntries);

    // Spatial grouping
    this.applySpatialGrouping(allEntries);

    // Consistency
    this.ensureConsistency(allEntries);

    return allEntries;
  }

  private detectRegex(textItems: TextItem[]): RedactionEntry[] {
    const entries: RedactionEntry[] = [];
    const pageTexts = this.buildPageTexts(textItems);

    for (const [page, { fullText, items }] of pageTexts.entries()) {
      for (const rule of REGEX_RULES) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(fullText)) !== null) {
          const matchedText = match[0].trim();
          if (matchedText.length < 2) continue;

          const bounds = this.findBoundsForMatch(match.index, matchedText.length, items);
          if (!bounds) continue;

          const isDuplicate = entries.some(
            e => e.originalContent === matchedText && e.page === page && e.category === rule.category
          );
          if (isDuplicate) continue;

          const variableName = this.getVariableName(rule.category, matchedText);

          entries.push({
            id: uuidv4(),
            variableName,
            originalContent: matchedText,
            category: rule.category,
            page,
            bounds,
            status: 'vorschlag',
            groupNumber: 0,
            source: 'regex',
          });
        }
      }
    }

    return entries;
  }

  private detectHeuristic(textItems: TextItem[], existingEntries: RedactionEntry[]): RedactionEntry[] {
    const entries: RedactionEntry[] = [];
    const pageItems = new Map<number, TextItem[]>();
    
    for (const item of textItems) {
      if (!pageItems.has(item.page)) pageItems.set(item.page, []);
      pageItems.get(item.page)!.push(item);
    }

    for (const [page, items] of pageItems.entries()) {
      for (const item of items) {
        // Street detection
        const streetMatches = item.text.match(STREET_PATTERN);
        if (streetMatches) {
          for (const match of streetMatches) {
            if (![...existingEntries, ...entries].some(e => e.originalContent === match && e.page === page)) {
              entries.push({
                id: uuidv4(),
                variableName: this.getVariableName('Adresse', match),
                originalContent: match,
                category: 'Adresse',
                page,
                bounds: item.bounds,
                status: 'vorschlag',
                groupNumber: 0,
                source: 'heuristic',
              });
            }
          }
        }

        // PLZ + Ort detection
        const plzMatches = item.text.match(PLZ_ORT_PATTERN);
        if (plzMatches) {
          for (const match of plzMatches) {
            if (![...existingEntries, ...entries].some(e => e.originalContent === match && e.page === page)) {
              entries.push({
                id: uuidv4(),
                variableName: this.getVariableName('Adresse', match),
                originalContent: match,
                category: 'Adresse',
                page,
                bounds: item.bounds,
                status: 'vorschlag',
                groupNumber: 0,
                source: 'heuristic',
              });
            }
          }
        }
      }

      // Name keyword proximity
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lowerText = item.text.toLowerCase().trim();
        const isNameKeyword = NAME_KEYWORDS.some(kw => lowerText.includes(kw));

        if (isNameKeyword) {
          for (let j = i + 1; j < Math.min(i + 4, items.length); j++) {
            const nextItem = items[j];
            const dist = Math.abs(nextItem.bounds.y - item.bounds.y);
            const hDist = Math.abs(nextItem.bounds.x - (item.bounds.x + item.bounds.width));

            if (dist <= 80 || hDist <= 200) {
              const candidateText = nextItem.text.trim();
              if (
                candidateText.length > 2 &&
                /^[A-ZÄÖÜ]/.test(candidateText) &&
                !/\d/.test(candidateText) &&
                !NAME_KEYWORDS.some(kw => candidateText.toLowerCase().includes(kw)) &&
                !ADDRESS_KEYWORDS.some(kw => candidateText.toLowerCase().includes(kw)) &&
                ![...existingEntries, ...entries].some(e => e.originalContent === candidateText && e.page === page)
              ) {
                entries.push({
                  id: uuidv4(),
                  variableName: this.getVariableName('Name', candidateText),
                  originalContent: candidateText,
                  category: 'Name',
                  page,
                  bounds: nextItem.bounds,
                  status: 'vorschlag',
                  groupNumber: 0,
                  source: 'heuristic',
                });
              }
            }
          }
        }
      }
    }

    return entries;
  }

  private applySpatialGrouping(entries: RedactionEntry[]): void {
    const MAX_DIST = 80;
    let currentGroup = 1;
    const assigned = new Set<string>();

    const sorted = [...entries].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return a.bounds.y - b.bounds.y;
    });

    for (const entry of sorted) {
      if (assigned.has(entry.id)) continue;
      entry.groupNumber = currentGroup;
      assigned.add(entry.id);

      for (const other of sorted) {
        if (assigned.has(other.id) || other.page !== entry.page) continue;
        const vDist = Math.abs(other.bounds.y - entry.bounds.y);
        const hDist = Math.abs(other.bounds.x - entry.bounds.x);
        if (vDist <= MAX_DIST || hDist <= MAX_DIST) {
          other.groupNumber = currentGroup;
          assigned.add(other.id);
        }
      }
      currentGroup++;
    }
  }

  private ensureConsistency(entries: RedactionEntry[]): void {
    const contentToVar = new Map<string, string>();
    for (const entry of entries) {
      const key = `${entry.category}::${entry.originalContent}`;
      if (contentToVar.has(key)) {
        entry.variableName = contentToVar.get(key)!;
      } else {
        contentToVar.set(key, entry.variableName);
      }
    }
  }

  private getVariableName(category: PIICategory, value: string): string {
    const key = `${category}::${value}`;
    if (this.valueToVariable.has(key)) return this.valueToVariable.get(key)!;

    const count = (this.categoryCounters.get(category) || 0) + 1;
    this.categoryCounters.set(category, count);

    const varName = `${category.replace(/[^a-zA-ZäöüÄÖÜ\-]/g, '')}_${count}`;
    this.valueToVariable.set(key, varName);
    return varName;
  }

  private buildPageTexts(textItems: TextItem[]): Map<number, { fullText: string; items: { start: number; end: number; item: TextItem }[] }> {
    const pageTexts = new Map();
    const pageGroups = new Map<number, TextItem[]>();

    for (const item of textItems) {
      if (!pageGroups.has(item.page)) pageGroups.set(item.page, []);
      pageGroups.get(item.page)!.push(item);
    }

    for (const [page, items] of pageGroups.entries()) {
      let fullText = '';
      const indexedItems: { start: number; end: number; item: TextItem }[] = [];
      for (const item of items) {
        const start = fullText.length;
        fullText += item.text + ' ';
        indexedItems.push({ start, end: fullText.length - 1, item });
      }
      pageTexts.set(page, { fullText, items: indexedItems });
    }

    return pageTexts;
  }

  private findBoundsForMatch(
    matchStart: number, matchLength: number,
    items: { start: number; end: number; item: TextItem }[]
  ): BoundingBox | null {
    const matchEnd = matchStart + matchLength;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;

    for (const { start, end, item } of items) {
      if (start < matchEnd && end > matchStart) {
        found = true;
        minX = Math.min(minX, item.bounds.x);
        minY = Math.min(minY, item.bounds.y);
        maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
        maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
      }
    }

    if (!found) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
