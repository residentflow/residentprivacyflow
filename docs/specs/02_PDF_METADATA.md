# Spec 02 — PDF-Metadaten-Schwärzung

> **Voraussetzung:** `00_OVERVIEW.md` UND `SPEC_CONVENTIONS.md` gelesen, Test-Framework installiert.  
> **Abhängigkeiten:** Keine.  
> **Komplexität:** Niedrig (~1–2h)

---

## Files to READ before starting

Der Agent MUSS diese Dateien vollständig lesen, bevor er Code schreibt:

- `src/renderer/components/Toolbar.tsx` (komplette Datei)
- `docs/specs/SPEC_CONVENTIONS.md` (Sektionen 1, 4, 5, 9)
- `package.json` (Version von jspdf prüfen — muss `^2.5.1` sein)

## Files to MODIFY (EXAKTE Liste — keine anderen Dateien ändern)

- `src/renderer/components/Toolbar.tsx`

## Files to CREATE

- `src/renderer/components/__tests__/toolbar-metadata.test.ts`

---

## Pre-flight Checks

Siehe `SPEC_CONVENTIONS.md §1`. Zusätzlich:

```bash
# Verifizieren dass jsPDF 2.x installiert ist (nicht 3.x)
node -p "require('./package.json').dependencies.jspdf"
# Muss ausgeben: ^2.5.1 (oder kompatibel)
```

---

## Ziel

Das exportierte PDF darf keine Metadaten enthalten, die auf den Ursprung des Dokuments, den Benutzer oder die verwendete Software hinweisen. `Creator`-Feld soll `ResidentPrivacyFlow` zeigen. Alle anderen persönlichen Felder leer.

---

## Problem

jsPDF 2.x setzt beim Erstellen eines neuen Dokuments automatisch:
- `Creator: jsPDF 2.x`
- `Producer: jsPDF 2.x`
- `CreationDate: <aktueller Timestamp>`

Diese Felder sind in Adobe Acrobat sichtbar: Datei → Eigenschaften → Beschreibung.

---

## Zu ändernde Datei

**`src/renderer/components/Toolbar.tsx`** — `handleExport`-Funktion

---

## Bestehender Code — vollständig

```typescript
// src/renderer/components/Toolbar.tsx — handleExport (Zeile 82–207)
const handleExport = useCallback(async () => {
  if (!state.filePath) return;

  try {
    const activeRedactions = state.redactions.filter(
      r => r.status === 'akzeptiert' || r.status === 'manuell'
    );

    if (state.redactions.some(r => r.status === 'vorschlag')) {
      dispatch({ 
        type: 'SET_ERROR', 
        error: 'Hinweis: Es gibt noch offene Vorschläge. Diese werden beim Export ignoriert.' 
      });
    }

    if (activeRedactions.length === 0) {
      dispatch({ type: 'SET_ERROR', error: 'Keine aktiven Schwärzungen zum Exportieren vorhanden.' });
      return;
    }

    const baseName = state.fileName?.replace(/\.pdf$/i, '') || 'document';
    const suffix = state.mode === 'pseudonymisieren' ? '_pseudonymisiert' : '_geschwärzt';
    const defaultName = `${baseName}${suffix}.pdf`;

    const outputPath = await window.electronAPI.saveFileDialog(defaultName);
    if (!outputPath) return;

    dispatch({ type: 'SET_EXPORTING', isExporting: true, progress: 'Export wird vorbereitet…' });

    const { getPdfDocument } = await import('../services/pdf-init');
    const pdf = await getPdfDocument(state.fileData!);
    const dpi = state.exportQuality === 'high' ? 300 : 150;
    const scale = dpi / 72;

    const { jsPDF } = await import('jspdf');

    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: 1.0 });
    const pdfDoc = new jsPDF({            // ← HIER EINFÜGEN nach dieser Zeile
      orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [firstViewport.width, firstViewport.height],
    });

    // ... rest der Funktion
  }
}, [state, dispatch]);
```

---

## Schritt 1 — Tests schreiben (TDD)

