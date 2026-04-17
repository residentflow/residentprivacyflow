# Spec-Konventionen (geteilt über alle Specs)

> **Diese Datei MUSS von jedem Agent gelesen werden, bevor mit einer Spec-Implementation begonnen wird.**  
> Sie ergänzt `00_OVERVIEW.md` um durchsetzbare Regeln.

---

## 1. Pre-flight Checkliste (VOR jeder Implementation)

Jeder Agent führt vor Beginn **exakt** diese Schritte aus — keine Ausnahme:

```bash
# 1. Git-Status muss sauber sein (keine ungewollten Änderungen)
git status

# 2. TypeScript muss kompilieren
npx tsc --noEmit

# 3. Bestehende Tests müssen grün sein
npm test 2>&1 | tee /tmp/baseline-tests.log

# 4. Notiere aktuellen Commit für Rollback
git rev-parse HEAD > /tmp/rollback-commit.txt
```

**Wenn einer dieser Schritte fehlschlägt:** NICHT mit der Implementation beginnen. Den User informieren und Ursache klären.

---

## 2. Rollback-Protokoll (bei Blockern)

Wenn ein Agent in Spec N einen unüberwindbaren Blocker findet:

```bash
# Stash aktuelle Änderungen mit beschreibendem Namen
git stash push -m "spec-NN-blocker: <kurze Beschreibung>"

# Zurück zum Baseline-Commit
git reset --hard $(cat /tmp/rollback-commit.txt)

# Agent meldet sich mit: Was versucht, warum blockiert, was benötigt
```

---

## 3. File-Read-Protokoll

Jede Spec listet unter **„Files to READ before starting"** die exakten Pfade. Der Agent:
1. Liest **ALLE** dort aufgeführten Dateien VOR der ersten Code-Änderung vollständig
2. Prüft ob die in der Spec eingebetteten Code-Snippets mit dem tatsächlichen Code übereinstimmen
3. Bei Abweichung: STOP — User informieren (die Spec ist veraltet)

---

## 4. Verbotene Aktionen (Forbidden)

Ein Agent darf **niemals**:

- ❌ `package.json` ändern (außer die Spec instruiert explizit `npm install X`)
- ❌ `tsconfig.*.json` ändern (außer Spec 00 für Test-Setup)
- ❌ `electron`, `electron-builder`, `vite` als Abhängigkeit upgraden
- ❌ Neue Abhängigkeiten hinzufügen die nicht in der Spec stehen
- ❌ Bestehende Tests löschen oder `.skip` setzen um sie „grün" zu kriegen
- ❌ `any`-Types einführen um TypeScript-Fehler zu verstecken
- ❌ `// @ts-ignore` oder `// @ts-nocheck` verwenden
- ❌ Git-Commits erstellen (macht der User)
- ❌ Dateien außerhalb der in der Spec genannten „Files to MODIFY / CREATE" Liste verändern

---

## 5. Test-Framework Regeln

### Vitest-Imports immer vollständig
```typescript
// RICHTIG — explizite Imports auch wenn globals: true konfiguriert
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// FALSCH — verlässt sich auf globals, bricht in Strict-Umgebungen
// describe('...', () => { expect(...).toBe(...) });  // ohne Import
```

### Canvas-Tests in jsdom

jsdom hat **nur rudimentäres Canvas-Support**. `getImageData`, `putImageData`, `drawImage` funktionieren NICHT zuverlässig.

**Regel für Canvas-Tests:**
- Nutze `vi.spyOn(ctx, 'fillRect')` / `vi.spyOn(ctx, 'fillText')` um Aufrufe zu verifizieren
- Teste **nicht** das gerenderte Pixelbild (`getImageData`)
- Für Integrationstests mit echtem Canvas: manuell in `npm run dev` verifizieren

**Beispiel (korrekt):**
```typescript
it('zeichnet schwarzes Rechteck', () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const fillRectSpy = vi.spyOn(ctx, 'fillRect');
  
  applyRedactionsToCanvas(ctx, [makeRedaction()], 'schwärzen', 1.0);
  
  expect(ctx.fillStyle).toBe('#000000');  // letzter gesetzter Style
  expect(fillRectSpy).toHaveBeenCalledWith(10, 10, 50, 20);
});
```

### Electron-API Mocks

`window.electronAPI` existiert nicht in jsdom. Für Tests die `window.electronAPI` nutzen:

```typescript
// src/test-setup.ts erweitern:
beforeEach(() => {
  (window as any).electronAPI = {
    openFileDialog: vi.fn().mockResolvedValue(undefined),
    saveFileDialog: vi.fn().mockResolvedValue(undefined),
    analyzePdf: vi.fn(),
    exportPdf: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    setSettings: vi.fn(),
    getAuditLog: vi.fn().mockResolvedValue([]),
    addAuditLog: vi.fn(),
    getAppPath: vi.fn().mockResolvedValue(''),
    cleanTemp: vi.fn(),
    onMenuOpenFile: vi.fn().mockReturnValue(() => {}),
    onMenuGoToSettings: vi.fn().mockReturnValue(() => {}),
    onMenuGoToAudit: vi.fn().mockReturnValue(() => {}),
    onAnalyzeProgress: vi.fn().mockReturnValue(() => {}),
    onExportProgress: vi.fn().mockReturnValue(() => {}),
  };
});
```

---

## 6. React-Pattern Regeln

### State-basierte useEffect-Handler

**NIEMALS** `state` direkt als Effect-Dependency wenn der Handler window-scoped registriert wird:

