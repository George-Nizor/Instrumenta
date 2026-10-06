const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('instrumenta', {
  getState: () => ipcRenderer.invoke('instrumenta:get-state'),
  refresh: () => ipcRenderer.invoke('instrumenta:refresh'),
  chooseWorkspace: () => ipcRenderer.invoke('instrumenta:choose-workspace'),
  launch: (tool) => ipcRenderer.invoke('instrumenta:launch', tool),
  prepare: (tool) => ipcRenderer.invoke('instrumenta:prepare', tool),
  install: (tool) => ipcRenderer.invoke('instrumenta:install', tool),
  installMany: (tools) => ipcRenderer.invoke('instrumenta:install-many', tools),
  setPreferences: (change) => ipcRenderer.invoke('instrumenta:set-preferences', change),
  launcherUpdate: (action) => ipcRenderer.invoke('instrumenta:launcher-update', action),
  uninstall: (tool) => ipcRenderer.invoke('instrumenta:uninstall', tool),
  rollback: (tool) => ipcRenderer.invoke('instrumenta:rollback', tool),
  reveal: (tool) => ipcRenderer.invoke('instrumenta:reveal', tool),
  openWorkspace: () => ipcRenderer.invoke('instrumenta:open-workspace'),
  openLink: (key) => ipcRenderer.invoke('instrumenta:open-link', key),
  storage: () => ipcRenderer.invoke('instrumenta:storage'),
  clean: (key) => ipcRenderer.invoke('instrumenta:clean', key),
  readiness: () => ipcRenderer.invoke('instrumenta:readiness'),
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('instrumenta:state', listener);
    return () => ipcRenderer.removeListener('instrumenta:state', listener);
  },
});