Datei erstellen: **`src/renderer/components/__tests__/toolbar-metadata.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wir testen die Metadaten-Bereinigung isoliert als pure Funktion
// da jsPDF in jsdom nicht vollständig verfügbar ist.

import { buildCleanDocumentProperties } from '../Toolbar';

describe('PDF Metadaten-Bereinigung', () => {
  it('gibt leere persönliche Felder zurück', () => {
    const props = buildCleanDocumentProperties();
    expect(props.title).toBe('');
    expect(props.subject).toBe('');
    expect(props.author).toBe('');
    expect(props.keywords).toBe('');
  });

  it('setzt Creator auf ResidentPrivacyFlow', () => {
    const props = buildCleanDocumentProperties();
    expect(props.creator).toBe('ResidentPrivacyFlow');
  });

  it('enthält kein Erstellungsdatum', () => {
    const props = buildCleanDocumentProperties();
    expect(props).not.toHaveProperty('creationDate');
  });
});
```

> **Hinweis:** Die Funktion `buildCleanDocumentProperties` wird als named export aus `Toolbar.tsx` exportiert, damit sie testbar ist. Sie enthält die Logik, nicht den jsPDF-Aufruf selbst.

---

## Schritt 2 — Implementation

### 2a. Pure Hilfsfunktion in Toolbar.tsx hinzufügen

**Am Anfang von `Toolbar.tsx`** (nach den Imports, vor der Komponente) folgende Funktion einfügen:

```typescript
/** Erzeugt neutrale PDF-Dokumenteigenschaften ohne persönliche Metadaten. */
export function buildCleanDocumentProperties() {
  return {
    title: '',
    subject: '',
    author: '',
    keywords: '',
    creator: 'ResidentPrivacyFlow',
  };
}
```

### 2b. Metadaten nach jsPDF-Instanziierung setzen

**In `handleExport`**, direkt nach der `new jsPDF(...)` Zeile einfügen:

```typescript
const pdfDoc = new jsPDF({
  orientation: firstViewport.width > firstViewport.height ? 'landscape' : 'portrait',
  unit: 'pt',
  format: [firstViewport.width, firstViewport.height],
});

// ← NACH dieser Zeile einfügen:
pdfDoc.setDocumentProperties(buildCleanDocumentProperties());
```

### 2c. Producer-Feld neutralisieren

jsPDF setzt `Producer` nicht über `setDocumentProperties`. Stattdessen nach `pdfDoc.output('arraybuffer')` eine Byte-Manipulation durchführen:

**Ersetze** den Block:
```typescript
const pdfBytes = pdfDoc.output('arraybuffer');
const pdfUint8 = new Uint8Array(pdfBytes);
```

**Durch:**
```typescript
const pdfBytes = pdfDoc.output('arraybuffer');
const pdfUint8 = neutralizePdfProducer(new Uint8Array(pdfBytes));
```

**Und füge diese Funktion** am Anfang der Datei hinzu (als named export für Tests):

