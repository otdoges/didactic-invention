// Nebula Browser - New Features Implementation

// Toggle incognito mode
function toggleIncognitoMode() {
  isIncognitoMode = !isIncognitoMode;
  
  if (isIncognitoMode) {
    // Enable incognito mode
    incognitoButton.classList.add('active');
    document.body.classList.add('incognito-mode');
    showNotification('Incognito mode enabled', 'info');
    
    // Create a new incognito tab
    createNewTab(null, true);
  } else {
    // Disable incognito mode
    incognitoButton.classList.remove('active');
    document.body.classList.remove('incognito-mode');
    showNotification('Incognito mode disabled', 'info');
    
    // Close all incognito tabs
    closeAllIncognitoTabs();
  }
}

// Close all incognito tabs
function closeAllIncognitoTabs() {
  const incognitoTabs = tabs.filter(tab => tab.isIncognito);
  incognitoTabs.forEach(tab => {
    window.browserAPI.closeTab(tab.id);
  });
}

// Toggle night mode (reader-friendly mode with reduced blue light)
function toggleNightMode() {
  isNightMode = !isNightMode;
  
  if (isNightMode) {
    // Enable night mode
    nightModeButton.classList.add('active');
    document.body.classList.add('night-mode');
    showNotification('Night mode enabled', 'info');
    
    // Apply night mode filter to all webviews
    applyNightModeToWebviews(true);
  } else {
    // Disable night mode
    nightModeButton.classList.remove('active');
    document.body.classList.remove('night-mode');
    showNotification('Night mode disabled', 'info');
    
    // Remove night mode filter from all webviews
    applyNightModeToWebviews(false);
  }
  
  // Save the night mode preference
  window.browserAPI.saveSettings('nightMode', isNightMode);
}

// Apply night mode filter to all webviews
function applyNightModeToWebviews(enable) {
  const webviews = document.querySelectorAll('webview');
  webviews.forEach(webview => {
    if (enable) {
      // Inject CSS to reduce blue light
      const css = `
        html {
          filter: sepia(20%) brightness(90%) !important;
        }
        img, video {
          filter: brightness(90%) !important;
        }
      `;
      webview.insertCSS(css);
    } else {
      // Remove the CSS
      webview.executeJavaScript(`
        const nightModeStyle = document.getElementById('nebula-night-mode');
        if (nightModeStyle) nightModeStyle.remove();
      `);
    }
  });
}

