import { describe, it, expect } from 'vitest';
import { buildCleanDocumentProperties, neutralizePdfProducer } from '../Toolbar';

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

describe('buildCleanDocumentProperties', () => {
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

describe('neutralizePdfProducer', () => {
  it('entfernt jsPDF aus dem Producer-Feld', () => {
    const input = strToBytes('/Producer (jsPDF 2.5.1)\n/Creator (jsPDF)');
    const output = neutralizePdfProducer(input);
    const result = bytesToStr(output);
    expect(result).not.toContain('jsPDF 2.5.1');
    expect(result).toContain('/Producer (ResidentPri)');
    expect(output.length).toBe(input.length);
  });

  it('ersetzt Producer vollständig wenn Feld lang genug ist', () => {
    const input = strToBytes('/Producer (Some long producer name here)\n');
    const output = neutralizePdfProducer(input);
    const result = bytesToStr(output);
    expect(result).toContain('ResidentPrivacyFlow');
    expect(output.length).toBe(input.length);
  });

  it('leert CreationDate vollständig (mit Padding)', () => {
    const input = strToBytes('/CreationDate (D:20260404120000)');
    const output = neutralizePdfProducer(input);
    const result = bytesToStr(output);
    expect(result).not.toContain('D:20260404');
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
    const binary = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const textPart = strToBytes('/Producer (jsPDF 2.5.1)\n');
    const combined = new Uint8Array(binary.length + textPart.length);
    combined.set(binary, 0);
    combined.set(textPart, binary.length);

    const output = neutralizePdfProducer(combined);

    for (let i = 0; i < binary.length; i++) {
      expect(output[i]).toBe(binary[i]);
    }
    expect(bytesToStr(output.slice(binary.length))).not.toContain('jsPDF');
    expect(output.length).toBe(combined.length);
  });

  it('idempotent: zweimal anwenden ergibt gleiches Resultat', () => {
    const input = strToBytes('/Producer (jsPDF 2.5.1)');
    const once = neutralizePdfProducer(input);
    const twice = neutralizePdfProducer(once);
    expect(bytesToStr(once)).toBe(bytesToStr(twice));
  });
});

describe('Integration: Metadaten-Flow', () => {
  it('buildCleanDocumentProperties + neutralizePdfProducer zusammen', () => {
    const props = buildCleanDocumentProperties();
    expect(props.author).toBe('');
    expect(props.creator).toBe('ResidentPrivacyFlow');

    const pdfStub = strToBytes(
      `/Author ()\n/Creator (ResidentPrivacyFlow)\n/Producer (jsPDF 2.5.1)\n/CreationDate (D:20260404120000)`
    );
    const cleaned = neutralizePdfProducer(pdfStub);
    const result = bytesToStr(cleaned);

    expect(result).toContain('/Creator (ResidentPrivacyFlow)');
    expect(result).not.toContain('jsPDF 2.5.1');
    expect(result).not.toMatch(/D:\d+/);
    expect(cleaned.length).toBe(pdfStub.length);
  });
});