```typescript
/**
 * Überschreibt Metadaten-Felder in PDF-Bytes (byte-weise, preserving length).
 * 
 * WICHTIG: Wir operieren byte-weise (nicht UTF-8!) da PDFs binäre Daten enthalten
 * und String-Konversion binäre Streams korrumpieren würde. Wir nutzen Latin-1
 * (ISO-8859-1) für Encoding/Decoding — es hat 1:1 Byte-Mapping.
 * 
 * WICHTIG: Die Länge der Ersatzstrings MUSS gleich oder kürzer sein als das
 * Original, damit xref-Byte-Offsets nicht invalidiert werden. Shorter strings
 * werden mit Spaces (0x20) innerhalb der Klammern aufgefüllt.
 */
export function neutralizePdfProducer(bytes: Uint8Array): Uint8Array {
  // Latin-1 garantiert 1:1 Byte-zu-Char Mapping
  const str = bytesToLatin1(bytes);

  let result = str;
  result = replacePaddedField(result, 'Producer', 'ResidentPrivacyFlow');
  result = replacePaddedField(result, 'CreationDate', '');
  result = replacePaddedField(result, 'ModDate', '');

  return latin1ToBytes(result);
}

/**
 * Ersetzt /FieldName (old-content) durch /FieldName (new-content-padded-to-same-length).
 * Gibt den ursprünglichen String zurück wenn das Feld nicht vorhanden ist.
 */
function replacePaddedField(pdfStr: string, fieldName: string, newContent: string): string {
  const pattern = new RegExp(`/${fieldName}\\s*\\(([^)]*)\\)`);
  const match = pdfStr.match(pattern);
  if (!match) return pdfStr;  // Feld nicht vorhanden — keine Änderung

  const originalContent = match[1];
  // Auf gleiche Länge padden damit xref-Offsets stimmen
  const padded = newContent.length <= originalContent.length
    ? newContent.padEnd(originalContent.length, ' ')
    : newContent.slice(0, originalContent.length);

  return pdfStr.replace(pattern, `/${fieldName} (${padded})`);
}

function bytesToLatin1(bytes: Uint8Array): string {
  // Direktes Char-Code Mapping — kein TextDecoder/Encoder
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

function latin1ToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}
```

> **Warum byte-weise statt TextEncoder/TextDecoder?**  
> PDFs sind keine reinen Textdateien. Sie enthalten binäre Streams (Bilder, Fonts). `TextDecoder('utf-8')` würde ungültige UTF-8-Sequenzen in Replacement Characters (`U+FFFD`) umwandeln — das korrumpiert das PDF. Latin-1 hat 1:1 Byte-Mapping (jedes Byte 0-255 = ein Char) und ist damit verlustfrei.
> 
> **Warum Padding?**  
> xref-Tables am Ende eines PDFs enthalten Byte-Offsets zu Objekten. Wenn sich die Byte-Länge ändert, zeigen diese Offsets auf falsche Positionen → PDF wird von strengen Readern abgelehnt. Padding auf Originallänge umgeht dieses Problem ohne xref-Rewrite.

---

## Schritt 3 — Erweiterte Tests

**Erweitere `toolbar-metadata.test.ts`:**

```typescript
import { neutralizePdfProducer } from '../Toolbar';

// Helper: String zu Uint8Array (byte-exakt via charCode, wie die Implementation)
function strToBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

function bytesToStr(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

describe('neutralizePdfProducer', () => {
  it('entfernt jsPDF aus dem Producer-Feld', () => {
    const input = strToBytes('/Producer (jsPDF 2.5.1)\n/Creator (jsPDF)');
    const output = neutralizePdfProducer(input);
    const result = bytesToStr(output);
    expect(result).not.toContain('jsPDF 2.5.1');
    expect(result).toContain('ResidentPrivacyFlow');
  });

  it('leert CreationDate vollständig (mit Padding)', () => {
    const input = strToBytes('/CreationDate (D:20260404120000)');
    const output = neutralizePdfProducer(input);
    const result = bytesToStr(output);
    expect(result).not.toContain('D:20260404');
    // Länge muss erhalten sein
    expect(output.length).toBe(input.length);
  });

  it('behält Byte-Länge exakt bei (xref-Stabilität)', () => {
    const input = strToBytes('/Producer (jsPDF 2.5.1)\n/CreationDate (D:20260404120000)\n/ModDate (D:20260404120000)');
    const output = neutralizePdfProducer(input);
    expect(output.length).toBe(input.length);
  });

  it('verändert PDF ohne Producer-Feld nicht', () => {
    const input = strToBytes('/Size 42\n/Root 1 0 R');
    const output = neutralizePdfProducer(input);
    expect(bytesToStr(output)).toBe('/Size 42\n/Root 1 0 R');
  });

  it('behält binäre Streams unverändert (Byte-Identität)', () => {
    // Simuliert PDF mit binärem Inhalt (z.B. eingebettetes JPEG)
    const binary = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const textPart = strToBytes('/Producer (jsPDF 2.5.1)\n');
    const combined = new Uint8Array(binary.length + textPart.length);
    combined.set(binary, 0);
    combined.set(textPart, binary.length);

    const output = neutralizePdfProducer(combined);

    // Binärer Header unverändert
    for (let i = 0; i < binary.length; i++) {
      expect(output[i]).toBe(binary[i]);
    }
    // Producer ersetzt
    expect(bytesToStr(output.slice(binary.length))).toContain('ResidentPrivacyFlow');
  });

  it('idempotent: zweimal anwenden ergibt gleiches Resultat', () => {
    const input = strToBytes('/Producer (jsPDF 2.5.1)');
    const once = neutralizePdfProducer(input);
    const twice = neutralizePdfProducer(once);
    expect(bytesToStr(once)).toBe(bytesToStr(twice));
  });
});
```

