
document.addEventListener('DOMContentLoaded', () => {
  const keyInput = document.getElementById('key');
  const urlInput = document.getElementById('url');
  const registerBtn = document.getElementById('register');
  const shortcutsDiv = document.getElementById('shortcuts');
  const messageDiv = document.getElementById('message');
  const isMacCheckbox = document.getElementById('isMac');
  const prefixDisplay = document.getElementById('prefix-display');
  const testBtn = document.getElementById('test-shortcut');
  const debugOutput = document.getElementById('debug-output');
  const platformDetection = document.getElementById('platform-detection');

  let debugLogs = [];

  const registerBtnClickHandler = () => {
    const key = keyInput.value.trim().toLowerCase();
    const url = urlInput.value.trim();
    const isMac = isMacCheckbox.checked;

    if (!key || !url) {
      showMessage('Please enter both key and URL', false);
      return;
    }

    if (key.length !== 1 || !/[a-z0-9]/.test(key)) {
      showMessage('Key must be a single letter or number', false);
      return;
    }

    chrome.runtime.sendMessage({
      type: "register_shortcut",
      payload: { key, url, isMac }
    }, (response) => {
      if (response.success) {
        showMessage('Shortcut registered successfully!', true);
        keyInput.value = '';
        urlInput.value = '';
        loadShortcuts();
      } else {
        showMessage(response.message || 'Error registering shortcut', false);
        debugLogs.push(`Error registering shortcut ${key}: ${response.message || 'Unknown error'}`);
        updateDebugOutput();
      }
    });
  };

  registerBtn.addEventListener('click', registerBtnClickHandler);

  chrome.runtime.sendMessage({ type: "test_platform" }, (response) => {
    const isMac = response.isMac;
    const isArc = response.isArc;
    
    isMacCheckbox.checked = isMac;
    prefixDisplay.textContent = isMac ? '⌘+Shift+' : 'Ctrl+Shift+';
    
    let platformText = `Detected: ${isMac ? 'macOS' : 'Windows/Linux'}`;
    if (isArc) platformText += ' (Arc Browser)';
    platformDetection.textContent = platformText;
    
    if (isArc) {
      debugLogs.push('Arc browser detected - using enhanced shortcut handling');
      updateDebugOutput();
    }
  });

  isMacCheckbox.addEventListener('change', () => {
    prefixDisplay.textContent = isMacCheckbox.checked ? '⌘+Shift+' : 'Ctrl+Shift+';
  });

  testBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: "test_platform" }, (response) => {
      debugLogs.push(`
        Platform Test Results:
        - macOS: ${response.isMac ? 'Yes' : 'No'}
        - Arc Browser: ${response.isArc ? 'Yes' : 'No'}
        - User Agent: ${navigator.userAgent.substring(0, 50)}...
      `);
      updateDebugOutput();
    });
  });

  function loadShortcuts() {
    chrome.runtime.sendMessage({ type: "get_shortcuts" }, (data) => {
      if (data.error) {
        debugLogs.push(`Error loading shortcuts: ${data.error}`);
        updateDebugOutput();
        return;
      }

      shortcutsDiv.innerHTML = '';
      
      Object.keys(data).forEach(key => {
        if (key === 'platformSettings' || key === 'lastShortcutKey') return;
        
        const shortcut = data[key];
        const url = typeof shortcut === 'string' ? shortcut : shortcut.url;
        const isMac = typeof shortcut === 'string' ? false : (shortcut.isMac || false);
        
        const shortcutDiv = document.createElement('div');
        shortcutDiv.className = 'shortcut';
        shortcutDiv.innerHTML = `
          <div>
            <strong>Shortcut:</strong> 
            <span class="key-display">${isMac ? '⌘' : 'Ctrl'}+Shift+${key.toUpperCase()}</span>
          </div>
          <div><strong>URL:</strong> <a href="${url}" target="_blank">${url}</a></div>
          <div class="shortcut-actions">
            <button class="edit-btn" data-key="${key}">Edit</button>
            <button class="delete-btn" data-key="${key}">Delete</button>
          </div>
        `;
        
        shortcutsDiv.appendChild(shortcutDiv);
      });

      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const key = e.target.dataset.key;
          editShortcut(key);
        });
      });

      document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const key = e.target.dataset.key;
          deleteShortcut(key);
        });
      });
    });
  }

  function editShortcut(oldKey) {
    chrome.runtime.sendMessage({ type: "get_shortcuts" }, (data) => {
      if (data.error) {
        debugLogs.push(`Error fetching shortcut ${oldKey}: ${data.error}`);
        updateDebugOutput();
        return;
      }

      const shortcut = data[oldKey];
      const url = typeof shortcut === 'string' ? shortcut : shortcut.url;
      const isMac = typeof shortcut === 'string' ? false : (shortcut.isMac || false);
      
      keyInput.value = oldKey;
      urlInput.value = url;
      isMacCheckbox.checked = isMac;
      prefixDisplay.textContent = isMac ? '⌘+Shift+' : 'Ctrl+Shift+';
      
      const editHandler = () => {
        const newKey = keyInput.value.trim().toLowerCase();
        const newUrl = urlInput.value.trim();
        const newIsMac = isMacCheckbox.checked;

        if (!newKey || !newUrl) {
          showMessage('Please enter both key and URL', false);
          return;
        }

        chrome.runtime.sendMessage({
          type: "edit_shortcut",
          payload: { oldKey, newKey, url: newUrl, isMac: newIsMac }
        }, (response) => {
          if (response.success) {
            showMessage('Shortcut updated successfully!', true);
            keyInput.value = '';
            urlInput.value = '';
            registerBtn.textContent = 'Register Shortcut';
            registerBtn.onclick = registerBtnClickHandler;
            loadShortcuts();
          } else {
            showMessage(response.message || 'Error updating shortcut', false);
            debugLogs.push(`Error updating shortcut ${oldKey} to ${newKey}: ${response.message || 'Unknown error'}`);
            updateDebugOutput();
          }
        });
      };

      registerBtn.textContent = 'Update Shortcut';
      registerBtn.onclick = editHandler;
    });
  }

  function deleteShortcut(key) {
    if (confirm(`Are you sure you want to delete the shortcut ${key}?`)) {
      chrome.runtime.sendMessage({
        type: "delete_shortcut",
        payload: { key }
      }, (response) => {
        if (response.success) {
          showMessage('Shortcut deleted successfully!', true);
          loadShortcuts();
        } else {
          showMessage('Error deleting shortcut', false);
          debugLogs.push(`Error deleting shortcut ${key}: ${response.message || 'Unknown error'}`);
          updateDebugOutput();
        }
      });
    }
  }

  function showMessage(msg, isSuccess) {
    messageDiv.textContent = msg;
    messageDiv.className = isSuccess ? 'success' : '';
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.className = '';
    }, 3000);
  }

  function updateDebugOutput() {
    debugOutput.innerHTML = debugLogs.join('<br>');
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "debug_log") {
      debugLogs.push(request.message);
      updateDebugOutput();
      sendResponse({ success: true });
    }
  });

  loadShortcuts();
});
