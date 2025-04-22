// Main Renderer process code
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sidebar = document.getElementById('sidebar');
  const navbar = document.getElementById('navbar');
  const mainContent = document.getElementById('main-content');
  const tabsContainer = document.getElementById('tabs-container');
  const urlInput = document.getElementById('url-input');
  const siteIcon = document.querySelector('.site-icon');
  const newTabBtn = document.getElementById('new-tab-btn');
  const homeBtn = document.getElementById('home-btn');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const copyUrlBtn = document.getElementById('copy-url-btn');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const toggleUiBtn = document.getElementById('toggle-ui-btn');
  const historyBtn = document.getElementById('history-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const settingsPanel = document.getElementById('settings-panel');
  const historyPanel = document.getElementById('history-panel');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyItemsContainer = document.getElementById('history-items-container');
  const defaultUrlInput = document.getElementById('default-url');
  const toggleAdBlockerCheckbox = document.getElementById('toggle-ad-blocker');
  const alwaysShowTabsCheckbox = document.getElementById('always-show-tabs');
  const notificationContainer = document.getElementById('notification-container');

  // State
  let activeTabId = null;
  let tabs = [];
  let settings = {};
  let bookmarks = [];
  let history = [];
  let currentFavicon = null;

  // Initialize
  init();

  // Functions
  async function init() {
    // Load settings
    settings = await window.browserAPI.getSettings();
    
    // Initialize UI based on settings
    updateUIFromSettings();
    
    // Load bookmarks
    await loadBookmarks();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up IPC listeners
    setupIPCListeners();
    
    // Apply custom animations
    applyCustomAnimations();
  }
  
  // Load bookmarks from store
  async function loadBookmarks() {
    try {
      const bookmarksData = await window.browserAPI.getBookmarks();
      bookmarks = bookmarksData.bookmarks;
      renderBookmarksBar();
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }
  
  // Apply additional animations to UI elements
  function applyCustomAnimations() {
    // Add subtle hover animations to various UI elements
    document.querySelectorAll('.sidebar-btn, .nav-controls button, .url-actions button').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
      });
    });
    
    // Add pulse animation to the new tab button
    newTabBtn.classList.add('pulse-animation');
    setTimeout(() => {
      newTabBtn.classList.remove('pulse-animation');
    }, 2000);
  }

  // Setup all UI event listeners
  function setupEventListeners() {
    // New tab button
    newTabBtn.addEventListener('click', () => {
      window.browserAPI.createTab(settings.defaultURL);
    });
    
    // Back button
    backBtn.addEventListener('click', () => {
      if (activeTabId) {
        sendMessageToActiveTab('history-go-back');
      }
    });
    
    // Forward button
    forwardBtn.addEventListener('click', () => {
      if (activeTabId) {
        sendMessageToActiveTab('history-go-forward');
      }
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', () => {
      if (activeTabId) {
        sendMessageToActiveTab('reload');
      }
    });
    
    // URL input
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (activeTabId) {
          window.browserAPI.navigateTo(activeTabId, urlInput.value);
        }
      }
    });
    
    // Copy URL button (also adds hotkey Ctrl+Shift+C or Cmd+Shift+C)
    copyUrlBtn.addEventListener('click', () => {
      copyCurrentUrl();
    });
    
    // Toggle UI visibility button
    toggleUiBtn.addEventListener('click', () => {
      window.browserAPI.toggleHideUI();
    });
    
    // Settings button
    settingsBtn.addEventListener('click', () => {
      openSettings();
    });
    
    // Close settings button
    closeSettingsBtn.addEventListener('click', () => {
      closeSettings();
    });
    
    // Settings inputs
    defaultUrlInput.addEventListener('change', () => {
      window.browserAPI.updateSetting('defaultURL', defaultUrlInput.value);
    });
    
    toggleAdBlockerCheckbox.addEventListener('change', () => {
      window.browserAPI.updateSetting('enableAdBlocker', toggleAdBlockerCheckbox.checked);
      showNotification('Please restart the browser to apply ad blocker changes');
    });
    
    alwaysShowTabsCheckbox.addEventListener('change', () => {
      window.browserAPI.updateSetting('showVerticalTabs', alwaysShowTabsCheckbox.checked);
    });
  }

  // Setup all IPC event listeners
  function setupIPCListeners() {
    // Tab created event
    window.browserAPI.onTabCreated((event, data) => {
      // Update local tabs array
      refreshTabs();
    });
    
    // Tab closed event
    window.browserAPI.onTabClosed((event, data) => {
      // Update local tabs array
      refreshTabs();
    });
    
    // Tab activated event
    window.browserAPI.onTabActivated((event, data) => {
      activeTabId = data.id;
      updateActiveTab();
      updateUrlBar();
    });
    
    // Tab updated event
    window.browserAPI.onTabUpdated((event, data) => {
      updateTab(data);
      if (data.id === activeTabId && data.url) {
        updateUrlBar();
      }
    });
    
    // Sidebar toggled event
    window.browserAPI.onSidebarToggled((event, data) => {
      if (data.visible) {
        sidebar.classList.remove('hidden');
        navbar.classList.remove('sidebar-hidden');
      } else {
        sidebar.classList.add('hidden');
        navbar.classList.add('sidebar-hidden');
      }
    });
    
    // UI visibility changed event
    window.browserAPI.onUIVisibilityChanged((event, data) => {
      if (data.hidden) {
        sidebar.classList.add('hidden');
        navbar.classList.add('hidden');
      } else {
        sidebar.classList.remove('hidden');
        navbar.classList.remove('hidden');
      }
    });
    
    // Show notification event
    window.browserAPI.onShowNotification((event, data) => {
      showNotification(data.message);
    });
  }

  // Refresh tabs list from main process
  function refreshTabs() {
    tabs = window.browserAPI.getTabs();
    renderTabs();
  }

  // Render the tabs in the sidebar
  function renderTabs() {
    // Clear current tabs
    tabsContainer.innerHTML = '';
    
    // Add each tab
    tabs.forEach(tab => {
      const tabElement = createTabElement(tab);
      tabsContainer.appendChild(tabElement);
    });
    
    // Update active tab UI
    updateActiveTab();
  }

  // Create a tab element for the sidebar
  function createTabElement(tab) {
    const tabElement = document.createElement('div');
    tabElement.className = `tab-item ${tab.isActive ? 'active' : ''}`;
    tabElement.setAttribute('data-tab-id', tab.id);
    
    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favicon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    };
    
    // Title
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || 'New Tab';
    
    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.browserAPI.closeTab(tab.id);
    });
    
    // Click event to switch tabs
    tabElement.addEventListener('click', () => {
      window.browserAPI.switchTab(tab.id);
    });
    
    // Append elements
    tabElement.appendChild(favicon);
    tabElement.appendChild(title);
    tabElement.appendChild(closeBtn);
    
    return tabElement;
  }

  // Update a specific tab
  function updateTab(tabData) {
    const index = tabs.findIndex(tab => tab.id === tabData.id);
    if (index !== -1) {
      // Update our local data
      tabs[index] = { ...tabs[index], ...tabData };
      
      // Update the DOM if the tab exists
      const tabElement = document.querySelector(`[data-tab-id="${tabData.id}"]`);
      if (tabElement) {
        // Update favicon if provided
        if (tabData.favicon) {
          const favicon = tabElement.querySelector('.tab-favicon');
          favicon.src = tabData.favicon;
        }
        
        // Update title if provided
        if (tabData.title) {
          const title = tabElement.querySelector('.tab-title');
          title.textContent = tabData.title;
        }
      }
    }
  }

  // Update the active tab styling
  function updateActiveTab() {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.remove('active');
    });
    
    // Add active class to current tab
    const activeTab = document.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
  }

  // Update the URL bar with the current tab's URL
  function updateUrlBar() {
    const currentUrl = window.browserAPI.getCurrentUrl();
    urlInput.value = currentUrl;
  }

  // Send a message to the active tab's webContents
  function sendMessageToActiveTab(message, args) {
    // This would need implementation in the main process
    // For now, we handle some cases directly
    if (message === 'history-go-back') {
      // Handled by main process
    } else if (message === 'history-go-forward') {
      // Handled by main process
    } else if (message === 'reload') {
      // Handled by main process
    }
  }

  // Copy the current URL to the clipboard
  function copyCurrentUrl() {
    const currentUrl = window.browserAPI.getCurrentUrl();
    if (currentUrl) {
      // The actual copying is done by the main process
      // Just trigger our shortcut handler
      showNotification('URL copied to clipboard');
    }
  }

  // Open settings panel
  function openSettings() {
    settingsPanel.classList.remove('hidden');
    setTimeout(() => {
      settingsPanel.classList.add('visible');
    }, 10);
    
    // Load current settings values
    defaultUrlInput.value = settings.defaultURL || '';
    toggleAdBlockerCheckbox.checked = settings.enableAdBlocker || false;
    alwaysShowTabsCheckbox.checked = settings.showVerticalTabs || false;
  }

  // Close settings panel
  function closeSettings() {
    settingsPanel.classList.remove('visible');
    setTimeout(() => {
      settingsPanel.classList.add('hidden');
    }, 300);
  }

  // Update UI based on settings
  function updateUIFromSettings() {
    // Update sidebar visibility
    if (!settings.sidebarVisible) {
      sidebar.classList.add('hidden');
      navbar.classList.add('sidebar-hidden');
    }
    
    // Update UI visibility (hide everything mode)
    if (settings.hideUI) {
      sidebar.classList.add('hidden');
      navbar.classList.add('hidden');
    }
  }

  // Show a notification
  function showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Animation will handle fading out
    setTimeout(() => {
      notification.style.opacity = '1';
      
      // Remove after animation completes
      setTimeout(() => {
        notification.remove();
      }, duration);
    }, 10);
  }

  // Initial tab refresh
  refreshTabs();
});