## Schritt 3b — Integrationstest (Pflicht laut SPEC_CONVENTIONS §10)

```typescript
describe('Integration: Metadaten-Flow', () => {
  it('buildCleanDocumentProperties + neutralizePdfProducer zusammen', () => {
    // Simuliert kompletten Export-Flow
    const props = buildCleanDocumentProperties();
    expect(props.author).toBe('');
    expect(props.creator).toBe('ResidentPrivacyFlow');

    // Simuliert jsPDF-Output mit den Properties gesetzt
    const pdfStub = strToBytes(
      `/Author ()\n/Creator (ResidentPrivacyFlow)\n/Producer (jsPDF 2.5.1)\n/CreationDate (D:20260404120000)`
    );
    const cleaned = neutralizePdfProducer(pdfStub);
    const result = bytesToStr(cleaned);

    expect(result).toContain('/Creator (ResidentPrivacyFlow)');
    expect(result).not.toContain('jsPDF 2.5.1');
    expect(result).not.toMatch(/D:\d+/);  // kein Datum mehr
    expect(cleaned.length).toBe(pdfStub.length);  // Länge erhalten
  });
});
```

---

## Schritt 4 — Tests ausführen

```bash
npx vitest run src/renderer/components/__tests__/toolbar-metadata.test.ts --reporter=verbose
npx tsc --noEmit
```

---

## Manuelle Verifikation

Da der vollständige Export-Flow jsdom-inkompatibel ist (Canvas, jsPDF, FileSystem), muss der Export manuell geprüft werden:

1. `npm run dev` starten
2. PDF öffnen, mindestens 1 Schwärzung akzeptieren
3. Exportieren
4. Exportiertes PDF in einem der folgenden Tools prüfen:
   - **Windows:** Rechtsklick → Eigenschaften → Details
   - **Adobe Acrobat:** Datei → Eigenschaften → Beschreibung
   - **CLI:** `pdfinfo exported.pdf` (falls poppler installiert)
5. Erwartetes Ergebnis: Kein Autor, Creator = `ResidentPrivacyFlow`, kein Bearbeitungspfad

---

## Definition of Done

- [ ] `buildCleanDocumentProperties()` als named export in `Toolbar.tsx`
- [ ] `neutralizePdfProducer()` als named export in `Toolbar.tsx`
- [ ] `pdfDoc.setDocumentProperties(buildCleanDocumentProperties())` direkt nach `new jsPDF()`
- [ ] `neutralizePdfProducer` wird auf die finalen Bytes angewendet
- [ ] Alle 9+ Unit-Tests grün (5 bisherige + 4 neue Edge-Cases)
- [ ] Byte-Länge nach Neutralisierung = Byte-Länge vorher (xref-Stabilität)
- [ ] Binäre Streams (JPEGs, Fonts) bleiben bytewise unverändert
- [ ] Manuell: Exportiertes PDF zeigt kein `jsPDF` in Metadaten
- [ ] Manuell: `Author`-Feld ist leer
- [ ] Manuell: Adobe Acrobat öffnet exportiertes PDF fehlerfrei
- [ ] Universal-Checks aus `SPEC_CONVENTIONS.md §9` erfüllt
