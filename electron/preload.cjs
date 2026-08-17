const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('instrumenta', {
  getState: () => ipcRenderer.invoke('instrumenta:get-state'),
  refresh: () => ipcRenderer.invoke('instrumenta:refresh'),
  chooseWorkspace: () => ipcRenderer.invoke('instrumenta:choose-workspace'),
  launch: (tool) => ipcRenderer.invoke('instrumenta:launch', tool),
  prepare: (tool) => ipcRenderer.invoke('instrumenta:prepare', tool),
  reveal: (tool) => ipcRenderer.invoke('instrumenta:reveal', tool),
  openWorkspace: () => ipcRenderer.invoke('instrumenta:open-workspace'),
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('instrumenta:state', listener);
    return () => ipcRenderer.removeListener('instrumenta:state', listener);
  },
});
