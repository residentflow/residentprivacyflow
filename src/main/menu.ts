import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
import { IPC_CHANNELS } from '../common/types';

export function createMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'Über ' + app.name },
              { type: 'separator' },
              { role: 'services', label: 'Dienste' },
              { type: 'separator' },
              { role: 'hide', label: app.name + ' ausblenden' },
              { role: 'hideOthers', label: 'Andere ausblenden' },
              { role: 'unhide', label: 'Alle anzeigen' },
              { type: 'separator' },
              { role: 'quit', label: app.name + ' beenden' },
            ] as MenuItemConstructorOptions[],
          },
        ]
      : []),
    // Datei
    {
      label: 'Datei',
      submenu: [
        {
          label: 'PDF öffnen...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send(IPC_CHANNELS.MENU_OPEN_FILE);
          },
        },
        { type: 'separator' },
        {
          label: 'Einstellungen',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send(IPC_CHANNELS.MENU_GO_TO_SETTINGS);
          },
        },
        {
          label: 'Verarbeitungsprotokoll',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send(IPC_CHANNELS.MENU_GO_TO_AUDIT);
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Fenster schließen' } : { role: 'quit', label: 'Beenden' },
      ] as MenuItemConstructorOptions[],
    },
    // Bearbeiten
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Rückgängig' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einfügen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ] as MenuItemConstructorOptions[],
    },
    // Ansicht
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'forceReload', label: 'Neu laden erzwingen' },
        { role: 'toggleDevTools', label: 'Entwicklertools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom zurücksetzen' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbildmodus' },
      ] as MenuItemConstructorOptions[],
    },
    // Fenster
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize', label: 'Minimieren' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front', label: 'Alle nach vorne bringen' },
              { type: 'separator' },
              { role: 'window', label: 'Fenster' },
            ]
          : [{ role: 'close', label: 'Schließen' }]),
      ] as MenuItemConstructorOptions[],
    },
    // Hilfe
    {
      label: 'Hilfe',
      role: 'help',
      submenu: [
        {
          label: 'Mehr erfahren',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://community.residentprivacyflow.de');
          },
        },
      ] as MenuItemConstructorOptions[],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
