const { app, BrowserWindow, BrowserView, ipcMain, clipboard, globalShortcut, Menu, session, shell } = require('electron');
const path = require('node:path');
const electronLocalshortcut = require('electron-localshortcut');
const Store = require('electron-store');
// We'll use a simplified adblock implementation instead of @cliqz/adblocker-electron


const fs = require('fs-extra');
const url = require('url');
const axios = require('axios');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Initialize stores for settings, history, and bookmarks
const store = new Store({
  name: 'settings',
  defaults: {
    hideUI: false,
    defaultURL: 'homepage',  // Changed to use our custom homepage
    enableAdBlocker: true,
    showDevTools: true,
    enableExtensions: true,
    showVerticalTabs: true,
    windowBounds: { width: 1200, height: 800 },
    sidebarVisible: true,
    showBookmarksBar: false,
    theme: 'dark',
    searchEngine: 'google',
    lastVisit: null,
    pinnedTabs: [],
    restoreSession: true,
    tabSize: 'medium',
    httpsOnly: false,
    blockThirdPartyCookies: true,
    doNotTrack: false
  }
});

// History store
const historyStore = new Store({
  name: 'history',
  defaults: {
    visits: []
  }
});

// Stats store
const statsStore = new Store({
  name: 'stats',
  defaults: {
    adsBlocked: 0,
    trackersBlocked: 0,
    dataSaved: 0,
    lastReset: Date.now()
  }
});

// Bookmarks store
const bookmarksStore = new Store({
  name: 'bookmarks',
  defaults: {
    bookmarks: [
      { id: 'github', title: 'GitHub', url: 'https://github.com', icon: null },
      { id: 'youtube', title: 'YouTube', url: 'https://youtube.com', icon: null },
      { id: 'twitter', title: 'Twitter', url: 'https://twitter.com', icon: null },
      { id: 'reddit', title: 'Reddit', url: 'https://reddit.com', icon: null }
    ],
    folders: [
      { id: 'root', title: 'Bookmarks Bar', items: ['github', 'youtube', 'twitter', 'reddit'] }
    ]
  }
});

// Global variables
let mainWindow;
let tabManager;
let extensions; // uBlock Origin and other extensions will be loaded here.
let adBlocker; // Ad blocker instance
let adBlockStats = { adsBlocked: 0, trackersBlocked: 0 };
let activeDownloads = [];
let downloadsStore = new Store({
  name: 'downloads',
  defaults: {
    items: [],
    downloadPath: app.getPath('downloads')
  }
});

// Tab management class
class TabManager {
  constructor(window) {
    this.mainWindow = window;
    this.tabs = [];
    this.activeTabIndex = -1;
    this.sidebarVisible = store.get('sidebarVisible');
    this.showBookmarksBar = store.get('showBookmarksBar');
    
    // Setup IPC handlers for tab operations
    this.setupIPCHandlers();
    
    // Load pinned tabs if any
    this.pinnedTabs = store.get('pinnedTabs') || [];
  }

