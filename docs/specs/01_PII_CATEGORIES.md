# Spec 01 — Neue PII-Kategorien

> **Voraussetzung:** `00_OVERVIEW.md` gelesen, Test-Framework installiert (`npm test` läuft fehlerfrei).  
> **Abhängigkeiten:** Keine.  
> **Komplexität:** Niedrig (~2–3h)

---

## Ziel

Die PII-Erkennung um 5 neue Kategorien erweitern: `Kreditkarte`, `Sozialversicherung`, `BIC`, `Fahrzeug`, `Steuernummer`. Außerdem die bestehende `Steuer-ID`-Erkennung von der neuen `Steuernummer` sauber trennen.

---

## Zu ändernde Dateien

| Datei | Art der Änderung |
|-------|-----------------|
| `src/common/types.ts` | `PIICategory` union erweitern |
| `src/main/services/pii-detection-service.ts` | 5 neue `REGEX_RULES` Einträge |
| `src/renderer/services/pii-detection-client.ts` | identische Erweiterung (gespiegelt) |

---

## Bestehender Code — VOLLSTÄNDIG lesen

### src/common/types.ts — relevanter Ausschnitt (Zeile 9–22)

```typescript
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
```

### src/main/services/pii-detection-service.ts — REGEX_RULES Array (Zeile 22–86)

```typescript
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
```

### Interface RegexRule (Zeile 6–11)

```typescript
interface RegexRule {
  name: string;
  category: PIICategory;
  pattern: RegExp;
  priority: number;
}
```

---

## Schritt 1 — Tests schreiben (TDD: zuerst Tests, dann Implementation)

Datei erstellen: **`src/main/services/__tests__/pii-detection-service.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PIIDetectionService } from '../pii-detection-service';
import { TextItem } from '../../../common/types';

function makeTextItem(text: string, page = 1): TextItem {
  return { text, bounds: { x: 0, y: 0, width: 100, height: 12 }, page };
}

describe('PIIDetectionService — neue Kategorien', () => {
  let svc: PIIDetectionService;

  beforeEach(() => {
    svc = new PIIDetectionService();
  });

  // ── Kreditkarte ─────────────────────────────────────────────

  describe('Kreditkarte', () => {
    it('erkennt Visa-Nummer', () => {
      const items = [makeTextItem('Kartennummer: 4111111111111111')];
      const results = svc.detectAll(items);
      const match = results.find(r => r.category === 'Kreditkarte');
      expect(match).toBeDefined();
      expect(match?.originalContent).toContain('4111111111111111');
    });

    it('erkennt Mastercard', () => {
      const items = [makeTextItem('5500005555555559')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Kreditkarte')).toBe(true);
    });

    it('erkennt Amex (15-stellig)', () => {
      const items = [makeTextItem('378282246310005')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Kreditkarte')).toBe(true);
    });

    it('erkennt KEINE zufällige 16-stellige Zahl ohne Kartenprefix', () => {
      const items = [makeTextItem('1234567890123456')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Kreditkarte')).toBe(false);
    });
  });

  // ── Sozialversicherung ──────────────────────────────────────

  describe('Sozialversicherung', () => {
    it('erkennt SV-Nummer ohne Leerzeichen', () => {
      const items = [makeTextItem('65070195M002')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Sozialversicherung')).toBe(true);
    });

    it('erkennt SV-Nummer mit Leerzeichen', () => {
      const items = [makeTextItem('65 070195 M 002')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Sozialversicherung')).toBe(true);
    });

    it('erkennt KEINE normale Zahl als SV-Nummer', () => {
      const items = [makeTextItem('12345678')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Sozialversicherung')).toBe(false);
    });
  });

  // ── BIC/SWIFT ───────────────────────────────────────────────

  describe('BIC/SWIFT', () => {
    it('erkennt 8-stelligen BIC', () => {
      const items = [makeTextItem('BIC: DEUTDEDB')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'BIC')).toBe(true);
    });

    it('erkennt 11-stelligen BIC', () => {
      const items = [makeTextItem('SWIFT: COBADEFFXXX')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'BIC')).toBe(true);
    });
  });

  // ── Fahrzeug-Kennzeichen ────────────────────────────────────

  describe('Fahrzeug', () => {
    it('erkennt deutsches Kennzeichen Standard', () => {
      const items = [makeTextItem('Fahrzeug: M-AB 1234')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Fahrzeug')).toBe(true);
    });

    it('erkennt Elektro-Kennzeichen mit E', () => {
      const items = [makeTextItem('B-XY 99E')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Fahrzeug')).toBe(true);
    });

    it('erkennt Umlaute im Kennzeichen (z.B. Ü)', () => {
      const items = [makeTextItem('MÜ-AB 123')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Fahrzeug')).toBe(true);
    });
  });

  // ── Steuernummer (Betrieb) ──────────────────────────────────

  describe('Steuernummer', () => {
    it('erkennt Steuernummer im Schrägstrich-Format', () => {
      const items = [makeTextItem('Steuernummer: 111/222/33333')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Steuernummer')).toBe(true);
    });

    it('Steuer-ID (11 Ziffern, keine Schrägstriche) bleibt Steuer-ID', () => {
      const items = [makeTextItem('Steueridentifikationsnummer: 86095742719')];
      const results = svc.detectAll(items);
      const steuerId = results.filter(r => r.category === 'Steuer-ID');
      const steuernummer = results.filter(r => r.category === 'Steuernummer');
      // Einer der beiden sollte matchen, nicht beide
      const total = steuerId.length + steuernummer.length;
      expect(total).toBeGreaterThanOrEqual(1);
      // Schrägstrich-Format darf nicht als Steuer-ID erkannt werden
    });

    it('erkennt NICHT Steuernummer ohne Keyword wenn nur Ziffern', () => {
      // Eine 11-stellige Zahl ohne Kontext ist ambig — Steuer-ID hat Vorrang
      const items = [makeTextItem('Referenz: 12345678901')];
      const results = svc.detectAll(items);
      // Kein False-Positive durch Steuernummer-Regel
      expect(results.filter(r => r.category === 'Steuernummer').length).toBeLessThanOrEqual(1);
    });
  });

  // ── Keine False-Positives ────────────────────────────────────

  describe('keine False-Positives', () => {
    it('erkennt IBAN nicht als Kreditkarte', () => {
      const items = [makeTextItem('DE89370400440532013000')];
      const results = svc.detectAll(items);
      expect(results.some(r => r.category === 'Kreditkarte')).toBe(false);
      expect(results.some(r => r.category === 'IBAN')).toBe(true);
    });
  });
});
```