```typescript
// ❌ FALSCH — re-registriert Listener bei jedem State-Change
useEffect(() => {
  const handler = (e: KeyboardEvent) => { /* nutzt state */ };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [state]);  // ← bei jedem Render neuer Listener

// ✅ RICHTIG — stable Handler via Ref
const stateRef = useRef(state);
stateRef.current = state;

useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const s = stateRef.current;  // immer aktueller Wert
    /* nutzt s statt state */
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);  // ← nur einmal registrieren
```

### Stable Callbacks

Alle Handler in `useCallback` wrappen wenn sie an Kinder-Komponenten als Prop übergeben werden.

### Map-Index statt indexOf

```typescript
// ❌ FALSCH — O(n²), unreliable bei Duplikaten
sortedEntries.map(entry => (
  <Row onClick={() => handleClick(entry.id, sortedEntries.indexOf(entry))} />
))

// ✅ RICHTIG — O(n), stabil
sortedEntries.map((entry, idx) => (
  <Row onClick={() => handleClick(entry.id, idx)} />
))
```

---

## 7. Cross-Spec Kompatibilität

Einige Specs ändern State-Shapes. Reihenfolge-Annahmen sind **explizit** dokumentiert:

| Spec | Ändert State-Shape | Kompatibel mit früheren Specs? |
|------|-------------------|-------------------------------|
| 01 | Nein (nur Typen) | Ja |
| 02 | Nein | Ja |
| 03 | Nein | Ja |
| 04 | Nein (nur Action-Union erweitert) | Ja |
| 05 | Nein (nur Action-Union erweitert) | Ja |
| 06 | Nein | Ja |
| 07 | **JA — BREAKING** | State-Migration nötig, siehe Spec 07 Migration-Guide |
| 08 | Nein (nur Settings-Felder) | Ja (benötigt Spec 01 für Kategorien) |

**Nach Spec 07** lesen alle folgenden Specs `activeDoc?.X` statt `state.X`. Die Spec 08 ist so geschrieben, dass sie BEIDE Fälle abdeckt — siehe Spec 08 für Details.

---

## 8. Global-Handler-Priorisierung

Mehrere Specs registrieren globale `keydown`-Handler. Zur Konfliktvermeidung:

**Verantwortlichkeiten:**
- `App.tsx` (Spec 03): Ctrl+Z/Y, Seitennavigation, Zoom, Modus, A/D/Delete, Tab, globales Escape (Auswahl aufheben)
- `EditorLayout.tsx` (Spec 05): Escape nur für `drawMode === 'groupselect'` (Modus-Toggle)
- `ExportPreviewModal.tsx` (Spec 06): Escape nur wenn Modal offen → schließt Modal

**Reihenfolge:**
1. Modal-Escape hat Vorrang (Modal stoppt Event-Propagation via `e.stopPropagation()`)
2. Wenn kein Modal offen: Group-Select-Mode prüft selbst
3. Sonst: globaler Handler aus App.tsx

**Implementation:** Modale und Popups registrieren ihren Handler mit `{ capture: true }` und rufen `e.stopImmediatePropagation()` — dann greift App.tsx nicht mehr.

```typescript
// In ExportPreviewModal.tsx:
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopImmediatePropagation();
      onClose();
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  return () => window.removeEventListener('keydown', handler, { capture: true });
}, [onClose]);
```

---

## 9. Definition of Done — erweiterte Universal-Checks

Zusätzlich zu Spec-spezifischen Kriterien muss für JEDE Spec erfüllt sein:

- [ ] `npx tsc --noEmit` fehlerfrei
- [ ] `npm test` alle Tests grün (keine neuen Failures)
- [ ] Keine `console.log` / `console.debug` in neuem Code
- [ ] Keine TODO/FIXME/XXX Kommentare in neuem Code
- [ ] Keine `any` Typen in neuem Code (außer in Tests mit Kommentar warum)
- [ ] Keine neuen Abhängigkeiten außer in Spec explizit erlaubt
- [ ] Alle geänderten Dateien stehen in der „Files to MODIFY" Liste der Spec
- [ ] Alle neuen Dateien stehen in der „Files to CREATE" Liste der Spec
- [ ] Deutsche User-Strings (keine englischen UI-Texte)
- [ ] Git-Diff gegen Baseline überprüft — keine unerwarteten Änderungen

---

## 10. Integrationstest-Pflicht

Jede Spec benötigt mindestens **einen** End-to-End Integration-Test, der den kompletten User-Flow simuliert — nicht nur isolierte Unit-Tests.

**Minimalbeispiel:**
```typescript
it('Integration: User akzeptiert alle Vorschläge einer Kategorie', () => {
  const state = {
    ...initialState,
    redactions: [
      makeEntry('1', 'IBAN', 'vorschlag'),
      makeEntry('2', 'IBAN', 'vorschlag'),
      makeEntry('3', 'Name', 'vorschlag'),
    ],
  };
  const result = reducer(state, { type: 'ACCEPT_BY_CATEGORY', category: 'IBAN' });
  
  // Prüfe: Status korrekt
  expect(result.redactions.filter(r => r.status === 'akzeptiert')).toHaveLength(2);
  // Prüfe: keine ungewollten Seiteneffekte
  expect(result.redactions.filter(r => r.category === 'Name')[0].status).toBe('vorschlag');
  // Prüfe: Identität erhalten (keine neuen Einträge)
  expect(result.redactions).toHaveLength(3);
});
```