  setupIPCHandlers() {
    ipcMain.on('create-tab', (event, url) => {
      this.createTab(url || store.get('defaultURL'));
    });

    ipcMain.on('close-tab', (event, tabId) => {
      this.closeTab(tabId);
    });

    ipcMain.on('switch-tab', (event, tabId) => {
      this.activateTab(tabId);
    });

    ipcMain.on('navigate', (event, { tabId, url }) => {
      this.navigateTo(tabId, url);
    });

    ipcMain.on('toggle-sidebar', () => {
      this.toggleSidebar();
    });

    ipcMain.on('toggle-hide-ui', () => {
      this.toggleHideUI();
    });
    
    ipcMain.on('toggle-bookmarks-bar', () => {
      this.toggleBookmarksBar();
    });

    ipcMain.on('get-current-url', (event) => {
      if (this.activeTabIndex >= 0 && this.tabs[this.activeTabIndex]) {
        event.returnValue = this.tabs[this.activeTabIndex].view.webContents.getURL();
      } else {
        event.returnValue = '';
      }
    });

    ipcMain.on('get-tabs', (event) => {
      const tabsInfo = this.tabs.map((tab, index) => ({
        id: tab.id,
        title: tab.title || 'New Tab',
        url: tab.url,
        isActive: index === this.activeTabIndex,
        favicon: tab.favicon || null,
        isPinned: this.pinnedTabs.includes(tab.id)
      }));
      event.returnValue = tabsInfo;
    });
    
    // History handlers
    ipcMain.handle('get-history', async () => {
      return historyStore.get('visits');
    });
    
    ipcMain.handle('clear-history', async () => {
      historyStore.set('visits', []);
      return true;
    });
    
    ipcMain.handle('delete-history-item', async (event, id) => {
      const visits = historyStore.get('visits');
      const filteredVisits = visits.filter(visit => visit.id !== id);
      historyStore.set('visits', filteredVisits);
      return true;
    });
    
    // Bookmark handlers
    ipcMain.handle('get-bookmarks', async () => {
      return {
        bookmarks: bookmarksStore.get('bookmarks'),
        folders: bookmarksStore.get('folders')
      };
    });
    
    ipcMain.handle('add-bookmark', async (event, bookmark) => {
      const bookmarks = bookmarksStore.get('bookmarks');
      const folders = bookmarksStore.get('folders');
      
      // Add to bookmarks array
      bookmarks.push(bookmark);
      
      // Add to root folder by default
      const rootFolder = folders.find(f => f.id === 'root');
      if (rootFolder) {
        rootFolder.items.push(bookmark.id);
      }
      
      bookmarksStore.set('bookmarks', bookmarks);
      bookmarksStore.set('folders', folders);
      
      return true;
    });
    
    ipcMain.handle('delete-bookmark', async (event, bookmarkId) => {
      let bookmarks = bookmarksStore.get('bookmarks');
      let folders = bookmarksStore.get('folders');
      
      // Remove from bookmarks array
      bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      
      // Remove from all folders
      folders = folders.map(folder => {
        folder.items = folder.items.filter(id => id !== bookmarkId);
        return folder;
      });
      
      bookmarksStore.set('bookmarks', bookmarks);
      bookmarksStore.set('folders', folders);
      
      return true;
    });
    
    // Pin/unpin tab handlers
    ipcMain.handle('pin-tab', async (event, tabId) => {
      if (!this.pinnedTabs.includes(tabId)) {
        this.pinnedTabs.push(tabId);
        store.set('pinnedTabs', this.pinnedTabs);
      }
      return true;
    });
    
    ipcMain.handle('unpin-tab', async (event, tabId) => {
      this.pinnedTabs = this.pinnedTabs.filter(id => id !== tabId);
      store.set('pinnedTabs', this.pinnedTabs);
      return true;
    });
  }

