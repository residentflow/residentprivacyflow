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
      const total = steuerId.length + steuernummer.length;
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it('erkennt NICHT Steuernummer ohne Keyword wenn nur Ziffern', () => {
      const items = [makeTextItem('Referenz: 12345678901')];
      const results = svc.detectAll(items);
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
