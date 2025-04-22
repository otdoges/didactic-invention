// Main Renderer process code
document.addEventListener('DOMContentLoaded', () => {
  // Document elements
  const browser = document.getElementById('browser');
  const sidebar = document.getElementById('sidebar');
  const tabsContainer = document.getElementById('tabs');
  const navbar = document.getElementById('navigation-bar');
  const addressInput = document.getElementById('address-input');
  const webviewContainer = document.getElementById('webviews');
  const tabContextMenu = document.getElementById('tab-context-menu');
  const menuNewTab = document.getElementById('menu-new-tab');
  const menuCloseTab = document.getElementById('menu-close-tab');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsModal = document.getElementById('settings-modal');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
  const toggleAdBlocker = document.getElementById('toggle-ad-blocker');
  const defaultUrl = document.getElementById('default-url');
  const alwaysShowTabs = document.getElementById('always-show-tabs');
  const notificationContainer = document.getElementById('notification-container');
  const loadingBar = document.getElementById('loading-bar');
  const themeSwitch = document.getElementById('theme-switch');
  const loadingSpinnerTemplate = document.getElementById('loading-spinner-template');
  const mediaPlayerTemplate = document.getElementById('media-player-template');
  const bookmarkBarToggle = document.getElementById('bookmark-bar-toggle');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const historyPanel = document.getElementById('history-panel');
  const closeHistoryBtn = document.getElementById('close-history-btn');
  const historyItemsContainer = document.getElementById('history-items-container');
  const defaultUrlInput = document.getElementById('default-url');
  const toggleAdBlockerCheckbox = document.getElementById('toggle-ad-blocker');
  const alwaysShowTabsCheckbox = document.getElementById('always-show-tabs');
  const settingsNavItems = document.querySelectorAll('.settings-nav-item');

  // State variables
  let activeTabId = null;
  let tabs = [];
  let bookmarks = [];
  let history = [];
  let currentFavicon = null;
  let isNavbarHidden = false;
  let isFullscreen = false;
  let settingsVisible = false;
  let historyVisible = false;
  let isDarkMode = false;
  let loadingTimers = {};
  let mediaPlayers = [];
  
  // Check system preference for dark mode
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Initialize the application
  async function init() {
    // Load settings
    const settings = await window.browserAPI.getSettings();
    
    // Update UI based on settings
    if (toggleAdBlockerCheckbox) toggleAdBlockerCheckbox.checked = settings.adBlocker || false;
    if (defaultUrlInput) defaultUrlInput.value = settings.defaultUrl || 'homepage';
    if (alwaysShowTabsCheckbox) alwaysShowTabsCheckbox.checked = settings.alwaysShowTabs || false;
    if (bookmarkBarToggle) bookmarkBarToggle.checked = settings.showBookmarkBar !== false; // Default to true

    // Set dark mode based on settings or system preference
    isDarkMode = settings.darkMode !== undefined ? settings.darkMode : prefersDarkMode;
    applyTheme();

    if (themeSwitch) {
      themeSwitch.classList.toggle('dark', isDarkMode);
    }

    // Create initial tab
    createNewTab();

    // Load bookmarks and history
    await loadBookmarks();
    await loadHistory();

    // Set up event listeners
    setupEventListeners();

    // Set up IPC listeners
    setupIPCListeners();
  }

  // Set up event listeners
  function setupEventListeners() {
    // New tab button
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', createNewTab);
    }

    // Navigation buttons
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', goBack);
    }

    const forwardBtn = document.getElementById('forward-btn');
    if (forwardBtn) {
      forwardBtn.addEventListener('click', goForward);
    }

    const reloadBtn = document.getElementById('reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', reload);
    }

    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
      homeBtn.addEventListener('click', goHome);
    }

    // Address bar
    if (addressInput) {
      addressInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          navigateToUrl(addressInput.value);
        }
      });
    }

    // Settings panel
    if (settingsBtn) {
      settingsBtn.addEventListener('click', toggleSettings);
    }

    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', toggleSettings);
    }

    // History panel
    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', toggleHistory);
    }

    if (closeHistoryBtn) {
      closeHistoryBtn.addEventListener('click', toggleHistory);
    }

    // Settings changes
    if (toggleAdBlocker) {
      toggleAdBlocker.addEventListener('change', updateSettings);
    }

    if (defaultUrl) {
      defaultUrl.addEventListener('change', updateSettings);
    }

    if (alwaysShowTabs) {
      alwaysShowTabs.addEventListener('change', updateSettings);
    }

    if (bookmarkBarToggle) {
      bookmarkBarToggle.addEventListener('change', updateSettings);
    }

    // Theme switch
    if (themeSwitch) {
      themeSwitch.addEventListener('click', toggleDarkMode);
    }

    // Clear history button
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearHistory);
    }

    // Bookmark button
    const bookmarkBtn = document.getElementById('bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', addCurrentPageToBookmarks);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Context menu for tabs
    document.addEventListener('click', () => {
      if (tabContextMenu) {
        tabContextMenu.style.display = 'none';
      }
    });

    if (menuNewTab) {
      menuNewTab.addEventListener('click', createNewTab);
    }

    if (menuCloseTab) {
      menuCloseTab.addEventListener('click', () => {
        closeTab(menuCloseTab.dataset.tabId);
        tabContextMenu.style.display = 'none';
      });
    }
  }

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

    // Home button
    homeBtn.addEventListener('click', () => {
      if (activeTabId) {
        window.browserAPI.navigateTo(activeTabId, 'homepage');
      } else {
        window.browserAPI.createTab('homepage');
      }
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

    // URL input focus animation
    urlInput.addEventListener('focus', () => {
      const zenAddressBar = document.querySelector('.zen-address-bar');
      if (zenAddressBar) {
        zenAddressBar.classList.add('focused');
      }
    });

    urlInput.addEventListener('blur', () => {
      const zenAddressBar = document.querySelector('.zen-address-bar');
      if (zenAddressBar) {
        zenAddressBar.classList.remove('focused');
      }
    });

    // Copy URL button
    copyUrlBtn.addEventListener('click', () => {
      copyCurrentUrl();
    });

    // Bookmark button
    bookmarkBtn.addEventListener('click', () => {
      addCurrentPageToBookmarks();
    });

    // Toggle UI visibility button
    toggleUiBtn.addEventListener('click', () => {
      window.browserAPI.toggleHideUI();
    });

    // History button
    historyBtn.addEventListener('click', () => {
      openHistory();
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
      openSettings();
    });

    // Close settings button
    closeSettingsBtn.addEventListener('click', () => {
      closeSettings();
    });

    // Close history button
    closeHistoryBtn.addEventListener('click', () => {
      closeHistory();
    });

    // Clear history button
    clearHistoryBtn.addEventListener('click', () => {
      clearHistory();
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

    // Toggle bookmarks bar
    document.getElementById('bookmarks-bar-toggle').addEventListener('change', () => {
      window.browserAPI.toggleBookmarksBar();
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
      updateBookmarkButtonState();
    });

    // Tab updated event
    window.browserAPI.onTabUpdated((event, data) => {
      updateTab(data);
      if (data.id === activeTabId) {
        if (data.url) {
          updateUrlBar();
          updateBookmarkButtonState();
        }
        if (data.favicon) {
          currentFavicon = data.favicon;
          updateSiteIcon(data.favicon);
        }
      }
    });

    // Sidebar toggled event
    window.browserAPI.onSidebarToggled((event, data) => {
      if (data.visible) {
        sidebar.classList.remove('hidden');
        mainContent.style.marginLeft = '80px';
      } else {
        sidebar.classList.add('hidden');
        mainContent.style.marginLeft = '0';
      }
      animateContent();
    });

    // Bookmarks bar toggled event
    window.browserAPI.onBookmarksBarToggled((event, data) => {
      if (data.visible) {
        bookmarksBar.classList.remove('hidden');
      } else {
        bookmarksBar.classList.add('hidden');
      }
      animateContent();
    });

    // UI visibility changed event
    window.browserAPI.onUIVisibilityChanged((event, data) => {
      if (data.hidden) {
        sidebar.classList.add('hidden');
        navbar.classList.add('hidden');
        bookmarksBar.classList.add('hidden');
        mainContent.style.marginLeft = '0';
      } else {
        if (settings.sidebarVisible) {
          sidebar.classList.remove('hidden');
          mainContent.style.marginLeft = '80px';
        }
        navbar.classList.remove('hidden');
        if (settings.showBookmarksBar) {
          bookmarksBar.classList.remove('hidden');
        }
      }
      animateContent();
    });

    // Show notification event
    window.browserAPI.onShowNotification((event, data) => {
      showNotification(data.message);
    });
  }

  // Animate content when UI elements show/hide
  function animateContent() {
    mainContent.style.transition = 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    setTimeout(() => {
      mainContent.style.transition = '';
    }, 300);
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

  // Update the site icon in the address bar
  function updateSiteIcon(faviconUrl) {
    if (faviconUrl) {
      // Create an image element
      const img = document.createElement('img');
      img.src = faviconUrl;
      img.style.width = '16px';
      img.style.height = '16px';
      siteIcon.innerHTML = '';
      siteIcon.appendChild(img);
    } else {
      // Reset to default icon
      siteIcon.innerHTML = '<span class="material-icons">public</span>';
    }
  }

  // Add current page to bookmarks
  async function addCurrentPageToBookmarks() {
    const currentUrl = window.browserAPI.getCurrentUrl();
    const currentTab = tabs.find(tab => tab.id === activeTabId);

    if (!currentUrl || !currentTab) return;

    // Check if already bookmarked
    const isBookmarked = bookmarks.some(bookmark => bookmark.url === currentUrl);

    if (isBookmarked) {
      showNotification('This page is already bookmarked');
      return;
    }

    const newBookmark = {
      id: 'bookmark_' + Date.now(),
      title: currentTab.title || 'Untitled',
      url: currentUrl,
      icon: currentTab.favicon,
      dateAdded: new Date().toISOString()
    };

    try {
      await window.browserAPI.addBookmark(newBookmark);
      bookmarks.push(newBookmark);
      renderBookmarksBar();
      showNotification('Bookmark added');
      updateBookmarkButtonState();

      // Add visual feedback
      bookmarkBtn.querySelector('.material-icons').textContent = 'bookmark';
      setTimeout(() => {
        // Animate the bookmark button
        bookmarkBtn.classList.add('pulse-animation');
        setTimeout(() => {
          bookmarkBtn.classList.remove('pulse-animation');
        }, 1000);
      }, 100);
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      showNotification('Failed to add bookmark');
    }
  }

  // Update bookmark button state based on current URL
  function updateBookmarkButtonState() {
    const currentUrl = window.browserAPI.getCurrentUrl();
    const isBookmarked = bookmarks.some(bookmark => bookmark.url === currentUrl);

    const icon = bookmarkBtn.querySelector('.material-icons');
    if (isBookmarked) {
      icon.textContent = 'bookmark';
    } else {
      icon.textContent = 'bookmark_border';
    }
  }

  // Render bookmarks in the bookmarks bar
  function renderBookmarksBar() {
    // Clear current bookmarks
    bookmarksBar.innerHTML = '';

    // Add each bookmark
    bookmarks.forEach(bookmark => {
      const bookmarkElement = createBookmarkElement(bookmark);
      bookmarksBar.appendChild(bookmarkElement);
    });

    // Add the "add bookmark" button
    const addButton = document.createElement('button');
    addButton.className = 'add-bookmark';
    addButton.title = 'Add bookmark';
    addButton.innerHTML = '<span class="material-icons">add</span>';
    addButton.addEventListener('click', () => {
      addCurrentPageToBookmarks();
    });

    bookmarksBar.appendChild(addButton);
  }

  // Create a bookmark element for the bookmark bar
  function createBookmarkElement(bookmark) {
    const bookmarkElement = document.createElement('div');
    bookmarkElement.className = 'bookmark-item';
    bookmarkElement.setAttribute('data-bookmark-id', bookmark.id);
    bookmarkElement.title = bookmark.title;

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'bookmark-icon';
    favicon.src = bookmark.icon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    };

    // Title
    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;

    // Click event to navigate
    bookmarkElement.addEventListener('click', () => {
      if (activeTabId) {
        window.browserAPI.navigateTo(activeTabId, bookmark.url);
      } else {
        window.browserAPI.createTab(bookmark.url);
      }
    });

    // Right-click to delete
    bookmarkElement.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('Delete this bookmark?')) {
        deleteBookmark(bookmark.id);
      }
    });

    // Append elements
    bookmarkElement.appendChild(favicon);
    bookmarkElement.appendChild(title);

    return bookmarkElement;
  }

  // Delete a bookmark
  async function deleteBookmark(bookmarkId) {
    try {
      await window.browserAPI.deleteBookmark(bookmarkId);
      bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
      renderBookmarksBar();
      showNotification('Bookmark deleted');
      updateBookmarkButtonState();
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
      showNotification('Failed to delete bookmark');
    }
  }

  // Open history panel
  async function openHistory() {
    // Load history data
    try {
      history = await window.browserAPI.getHistory();
      renderHistory();
      historyPanel.classList.add('visible');
    } catch (error) {
      console.error('Failed to load history:', error);
      showNotification('Failed to load history');
    }
  }

  // Close history panel
  function closeHistory() {
    historyPanel.classList.remove('visible');
  }

  // Clear history
  async function clearHistory() {
    if (confirm('Are you sure you want to clear all browsing history?')) {
      try {
        await window.browserAPI.clearHistory();
        history = [];
        renderHistory();
        showNotification('History cleared');
      } catch (error) {
        console.error('Failed to clear history:', error);
        showNotification('Failed to clear history');
      }
    }
  }

  // Render history items
  function renderHistory() {
    // Clear current history items
    historyItemsContainer.innerHTML = '';

    if (history.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-history';
      emptyMessage.textContent = 'No browsing history';
      historyItemsContainer.appendChild(emptyMessage);
      return;
    }

    // Group by date
    const groupedHistory = groupHistoryByDate(history);

    // Add each group
    Object.keys(groupedHistory).forEach(date => {
      // Add date header
      const dateHeader = document.createElement('div');
      dateHeader.className = 'history-date-header';
      dateHeader.textContent = date;
      historyItemsContainer.appendChild(dateHeader);

      // Add items for this date
      groupedHistory[date].forEach(item => {
        const historyElement = createHistoryElement(item);
        historyItemsContainer.appendChild(historyElement);
      });
    });
  }

  // Group history items by date
  function groupHistoryByDate(historyItems) {
    const grouped = {};

    historyItems.forEach(item => {
      const date = new Date(item.timestamp);
      const dateString = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      if (!grouped[dateString]) {
        grouped[dateString] = [];
      }

      grouped[dateString].push(item);
    });

    return grouped;
  }

  // Create a history item element
  function createHistoryElement(historyItem) {
    const element = document.createElement('div');
    element.className = 'history-item';
    element.setAttribute('data-history-id', historyItem.id);

    // Favicon
    const favicon = document.createElement('img');
    favicon.className = 'history-favicon';
    favicon.src = historyItem.favicon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    favicon.onerror = () => {
      favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%236B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    };

    // Details container
    const details = document.createElement('div');
    details.className = 'history-details';

    // Title
    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = historyItem.title;

    // URL
    const url = document.createElement('div');
    url.className = 'history-url';
    url.textContent = historyItem.url;

    details.appendChild(title);
    details.appendChild(url);

    // Time
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = new Date(historyItem.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'history-delete';
    deleteBtn.innerHTML = '<span class="material-icons">close</span>';
    deleteBtn.title = 'Remove from history';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(historyItem.id);
    });

    // Click to navigate
    element.addEventListener('click', () => {
      if (activeTabId) {
        window.browserAPI.navigateTo(activeTabId, historyItem.url);
      } else {
        window.browserAPI.createTab(historyItem.url);
      }
      closeHistory();
    });

    // Append all elements
    element.appendChild(favicon);
    element.appendChild(details);
    element.appendChild(time);
    element.appendChild(deleteBtn);

    return element;
  }

  // Delete a history item
  async function deleteHistoryItem(id) {
    try {
      await window.browserAPI.deleteHistoryItem(id);
      history = history.filter(item => item.id !== id);
      renderHistory();
      showNotification('History item removed');
    } catch (error) {
      console.error('Failed to delete history item:', error);
      showNotification('Failed to delete history item');
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