  createTab(url) {
    const id = Date.now();
    
    // Create browser view for the tab
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'tab-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: true
      }
    });
    
    // Add to window but don't show yet
    this.mainWindow.addBrowserView(view);
    
    // Track tab data
    const newTab = {
      id,
      view,
      url,
      title: 'New Tab',
      favicon: null,
      isHomepage: url === 'homepage'
    };
    
    this.tabs.push(newTab);
    
    // Configure view
    this.updateViewBounds(view);
    
    // Set up event listeners for this tab
    view.webContents.on('page-title-updated', (event, title) => {
      newTab.title = title;
      this.mainWindow.webContents.send('tab-updated', { id, title });
    });
    
    view.webContents.on('page-favicon-updated', (event, favicons) => {
      if (favicons && favicons.length > 0) {
        newTab.favicon = favicons[0];
        this.mainWindow.webContents.send('tab-updated', { id, favicon: favicons[0] });
      }
    });

    view.webContents.on('did-navigate', (event, navigatedUrl) => {
      newTab.url = navigatedUrl;
      newTab.isHomepage = false; // No longer homepage after navigation
      this.mainWindow.webContents.send('tab-updated', { id, url: navigatedUrl });
      
      // Add to history
      this.addToHistory(navigatedUrl, newTab.title, newTab.favicon);
    });

    view.webContents.on('did-navigate-in-page', (event, navigatedUrl) => {
      newTab.url = navigatedUrl;
      this.mainWindow.webContents.send('tab-updated', { id, url: navigatedUrl });
    });
    
    // Handle external links
    view.webContents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: 'deny' };
    });
    
    // Load the URL - special handling for homepage
    if (url === 'homepage') {
      view.webContents.loadFile(path.join(__dirname, 'homepage.html'));
    } else {
      view.webContents.loadURL(url);
      // Only add to history for non-homepage loads
      this.addToHistory(url, 'New Tab');
    }
    
    // Set as active tab
    this.activateTab(id);
    
    // Notify renderer
    this.mainWindow.webContents.send('tab-created', { id });
    
    return id;
  }

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
    
    if (tabIndex === -1) return;
    
    // Remove the browser view
    const tab = this.tabs[tabIndex];
    this.mainWindow.removeBrowserView(tab.view);
    
    // Remove from our tabs array
    this.tabs.splice(tabIndex, 1);
    
    // Handle active tab after closing
    if (this.activeTabIndex === tabIndex) {
      // Was the active tab, need to activate another
      if (this.tabs.length === 0) {
        // No more tabs, create a new one
        this.activeTabIndex = -1;
        this.createTab(store.get('defaultURL'));
      } else {
        // Activate the next tab, or the last one if we closed the last tab
        this.activeTabIndex = Math.min(tabIndex, this.tabs.length - 1);
        this.showTab(this.activeTabIndex);
      }
    } else if (tabIndex < this.activeTabIndex) {
      // Closed tab was before the active one, adjust index
      this.activeTabIndex--;
    }
    
    // Notify renderer
    this.mainWindow.webContents.send('tab-closed', { id: tabId });
  }

  activateTab(tabId) {
    const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
    
    if (tabIndex === -1 || tabIndex === this.activeTabIndex) return;
    
    this.showTab(tabIndex);
  }

  showTab(tabIndex) {
    // Hide current active tab if any
    if (this.activeTabIndex !== -1 && this.tabs[this.activeTabIndex]) {
      this.mainWindow.removeBrowserView(this.tabs[this.activeTabIndex].view);
    }
    
    // Set and show new active tab
    this.activeTabIndex = tabIndex;
    const activeTab = this.tabs[tabIndex];
    
    this.mainWindow.addBrowserView(activeTab.view);
    this.updateViewBounds(activeTab.view);
    
    // Notify renderer
    this.mainWindow.webContents.send('tab-activated', { id: activeTab.id });
    
    // Focus the view
    activeTab.view.webContents.focus();
  }

  navigateTo(tabId, url) {
    const tabIndex = this.tabs.findIndex(tab => tab.id === tabId);
    
    if (tabIndex === -1) return;
    
    // Make sure URL has http/https protocol
    let navigateUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it's a valid domain-like string
      if (url.includes('.') && !url.includes(' ')) {
        navigateUrl = 'https://' + url;
      } else {
        // Treat as a search query
        navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    
    this.tabs[tabIndex].view.webContents.loadURL(navigateUrl);
  }

  updateViewBounds(view) {
    const [width, height] = this.mainWindow.getContentSize();
    const hideUI = store.get('hideUI', false);
    
    // Define sidebar width and heights for UI elements
    const sidebarWidth = this.sidebarVisible && !hideUI ? 80 : 0;
    const navbarHeight = !hideUI ? 60 : 0;
    const bookmarksBarHeight = this.showBookmarksBar && !hideUI ? 40 : 0;
    
    // Calculate y-position based on visible UI elements
    const yPosition = navbarHeight + bookmarksBarHeight;
    
    // Calculate content area (adjusting for sidebar and other UI elements if visible)
    view.setBounds({
      x: sidebarWidth,
      y: yPosition,
      width: width - sidebarWidth,
      height: height - yPosition
    });
  }

  updateAllViewBounds() {
    if (this.activeTabIndex !== -1 && this.tabs[this.activeTabIndex]) {
      this.updateViewBounds(this.tabs[this.activeTabIndex].view);
    }
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    store.set('sidebarVisible', this.sidebarVisible);
    
    // Update view bounds to account for sidebar toggle
    this.updateAllViewBounds();
    
    // Notify renderer to update UI
    this.mainWindow.webContents.send('sidebar-toggled', { visible: this.sidebarVisible });
  }
  
  toggleBookmarksBar() {
    this.showBookmarksBar = !this.showBookmarksBar;
    store.set('showBookmarksBar', this.showBookmarksBar);
    
    // Update view bounds to account for bookmarks bar toggle
    this.updateAllViewBounds();
    
    // Notify renderer to update UI
    this.mainWindow.webContents.send('bookmarks-bar-toggled', { visible: this.showBookmarksBar });
  }
  
  // Add to history
  addToHistory(url, title, favicon = null) {
    // Don't track local files or special URLs
    if (url.startsWith('file://') || url === 'about:blank') {
      return;
    }
    
    // Get current history
    const visits = historyStore.get('visits');
    
    // Create a new history entry
    const historyItem = {
      id: Date.now(),
      url,
      title: title || url,
      favicon,
      timestamp: new Date().toISOString()
    };
    
    // Add to the beginning of the array (most recent first)
    visits.unshift(historyItem);
    
    // Limit history size (keep last 1000 items)
    const limitedVisits = visits.slice(0, 1000);
    
    // Save updated history
    historyStore.set('visits', limitedVisits);
    
    // Update last visit time in settings
    store.set('lastVisit', new Date().toISOString());
  }

  toggleHideUI() {
    const hideUI = !store.get('hideUI');
    store.set('hideUI', hideUI);
    
    // Update view bounds
    this.updateAllViewBounds();
    
    // Notify renderer
    this.mainWindow.webContents.send('ui-visibility-changed', { hidden: hideUI });
  }

  getCurrentUrl() {
    if (this.activeTabIndex >= 0 && this.tabs[this.activeTabIndex]) {
      return this.tabs[this.activeTabIndex].view.webContents.getURL();
    }
    return '';
  }
}

