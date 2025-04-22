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

    // Get search engine URL
    function getSearchEngineUrl() {
      const searchEngineSelect = document.getElementById('search-engine');
      let searchEngine = 'https://www.google.com/search?q=';
      
      if (searchEngineSelect) {
        const engine = searchEngineSelect.value;
        switch (engine) {
          case 'bing':
            searchEngine = 'https://www.bing.com/search?q=';
            break;
          case 'duckduckgo':
            searchEngine = 'https://duckduckgo.com/?q=';
            break;
          case 'yahoo':
            searchEngine = 'https://search.yahoo.com/search?p=';
            break;
          default:
            searchEngine = 'https://www.google.com/search?q=';
        }
      }
      
      return searchEngine;
    }

    // ...
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

  // Update settings
  async function updateSettings() {
    const settings = {
      adBlocker: toggleAdBlocker && toggleAdBlocker.checked,
      defaultUrl: defaultUrl && defaultUrl.value || 'homepage',
      alwaysShowTabs: alwaysShowTabs && alwaysShowTabs.checked,
      darkMode: isDarkMode,
      showBookmarkBar: bookmarkBarToggle && bookmarkBarToggle.checked
    };
    
    // Update bookmark bar visibility
    const bookmarkBar = document.getElementById('bookmark-bar');
    if (bookmarkBar) {
      if (settings.showBookmarkBar) {
        bookmarkBar.classList.remove('hidden');
      } else {
        bookmarkBar.classList.add('hidden');
      }
    }
    
    await window.browserAPI.saveSettings(settings);
    showNotification('Settings updated', 'success');
  }

  // Toggle dark mode
  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    applyTheme();
    
    // Update theme switch appearance
    if (themeSwitch) {
      themeSwitch.classList.toggle('dark', isDarkMode);
    }
    
    // Save the setting
    updateSettings();
  }

  // Apply theme based on dark mode setting
  function applyTheme() {
    document.body.classList.toggle('dark-theme', isDarkMode);
    
    // Update webviews with appropriate theme
    document.querySelectorAll('webview').forEach(webview => {
      webview.send('theme-changed', { isDarkMode });
    });
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
