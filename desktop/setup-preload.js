const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('setupBridge', {
  done: () => ipcRenderer.send('setup-done'),
});