// Setup download handling
function setupDownloadHandling() {
  // Set default download path
  const downloadPath = downloadsStore.get('downloadPath') || app.getPath('downloads');
  session.defaultSession.setDownloadPath(downloadPath);

  // Handle download events
  session.defaultSession.on('will-download', (event, item, webContents) => {
    // Get file info
    const fileName = item.getFilename();
    const fileSize = item.getTotalBytes();
    const startTime = Date.now();
    const savePath = path.join(downloadPath, fileName);
    
    // Generate unique download ID
    const downloadId = Date.now().toString();
    
    // Create download item object
    const downloadItem = {
      id: downloadId,
      filename: fileName,
      url: item.getURL(),
      path: savePath,
      size: fileSize,
      received: 0,
      progress: 0,
      status: 'progressing',
      speed: 0,
      startTime,
      mime: item.getMimeType() || 'application/octet-stream',
      etag: null
    };
    
    // Add to active downloads
    activeDownloads.push(downloadItem);
    
    // Notify renderer of download start
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-started', downloadItem);
    }
    
    // Update download progress
    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        downloadItem.status = 'interrupted';
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          downloadItem.status = 'paused';
        } else {
          downloadItem.status = 'progressing';
          downloadItem.received = item.getReceivedBytes();
          downloadItem.progress = downloadItem.size > 0 ? 
            Math.round((downloadItem.received / downloadItem.size) * 100) : 0;
            
          // Calculate download speed (bytes per second)
          const elapsed = (Date.now() - startTime) / 1000;
          downloadItem.speed = elapsed > 0 ? Math.round(downloadItem.received / elapsed) : 0;
        }
      }
      
      // Notify renderer of download update
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-updated', downloadItem);
      }
    });
    
    // Handle download completion
    item.once('done', (event, state) => {
      if (state === 'completed') {
        downloadItem.status = 'completed';
        downloadItem.progress = 100;
        downloadItem.received = downloadItem.size;
        
        // Add to download history
        const downloads = downloadsStore.get('items') || [];
        downloads.unshift({
          ...downloadItem,
          completedTime: Date.now(),
        });
        
        // Keep only the last 100 downloads
        downloadsStore.set('items', downloads.slice(0, 100));
        
        // Show notification
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-completed', downloadItem);
          mainWindow.webContents.send('show-notification', {
            title: 'Download Complete',
            body: `${fileName} has been downloaded.`
          });
        }
      } else {
        downloadItem.status = 'cancelled';
        
        // Notify renderer of download cancellation
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-updated', downloadItem);
        }
      }
      
      // Remove from active downloads
      activeDownloads = activeDownloads.filter(d => d.id !== downloadItem.id);
    });
  });
}

