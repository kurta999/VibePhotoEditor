const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vibeDesktop', {
  chooseFolder: (outputOnly = false) => ipcRenderer.invoke('vibe:choose-folder', outputOnly),
  readImage: (id, imagePath) => ipcRenderer.invoke('vibe:read-image', id, imagePath),
  saveEdited: (id, imagePath, bytes, type) => ipcRenderer.invoke('vibe:save-edited', id, imagePath, bytes, type),
});