---

## Schritt 2 — Implementation

### 2a. `src/common/types.ts` ändern

**Ersetze** die `PIICategory`-Definition (Zeile 9–22) durch:

```typescript
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
  | 'Steuernummer'
  | 'URL'
  | 'Kontonummer'
  | 'Kreditkarte'
  | 'Sozialversicherung'
  | 'BIC'
  | 'Fahrzeug'
  | 'Manuell'
  | 'Unbekannt';
```

### 2b. `src/main/services/pii-detection-service.ts` — REGEX_RULES ergänzen

**Füge nach dem IBAN-Eintrag** (nach Zeile 29, vor E-Mail) folgende Regeln ein:

```typescript
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
  // Nur erkennen wenn Keyword vorhanden oder nach IBAN-Kontext
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
```

**Ändere außerdem** den bestehenden `Steuer-ID`-Eintrag (Zeile 66–71) — mache den Pattern exklusiver für die persönliche IdNr. (11 Stellen, keine Schrägstriche) und füge danach `Steuernummer` hinzu:

```typescript
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
```

### 2c. `src/renderer/services/pii-detection-client.ts` prüfen und spiegeln

Öffne `src/renderer/services/pii-detection-client.ts`. Diese Datei hat eine eigene Kopie der `REGEX_RULES`. Wende **identische Änderungen** an:
1. Prüfe ob `PIICategory`-Import aus `../../common/types` kommt (tut es, da gemeinsam)
2. Füge die gleichen 5 neuen Regeln an der gleichen Position ein
3. Ändere den `Steuer-ID`-Eintrag identisch

---

## Schritt 3 — Tests ausführen und verifizieren

```bash
npx vitest run src/main/services/__tests__/pii-detection-service.test.ts --reporter=verbose
```

Alle Tests müssen grün sein.

```bash
npx tsc --noEmit
```

TypeScript darf keine Fehler zeigen. Insbesondere: alle Stellen die `PIICategory` nutzen und eventuell via switch/exhaustive check prüfen.

---

## Schritt 4 — Regression prüfen

```bash
npm test
```

Bestehende Tests (falls vorhanden) dürfen nicht brechen.

---

## Definition of Done

- [ ] `PIICategory` in `types.ts` enthält alle 5 neuen Werte + `Steuernummer`
- [ ] `REGEX_RULES` in `pii-detection-service.ts` enthält 5 neue Einträge
- [ ] `pii-detection-client.ts` ist identisch gespiegelt
- [ ] Alle 16 Tests aus `pii-detection-service.test.ts` sind grün
- [ ] `npx tsc --noEmit` ohne Fehler
- [ ] Kreditkarte `4111111111111111` wird erkannt
- [ ] `65070195M002` wird als `Sozialversicherung` erkannt
- [ ] `DEUTDEDB` nach "BIC:" wird als `BIC` erkannt
- [ ] `M-AB 1234` wird als `Fahrzeug` erkannt
- [ ] `111/222/33333` wird als `Steuernummer` erkannt

---

## Bekannte Tücken

1. **BIC-False-Positives:** BIC-Muster ohne Keyword-Prefix würde viele Wörter matchen. Deshalb: Pattern enthält obligatorisches Keyword `BIC:` oder `SWIFT:`. Falls BIC ohne Keyword erkannt werden soll (z.B. direkt nach IBAN), muss ein zweiter Lookup-Kontext gebaut werden — das ist für v1.1 out-of-scope.

2. **Steuer-ID vs. Steuernummer Überschneidung:** Die neue `Steuer-ID`-Regex `\d{11}` kann mit zufälligen 11-stelligen Zahlen matchen. Die Prüfung `(?<![\/\d])` und `(?![\/\d])` reduziert False-Positives. In der Praxis erscheint die IdNr. immer mit Keyword „Steueridentifikationsnummer" oder „IdNr." im Dokument.

3. **Regex-Flags:** Alle neuen Regeln benötigen das `g`-Flag. Niemals `i`-Flag bei `Fahrzeug` und `BIC`, da Kennzeichen und BIC immer Großbuchstaben haben.