// Create the browser window
const createWindow = async () => {
  const { width, height } = store.get('windowBounds');
  const isDark = store.get('theme') === 'dark';
  
  // Set up homepage
  const homepageUrl = await createHomepage();
  if (store.get('defaultURL') === 'homepage') {
    store.set('defaultURL', homepageUrl);
  }
  
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    },
    autoHideMenuBar: true, // Hide menu by default
    backgroundColor: isDark ? '#212121' : '#ffffff',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Setup ad blocker if enabled
  if (store.get('enableAdBlocker')) {
    await loadUblockOriginExtension();
  }
  
  // Load stats from store
  adBlockStats.adsBlocked = statsStore.get('adsBlocked') || 0;
  adBlockStats.trackersBlocked = statsStore.get('trackersBlocked') || 0;
  
  // Extensions feature will be implemented in a future update
  console.log('Extensions support will be added in a future update');

  // Create directory for assets if it doesn't exist
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Initialize the tab manager
  tabManager = new TabManager(mainWindow);

  // Setup download handling
  setupDownloadHandling();

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open a new tab once UI is ready
  mainWindow.webContents.once('did-finish-load', () => {
    tabManager.createTab(store.get('defaultURL'));
  });

  // Register global shortcuts
  setupShortcuts();
  
  // Send adblock stats to the renderer
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('adblock-stats-updated', adBlockStats);
    }
  }, 5000); // Update every 5 seconds

  // Save window size on resize
  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Handle window close
  mainWindow.on('closed', () => {
    globalShortcut.unregisterAll();
    mainWindow = null;
  });
};

