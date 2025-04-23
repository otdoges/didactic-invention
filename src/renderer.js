// Nebula Browser Renderer Process - Main UI handling
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
  const downloadsBtn = document.getElementById('downloads-btn');
  const downloadsPanel = document.getElementById('downloads-panel');
  const closeDownloadsBtn = document.getElementById('close-downloads-btn');
  const clearDownloadsBtn = document.getElementById('clear-downloads-btn');
  const openDownloadsFolderBtn = document.getElementById('open-downloads-folder-btn');
  const downloadsItemsContainer = document.getElementById('downloads-items-container');
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
  const incognitoButton = document.getElementById('incognito-btn');
  const nightModeButton = document.getElementById('night-mode-btn');
  const translateButton = document.getElementById('translate-btn');
  const screenshotButton = document.getElementById('screenshot-btn');
  const bookmarkButton = document.getElementById('bookmark-btn');

  // State variables
  let activeTabId = null;
  let tabs = [];
  let bookmarks = [];
  let history = [];
  let downloads = [];
  let activeDownloads = [];
  let currentFavicon = null;
  let isNavbarHidden = false;
  let isFullscreen = false;
  let settingsVisible = false;
  let historyVisible = false;
  let downloadsVisible = false;
  let isDarkMode = false;
  let loadingTimers = {};
  let mediaPlayers = [];
  let isIncognitoMode = false;
  let isNightMode = false;

  // Check system preference for dark mode
  const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Initialize the application
  async function init() {
    // Load settings
    const settings = await window.browserAPI.getSettings();
    
    // Update UI based on settings
    if (toggleAdBlocker) toggleAdBlocker.checked = settings.enableAdBlocker !== false; // Default to true
    if (defaultUrl) defaultUrl.value = settings.defaultUrl || 'homepage';
    if (alwaysShowTabs) alwaysShowTabs.checked = settings.showVerticalTabs !== false; // Default to true

    // Set dark mode based on settings or system preference
    isDarkMode = settings.theme === 'dark';
    document.body.classList.toggle('dark-theme', isDarkMode);

    // Set up event listeners
    setupEventListeners();

    // Set up IPC listeners
    setupIPCListeners();
    
    // Get adblock stats
    try {
      const stats = await window.browserAPI.getAdBlockStats();
      updateAdBlockStats(stats);
    } catch (error) {
      console.error('Failed to get adblock stats:', error);
    }
    
    // Load downloads
    loadDownloads();
    
    // Initial tabs refresh
    refreshTabs();
  }

  // Set up event listeners
  function setupEventListeners() {
    // Set up downloads button
    if (downloadsBtn) {
      downloadsBtn.addEventListener('click', () => {
        toggleDownloadsPanel();
      });
    }

    // Close downloads button
    if (closeDownloadsBtn) {
      closeDownloadsBtn.addEventListener('click', () => {
        toggleDownloadsPanel(false);
      });
    }

    // Clear downloads button
    if (clearDownloadsBtn) {
      clearDownloadsBtn.addEventListener('click', async () => {
        await window.browserAPI.clearDownloads();
        downloads = [];
        updateDownloadsList();
        showNotification('Downloads cleared');
      });
    }

    // Open downloads folder button
    if (openDownloadsFolderBtn) {
      openDownloadsFolderBtn.addEventListener('click', async () => {
        await window.browserAPI.openDownloadsFolder();
      });
    }

    // New tab button
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn) {
      newTabBtn.addEventListener('click', () => {
        window.browserAPI.createTab();
      });
    }

    // DevTools button
    const devtoolsBtn = document.getElementById('devtools-btn');
    if (devtoolsBtn) {
      devtoolsBtn.addEventListener('click', () => {
        if (activeTabId) {
          window.browserAPI.openDevTools(activeTabId);
          showNotification('DevTools opened');
        }
      });
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
      settingsBtn.addEventListener('click', () => {
        // Close extensions panel if open
        if (extensionsVisible && extensionsPanel) {
          extensionsPanel.classList.remove('visible');
          extensionsVisible = false;
        }

        settingsPanel.classList.toggle('visible');
        settingsVisible = !settingsVisible;
      });
    }

    // Close settings button
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.remove('visible');
        settingsVisible = false;
      });
    }

    // Extensions button
    const extensionsBtn = document.getElementById('extensions-btn');
    if (extensionsBtn) {
      extensionsBtn.addEventListener('click', () => {
        // Close settings panel if open
        if (settingsVisible && settingsPanel) {
          settingsPanel.classList.remove('visible');
          settingsVisible = false;
        }

        extensionsPanel.classList.toggle('visible');
        extensionsVisible = !extensionsVisible;
      });
    }

    // Close extensions button
    const closeExtensionsBtn = document.getElementById('close-extensions-btn');
    if (closeExtensionsBtn) {
      closeExtensionsBtn.addEventListener('click', () => {
        extensionsPanel.classList.remove('visible');
        extensionsVisible = false;
      });
    }

    // Settings navigation
    if (settingsNavItems) {
      settingsNavItems.forEach(item => {
        item.addEventListener('click', () => {
          const section = item.getAttribute('data-section');

          // Update active nav item
          settingsNavItems.forEach(navItem => {
            navItem.classList.toggle('active', navItem === item);
          });

          // Show the corresponding section
          const sections = document.querySelectorAll('.settings-section');
          sections.forEach(sec => {
            sec.classList.toggle('active', sec.id === section + '-section');
          });
        });
      });
    }

    // Close history button
    closeHistoryBtn.addEventListener('click', () => {
      closeHistory();
    });

    // Clear history button
    const clearHistoryBtn = document.getElementById('clear-history-btn');
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

    // Incognito button
    if (incognitoButton) {
      incognitoButton.addEventListener('click', toggleIncognitoMode);
    }

    // Screenshot button
    if (screenshotButton) {
      screenshotButton.addEventListener('click', takeScreenshot);
    }

    // Bookmark button in bookmarks panel
    const addBookmarkBtn = document.getElementById('add-bookmark');
    if (addBookmarkBtn) {
      addBookmarkBtn.addEventListener('click', addBookmark);
    }

    // Night mode button
    if (nightModeButton) {
      nightModeButton.addEventListener('click', toggleNightMode);
    }

    // Bookmark button
    if (bookmarkButton) {
      bookmarkButton.addEventListener('click', toggleBookmarksPanel);
    }
  }

  // Setup all IPC event listeners
  function setupIPCListeners() {
    // AdBlock stats updates
    window.browserAPI.onAdBlockStatsUpdated((stats) => {
      updateAdBlockStats(stats);
    });

    // Tab updates
    window.browserAPI.onTabCreated((tab) => {
      refreshTabs();
    });

    window.browserAPI.onTabClosed((tabId) => {
      refreshTabs();
    });

    window.browserAPI.onTabUpdated((tab) => {
      refreshTabs();

      // Update address bar if this is the active tab
      if (tab.isActive) {
        addressInput.value = tab.url;
        currentFavicon = tab.favicon;
      }
    });

    window.browserAPI.onTabActivated((tabId) => {
      activeTabId = tabId;
      refreshTabs();

      // Update address bar
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        addressInput.value = tab.url;
        currentFavicon = tab.favicon;
      }
    });

    window.browserAPI.onSidebarToggled((visible) => {
      sidebar.classList.toggle('hidden', !visible);
      navbar.classList.toggle('sidebar-hidden', !visible);
    });

    window.browserAPI.onBookmarksBarToggled((visible) => {
      const bookmarksBar = document.getElementById('bookmark-bar');
      if (bookmarksBar) {
        bookmarksBar.classList.toggle('hidden', !visible);
      }
    });

    window.browserAPI.onUIVisibilityChanged((data) => {
      isNavbarHidden = data.hidden;
      navbar.classList.toggle('hidden', data.hidden);
      sidebar.classList.toggle('hidden', data.hidden);
    });
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
        window.browserAPI.goBack(activeTabId);
      }
    });

    // Forward button
    forwardBtn.addEventListener('click', () => {
      if (activeTabId) {
        window.browserAPI.goForward(activeTabId);
      }
    });

    // Refresh button
    refreshBtn.addEventListener('click', () => {
      if (activeTabId) {
        window.browserAPI.reload(activeTabId);
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

  // Map of search engine base URLs
  const SEARCH_ENGINES = {
    bing: 'https://www.bing.com/search',
    duckduckgo: 'https://duckduckgo.com/',
    yahoo: 'https://search.yahoo.com/search',
    google: 'https://www.google.com/search',
  };
  
  // Get search engine URL based on settings and query
  function getSearchEngineUrl(query) {
    try {
      const settings = window.browserAPI.getSettings();
      const key = settings?.searchEngine ?? 'google';
      const base = SEARCH_ENGINES[key] ?? SEARCH_ENGINES.google;
      const url = new URL(base);
      url.searchParams.set('q', query);
      return url.toString();
    } catch (error) {
      console.error('Error getting search engine:', error);
      return new URL(`${SEARCH_ENGINES.google}?q=${query}`).toString();
    }
  }

    // ...

  // Media handling functions
  function checkForMediaContent(webview) {
    if (!webview) return;
    
    webview.executeJavaScript(`
      (function() {
        const videos = document.querySelectorAll('video');
        const audios = document.querySelectorAll('audio');
        return {
          videos: videos.length,
          audios: audios.length
        };
      })()
    `).then(result => {
      if (result.videos > 0 || result.audios > 0) {
        if (!document.querySelector('.media-player')) {
          createMediaPlayer(webview, result.videos > 0 ? 'video' : 'audio');
        }
      }
    }).catch(err => console.error('Error checking for media:', err));
  }
  
  function createMediaPlayer(webview, type) {
    // Clone the template
    if (!mediaPlayerTemplate) return;
    
    const mediaPlayerNode = mediaPlayerTemplate.content.cloneNode(true);
    const mediaPlayer = mediaPlayerNode.querySelector('.media-player');
    const mediaContent = mediaPlayer.querySelector('.media-content');
    
    // Add class based on media type
    mediaPlayer.classList.add(type === 'video' ? 'video-player' : 'audio-player');
    
    // Set up media content based on type
    if (type === 'video') {
      webview.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video) {
            return {
              src: video.src || video.currentSrc,
              poster: video.poster,
              title: document.title
            };
          }
          return null;
        })()
      `).then(videoData => {
        if (videoData) {
          // Create video element
          const videoEl = document.createElement('video');
          videoEl.src = videoData.src;
          videoEl.controls = false;
          videoEl.poster = videoData.poster;
          mediaContent.appendChild(videoEl);
          
          // Update title
          const titleEl = mediaPlayer.querySelector('.media-player-title');
          titleEl.textContent = videoData.title || 'Video Player';
          
          // Set up controls
          setupMediaControls(mediaPlayer, videoEl);
        }
      });
    } else {
      webview.executeJavaScript(`
        (function() {
          const audio = document.querySelector('audio');
          if (audio) {
            return {
              src: audio.src || audio.currentSrc,
              title: document.title
            };
          }
          return null;
        })()
      `).then(audioData => {
        if (audioData) {
          // Create audio placeholder icon
          const audioIcon = document.createElement('div');
          audioIcon.className = 'media-icon';
          audioIcon.innerHTML = '<span class="material-icons">music_note</span>';
          mediaContent.appendChild(audioIcon);
          
          // Create audio element
          const audioEl = document.createElement('audio');
          audioEl.src = audioData.src;
          audioEl.controls = false;
          mediaContent.appendChild(audioEl);
          
          // Update title
          const titleEl = mediaPlayer.querySelector('.media-player-title');
          titleEl.textContent = audioData.title || 'Audio Player';
          
          // Set up controls
          setupMediaControls(mediaPlayer, audioEl);
        }
      });
    }
    
    // Add to document and store reference
    document.body.appendChild(mediaPlayer);
    mediaPlayers.push(mediaPlayer);
    
    // Set up close button
    const closeBtn = mediaPlayer.querySelector('.media-close-btn');
    closeBtn.addEventListener('click', () => {
      mediaPlayer.remove();
      mediaPlayers = mediaPlayers.filter(player => player !== mediaPlayer);
    });
    
    return mediaPlayer;
  }
  
  function setupMediaControls(mediaPlayer, mediaElement) {
    const playBtn = mediaPlayer.querySelector('.media-play');
    const progressBar = mediaPlayer.querySelector('.media-progress');
    const progressFill = mediaPlayer.querySelector('.media-progress-fill');
    const timeDisplay = mediaPlayer.querySelector('.media-time');
    const fullscreenBtn = mediaPlayer.querySelector('.media-fullscreen');
    
    // Play/pause button
    playBtn.addEventListener('click', () => {
      if (mediaElement.paused) {
        mediaElement.play();
        playBtn.querySelector('span').textContent = 'pause';
      } else {
        mediaElement.pause();
        playBtn.querySelector('span').textContent = 'play_arrow';
      }
    });
    
    // Update progress bar
    mediaElement.addEventListener('timeupdate', () => {
      const percent = (mediaElement.currentTime / mediaElement.duration) * 100;
      progressFill.style.width = `${percent}%`;
      
      // Update time display
      const currentTime = formatTime(mediaElement.currentTime);
      const duration = formatTime(mediaElement.duration);
      timeDisplay.textContent = `${currentTime} / ${duration}`;
    });
    
    // Click on progress bar to seek
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      mediaElement.currentTime = pos * mediaElement.duration;
    });
    
    // Fullscreen button (only for video)
    if (mediaPlayer.classList.contains('video-player') && fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (mediaPlayer.classList.contains('fullscreen')) {
          mediaPlayer.classList.remove('fullscreen');
          fullscreenBtn.querySelector('span').textContent = 'fullscreen';
        } else {
          mediaPlayer.classList.add('fullscreen');
          fullscreenBtn.querySelector('span').textContent = 'fullscreen_exit';
        }
      });
    } else if (fullscreenBtn) {
      // Hide fullscreen button for audio
      fullscreenBtn.style.display = 'none';
    }
  }
  
  // Format time in MM:SS format
  function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ...

  // Update UI from settings
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

  // Settings form handlers
  if (toggleAdBlocker) {
    toggleAdBlocker.addEventListener('change', () => {
      window.browserAPI.saveSetting('enableAdBlocker', toggleAdBlocker.checked);
      showNotification(`Ad blocker ${toggleAdBlocker.checked ? 'enabled' : 'disabled'}`);
    });
  }
  
  if (defaultUrl) {
    defaultUrl.addEventListener('change', () => {
      window.browserAPI.saveSetting('defaultURL', defaultUrl.value);
      showNotification('Default URL updated');
    });
  }
  
  if (alwaysShowTabs) {
    alwaysShowTabs.addEventListener('change', () => {
      window.browserAPI.saveSetting('showVerticalTabs', alwaysShowTabs.checked);
      sidebar.classList.toggle('hidden', !alwaysShowTabs.checked);
      showNotification(`Vertical tabs ${alwaysShowTabs.checked ? 'enabled' : 'disabled'}`);
    });
  }
  
  // Handle other checkbox settings
  document.querySelectorAll('.checkbox-item input[type="checkbox"]').forEach(checkbox => {
    if (!checkbox.id || ['toggle-ad-blocker', 'always-show-tabs', 'bookmark-bar-toggle'].includes(checkbox.id)) {
      return; // Skip already handled checkboxes
    }
    
    checkbox.addEventListener('change', () => {
      // Convert kebab-case to camelCase for setting key
      const key = checkbox.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      window.browserAPI.saveSetting(key, checkbox.checked);
      showNotification(`${key} ${checkbox.checked ? 'enabled' : 'disabled'}`);
    });
  });
  
  // Handle selects
  document.querySelectorAll('select').forEach(select => {
    if (!select.id) return;
    
    select.addEventListener('change', () => {
      // Convert kebab-case to camelCase for setting key
      const key = select.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      window.browserAPI.saveSetting(key, select.value);
      showNotification(`${key} set to ${select.value}`);
    });
  });
  
  // Clear browsing data button
  const clearBrowsingDataBtn = document.getElementById('clear-browsing-data-btn');
  if (clearBrowsingDataBtn) {
    clearBrowsingDataBtn.addEventListener('click', async () => {
      await window.browserAPI.clearHistory();
      showNotification('Browsing data cleared');
    });
  }
  
  // Reset adblock stats
  const resetAdblockStatsBtn = document.getElementById('reset-adblock-stats-btn');
  if (resetAdblockStatsBtn) {
    resetAdblockStatsBtn.addEventListener('click', async () => {
      const stats = await window.browserAPI.resetAdBlockStats();
      updateAdBlockStats(stats);
      showNotification('AdBlock statistics reset');
    });
  }

  // Update AdBlock stats UI
  function updateAdBlockStats(stats) {
    if (!stats) return;
    
    adblockStats = stats;
    
    // Update count in sidebar
    if (adsBlockedCount) {
      adsBlockedCount.textContent = stats.adsBlocked.toLocaleString();
    }
    
    // Update stats in settings panel
    if (settingsAdsBlocked) {
      settingsAdsBlocked.textContent = stats.adsBlocked.toLocaleString();
    }
    
    if (settingsTrackersBlocked) {
      settingsTrackersBlocked.textContent = stats.trackersBlocked.toLocaleString();
    }
    
    if (settingsDataSaved) {
      const dataSavedMB = (stats.dataSaved / 1024).toFixed(1);
      settingsDataSaved.textContent = dataSavedMB > 1 ? 
        `${dataSavedMB} MB` : 
        `${stats.dataSaved.toLocaleString()} KB`;
    }
  }
  
  // Theme handling
  if (themeSwitch) {
    const lightTheme = themeSwitch.querySelector('.light-theme');
    const darkTheme = themeSwitch.querySelector('.dark-theme');
    const systemTheme = themeSwitch.querySelector('.system-theme');
    
    if (lightTheme && darkTheme && systemTheme) {
      // Set up initial state based on settings
      const settings = window.browserAPI.getSettings();
      const theme = settings.theme || 'system';
      
      if (theme === 'light') {
        lightTheme.classList.add('active');
      } else if (theme === 'dark') {
        darkTheme.classList.add('active');
      } else {
        systemTheme.classList.add('active');
      }
      
      // Add click handlers
      [lightTheme, darkTheme, systemTheme].forEach(option => {
        option.addEventListener('click', () => {
          // Remove active class from all options
          [lightTheme, darkTheme, systemTheme].forEach(opt => {
            opt.classList.remove('active');
          });
          
          // Add active class to clicked option
          option.classList.add('active');
          
          // Set theme based on clicked option
          let theme;
          if (option === lightTheme) {
            theme = 'light';
            isDarkMode = false;
          } else if (option === darkTheme) {
            theme = 'dark';
            isDarkMode = true;
          } else {
            theme = 'system';
            // Check system preference
            isDarkMode = window.matchMedia && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches;
          }
          
          // Apply theme
          document.body.classList.toggle('dark-theme', isDarkMode);
          
          // Save setting
          window.browserAPI.saveSetting('theme', theme);
          
          // Show notification
          showNotification(`Theme set to ${theme}`);
        });
      });
    }
  }

  // Toggle downloads panel
  function toggleDownloadsPanel(show) {
    if (show === undefined) {
      downloadsVisible = !downloadsVisible;
    } else {
      downloadsVisible = show;
    }
    
    if (downloadsVisible) {
      downloadsPanel.classList.remove('hidden');
      // Hide other panels
      if (settingsVisible) toggleSettingsPanel(false);
      if (historyVisible) toggleHistoryPanel(false);
    } else {
      downloadsPanel.classList.add('hidden');
    }
  }
  
  // Load downloads from main process
  async function loadDownloads() {
    try {
      const downloadData = await window.browserAPI.getDownloads();
      downloads = downloadData.completed || [];
      activeDownloads = downloadData.active || [];
      updateDownloadsList();
    } catch (error) {
      console.error('Failed to load downloads:', error);
    }
  }
  
  // Update downloads list in UI
  function updateDownloadsList() {
    if (!downloadsItemsContainer) return;
    
    // Clear current list
    downloadsItemsContainer.innerHTML = '';
    
    // Show empty state if no downloads
    if (activeDownloads.length === 0 && downloads.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
        <span class="material-icons empty-icon">cloud_download</span>
        <p>No downloads yet</p>
      `;
      downloadsItemsContainer.appendChild(emptyState);
      return;
    }
    
    // Active downloads section
    if (activeDownloads.length > 0) {
      const activeSection = document.createElement('div');
      activeSection.className = 'downloads-section';
      activeSection.innerHTML = '<h3>Active Downloads</h3>';
      downloadsItemsContainer.appendChild(activeSection);
      
      activeDownloads.forEach(download => {
        const downloadItem = createDownloadItem(download, true);
        downloadsItemsContainer.appendChild(downloadItem);
      });
    }
    
    // Completed downloads section
    if (downloads.length > 0) {
      const completedSection = document.createElement('div');
      completedSection.className = 'downloads-section';
      completedSection.innerHTML = '<h3>Completed Downloads</h3>';
      downloadsItemsContainer.appendChild(completedSection);
      
      // Show only the most recent 20 downloads
      const recentDownloads = downloads.slice(0, 20);
      recentDownloads.forEach(download => {
        const downloadItem = createDownloadItem(download, false);
        downloadsItemsContainer.appendChild(downloadItem);
      });
    }
  }
  
  // Create a download item element
  function createDownloadItem(download, isActive) {
    const item = document.createElement('div');
    item.className = 'download-item';
    item.dataset.id = download.id;
    
    // Format file size
    const sizeText = formatFileSize(download.size);
    
    // Format speed if active
    let speedText = '';
    if (isActive && download.status === 'progressing') {
      speedText = formatFileSize(download.speed) + '/s';
    }
    
    // Create status indicator
    let statusIcon = 'cloud_download';
    let statusClass = 'status-in-progress';
    
    if (download.status === 'completed') {
      statusIcon = 'check_circle';
      statusClass = 'status-complete';
    } else if (download.status === 'cancelled' || download.status === 'interrupted') {
      statusIcon = 'error';
      statusClass = 'status-error';
    } else if (download.status === 'paused') {
      statusIcon = 'pause';
      statusClass = 'status-paused';
    }
    
    // Determine file type icon
    let fileIcon = 'insert_drive_file';
    const extension = download.filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      fileIcon = 'image';
    } else if (['mp4', 'webm', 'mov', 'avi'].includes(extension)) {
      fileIcon = 'movie';
    } else if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
      fileIcon = 'music_note';
    } else if (['pdf'].includes(extension)) {
      fileIcon = 'picture_as_pdf';
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      fileIcon = 'description';
    } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
      fileIcon = 'table_chart';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
      fileIcon = 'archive';
    }
    
    // Create layout
    const html = `
      <div class="download-icon">
        <span class="material-icons file-icon">${fileIcon}</span>
      </div>
      <div class="download-details">
        <div class="download-name">${download.filename}</div>
        <div class="download-info">
          ${sizeText} ${speedText ? `• ${speedText}` : ''}
        </div>
        ${isActive && download.status === 'progressing' ? 
          `<div class="download-progress">
            <div class="download-progress-bar" style="width: ${download.progress}%"></div>
          </div>` : ''
        }
      </div>
      <div class="download-status ${statusClass}">
        <span class="material-icons status-icon">${statusIcon}</span>
      </div>
      ${isActive ? 
        `<div class="download-actions">
          ${download.status === 'progressing' ? 
            `<button class="download-action-btn pause-download" title="Pause download">
              <span class="material-icons">pause</span>
            </button>` : 
            download.status === 'paused' ? 
            `<button class="download-action-btn resume-download" title="Resume download">
              <span class="material-icons">play_arrow</span>
            </button>` : ''
          }
          <button class="download-action-btn cancel-download" title="Cancel download">
            <img src="assets/icons/close.svg" class="icon small-icon" alt="Cancel">
          </button>
        </div>` : 
        `<div class="download-actions">
          <button class="download-action-btn open-download" title="Open file">
            <img src="assets/icons/open_in_new.svg" class="icon small-icon" alt="Open">
          </button>
        </div>`
      }
    `;
    
    item.innerHTML = html;
    
    // Add event listeners for download actions
    if (isActive) {
      const pauseBtn = item.querySelector('.pause-download');
      const resumeBtn = item.querySelector('.resume-download');
      const cancelBtn = item.querySelector('.cancel-download');
      
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          window.browserAPI.pauseDownload(download.id);
        });
      }
      
      if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
          window.browserAPI.resumeDownload(download.id);
        });
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          window.browserAPI.cancelDownload(download.id);
        });
      }
    } else {
      const openBtn = item.querySelector('.open-download');
      if (openBtn) {
        openBtn.addEventListener('click', () => {
          window.browserAPI.openDownloadedFile(download.path);
        });
      }
    }
    
    return item;
  }
  
  // Refresh the tabs list from main process
  async function refreshTabs() {
    const allTabs = window.browserAPI.getTabs();
    tabs = allTabs;
    
    tabsContainer.innerHTML = '';
    
    // Find active tab
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab) {
      activeTabId = activeTab.id;
    }
    
    // Create tab elements
    tabs.forEach(tab => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.dataset.id = tab.id;
      
      if (tab.isActive) {
        tabElement.classList.add('active');
      }
      
      // Determine icon based on URL or use favicon if available
      let iconHtml = '';
      if (tab.favicon) {
        iconHtml = `<img src="${tab.favicon}" class="tab-icon" alt="">`;
      } else {
        // Determine icon based on URL
        let iconPath = 'assets/icons/home.svg';
        
        if (tab.url.includes('google.com')) {
          iconPath = 'assets/icons/search.svg';
        } else if (tab.url.includes('github.com')) {
          iconPath = 'assets/icons/code.svg';
        } else if (tab.url.includes('youtube.com')) {
          iconPath = 'assets/icons/video.svg';
        } else if (tab.url.startsWith('file://')) {
          iconPath = 'assets/icons/home.svg';
        }
        
        iconHtml = `<img src="${iconPath}" class="tab-icon" alt="">`;
      }
      
      tabElement.innerHTML = `
        <div class="tab-favicon">
          ${iconHtml}
        </div>
        <div class="tab-title">${tab.title || 'New Tab'}</div>
        <div class="tab-close" title="Close tab">
          <img src="assets/icons/close.svg" class="icon small-icon" alt="Close">
        </div>
      `;
      
      // Add event listeners to the tab
      tabElement.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close')) {
          window.browserAPI.switchTab(tab.id);
        }
      });
      
      const closeBtn = tabElement.querySelector('.tab-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.browserAPI.closeTab(tab.id);
        });
      }
      
      tabsContainer.appendChild(tabElement);
    });
  }
  
  // Format file size in human-readable format
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    if (!bytes) return 'Unknown size';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
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
