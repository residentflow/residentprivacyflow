# Mitwirkungs-Richtlinien für ResidentPrivacyFlow

Vielen Dank, dass Sie sich an der Weiterentwicklung von ResidentPrivacyFlow beteiligen möchten! Hier finden Sie Richtlinien, um den Prozess für alle Beteiligten reibungslos zu gestalten.

## Wie Sie beitragen können

### Fehlermeldungen (Issues)
- Überprüfen Sie, ob der Fehler bereits gemeldet wurde.
- Falls nicht, erstellen Sie ein neues Issue mit einer klaren Beschreibung, Schritten zur Reproduktion und Informationen zu Ihrer Umgebung (Windows-Version, Node.js-Version).

### Funktionsanfragen
- Nutzen Sie Issues, um neue Funktionen vorzuschlagen. Beschreiben Sie den Anwendungsfall und den Nutzen für andere Anwender.

### Pull Requests (PRs)
1. Forken Sie das Repository.
2. Erstellen Sie einen Feature-Branch (`git checkout -b feature/neue-funktion`).
3. Stellen Sie sicher, dass Ihr Code den Projektrichtlinien entspricht (Linting, Typsicherheit).
4. Committen Sie Ihre Änderungen (`git commit -m 'Hilfreiche Nachricht'`).
5. Pushen Sie den Branch (`git push origin feature/neue-funktion`).
6. Erfassen Sie einen Pull Request.

## Codestil & Best Practices

- **TypeScript**: Nutzen Sie strikte Typisierung, wo immer möglich. Vermeiden Sie den Typ `any`.
- **Komponenten**: Halten Sie React-Komponenten klein und fokussiert. Nutzen Sie funktionale Komponenten und Hooks.
- **Deutsch als Primär-Sprache**: Da sich die Anwendung primär an den deutschsprachigen Markt richtet (DSGVO-Konformität), sind die Benutzeroberfläche und die Dokumentation standardmäßig auf Deutsch.

## Entwicklungsumgebung

Befolgen Sie die Anweisungen in der [README.md](README.md) und der [DEVELOPMENT.md](DEVELOPMENT.md), um Ihre lokale Umgebung einzurichten.

## Lizenz
Durch Ihren Beitrag stimmen Sie zu, dass Ihr Code unter der [MIT-Lizenz](LICENSE) des Projekts veröffentlicht wird.