// Setup keyboard shortcuts
function setupShortcuts() {
  // PRIORITY: Copy current URL (Cmd+Shift+C or Ctrl+Shift+C)
  const copyUrlShortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+C' : 'Ctrl+Shift+C';
  electronLocalshortcut.register(mainWindow, copyUrlShortcut, () => {
    const currentUrl = tabManager.getCurrentUrl();
    if (currentUrl) {
      clipboard.writeText(currentUrl);
      mainWindow.webContents.send('show-notification', {
        message: 'URL copied to clipboard'
      });
    }
  });

  // Toggle sidebar (Alt+S)
  electronLocalshortcut.register(mainWindow, 'Alt+S', () => {
    tabManager.toggleSidebar();
  });

  // Hide UI (Alt+H)
  electronLocalshortcut.register(mainWindow, 'Alt+H', () => {
    tabManager.toggleHideUI();
  });

  // New tab (Ctrl+T)
  electronLocalshortcut.register(mainWindow, 'CommandOrControl+T', () => {
    tabManager.createTab(store.get('defaultURL'));
  });

  // Close tab (Ctrl+W)
  electronLocalshortcut.register(mainWindow, 'CommandOrControl+W', () => {
    if (tabManager.activeTabIndex >= 0 && tabManager.tabs[tabManager.activeTabIndex]) {
      tabManager.closeTab(tabManager.tabs[tabManager.activeTabIndex].id);
    }
  });
  
  // Open DevTools for active tab (F12 or Ctrl+Shift+I)
  electronLocalshortcut.register(mainWindow, ['F12', 'CommandOrControl+Shift+I'], () => {
    if (store.get('showDevTools') && tabManager.activeTabIndex >= 0 && tabManager.tabs[tabManager.activeTabIndex]) {
      tabManager.tabs[tabManager.activeTabIndex].view.webContents.openDevTools({ mode: 'detach' });
    }
  });
  
  // Reload active tab (F5 or Ctrl+R)
  electronLocalshortcut.register(mainWindow, ['F5', 'CommandOrControl+R'], () => {
    if (tabManager.activeTabIndex >= 0 && tabManager.tabs[tabManager.activeTabIndex]) {
      tabManager.tabs[tabManager.activeTabIndex].view.webContents.reload();
    }
  });
  
  // Hard reload active tab (Ctrl+Shift+R)
  electronLocalshortcut.register(mainWindow, 'CommandOrControl+Shift+R', () => {
    if (tabManager.activeTabIndex >= 0 && tabManager.tabs[tabManager.activeTabIndex]) {
      tabManager.tabs[tabManager.activeTabIndex].view.webContents.reloadIgnoringCache();
    }
  });
}

// Setup a simplified ad blocker
async function setupAdBlocker() {
  try {
    // Common ad and tracking domains to block
    const blockList = [
      'ads', 'ad.', 'analytics', 'tracker', 'pixel', 'banner', 'popup',
      'doubleclick.net', 'googlesyndication', 'googleadservices',
      'google-analytics', 'facebook.com/tr', 'facebook.net', 'moatads',
      'adnxs', 'adsrvr', 'serving-sys', 'taboola', 'outbrain'
    ];
    
    // Setup request monitoring to count and block ads and trackers
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const url = details.url.toLowerCase();
        let shouldBlock = false;
        
        for (const blockedTerm of blockList) {
          if (url.includes(blockedTerm)) {
            shouldBlock = true;
            adBlockStats.adsBlocked++;
            if (url.includes('track') || url.includes('analytics') || url.includes('beacon')) {
              adBlockStats.trackersBlocked++;
            }
            // Update stats in store
            statsStore.set('adsBlocked', statsStore.get('adsBlocked') + 1);
            break;
          }
        }
        
        callback({ cancel: shouldBlock });
      }
    );
    
    console.log('Simple ad blocker initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to set up ad blocker:', error);
    return null;
  }
}

// Setup extensions support - simplified for now since electron-extensions isn't installed
async function setupExtensions() {
  // Extensions will be implemented in a future update
  console.log('Extensions support will be implemented in a future update');
  return;
}

// Load our simplified ad blocker
async function loadUblockOriginExtension() {
  try {
    console.log('Setting up simplified ad blocker');
    return await setupAdBlocker();
  } catch (error) {
    console.error('Failed to load ad blocker:', error);
    return null;
  }
}

