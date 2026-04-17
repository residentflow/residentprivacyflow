import { TextItem, RedactionEntry, PIICategory, BoundingBox } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';

// ─── Regex Rule Definition ──────────────────────────────────

interface RegexRule {
  name: string;
  category: PIICategory;
  pattern: RegExp;
  priority: number;
}

// ─── PII Detection Provider Interface (for future NER extension) ─

export interface PIIDetectionProvider {
  name: string;
  detect(textItems: TextItem[]): RedactionEntry[];
}

// ─── Regex Rules ─────────────────────────────────────────────

const REGEX_RULES: RegexRule[] = [
  // IBAN (DE and international)
  {
    name: 'IBAN',
    category: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2,4}\b/gi,
    priority: 10,
  },
  // Kreditkartennummern (Visa, Mastercard, Amex, Discover)
  {
    name: 'Kreditkarte',
    category: 'Kreditkarte',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    priority: 10,
  },
  // Deutsche Sozialversicherungsnummer: 2 Ziffern + 6 Ziffern + Buchstabe + 3 Ziffern
  {
    name: 'Sozialversicherungsnummer',
    category: 'Sozialversicherung',
    pattern: /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g,
    priority: 9,
  },
  // BIC/SWIFT: 4 Buchstaben (Bank) + 2 Buchstaben (Land) + 2 alphanumerisch + optionale 3
  {
    name: 'BIC',
    category: 'BIC',
    pattern: /(?:BIC|SWIFT)[:\s]*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/gi,
    priority: 9,
  },
  // Fahrzeug-Kennzeichen (DE): 1-3 Buchstaben - 1-2 Buchstaben + 1-4 Ziffern + opt. E/H
  {
    name: 'Fahrzeug-Kennzeichen',
    category: 'Fahrzeug',
    pattern: /\b[A-ZÄÖÜ]{1,3}[-\s][A-Z]{1,2}\s?\d{1,4}[EH]?\b/g,
    priority: 7,
  },
  // E-Mail
  {
    name: 'E-Mail',
    category: 'E-Mail',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    priority: 10,
  },
  // German mobile numbers (015x, 016x, 017x)
  {
    name: 'Mobilfunknummer',
    category: 'Mobilfunk',
    pattern: /\b(?:(?:\+49|0049)\s?)?(?:0?1[567]\d)\s?[\d\s/\-]{6,12}\b/g,
    priority: 9,
  },
  // German phone numbers (+49 or 0...)
  {
    name: 'Telefonnummer',
    category: 'Telefon',
    pattern: /\b(?:(?:\+49|0049)\s?)?(?:0\d{1,5})\s?[\d\s/\-]{4,12}\b/g,
    priority: 7,
  },
  // Fax (keyword-based)
  {
    name: 'Faxnummer',
    category: 'Fax',
    pattern: /(?:Fax|Telefax)[:\s]*(?:(?:\+49|0049)\s?)?(?:0?\d{1,5})\s?[\d\s/\-]{4,12}/gi,
    priority: 8,
  },
  // Date DD.MM.YYYY
  {
    name: 'Datum',
    category: 'Datum',
    pattern: /\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?:19|20)\d{2}\b/g,
    priority: 6,
  },
  // Persönliche Steueridentifikationsnummer (IdNr.): exakt 11 Ziffern, keine Trennzeichen
  {
    name: 'Steuer-ID',
    category: 'Steuer-ID',
    pattern: /\b(?<![\/\d])\d{11}(?![\/\d])\b/g,
    priority: 8,
  },
  // Unternehmens-Steuernummer: Schrägstrich-Format (Bayern: 111/222/33333)
  {
    name: 'Steuernummer',
    category: 'Steuernummer',
    pattern: /\b\d{2,3}\/\d{3}\/\d{4,5}\b/g,
    priority: 8,
  },
  // URLs
  {
    name: 'URL',
    category: 'URL',
    pattern: /\b(?:https?:\/\/|www\.)[^\s,;)}\]]+/gi,
    priority: 5,
  },
  // German account numbers (Kontonummer) - 7-10 digits often near keywords
  {
    name: 'Kontonummer',
    category: 'Kontonummer',
    pattern: /(?:Konto(?:nummer|nr\.?)?|Kto\.?\s*(?:Nr\.?)?)[:\s]*(\d{5,10})/gi,
    priority: 7,
  },
];

// ─── Heuristic Keywords ─────────────────────────────────────

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

// German street suffixes
const STREET_PATTERN = /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|allee|platz|gasse|ring|damm|ufer|chaussee|boulevard)\s+\d{1,4}\s*[a-zA-Z]?\b/g;

// PLZ + Ort
const PLZ_ORT_PATTERN = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+){0,2}\b/g;

// ─── Main PII Detection Service ─────────────────────────────

