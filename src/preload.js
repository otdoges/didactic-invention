const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to communicate with
// the main process via IPC.
contextBridge.exposeInMainWorld('browserAPI', {
  // Tab operations
  createTab: (url) => ipcRenderer.send('create-tab', url),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),
  navigateTo: (tabId, url) => ipcRenderer.send('navigate', { tabId, url }),
  getTabs: () => ipcRenderer.sendSync('get-tabs'),
  getCurrentUrl: () => ipcRenderer.sendSync('get-current-url'),
  
  // UI actions
  toggleSidebar: () => ipcRenderer.send('toggle-sidebar'),
  toggleHideUI: () => ipcRenderer.send('toggle-hide-ui'),
  toggleBookmarksBar: () => ipcRenderer.send('toggle-bookmarks-bar'),
  
  // Tab pins
  pinTab: (tabId) => ipcRenderer.invoke('pin-tab', tabId),
  unpinTab: (tabId) => ipcRenderer.invoke('unpin-tab', tabId),
  
  // History operations
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),
  
  // Bookmark operations
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (bookmark) => ipcRenderer.invoke('add-bookmark', bookmark),
  deleteBookmark: (id) => ipcRenderer.invoke('delete-bookmark', id),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (key, value) => ipcRenderer.invoke('update-setting', { key, value }),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  toggleTheme: () => ipcRenderer.invoke('toggle-theme'),
  
  // Downloads
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  pauseDownload: (id) => ipcRenderer.invoke('pause-download', id),
  resumeDownload: (id) => ipcRenderer.invoke('resume-download', id),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  openDownloadedFile: (path) => ipcRenderer.invoke('open-downloaded-file', path),
  
  // Event listeners
  onAdBlockStatsUpdated: (callback) => {
    ipcRenderer.on('adblock-stats-updated', (event, stats) => callback(stats));
  },
  onTabCreated: (callback) => {
    ipcRenderer.on('tab-created', (event, tab) => callback(tab));
  },
  onTabClosed: (callback) => {
    ipcRenderer.on('tab-closed', (event, tabId) => callback(tabId));
  },
  onTabUpdated: (callback) => {
    ipcRenderer.on('tab-updated', (event, tab) => callback(tab));
  },
  onTabActivated: (callback) => {
    ipcRenderer.on('tab-activated', (event, tabId) => callback(tabId));
  },
  onSidebarToggled: (callback) => {
    ipcRenderer.on('sidebar-toggled', (event, data) => callback(data));
  },
  onBookmarksBarToggled: (callback) => {
    ipcRenderer.on('bookmarks-bar-toggled', (event, data) => callback(data));
  },
  onUIVisibilityChanged: (callback) => {
    ipcRenderer.on('ui-visibility-changed', (event, data) => callback(data));
  },
  onShowNotification: (callback) => ipcRenderer.on('show-notification', callback),
  onDownloadStarted: (callback) => ipcRenderer.on('download-started', (event, item) => callback(item)),
  onDownloadUpdated: (callback) => ipcRenderer.on('download-updated', (event, item) => callback(item)),
  onDownloadCompleted: (callback) => ipcRenderer.on('download-completed', (event, item) => callback(item)),
  
  // Remove event listeners
  removeAllListeners: (channel) => {
    if (channel) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
