'use strict';

const { app, ipcMain, session, globalShortcut } = require('electron');

const { enableSystemAudioLoopback } = require('./loopback-audio');
const { WindowManager } = require('./window-manager');

const isDev = process.argv.includes('--dev');
const windows = new WindowManager({ isDev });

// A single instance keeps one loopback capture alive; a second launch just
// focuses the window that already exists.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (windows.window) {
      if (windows.window.isMinimized()) windows.window.restore();
      windows.window.focus();
    }
  });

  app.whenReady().then(() => {
    enableSystemAudioLoopback(session.defaultSession);
    windows.create();
    registerIpc();
    registerShortcuts();
  });
}

function registerIpc() {
  ipcMain.handle('window:minimize', () => windows.window?.minimize());
  ipcMain.handle('window:close', () => windows.window?.close());

  ipcMain.handle('window:toggle-fullscreen', () => {
    const win = windows.window;
    if (!win) return false;
    const next = !win.isFullScreen();
    win.setFullScreen(next);
    return next;
  });

  ipcMain.handle('window:toggle-mode', () => windows.toggleMode());

  // Leaves overlay and lands directly in fullscreen, so the user does not have
  // to stop at windowed mode on the way.
  ipcMain.handle('window:overlay-to-fullscreen', () => windows.toggleMode(true));

  ipcMain.handle('window:set-click-through', (_event, enabled) =>
    windows.setClickThrough(Boolean(enabled))
  );

  // The renderer asks for these on load so a rebuilt window comes back in the
  // same visual state the user left it in.
  ipcMain.handle('window:get-state', () => ({
    mode: windows.mode,
    ...windows.pendingView,
    fullscreen: windows.window?.isFullScreen() ?? false,
  }));

  ipcMain.handle('window:remember-view', (_event, view) => {
    windows.pendingView = view;
  });
}

function registerShortcuts() {
  // Works while the overlay is click-through and cannot be focused.
  globalShortcut.register('Alt+Shift+V', () => {
    const win = windows.window;
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
}

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