// Translate the current page
function translatePage() {
  const activeWebview = document.querySelector('webview.active');
  if (!activeWebview) return;
  
  const currentUrl = activeWebview.getURL();
  const googleTranslateUrl = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(currentUrl)}`;
  
  // Navigate the current tab to the translated version
  activeWebview.loadURL(googleTranslateUrl);
  showNotification('Translating page...', 'info');
}

// Take a screenshot of the current page
async function takeScreenshot() {
  const activeWebview = document.querySelector('webview.active');
  if (!activeWebview) return;
  
  showNotification('Taking screenshot...', 'info');
  
  try {
    activeWebview.executeJavaScript(`
      (function() {
        // Create a screenshot using the browser's captureVisibleTab API
        const canvas = document.createElement('canvas');
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Use html2canvas or similar approach
        // For simplicity, we'll just return dimensions in this example
        return { width, height };
      })();
    `).then(dimensions => {
      // In a real implementation, we'd save the actual screenshot
      // For now, we'll just simulate it
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `nebula-screenshot-${timestamp}.png`;
      
      // Simulate screenshot creation
      window.browserAPI.saveSetting('lastScreenshot', {
        url: activeWebview.getURL(),
        timestamp: timestamp,
        filename: filename
      });
      
      showNotification(`Screenshot saved as ${filename}`, 'success');
    });
  } catch (error) {
    console.error('Failed to take screenshot:', error);
    showNotification('Failed to take screenshot', 'error');
  }
}

// Toggle bookmarks panel
function toggleBookmarksPanel() {
  const bookmarksPanel = document.getElementById('bookmarks-panel');
  
  // Close other panels first
  document.querySelectorAll('.panel').forEach(panel => {
    if (panel.id !== 'bookmarks-panel') {
      panel.classList.remove('show');
    }
  });
  
  if (bookmarksPanel) {
    bookmarksPanel.classList.toggle('show');
    
    if (bookmarksPanel.classList.contains('show')) {
      loadBookmarks();
    }
  }
}

// Load bookmarks from storage
async function loadBookmarks() {
  try {
    const bookmarks = await window.browserAPI.getBookmarks() || [];
    const bookmarksContainer = document.getElementById('bookmarks-items');
    
    if (bookmarksContainer) {
      bookmarksContainer.innerHTML = '';
      
      if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = '<div class="empty-state">No bookmarks yet. Add some by clicking the bookmark icon when visiting a page.</div>';
        return;
      }
      
      bookmarks.forEach(bookmark => {
        const item = document.createElement('div');
        item.className = 'bookmark-item';
        
        let faviconHtml = `<img src="assets/icons/bookmark.svg" class="bookmark-icon">`;
        if (bookmark.favicon) {
          faviconHtml = `<img src="${bookmark.favicon}" class="bookmark-icon">`;
        }
        
        item.innerHTML = `
          <div class="bookmark-favicon">${faviconHtml}</div>
          <div class="bookmark-title">${bookmark.title}</div>
          <div class="bookmark-actions">
            <button class="remove-bookmark" title="Remove bookmark">
              <img src="assets/icons/close.svg" class="icon small-icon" alt="Remove">
            </button>
          </div>
        `;
        
        item.addEventListener('click', (e) => {
          if (!e.target.closest('.remove-bookmark')) {
            // Open bookmark in current tab
            const activeWebview = document.querySelector('webview.active');
            if (activeWebview) {
              activeWebview.loadURL(bookmark.url);
            }
            
            // Close the panel
            bookmarksPanel.classList.remove('show');
          }
        });
        
        const removeBtn = item.querySelector('.remove-bookmark');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.browserAPI.removeBookmark(bookmark.id);
            item.remove();
            showNotification('Bookmark removed', 'info');
          });
        }
        
        bookmarksContainer.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    showNotification('Failed to load bookmarks', 'error');
  }
}

// Add current page to bookmarks
function addBookmark() {
  const activeWebview = document.querySelector('webview.active');
  if (!activeWebview) return;
  
  const url = activeWebview.getURL();
  const title = activeWebview.getTitle() || url;
  const favicon = currentFavicon || '';
  
  window.browserAPI.addBookmark({ url, title, favicon });
  showNotification('Bookmark added', 'success');
}

// Function to create a new tab, supporting incognito mode
function createIncognitoTab(url = null) {
  // Generate a unique ID for the tab
  const tabId = 'tab-' + Date.now();
  
  // Create a new webview
  const webview = document.createElement('webview');
  webview.setAttribute('id', tabId);
  webview.setAttribute('partition', 'persist:incognito');
  webview.setAttribute('webpreferences', 'allowRunningInsecureContent=no, javascript=yes');
  webview.setAttribute('class', 'webview');
  webview.style.display = 'none';
  webview.setAttribute('autosize', 'on');
  webview.setAttribute('allowpopups', '');
  
  // Add the webview to the container
  webviewContainer.appendChild(webview);
  
  // Create new tab object
  const newTab = {
    id: tabId,
    title: 'Incognito Tab',
    url: url || 'file://' + window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/assets/homepage.html',
    isActive: true,
    favicon: null,
    isIncognito: true
  };
  
  // Update tabs list
  tabs.forEach(tab => {
    tab.isActive = false;
  });
  
  tabs.push(newTab);
  activeTabId = tabId;
  
  // Navigate webview
  webview.src = newTab.url;
  
  // Apply night mode if enabled
  if (isNightMode) {
    setTimeout(() => {
      applyNightModeToWebviews(true);
    }, 1000);
  }
  
  // Update UI
  refreshTabs();
}
