const { app, BrowserWindow, BrowserView, ipcMain, clipboard, globalShortcut, Menu, session, shell } = require('electron');
const path = require('node:path');
const electronLocalshortcut = require('electron-localshortcut');
const Store = require('electron-store');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');
const fs = require('fs');
const url = require('url');

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
    showVerticalTabs: true,
    windowBounds: { width: 1200, height: 800 },
    sidebarVisible: true,
    showBookmarksBar: true,
    theme: 'light',
    searchEngine: 'google',
    lastVisit: null,
    pinnedTabs: []
  }
});

// History store
const historyStore = new Store({
  name: 'history',
  defaults: {
    visits: []
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
let adBlocker;

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

// Create the browser window
const createWindow = async () => {
  const { width, height } = store.get('windowBounds');
  
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 400,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true, // Hide menu by default
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Setup ad blocker if enabled
  if (store.get('enableAdBlocker')) {
    await setupAdBlocker();
  }

  // Create directory for assets if it doesn't exist
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Initialize the tab manager
  tabManager = new TabManager(mainWindow);

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open a new tab once UI is ready
  mainWindow.webContents.once('did-finish-load', () => {
    tabManager.createTab(store.get('defaultURL'));
  });

  // Register global shortcuts
  setupShortcuts();

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
}

// Setup ad blocker (Brave browser ad blocker from @cliqz/adblocker)
async function setupAdBlocker() {
  try {
    adBlocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    adBlocker.enableBlockingInSession(session.defaultSession);
    console.log('Ad blocker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize ad blocker:', error);
  }
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
  return true;
});

ipcMain.handle('reset-settings', () => {
  store.clear();
  return store.store;
});
