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
  installLocation: (action) => ipcRenderer.invoke('instrumenta:install-location', action),
  revealInstallLocation: () => ipcRenderer.invoke('instrumenta:reveal-install-location'),
  launcherUpdate: (action) => ipcRenderer.invoke('instrumenta:launcher-update', action),
  uninstall: (tool) => ipcRenderer.invoke('instrumenta:uninstall', tool),
  rollback: (tool) => ipcRenderer.invoke('instrumenta:rollback', tool),
  reveal: (tool) => ipcRenderer.invoke('instrumenta:reveal', tool),
  openWorkspace: () => ipcRenderer.invoke('instrumenta:open-workspace'),
  openLink: (key) => ipcRenderer.invoke('instrumenta:open-link', key),
  storage: () => ipcRenderer.invoke('instrumenta:storage'),
  clean: (key) => ipcRenderer.invoke('instrumenta:clean', key),
  readiness: () => ipcRenderer.invoke('instrumenta:readiness'),
  // The External library (external-library.cjs): apps by other people, addressed by app ID.
  library: () => ipcRenderer.invoke('instrumenta:library'),
  libraryInstall: (ids) => ipcRenderer.invoke('instrumenta:library-install', ids),
  libraryOpen: (id) => ipcRenderer.invoke('instrumenta:library-open', id),
  libraryUninstall: (id) => ipcRenderer.invoke('instrumenta:library-uninstall', id),
  libraryRollback: (id) => ipcRenderer.invoke('instrumenta:library-rollback', id),
  libraryReveal: (target) => ipcRenderer.invoke('instrumenta:library-reveal', target),
  libraryRepository: (id) => ipcRenderer.invoke('instrumenta:library-repository', id),
  libraryPreference: (change) => ipcRenderer.invoke('instrumenta:library-preference', change),
  libraryLocation: (action) => ipcRenderer.invoke('instrumenta:library-location', action),
  librarySuggestion: (change) => ipcRenderer.invoke('instrumenta:library-suggestion', change),
  libraryIcon: (id) => ipcRenderer.invoke('instrumenta:library-icon', id),
  onLibrary: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('instrumenta:library', listener);
    return () => ipcRenderer.removeListener('instrumenta:library', listener);
  },
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('instrumenta:state', listener);
    return () => ipcRenderer.removeListener('instrumenta:state', listener);
  },
  // Download progress alone ({ queue, launcherUpdate }), between full states.
  onProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('instrumenta:progress', listener);
    return () => ipcRenderer.removeListener('instrumenta:progress', listener);
  },
});