export class PIIDetectionService {
  private providers: PIIDetectionProvider[] = [];
  private categoryCounters: Map<PIICategory, number> = new Map();
  private valueToVariable: Map<string, string> = new Map();
  private groupCounter = 0;

  /**
   * Register an additional detection provider (e.g., future NER/spaCy).
   */
  registerProvider(provider: PIIDetectionProvider): void {
    this.providers.push(provider);
  }

  /**
   * Run all detection (regex + heuristic + registered providers) on text items.
   */
  detectAll(textItems: TextItem[]): RedactionEntry[] {
    this.categoryCounters.clear();
    this.valueToVariable.clear();
    this.groupCounter = 0;

    const allEntries: RedactionEntry[] = [];

    // 1. Regex-based detection
    const regexEntries = this.detectRegex(textItems);
    allEntries.push(...regexEntries);

    // 2. Heuristic detection
    const heuristicEntries = this.detectHeuristic(textItems, allEntries);
    allEntries.push(...heuristicEntries);

    // 3. Additional providers
    for (const provider of this.providers) {
      const providerEntries = provider.detect(textItems);
      allEntries.push(...providerEntries);
    }

    // 4. Apply spatial grouping
    this.applySpatialGrouping(allEntries);

    // 5. Assign variable names based on category and groupNumber
    this.finalizeVariableNames(allEntries);

    // 6. Ensure consistency (duplicate content gets same variable name if in same context)
    this.ensureConsistency(allEntries);

    return allEntries;
  }

  // ─── Regex Detection ─────────────────────────────────────