// Function to create a homepage
async function createHomepage() {
  const homepageDir = path.join(__dirname, 'homepage');
  const homepageFile = path.join(homepageDir, 'index.html');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(homepageDir)) {
    fs.mkdirSync(homepageDir, { recursive: true });
  }
  
  // Create homepage file if it doesn't exist
  if (!fs.existsSync(homepageFile)) {
    const darkMode = store.get('theme') === 'dark';
    const searchEngine = store.get('searchEngine');
    
    const homepage = `<!DOCTYPE html>
<html>
<head>
  <title>Zen Browser</title>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: ${darkMode ? '#212121' : '#f5f5f5'};
      color: ${darkMode ? '#ffffff' : '#212121'};
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    .container {
      width: 80%;
      max-width: 800px;
      text-align: center;
    }
    .logo {
      font-size: 3rem;
      font-weight: bold;
      margin-bottom: 2rem;
      color: ${darkMode ? '#ffffff' : '#333333'};
    }
    .search-box {
      width: 100%;
      padding: 1rem;
      font-size: 1.2rem;
      border: none;
      border-radius: 30px;
      background-color: ${darkMode ? '#333333' : '#ffffff'};
      color: ${darkMode ? '#ffffff' : '#333333'};
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      outline: none;
      transition: box-shadow 0.3s ease;
    }
    .search-box:focus {
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }
    .bookmarks {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 3rem;
    }
    .bookmark {
      background-color: ${darkMode ? '#333333' : '#ffffff'};
      border-radius: 10px;
      padding: 1rem;
      margin: 0.5rem;
      width: 100px;
      height: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: ${darkMode ? '#ffffff' : '#333333'};
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .bookmark:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    }
    .bookmark-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .theme-toggle {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      color: ${darkMode ? '#ffffff' : '#333333'};
      font-size: 1.5rem;
      cursor: pointer;
      outline: none;
    }
    .footer {
      margin-top: 3rem;
      color: ${darkMode ? '#aaaaaa' : '#777777'};
      font-size: 0.9rem;
    }
    @media (max-width: 600px) {
      .container {
        width: 90%;
      }
      .bookmarks {
        margin-top: 2rem;
      }
    }
  </style>
</head>
<body>
  <button class="theme-toggle" id="themeToggle">${darkMode ? '☀️' : '🌙'}</button>
  <div class="container">
    <div class="logo">Zen Browser</div>
    <form id="searchForm">
      <input type="text" class="search-box" id="searchBox" placeholder="Search the web..." autofocus>
    </form>
    <div class="bookmarks">
      <a href="https://github.com" class="bookmark">
        <div class="bookmark-icon">🐙</div>
        <div>GitHub</div>
      </a>
      <a href="https://youtube.com" class="bookmark">
        <div class="bookmark-icon">📺</div>
        <div>YouTube</div>
      </a>
      <a href="https://twitter.com" class="bookmark">
        <div class="bookmark-icon">🐦</div>
        <div>Twitter</div>
      </a>
      <a href="https://reddit.com" class="bookmark">
        <div class="bookmark-icon">👽</div>
        <div>Reddit</div>
      </a>
      <a href="https://news.ycombinator.com" class="bookmark">
        <div class="bookmark-icon">🔥</div>
        <div>Hacker News</div>
      </a>
      <a href="https://wikipedia.org" class="bookmark">
        <div class="bookmark-icon">📚</div>
        <div>Wikipedia</div>
      </a>
    </div>
    <div class="footer">
      <p>Zen Browser - A lightweight, privacy-focused web browser</p>
      <p>Ads blocked: <span id="adsBlocked">0</span> | Trackers blocked: <span id="trackersBlocked">0</span></p>
    </div>
  </div>

  <script>
    // Handle search
    document.getElementById('searchForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const query = document.getElementById('searchBox').value.trim();
      if (query) {
        let searchUrl = '';
        const searchEngine = '${searchEngine}';
        
        switch(searchEngine) {
          case 'google':
            searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
            break;
          case 'bing':
            searchUrl = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
            break;
          case 'duckduckgo':
            searchUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
            break;
          case 'yahoo':
            searchUrl = 'https://search.yahoo.com/search?p=' + encodeURIComponent(query);
            break;
          default:
            searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        }
        
        window.location.href = searchUrl;
      }
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
      window.electronAPI.toggleTheme();
    });
    
    // Update ad block stats
    window.electronAPI.onAdBlockStatsUpdated((stats) => {
      document.getElementById('adsBlocked').textContent = stats.adsBlocked;
      document.getElementById('trackersBlocked').textContent = stats.trackersBlocked;
    });
  </script>
</body>
</html>`;
    
    fs.writeFileSync(homepageFile, homepage);
  }
  
  return `file://${homepageFile}`;
}

// Handle app ready event
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Settings IPC handlers
ipcMain.handle('get-settings', () => {
  return store.store; // Return all settings
});

