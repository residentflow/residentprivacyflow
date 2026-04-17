# Feature Specifications — ResidentPrivacyFlow v1.1

> **Stand:** 2026-04-17  
> **Basis:** v1.0.1  
> **Scope:** 7 Features, 4 Phasen

---

## Inhaltsverzeichnis

1. [Phase 1A — Neue PII-Kategorien](#phase-1a--neue-pii-kategorien)
2. [Phase 1B — PDF-Metadaten-Schwärzung](#phase-1b--pdf-metadaten-schwärzung)
3. [Phase 1C — Tastaturkürzel](#phase-1c--tastaturkürzel)
4. [Phase 1D — Bulk-Aktionen](#phase-1d--bulk-aktionen)
5. [Phase 2A — Gruppenzuweisung über Markierung](#phase-2a--gruppenzuweisung-über-markierung)
6. [Phase 2B — Export-Vorschau](#phase-2b--export-vorschau)
7. [Phase 3 — Batch-Verarbeitung / Multi-Tab](#phase-3--batch-verarbeitung--multi-tab)
8. [Phase 4 — OCR für bildbasierte PDFs](#phase-4--ocr-für-bildbasierte-pdfs)

---

## Phase 1A — Neue PII-Kategorien

### Ziel
Die automatische PII-Erkennung deckt aktuell 9 Kategorien ab. Für ein vollständiges GDPR-Werkzeug fehlen 5 relevante Kategorien, die in deutschen Mietverträgen, Arbeitsverträgen und Bankkorrespondenz häufig vorkommen.

### Neue Kategorien

| Kategorie | Beschreibung | Beispiel |
|-----------|-------------|---------|
| `Kreditkarte` | Kartennummern nach Luhn-Algorithmus | `4111 1111 1111 1111` |
| `Sozialversicherung` | Deutsche Sozialversicherungsnummer | `65 070195 M 002` |
| `BIC` | BIC/SWIFT-Bankidentifikationscode | `DEUTDEDB` oder `COBADEFFXXX` |
| `Fahrzeug` | Amtliche Kennzeichen (DE) | `M-AB 1234`, `B-XY 99E` |
| `Steuernummer` | Unternehmens-Steuernummer (10–13 Ziffern / Schrägstrich-Format) | `111/222/33333` |

> `Steuer-ID` (persönliche IdNr., 11 Ziffern) bleibt als eigene Kategorie unverändert.

### Regex-Regeln (Detail)

```
Kreditkarte:
  Visa:       /\b4[0-9]{12}(?:[0-9]{3})?\b/
  Mastercard: /\b5[1-5][0-9]{14}\b/
  Amex:       /\b3[47][0-9]{13}\b/
  Discover:   /\b6(?:011|5[0-9]{2})[0-9]{12}\b/
  → Luhn-Validierung als optionale Nachfilterung

Sozialversicherung:
  /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/
  Beispiele: "65 070195 M 002", "65070195M002"

BIC/SWIFT:
  /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/
  Mindestlänge 8, max 11 Zeichen
  → Falsch-Positive-Reduktion: nur matchen wenn in der Nähe von
    Keywords wie "BIC", "SWIFT", "Bank" oder direkt nach IBAN

Fahrzeug-Kennzeichen:
  /\b[A-ZÄÖÜ]{1,3}[-\s][A-Z]{1,2}\s?\d{1,4}[EH]?\b/
  Deckt Standardformat und E/H-Kennzeichen ab

Steuernummer (Betrieb):
  /\b\d{2,3}\/\d{3}\/\d{4,5}\b/        ← Schrägstrich-Format (Bayern, NRW, etc.)
  /\b\d{13}\b/                           ← 13-stellig (ELSTER-Format)
  Konflikt mit Steuer-ID vermeiden: Steuer-ID hat exakt 11 Stellen,
  kein Schrägstrich → vorrangig matchen
```

### Änderungen im Code

**`src/common/types.ts`**
```typescript
export type PIICategory =
  | 'Name' | 'Adresse' | 'IBAN' | 'E-Mail'
  | 'Telefon' | 'Mobilfunk' | 'Fax' | 'Datum'
  | 'Steuer-ID' | 'Steuernummer'          // ← Steuernummer neu
  | 'URL' | 'Kontonummer'
  | 'Kreditkarte' | 'Sozialversicherung'  // ← neu
  | 'BIC' | 'Fahrzeug'                    // ← neu
  | 'Manuell' | 'Unbekannt';
```

**`src/main/services/pii-detection-service.ts`** — 5 neue Einträge in `REGEX_RULES[]` nach dem IBAN-Block.

**`src/renderer/services/pii-detection-client.ts`** — identisch spiegeln (Regex-Regeln sind dupliziert, beide aktualisieren).

### Akzeptanzkriterien

- [ ] Kreditkartennummer in Testdokument wird erkannt und als `Kreditkarte` kategorisiert
- [ ] `Sozialversicherung` und `Steuer-ID` werden nicht verwechselt
- [ ] BIC ohne IBAN-Kontext erzeugt keine massiven Falsch-Positiven
- [ ] Fahrzeugkennzeichen `M-AB 1234E` und `B-XY 99` werden erkannt
- [ ] Steuernummer `111/222/33333` wird als `Steuernummer` erkannt, nicht als `Steuer-ID`
- [ ] Alle neuen Kategorien erscheinen im Kategorie-Dropdown der RedactionTable

---

## Phase 1B — PDF-Metadaten-Schwärzung

### Ziel
Das exportierte PDF enthält aktuell jsPDF-Standardmetadaten (Creator, Producer, ggf. Erstellungsdatum). Für echte Anonymisierung müssen diese im Output leer oder neutral sein.

### Aktuelles Verhalten

jsPDF setzt beim Erstellen automatisch:
- `Creator`: `jsPDF 2.x`
- `Producer`: `jsPDF 2.x`
- `CreationDate`: aktueller Timestamp

Diese Felder sind im exportierten PDF sichtbar (Adobe Acrobat → Datei → Eigenschaften → Beschreibung).

### Gewünschtes Verhalten

| Metadatenfeld | Ausgabe |
|--------------|---------|
| Title | `` (leer) |
| Author | `` (leer) |
| Subject | `` (leer) |
| Keywords | `` (leer) |
| Creator | `ResidentPrivacyFlow` |
| Producer | `ResidentPrivacyFlow` |
| CreationDate | entfernt / nicht gesetzt |

### Änderungen im Code

**`src/renderer/components/Toolbar.tsx`** — direkt nach `new jsPDF(...)`:

```typescript
pdfDoc.setDocumentProperties({
  title: '',
  subject: '',
  author: '',
  keywords: '',
  creator: 'ResidentPrivacyFlow',
});

// Producer-Feld über interne jsPDF-Struktur überschreiben
// (jsPDF setzt Producer nicht über setDocumentProperties)
(pdfDoc as any).internal.getPDFVersion = () => '1.4';
(pdfDoc as any).internal.events.publish('putDocumentProperties');
```

> **Hinweis:** jsPDF 2.x bietet kein direktes API für `Producer`. Das Feld wird über die interne `putDocumentProperties`-Funktion gesetzt. Ein Workaround: nach `pdfDoc.output('arraybuffer')` die resultierenden Bytes nach `%%Creator` und `%%Producer` scannen und überschreiben (Buffer-Manipulation, 5–10 Zeilen).

### Akzeptanzkriterien

- [ ] Exportiertes PDF enthält kein `Author`-Feld
- [ ] `Creator`-Feld zeigt `ResidentPrivacyFlow`
- [ ] Kein Ursprungsdateiname im Metadaten sichtbar
- [ ] Test mit `pdfinfo` (CLI) oder Adobe Acrobat Eigenschaften

---

## Phase 1C — Tastaturkürzel

### Ziel
Navigation und Kernaktionen ohne Maus ermöglichen. Besonders für Power-User die viele Dokumente verarbeiten.

### Shortcut-Tabelle

| Kürzel | Kontext | Aktion | Bedingung |
|--------|---------|--------|-----------|
| `Strg+Z` | Überall | Rückgängig | — (bereits vorhanden) |
| `Strg+Y` / `Strg+Shift+Z` | Überall | Wiederholen | — (bereits vorhanden) |
| `←` / `ArrowLeft` | Editor | Vorherige Seite | `currentPage > 1` |
| `→` / `ArrowRight` | Editor | Nächste Seite | `currentPage < pageCount` |
| `PageUp` | Editor | Vorherige Seite | `currentPage > 1` |
| `PageDown` | Editor | Nächste Seite | `currentPage < pageCount` |
| `+` / `NumpadAdd` | Editor | Zoom +25% | `zoom < 400` |
| `-` / `NumpadSubtract` | Editor | Zoom −25% | `zoom > 25` |
| `0` / `Numpad0` | Editor | Zoom 100% | — |
| `S` | Editor | Modus umschalten | kein Input fokussiert |
| `A` | Editor | Auswahl akzeptieren | `selectedRedactionId` gesetzt, Status = `vorschlag` |
| `D` | Editor | Auswahl ablehnen | `selectedRedactionId` gesetzt, Status = `vorschlag` |
| `Delete` | Editor | Auswahl löschen | `selectedRedactionId` gesetzt, Status = `manuell` |
| `Escape` | Editor | Auswahl aufheben | `selectedRedactionId !== null` |
| `Tab` | Editor | Nächste Schwärzung auswählen | mind. 1 Schwärzung vorhanden |
| `Shift+Tab` | Editor | Vorherige Schwärzung | mind. 1 Schwärzung vorhanden |

### Implementierung

**`src/renderer/App.tsx`** — `handleKeyDown` erweitern:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  // Nicht feuern wenn Input-Feld fokussiert
  if (e.target instanceof HTMLInputElement || 
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement) return;
  
  if (state.view !== 'editor') return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      dispatch({ type: 'SET_PAGE', page: state.currentPage - 1 });
      break;
    case 'ArrowRight':
    case 'PageDown':
      e.preventDefault();
      dispatch({ type: 'SET_PAGE', page: state.currentPage + 1 });
      break;
    case '+':
    case 'NumpadAdd':
      e.preventDefault();
      dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 25 });
      break;
    case '-':
    case 'NumpadSubtract':
      e.preventDefault();
      dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 25 });
      break;
    case '0':
      if (!e.ctrlKey) { e.preventDefault(); dispatch({ type: 'SET_ZOOM', zoom: 100 }); }
      break;
    case 's':
    case 'S':
      if (!e.ctrlKey) {
        e.preventDefault();
        dispatch({ type: 'SET_MODE', mode: state.mode === 'schwärzen' ? 'pseudonymisieren' : 'schwärzen' });
      }
      break;
    case 'a':
    case 'A':
      if (!e.ctrlKey && state.selectedRedactionId) {
        e.preventDefault();
        dispatch({ type: 'ACCEPT_SUGGESTION', id: state.selectedRedactionId });
      }
      break;
    case 'd':
    case 'D':
      if (!e.ctrlKey && state.selectedRedactionId) {
        e.preventDefault();
        dispatch({ type: 'REJECT_SUGGESTION', id: state.selectedRedactionId });
      }
      break;
    case 'Delete':
      if (state.selectedRedactionId) {
        const sel = state.redactions.find(r => r.id === state.selectedRedactionId);
        if (sel?.status === 'manuell') dispatch({ type: 'REMOVE_REDACTION', id: state.selectedRedactionId });
      }
      break;
    case 'Escape':
      dispatch({ type: 'SELECT_REDACTION', id: null });
      break;
    case 'Tab': {
      e.preventDefault();
      const sorted = [...state.redactions].sort((a, b) => a.page - b.page || a.bounds.y - b.bounds.y);
      const idx = sorted.findIndex(r => r.id === state.selectedRedactionId);
      const next = e.shiftKey ? sorted[idx - 1] : sorted[idx + 1];
      if (next) dispatch({ type: 'SELECT_REDACTION', id: next.id });
      break;
    }
  }
};
```

### Tooltip-Anzeige

Die bestehenden Tooltips in `Toolbar.tsx` für Undo/Redo zeigen bereits `(Strg+Z)`. Neue Shortcuts sollen analog im Tooltip erscheinen wo sinnvoll:
- Analyse-Button: kein Shortcut (zu gefährlich versehentlich)
- Zoom-Buttons: `(+)` / `(-)`
- Modus-Toggle: `(S)`

### Akzeptanzkriterien

- [ ] Seitennavigation via Pfeiltasten funktioniert, kein Scrollen ausgelöst
- [ ] `Tab` durchläuft alle Schwärzungen seitenübergreifend
- [ ] `A` / `D` reagieren nur auf Vorschläge, nicht auf manuelle Einträge
- [ ] In Texteingabefeldern keine Shortcut-Konflikte

---

## Phase 1D — Bulk-Aktionen

### Ziel
Massenoperationen auf Schwärzungen ermöglichen. Aktuell existieren `handleAcceptOpen()` / `handleRejectOpen()` für alle offenen Vorschläge. Benötigt werden:
1. Bulk-Aktionen pro Kategorie
2. Mehrfachauswahl mit Checkboxen

### Neue Actions im Reducer

**`src/renderer/store/types-and-reducer.ts`:**

```typescript
| { type: 'ACCEPT_BY_CATEGORY'; category: PIICategory }
| { type: 'REJECT_BY_CATEGORY'; category: PIICategory }
| { type: 'REMOVE_BY_CATEGORY'; category: PIICategory }
| { type: 'ACCEPT_SELECTION'; ids: string[] }
| { type: 'REJECT_SELECTION'; ids: string[] }
| { type: 'REMOVE_SELECTION'; ids: string[] }
```

Reducer-Implementierung (Beispiel `ACCEPT_BY_CATEGORY`):
```typescript
case 'ACCEPT_BY_CATEGORY':
  return {
    ...state,
    redactions: state.redactions.map(r =>
      r.category === action.category && r.status === 'vorschlag'
        ? { ...r, status: 'akzeptiert' }
        : r
    ),
  };
```

### UI-Änderungen in RedactionTable.tsx

#### 1. Kategorie-Header-Buttons

Wenn der Filter auf eine spezifische Kategorie gesetzt ist, erscheinen neben dem Kategorie-Label zwei kleine Buttons:

```
[IBAN ×]   [✓ Alle]  [✗ Alle]
```

- `✓ Alle`: dispatcht `ACCEPT_BY_CATEGORY`
- `✗ Alle`: dispatcht `REJECT_BY_CATEGORY`
- Buttons nur anzeigen wenn mind. 1 Vorschlag der Kategorie vorhanden

#### 2. Checkboxen + Aktionsleiste

Jede Tabellenzeile erhält eine Checkbox (links). Sobald ≥1 Checkbox aktiviert ist, erscheint eine fixierte Aktionsleiste am unteren Rand der Tabelle:

```
┌─────────────────────────────────────────┐
│  3 ausgewählt  [✓ Akzeptieren] [✗ Ablehnen] [🗑 Löschen]  │
└─────────────────────────────────────────┘
```

**State (lokal in `RedactionTable.tsx`):**
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
```

**Interaktion:**
- Checkbox Klick → `selectedIds.add/delete(id)`
- `Shift+Klick` → Bereich auswählen (von zuletzt geklickter bis aktueller Position)
- „Alle auswählen"-Checkbox im Header → alle sichtbaren Einträge
- Beim Filteränderung → `selectedIds.clear()`

**Aktionsleiste:**
- `Akzeptieren`: dispatcht `ACCEPT_SELECTION` mit `[...selectedIds]`, leert `selectedIds`
- `Ablehnen`: dispatcht `REJECT_SELECTION`
- `Löschen`: dispatcht `REMOVE_SELECTION` (nur manuelle Einträge, Vorschläge werden nur abgelehnt)

### Akzeptanzkriterien

- [ ] „Alle IBAN akzeptieren" akzeptiert nur IBAN-Vorschläge, lässt andere unberührt
- [ ] Checkboxen erscheinen nicht bei leerem Dokument
- [ ] Aktionsleiste verschwindet wenn `selectedIds.size === 0`
- [ ] Shift+Klick wählt korrekten Bereich aus
- [ ] Undo nach Bulk-Aktion stellt alle betroffenen Einträge wieder her

---

## Phase 2A — Gruppenzuweisung über Markierung

### Ziel
Der User kann einen Bereich im PDF-Viewer aufziehen und alle darin enthaltenen Schwärzungen auf einmal einer Gruppe zuweisen. Primärer Anwendungsfall: Empfängeradresse eines Briefes mit einem Zug der Gruppe „Empfänger" zuordnen.

### Konzept

Neuer Zeichenmodus im `PdfViewer`: `drawMode: 'redaction' | 'groupselect'`

| Modus | Aufziehen bewirkt |
|-------|------------------|
| `redaction` (Standard) | Neue manuelle Schwärzung erstellen |
| `groupselect` | Alle überlappenden Schwärzungen auswählen → Gruppen-Popup |

### UX-Flow

1. User klickt „Gruppe zuweisen"-Button in der Toolbar (Toggle)
2. Cursor ändert sich zu einem Fadenkreuz mit Gruppenicon
3. User zieht Rechteck über Adressfeld
4. Beim Loslassen: alle Schwärzungen die das Rechteck überlappen werden markiert (visuelle Hervorhebung)
5. `GroupAssignPopup` erscheint nahe dem gezeichneten Rechteck:
   ```
   ┌────────────────────────────┐
   │  Gruppe zuweisen           │
   │  3 Schwärzungen ausgewählt │
   │                            │
   │  Gruppe: [  2  ▼]          │
   │  oder [+ Neue Gruppe]      │
   │                            │
   │  [Abbrechen]  [Zuweisen]   │
   └────────────────────────────┘
   ```
6. User wählt Gruppe → dispatcht `ASSIGN_GROUP_TO_IDS`
7. Toolbar-Button wechselt zurück zu normalem Modus

### Neue Action

**`src/renderer/store/types-and-reducer.ts`:**
```typescript
| { type: 'ASSIGN_GROUP_TO_IDS'; ids: string[]; groupNumber: number }
```

Reducer:
```typescript
case 'ASSIGN_GROUP_TO_IDS':
  return {
    ...state,
    redactions: state.redactions.map(r =>
      action.ids.includes(r.id) ? { ...r, groupNumber: action.groupNumber } : r
    ),
  };
```

### Überlappungserkennung

```typescript
function overlaps(rect: BoundingBox, redaction: BoundingBox): boolean {
  return !(
    rect.x + rect.width < redaction.x ||
    redaction.x + redaction.width < rect.x ||
    rect.y + rect.height < redaction.y ||
    redaction.y + redaction.height < rect.y
  );
}
```

Koordinaten: das gezogene Rechteck muss vor dem Vergleich vom Canvas-Koordinatensystem in PDF-Punkte umgerechnet werden (gleiche Logik wie bei der manuellen Schwärzungserstellung).

### Neue Komponente: GroupAssignPopup.tsx

**Props:**
```typescript
interface GroupAssignPopupProps {
  position: { x: number; y: number };   // Bildschirmkoordinaten
  affectedIds: string[];
  existingGroups: number[];
  onAssign: (groupNumber: number) => void;
  onCancel: () => void;
}
```

**Verhalten:**
- Dropdown zeigt alle in `redactions` vorhandenen `groupNumber`-Werte (dedupliziert, sortiert)
- „+ Neue Gruppe": `Math.max(...existingGroups) + 1` vorschlagen
- Popup bleibt innerhalb des Viewport (Positionskorrektur wenn zu nah am Rand)

### PdfViewer-Änderungen

- Neues Prop `drawMode` von `Toolbar` via State übergeben oder direkt aus dem Store lesen
- Visuelles Rechteck während Aufziehen: gestrichelt, blaue Farbe (statt durchgezogener Linie für Schwärzungen)
- Nach Aufziehen: betroffene Overlays kurz mit einem blauen Rahmen hervorheben (500ms)

### Toolbar-Änderungen

```tsx
<Tooltip content="Gruppe über Markierung zuweisen">
  <button
    className={`btn btn-ghost btn-sm ${drawMode === 'groupselect' ? 'active' : ''}`}
    onClick={() => setDrawMode(m => m === 'groupselect' ? 'redaction' : 'groupselect')}
    disabled={!state.fileData}
  >
    ⊡ <span className="hide-mobile">Gruppe</span>
  </button>
</Tooltip>
```

`drawMode` als lokaler State in `EditorLayout` oder `Toolbar`, der als Prop an `PdfViewer` übergeben wird.

### Undo-Integration

`ASSIGN_GROUP_TO_IDS` muss in den Undo-Stack. Vorher die alten `groupNumber`-Werte sichern:
```typescript
const previousGroups = ids.map(id => ({
  id,
  groupNumber: state.redactions.find(r => r.id === id)?.groupNumber ?? 0,
}));
// Undo: Wiederherstellen der previousGroups
// Redo: Erneutes Anwenden von action.groupNumber
```

### Akzeptanzkriterien

- [ ] Rechteck über 3 Schwärzungen → Popup zeigt „3 Schwärzungen ausgewählt"
- [ ] Gruppenzuweisung wird korrekt auf alle 3 angewendet
- [ ] Undo hebt die Zuweisung vollständig auf
- [ ] Leeres Rechteck (keine Schwärzung getroffen) → kein Popup, keine Aktion
- [ ] Modus-Toggle in Toolbar schaltet visuellen Cursor korrekt um

---

## Phase 2B — Export-Vorschau

### Ziel
Vor dem finalen Export kann der User eine gerenderte Vorschau der aktuellen Seite sehen — mit allen aktiven Schwärzungen eingeblendet. Verhindert Überraschungen beim Export.

### UX-Flow

1. User klickt „Vorschau"-Button (neben „Exportieren" in der Toolbar)
2. Modal öffnet sich → lädt Canvas-Rendering der aktuellen Seite
3. Qualitäts- und Modusauswahl sind im Modal wiederholbar
4. Buttons: „Abbrechen" / „So exportieren"
5. Klick auf „So exportieren" → schließt Modal, startet normalen Export-Flow

### Modal-Aufbau

```
┌────────────────────────────────────────────────────────────┐
│  Vorschau: Seite 2 von 8               [Seite ← →]  [✕]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│              [Canvas — gerendertes PDF mit Schwärzungen]   │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  Qualität:  ○ Hoch (300 DPI)  ○ Komprimiert (150 DPI)      │
│  Modus:     ○ Schwärzen  ○ Pseudonymisieren                │
│                                                            │
│                          [Abbrechen]  [So exportieren →]   │
└────────────────────────────────────────────────────────────┘
```

### Neue Komponente: ExportPreviewModal.tsx

**Props:**
```typescript
interface ExportPreviewModalProps {
  fileData: Uint8Array;
  pageCount: number;
  initialPage: number;
  redactions: RedactionEntry[];
  initialMode: RedactionMode;
  initialQuality: ExportQuality;
  onExport: (mode: RedactionMode, quality: ExportQuality) => void;
  onClose: () => void;
}
```

**Interner State:**
```typescript
const [previewPage, setPreviewPage] = useState(props.initialPage);
const [previewMode, setPreviewMode] = useState(props.initialMode);
const [previewQuality, setPreviewQuality] = useState(props.initialQuality);
const [isRendering, setIsRendering] = useState(false);
```

### Rendering-Extraktion aus Toolbar.tsx

Die Page-Render-Logik wird aus `handleExport` in eine wiederverwendbare Funktion extrahiert:

**Neue Datei: `src/renderer/services/pdf-renderer.ts`**
```typescript
export async function renderPageWithRedactions(
  fileData: Uint8Array,
  pageNumber: number,
  redactions: RedactionEntry[],
  mode: RedactionMode,
  dpi: number
): Promise<string> { // returns data URL
  // ... identische Canvas-Render-Logik aus Toolbar.tsx handleExport
  // gibt canvas.toDataURL() zurück
}
```

`Toolbar.tsx` und `ExportPreviewModal.tsx` nutzen diese Funktion.

### Performance

- Rendering bei jedem Seitenwechsel im Modal neu ausführen (`useEffect` auf `previewPage` + `previewMode` + `previewQuality`)
- Canvas in einem `<img>`-Tag anzeigen (data URL) — kein zusätzlicher Canvas-Overhead im Modal
- Spinner während Rendering

### Toolbar-Änderungen

```tsx
<Tooltip content="Vorschau vor dem Export">
  <button
    className="btn btn-ghost btn-sm"
    onClick={() => setShowPreview(true)}
    disabled={activeRedactions.length === 0}
    id="btn-preview"
  >
    👁 <span className="hide-mobile">Vorschau</span>
  </button>
</Tooltip>
```

Lokaler State in `Toolbar`:
```typescript
const [showPreview, setShowPreview] = useState(false);
```

### Akzeptanzkriterien

- [ ] Vorschau öffnet sich für die aktuell angezeigte Seite
- [ ] Schwärzungen / Pseudonymisierungs-Labels korrekt eingeblendet
- [ ] Seitenwechsel innerhalb des Modals funktioniert
- [ ] Qualitätsumschaltung aktualisiert das Rendering sichtbar
- [ ] „So exportieren" startet den Export mit den im Modal gewählten Einstellungen
- [ ] Modal schließbar via `Escape` und ✕-Button

---

## Phase 3 — Batch-Verarbeitung / Multi-Tab

### Ziel
Mehrere PDF-Dokumente gleichzeitig geöffnet haben, in Tabs navigieren, und eine gemeinsame Variablen-Zuweisung verwenden, sodass dieselbe Person über alle Dokumente hinweg konsistent pseudonymisiert wird.

### State-Refactor

Dies ist ein Breaking Change im App-State. Alle Komponenten, die direkt auf `state.filePath`, `state.fileData`, etc. zugreifen, müssen auf das aktive Dokument umgestellt werden.

#### Neuer DocumentState

**`src/renderer/store/types-and-reducer.ts`** — vollständig ersetzen:

```typescript
export interface DocumentState {
  id: string;
  filePath: string;
  fileName: string;
  fileData: Uint8Array;
  pageCount: number;
  currentPage: number;
  redactions: RedactionEntry[];
  hasAnalyzed: boolean;
  analysisTypes: string[];
  isAnalyzing: boolean;
  analysisProgress: string;
  manualCounter: number;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
}

// Key: `${originalContent}|${category}` → variableName
export type VariableRegistry = Record<string, string>;
// Key: `${originalContent}|${category}` → groupNumber  
export type GroupRegistry = Record<string, number>;

export interface AppState {
  // Dokumente
  documents: DocumentState[];
  activeDocumentId: string | null;

  // Geteilte Registries (dokumentübergreifend)
  variableRegistry: VariableRegistry;
  groupRegistry: GroupRegistry;

  // Globale UI
  mode: RedactionMode;
  exportQuality: ExportQuality;
  zoom: number;
  selectedRedactionId: string | null;
  hoveredRedactionId: string | null;
  isExporting: boolean;
  exportProgress: string;
  view: 'start' | 'editor' | 'audit' | 'settings';
  error: string | null;
}
```

#### Helper: aktives Dokument

```typescript
// In app-store.tsx
export function useActiveDocument(): DocumentState | null {
  const { state } = useAppState();
  return state.documents.find(d => d.id === state.activeDocumentId) ?? null;
}
```

Alle Komponenten ersetzen `state.filePath` → `activeDoc?.filePath`, etc.

### Neue Actions

```typescript
| { type: 'ADD_DOCUMENT'; doc: DocumentState }
| { type: 'REMOVE_DOCUMENT'; id: string }
| { type: 'SET_ACTIVE_DOCUMENT'; id: string }
| { type: 'UPDATE_DOCUMENT'; docId: string; updates: Partial<DocumentState> }
| { type: 'SET_DOCUMENT_PAGE'; docId: string; page: number }
| { type: 'SET_DOCUMENT_REDACTIONS'; docId: string; redactions: RedactionEntry[] }
| { type: 'ACCEPT_ALL_DOCUMENTS' }
| { type: 'REJECT_ALL_DOCUMENTS' }
| { type: 'UPDATE_VARIABLE_REGISTRY'; key: string; variableName: string }
| { type: 'UPDATE_GROUP_REGISTRY'; key: string; groupNumber: number }
```

### Variable-Konsistenz

**Beim Analysieren (Toolbar.tsx):**
```typescript
// Nach PII-Erkennung, vor dispatch SET_DOCUMENT_REDACTIONS:
const enrichedSuggestions = suggestions.map(s => {
  const key = `${s.originalContent}|${s.category}`;
  const existingName = state.variableRegistry[key];
  return existingName ? { ...s, variableName: existingName } : s;
});
// Neue Einträge in Registry registrieren:
enrichedSuggestions.forEach(s => {
  const key = `${s.originalContent}|${s.category}`;
  if (!state.variableRegistry[key]) {
    dispatch({ type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: s.variableName });
  }
});
```

**Bei Variablenumbenennung (app-store.tsx `updateRedactionVariable`):**
```typescript
// 1. variableRegistry updaten
dispatch({ type: 'UPDATE_VARIABLE_REGISTRY', key, variableName: newName });
// 2. In ALLEN Dokumenten synchronisieren
state.documents.forEach(doc => {
  const updated = doc.redactions.map(r =>
    `${r.originalContent}|${r.category}` === key ? { ...r, variableName: newName } : r
  );
  dispatch({ type: 'SET_DOCUMENT_REDACTIONS', docId: doc.id, redactions: updated });
});
```

### Tab-UI

**Neue Datei: `src/renderer/components/TabBar.tsx`**

```
┌──────────────────────────────────────────────────────────┐
│  [📄 Mietvertrag.pdf ×]  [📄 Zeugnis.pdf ×]  [+ Öffnen] │
└──────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface TabBarProps {
  documents: DocumentState[];
  activeDocumentId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpenFile: () => void;
}
```

**Verhalten:**
- Aktiver Tab: hellerer Hintergrund, kein `×`-Hover nötig
- Tab schließen: wenn geschlossener Tab aktiv → nächsten Tab aktivieren (oder vorherigen)
- Letzter Tab geschlossen → `view: 'start'`
- Scrollbar wenn > 5 Tabs (`overflow-x: auto`)

**`EditorLayout.tsx`:** `TabBar` zwischen Toolbar und dem eigentlichen Editor-Bereich einbinden.

### Mehrere Dateien öffnen

**`src/main/main.ts`** — `OPEN_FILE_DIALOG` Handler:
```typescript
const result = await dialog.showOpenDialog({
  filters: [{ name: 'PDF', extensions: ['pdf'] }],
  properties: ['openFile', 'multiSelections'],   // ← multiSelections neu
  defaultPath: settings.lastOpenDirectory,
});
return result.filePaths;  // string[] statt string | undefined
```

**`src/main/preload.ts`:**
```typescript
openFileDialog: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FILE_DIALOG) as Promise<string[]>,
```

**`src/renderer/services/file-handler.ts`** (oder StartPage / Toolbar):
- Loop über alle zurückgegebenen Pfade
- Für jeden Pfad: `ADD_DOCUMENT` dispatchen, ersten Tab aktivieren

### Bulk-Aktionen über alle Dokumente

In `RedactionTable.tsx` — neue Sektion wenn `documents.length > 1`:

```
┌─────────────────────────────────────────────┐
│  Alle Dokumente:  [✓ Alle akzeptieren]  [✗ Alle ablehnen]  │
└─────────────────────────────────────────────┘
```

Dispatcht `ACCEPT_ALL_DOCUMENTS` / `REJECT_ALL_DOCUMENTS`.

### CSV-Export-Erweiterung

**`src/common/types.ts`:**
```typescript
export interface CSVRow {
  bezeichnung: string;
  inhalt: string;
  typ: string;
  gruppe: string;
  status: string;
  seite: string;
  dokument?: string;  // ← neu
}
```

**`src/main/services/pdf-export-service.ts`** — neue Methode:
```typescript
generateCombinedCSV(exports: { fileName: string; rows: CSVRow[] }[]): string
```

Format der kombinierten Zuweisungstabelle:
```
Bezeichnung;Inhalt;Typ;Gruppe;Status;Seite;Dokument
Name_1;Max Mustermann;Name;1;akzeptiert;1;Mietvertrag.pdf, Zeugnis.pdf
IBAN_2;DE89 3704 0044...;IBAN;2;akzeptiert;3;Mietvertrag.pdf
```

Zeile „Max Mustermann" erscheint einmal — die Dokument-Spalte listet alle Dokumente kommasepariert.

### Export-Dialog (Mehrere Dokumente)

In `Toolbar.tsx` wenn `state.documents.length > 1`:

```
┌──────────────────────────────┐
│  Was soll exportiert werden? │
│                              │
│  ○ Nur dieses Dokument       │
│  ● Alle Dokumente (3)        │
│                              │
│  [Abbrechen]  [Exportieren]  │
└──────────────────────────────┘
```

Bei „Alle Dokumente": Ordnerauswahl statt Dateipfad. Jedes Dokument wird als `{originalName}_geschwärzt.pdf` gespeichert. Eine gemeinsame `_zuordnung_gesamt.csv` mit `dokument`-Spalte.

### Neuer IPC-Channel

**`src/common/types.ts`:**
```typescript
EXPORT_ALL_PDFS: 'pdf:exportAll',
```

Payload:
```typescript
interface ExportAllPayload {
  exports: {
    sourceFilePath: string;
    redactions: RedactionEntry[];
    pdfData: Uint8Array;
    outputPath: string;
  }[];
  csvPath: string;
  mode: RedactionMode;
  quality: ExportQuality;
}
```

### Akzeptanzkriterien

- [ ] 3 PDFs öffnen → 3 Tabs, Tab-Wechsel funktioniert
- [ ] Tab schließen → korrekter nächster Tab wird aktiv
- [ ] Gleiche Person in Doc 1 + 3 → identischer `variableName`
- [ ] Variablenumbenennung in Doc 1 aktualisiert Doc 3 automatisch
- [ ] „Alle Dokumente exportieren" erstellt 3 PDFs + 1 kombinierte CSV
- [ ] `dokument`-Spalte in CSV zeigt korrekte Dokumentzuordnung
- [ ] Undo/Redo ist dokumentspezifisch (Undo in Tab 2 berührt Tab 1 nicht)

---

## Phase 4 — OCR für bildbasierte PDFs

### Ziel
Gescannte PDFs und Dokumente ohne eingebetteten Textlayer können aktuell nicht analysiert werden (stiller Fehlfall). Mit OCR werden diese Seiten erkannt und PII-Erkennung ermöglicht.

### Ansatz

**Tesseract.js** (v4/v5) — reines JavaScript, kein nativer Code, 100% offline.

- Läuft im **Renderer-Prozess** (wie pdf.js), kein Main-Process-Eingriff nötig
- Sprachdaten: `deu` (Standard) + `eng` (Fallback), lazy geladen
- `PageAnalysis.ocrUsed` und `TextItem.confidence` bereits im Typ vorhanden

### Installation

```bash
npm install tesseract.js
```

> Paketgröße: ~3 MB (JS) + ~4 MB `deu.traineddata` (Sprachdaten, einmalig geladen).

### Neue Datei: `src/renderer/services/ocr-service.ts`

```typescript
import Tesseract from 'tesseract.js';
import { TextItem } from '../../common/types';

export class OcrService {
  private worker: Tesseract.Worker | null = null;

  async initialize(languages: string[] = ['deu', 'eng']): Promise<void> {
    this.worker = await Tesseract.createWorker(languages.join('+'));
  }

  async recognizePage(canvas: HTMLCanvasElement, pageNumber: number): Promise<TextItem[]> {
    if (!this.worker) throw new Error('OCR-Worker nicht initialisiert');

    const { data } = await this.worker.recognize(canvas);

    return data.words.map(word => ({
      text: word.text,
      bounds: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
      },
      page: pageNumber,
      confidence: word.confidence / 100,  // Tesseract gibt 0–100, wir wollen 0–1
    }));
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
```

### Koordinaten-Mapping

Tesseract gibt Koordinaten in **Pixel** des übergebenen Canvas zurück. Das Canvas wird in `Toolbar.tsx` mit `scale * devicePixelRatio` gerendert. Damit die Koordinaten mit den PDF-Punkt-Koordinaten übereinstimmen:

```typescript
const pixelToPt = (px: number) => px / scale;
// Im recognizePage-Aufruf:
bounds: {
  x: pixelToPt(word.bbox.x0),
  y: pixelToPt(word.bbox.y0),
  width: pixelToPt(word.bbox.x1 - word.bbox.x0),
  height: pixelToPt(word.bbox.y1 - word.bbox.y0),
}
```

### Integration in Toolbar.tsx (Analyse-Flow)

```typescript
// Initialisierung einmalig vor der Page-Loop:
const ocrService = new OcrService();
let ocrInitialized = false;

for (let i = 1; i <= pdf.numPages; i++) {
  // ... bestehende Text-Extraktion ...

  if (!pageHasText) {
    // Seite auf Canvas rendern (für OCR)
    if (!ocrInitialized) {
      dispatch({ type: 'SET_ANALYSIS_PROGRESS', progress: 'OCR-Engine wird geladen…' });
      await ocrService.initialize(['deu', 'eng']);
      ocrInitialized = true;
    }

    dispatch({
      type: 'SET_ANALYSIS_PROGRESS',
      progress: `Seite ${i} von ${pdf.numPages} — OCR läuft…`,
    });

    const canvas = document.createElement('canvas');
    const viewport = page.getViewport({ scale: 2.0 }); // Höhere Auflösung für bessere OCR-Qualität
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;

    const ocrItems = await ocrService.recognizePage(canvas, i);
    allTextItems.push(...ocrItems.filter(t => (t.confidence ?? 0) > 0.5));
    usedOcr = true;
    canvas.remove();
  }
}

// Aufräumen
if (ocrInitialized) await ocrService.terminate();
```

### OCR-Hinweis im UI

Nach Analyse wenn `analysisTypes.includes('ocr')`:

**`src/renderer/components/Toolbar.tsx`** — unter dem Analyse-Button:
```tsx
{state.hasAnalyzed && state.analysisTypes.includes('ocr') && (
  <span className="ocr-hint" title="OCR-Ergebnisse können weniger präzise sein als eingebetteter Text">
    ⚠ OCR verwendet
  </span>
)}
```

In den `analysisTypes` wird `'ocr'` nur gesetzt wenn mind. 1 Seite per OCR analysiert wurde.

### Schwellenwert-Konfiguration

In `src/common/types.ts` (`AppSettings`):
```typescript
ocrConfidenceThreshold: number;  // Standard: 0.5
ocrLanguages: string[];          // Standard: ['deu', 'eng']
```

### Bekannte Einschränkungen

- Handschrift wird von Tesseract schlecht erkannt (kein Ziel dieser Version)
- Sehr kleine Schrift (<6pt) oder niedrige Scan-Qualität (<150 DPI) liefert unzuverlässige Ergebnisse
- OCR dauert ca. 2–5 Sekunden pro Seite — bei 20-seitigem Scan entsprechend Fortschrittsanzeige wichtig
- Sprachdaten (deu.traineddata ~4 MB) werden beim ersten OCR-Einsatz in den Browser-Cache geladen

### Akzeptanzkriterien

- [ ] Bild-PDF (keine Textschicht) öffnen → Analyse läuft → Vorschläge vorhanden
- [ ] OCR-Hinweis-Badge erscheint nach Analyse
- [ ] Confidence-Filter: Einträge unter Schwellenwert erscheinen nicht
- [ ] Normales PDF (mit Textlayer) löst keine OCR-Initialisierung aus (Performance)
- [ ] Nach Analyse: `analysisTypes` enthält `'ocr'` wenn OCR genutzt wurde

---

## Abhängigkeiten zwischen Features

```
Phase 1A ──→ Phase 4 (OCR-Kategorien werden korrekt erkannt)
Phase 1D ──→ Phase 3 (ACCEPT_ALL_DOCUMENTS erweitert Bulk-Aktionen)
Phase 2A ────┐
Phase 2B ────┤
             └──→ Phase 3 (beide nutzen extrahierte Render-Funktion aus pdf-renderer.ts)
Phase 3 ──→ Phase 4 (OCR-Fortschritt pro Dokument im Multi-Tab-State)
```

## Empfohlene Implementierungsreihenfolge

| Sprint | Features | Begründung |
|--------|----------|-----------|
| 1 | 1A + 1B + 1C | Unabhängig, schnell umsetzbar, sofortiger Nutzen |
| 2 | 1D | Aufbaut auf 1A (neue Kategorien im Filter) |
| 3 | 2A + 2B | Unabhängig von Phase 3, mittlere Komplexität |
| 4 | 3 | Größter Refactor, danach 1D um ACCEPT_ALL_DOCUMENTS erweitern |
| 5 | 4 | Neue Abhängigkeit: npm install tesseract.js |