  private detectRegex(textItems: TextItem[]): RedactionEntry[] {
    const entries: RedactionEntry[] = [];
    
    // Build full text per page with position mapping
    const pageTexts = this.buildPageTexts(textItems);

    for (const [page, { fullText, items }] of pageTexts.entries()) {
      for (const rule of REGEX_RULES) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(fullText)) !== null) {
          const matchedText = match[0].trim();
          if (matchedText.length < 2) continue;

          // Find the text items that contain this match
          const bounds = this.findBoundsForMatch(match.index, matchedText.length, items);
          if (!bounds) continue;

          // Check for duplicates
          const isDuplicate = entries.some(
            e => e.originalContent === matchedText && e.page === page && e.category === rule.category
          );
          if (isDuplicate) continue;

          const variableName = rule.category; // Set temporary name, finalized later

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

  // ─── Heuristic Detection ──────────────────────────────────

  private detectHeuristic(textItems: TextItem[], existingEntries: RedactionEntry[]): RedactionEntry[] {
    const entries: RedactionEntry[] = [];

    // Group text items by page
    const pageItems = new Map<number, TextItem[]>();
    for (const item of textItems) {
      const page = item.page;
      if (!pageItems.has(page)) pageItems.set(page, []);
      pageItems.get(page)!.push(item);
    }

    for (const [page, items] of pageItems.entries()) {
      // Street + house number detection
      for (const item of items) {
        const streetMatch = item.text.match(STREET_PATTERN);
        if (streetMatch) {
          for (const match of streetMatch) {
            const isAlreadyFound = [...existingEntries, ...entries].some(
              e => e.originalContent === match && e.page === page
            );
            if (!isAlreadyFound) {
              const variableName = 'Adresse'; // Temporary
              entries.push({
                id: uuidv4(),
                variableName,
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
        const plzMatch = item.text.match(PLZ_ORT_PATTERN);
        if (plzMatch) {
          for (const match of plzMatch) {
            const isAlreadyFound = [...existingEntries, ...entries].some(
              e => e.originalContent === match && e.page === page
            );
            if (!isAlreadyFound) {
              const variableName = 'Adresse'; // Temporary
              entries.push({
                id: uuidv4(),
                variableName,
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

      // Name detection via keyword proximity
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lowerText = item.text.toLowerCase().trim();

        // Check if current item is a name keyword
        const isNameKeyword = NAME_KEYWORDS.some(kw => lowerText.includes(kw));
        if (isNameKeyword) {
          // Look at the next items within ~80px for the actual name
          for (let j = i + 1; j < Math.min(i + 4, items.length); j++) {
            const nextItem = items[j];
            const distance = Math.abs(nextItem.bounds.y - item.bounds.y);
            const horizontalDistance = Math.abs(nextItem.bounds.x - (item.bounds.x + item.bounds.width));

            if (distance <= 80 || horizontalDistance <= 200) {
              const candidateText = nextItem.text.trim();
              // Check if it looks like a name (starts with uppercase, >2 chars, no numbers)
              if (
                candidateText.length > 2 &&
                /^[A-ZÄÖÜ]/.test(candidateText) &&
                !/\d/.test(candidateText) &&
                !NAME_KEYWORDS.some(kw => candidateText.toLowerCase().includes(kw)) &&
                !ADDRESS_KEYWORDS.some(kw => candidateText.toLowerCase().includes(kw))
              ) {
                const isAlreadyFound = [...existingEntries, ...entries].some(
                  e => e.originalContent === candidateText && e.page === page
                );
                if (!isAlreadyFound) {
                  const variableName = 'Name'; // Temporary
                  entries.push({
                    id: uuidv4(),
                    variableName,
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

        // Address keyword proximity
        const isAddressKeyword = ADDRESS_KEYWORDS.some(kw => lowerText.includes(kw));
        if (isAddressKeyword && !STREET_PATTERN.test(item.text) && !PLZ_ORT_PATTERN.test(item.text)) {
          for (let j = i + 1; j < Math.min(i + 3, items.length); j++) {
            const nextItem = items[j];
            const distance = Math.abs(nextItem.bounds.y - item.bounds.y);

            if (distance <= 80) {
              const candidateText = nextItem.text.trim();
              if (
                candidateText.length > 3 &&
                !ADDRESS_KEYWORDS.some(kw => candidateText.toLowerCase() === kw)
              ) {
                const isAlreadyFound = [...existingEntries, ...entries].some(
                  e => e.originalContent === candidateText && e.page === page
                );
                if (!isAlreadyFound) {
                  const variableName = 'Adresse'; // Temporary
                  entries.push({
                    id: uuidv4(),
                    variableName,
                    originalContent: candidateText,
                    category: 'Adresse',
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
    }

    return entries;
  }

  // ─── Spatial Grouping ─────────────────────────────────────

  private applySpatialGrouping(entries: RedactionEntry[]): void {
    const MAX_GROUP_DISTANCE = 80; // pixels

    // Sort by page, then by y, then by x
    const sorted = [...entries].sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      if (Math.abs(a.bounds.y - b.bounds.y) > MAX_GROUP_DISTANCE) return a.bounds.y - b.bounds.y;
      return a.bounds.x - b.bounds.x;
    });

    let currentGroup = 1;
    const assigned = new Set<string>();

    for (const entry of sorted) {
      if (assigned.has(entry.id)) continue;

      entry.groupNumber = currentGroup;
      assigned.add(entry.id);

      // Find nearby entries on the same page
      for (const other of sorted) {
        if (assigned.has(other.id) || other.page !== entry.page) continue;

        const verticalDist = Math.abs(other.bounds.y - entry.bounds.y);
        const horizontalDist = Math.abs(other.bounds.x - entry.bounds.x);

        if (verticalDist <= MAX_GROUP_DISTANCE || horizontalDist <= MAX_GROUP_DISTANCE) {
          other.groupNumber = currentGroup;
          assigned.add(other.id);
        }
      }

      currentGroup++;
    }
  }

  private finalizeVariableNames(entries: RedactionEntry[]): void {
    for (const entry of entries) {
      if (entry.groupNumber > 0) {
        const catClean = entry.category.replace(/[^a-zA-ZäöüÄÖÜ\-]/g, '');
        entry.variableName = `${catClean}_${entry.groupNumber}`;
      } else {
        // Fallback for items without a group (not spatially clustered)
        // Usually should not happen with applySpatialGrouping
        entry.variableName = this.getVariableName(entry.category, entry.originalContent);
      }
    }
  }

  // ─── Consistency Enforcement ──────────────────────────────

  private ensureConsistency(entries: RedactionEntry[]): void {
    // Same original content should ideally have same variable name IF they were placed in same group context
    // Actually, if Name_2 appears in Group 2, and the SAME content appears in Group 5,
    // current logic might result in Name_2 and Name_5.
    // The consistency should probably override the group assignment IF for the whole document it represents the same person.
    // However, the user specifically wants Name_2 to be in Gruppe 2.
    // So we'll stick to the group-based name.
  }

  // ─── Helper Methods ───────────────────────────────────────

  private getVariableName(category: PIICategory, value: string): string {
    const key = `${category}::${value}`;
    if (this.valueToVariable.has(key)) {
      return this.valueToVariable.get(key)!;
    }

    const count = (this.categoryCounters.get(category) || 0) + 1;
    this.categoryCounters.set(category, count);

    const varName = `${category.replace(/[^a-zA-ZäöüÄÖÜ\-]/g, '')}_${count}`;
    this.valueToVariable.set(key, varName);
    return varName;
  }

  private buildPageTexts(textItems: TextItem[]): Map<number, { fullText: string; items: { start: number; end: number; item: TextItem }[] }> {
    const pageTexts = new Map<number, { fullText: string; items: { start: number; end: number; item: TextItem }[] }>();

    // Group by page
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
    matchStart: number,
    matchLength: number,
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

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