ipcMain.handle('update-setting', (event, { key, value }) => {
  store.set(key, value);
  
  // Handle special settings that need immediate action
  if (key === 'enableAdBlocker' && value === false) {
    // Disable ad blocker
    session.defaultSession.webRequest.onBeforeRequest(null);
  } else if (key === 'enableAdBlocker' && value === true) {
    // Re-enable ad blocker
    loadUblockOriginExtension();
  } else if (key === 'blockThirdPartyCookies') {
    session.defaultSession.cookies.set({
      blockThirdPartyCookies: value
    });
  } else if (key === 'httpsOnly') {
    if (value) {
      setupHttpsOnlyMode();
    } else {
      session.defaultSession.webRequest.onBeforeRequest(null);
    }
  } else if (key === 'theme') {
    // Update homepage with new theme
    createHomepage();
    // If the current URL is the homepage, reload it
    if (tabManager.activeTabIndex >= 0 && tabManager.tabs[tabManager.activeTabIndex]) {
      const currentUrl = tabManager.tabs[tabManager.activeTabIndex].view.webContents.getURL();
      if (currentUrl.includes('homepage')) {
        tabManager.tabs[tabManager.activeTabIndex].view.webContents.reload();
      }
    }
  }
  
  return true;
});

// Toggle theme between light and dark
ipcMain.handle('toggle-theme', () => {
  const currentTheme = store.get('theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  store.set('theme', newTheme);
  return newTheme;
});

// Setup HTTPS only mode
function setupHttpsOnlyMode() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*'] }, (details, callback) => {
    if (details.url.startsWith('http://') && !details.url.startsWith('http://localhost') && !details.url.includes('127.0.0.1')) {
      const httpsUrl = details.url.replace('http://', 'https://');
      callback({ redirectURL: httpsUrl });
    } else {
      callback({});
    }
  });
}

ipcMain.handle('reset-settings', () => {
  store.clear();
  return store.store;
});

// Download related IPC handlers
ipcMain.handle('get-downloads', () => {
  return {
    active: activeDownloads,
    completed: downloadsStore.get('items') || []
  };
});

ipcMain.handle('clear-downloads', () => {
  downloadsStore.set('items', []);
  return { success: true };
});

ipcMain.handle('pause-download', (event, id) => {
  const download = activeDownloads.find(d => d.id === id);
  if (download) {
    // In Electron, we can't directly pause a download by ID
    // This is a simplified implementation
    download.status = 'paused';
    return { success: true };
  }
  return { success: false, error: 'Download not found' };
});

ipcMain.handle('resume-download', (event, id) => {
  const download = activeDownloads.find(d => d.id === id);
  if (download) {
    // In Electron, we can't directly resume a download by ID
    // This is a simplified implementation
    download.status = 'progressing';
    return { success: true };
  }
  return { success: false, error: 'Download not found' };
});

ipcMain.handle('cancel-download', (event, id) => {
  const download = activeDownloads.find(d => d.id === id);
  if (download) {
    // In Electron, we can't directly cancel a download by ID
    // This is a simplified implementation
    download.status = 'cancelled';
    return { success: true };
  }
  return { success: false, error: 'Download not found' };
});

ipcMain.handle('open-downloads-folder', () => {
  const downloadPath = downloadsStore.get('downloadPath') || app.getPath('downloads');
  shell.openPath(downloadPath);
  return { success: true };
});

ipcMain.handle('open-downloaded-file', (event, filePath) => {
  shell.openPath(filePath);
  return { success: true };
});



ipcMain.handle('get-extensions', async () => {
  // Extensions feature will be implemented in a future update
  return [];
});

ipcMain.handle('toggle-extension', async (event, { id, enabled }) => {
  // Extensions feature will be implemented in a future update
  return false;
});

ipcMain.handle('install-extension', async (event, crxPath) => {
  // Extensions feature will be implemented in a future update
  return { success: false, error: 'Extensions not yet implemented' };
});
