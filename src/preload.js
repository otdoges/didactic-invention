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
  
  // Event listeners
  onTabCreated: (callback) => ipcRenderer.on('tab-created', callback),
  onTabClosed: (callback) => ipcRenderer.on('tab-closed', callback),
  onTabActivated: (callback) => ipcRenderer.on('tab-activated', callback),
  onTabUpdated: (callback) => ipcRenderer.on('tab-updated', callback),
  onSidebarToggled: (callback) => ipcRenderer.on('sidebar-toggled', callback),
  onBookmarksBarToggled: (callback) => ipcRenderer.on('bookmarks-bar-toggled', callback),
  onUIVisibilityChanged: (callback) => ipcRenderer.on('ui-visibility-changed', callback),
  onShowNotification: (callback) => ipcRenderer.on('show-notification', callback),
  
  // Remove event listeners
  removeAllListeners: (channel) => {
    if (channel) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});
