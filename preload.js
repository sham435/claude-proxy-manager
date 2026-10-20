const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Proxy management
  startProxy: () => ipcRenderer.invoke('start-proxy'),
  stopProxy: () => ipcRenderer.invoke('stop-proxy'),
  getProxyStatus: () => ipcRenderer.invoke('get-proxy-status'),

  // Models — dynamic from config
  getModels: () => ipcRenderer.invoke('get-models'),

  // Logs
  getLogs: (lines) => ipcRenderer.invoke('get-logs', lines),
  openLogFile: () => ipcRenderer.invoke('open-log-file'),

  // Environment info
  getEnvInfo: () => ipcRenderer.invoke('get-env-info'),

  // Configuration
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),
  exportConfig: (config) => ipcRenderer.invoke('export-config', config),

  // File system
  openConfigDir: () => ipcRenderer.invoke('open-config-dir'),

  // Dialogs
  showMessage: (options) => ipcRenderer.invoke('show-message', options),

  // Event listeners (push from main process)
  onProxyStatusChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('proxy-status-changed', handler);
    return () => ipcRenderer.removeListener('proxy-status-changed', handler);
  },

  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },

  // Platform info
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
});
