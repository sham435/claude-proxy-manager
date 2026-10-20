const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Proxy management
  startProxy: () => ipcRenderer.invoke('start-proxy'),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  
  // Logs
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  
  // Configuration
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  exportConfig: (config) => ipcRenderer.invoke('export-config', config),
  
  // File system
  openConfigDir: () => ipcRenderer.invoke('open-config-dir'),
  
  // Dialogs
  showMessage: (options) => ipcRenderer.invoke('show-message', options),
  
  // Platform info
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron
});
