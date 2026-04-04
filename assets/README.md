# Assets - Ressourcen & Branding

Dieses Verzeichnis enthält statische Ressourcen (Bilder, Icons), die für das Erscheinungsbild der ResidentPrivacyFlow-Anwendung und das Packaging erforderlich sind.

## Anwendungs-Icons

### Windows (`icon.ico`)
Für das Icon in der Taskleiste und auf dem Desktop wird eine `.ico`-Datei mit mehreren Größen benötigt. 

- **Erstellung**: Falls Sie eine PNG-Datei (`icon.png`) vorliegen haben, können Sie mit ImageMagick ein optimiertes Icon generieren:
  ```bash
  magick convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
  ```
- **Platzierung**: Die Datei `icon.ico` muss in diesem Verzeichnis liegen, damit `electron-builder` sie beim Build-Prozess (`npm run dist`) korrekt einbindet.

## Logos & Grafiken

- `logo.png`: Das primäre Markenzeichen von ResidentPrivacyFlow, das in der Benutzeroberfläche (z. B. auf der Startseite) verwendet wird. Wir empfehlen eine hohe Auflösung für beste Darstellung auf 4K-Displays.
- **Weitere**: Zusätzliche UI-Elemente wie Banner oder Illustrationen sollten ebenfalls hier abgelegt werden.

## Pfade im Code

Im **Main-Prozess** greifen wir mit `path.join(__dirname, '../../../assets/...')` auf diese Ressourcen zu. Im **Renderer-Prozess** (React) werden Ressourcen aus dem `public/`-Ordner oder durch Importe in Vite-Komponenten direkt eingebunden.

## Best Practices

- Nutzen Sie verlustfreie Kompression für PNG-Dateien, um die finale Anwendungsgröße gering zu halten.
- Achten Sie darauf, dass Icons auch in kleinen Größen (16x16, 32x32) gut erkennbar sind.
