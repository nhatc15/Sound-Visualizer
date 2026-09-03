'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Narrow, explicit surface: the renderer never touches ipcRenderer directly.
contextBridge.exposeInMainWorld('appBridge', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  toggleMode: () => ipcRenderer.invoke('window:toggle-mode'),
  overlayToFullscreen: () => ipcRenderer.invoke('window:overlay-to-fullscreen'),
  setClickThrough: (enabled) => ipcRenderer.invoke('window:set-click-through', enabled),
  getState: () => ipcRenderer.invoke('window:get-state'),
  rememberView: (view) => ipcRenderer.invoke('window:remember-view', view),
});
