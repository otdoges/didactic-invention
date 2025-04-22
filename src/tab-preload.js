const { contextBridge, ipcRenderer } = require('electron');

// Expose API to webpages to communicate with main process
contextBridge.exposeInMainWorld('tabAPI', {
  // No need to expose much, as this is for content inside the tabs
  // We only want minimal access from webpage content to our browser
  getBrowserInfo: () => {
    return {
      name: 'Electron Browser',
      version: '1.0.0'
    };
  }
});

// Setup the adblocker preload
try {
  require('@cliqz/adblocker-electron-preload');
} catch (error) {
  console.error('Failed to load adblocker preload:', error);
}
