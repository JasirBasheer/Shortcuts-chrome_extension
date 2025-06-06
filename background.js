chrome.runtime.onInstalled.addListener(() => {
  console.log("ShortCuts Extension installed");

  chrome.storage.sync.get(null, (data) => {
    if (Object.keys(data).length === 0) {
      const defaultShortcuts = {
        m: {
          url: "https://example.com",
          isMac: true,
        },
        platformSettings: {
          defaultIsMac: /Mac|iPod|iPhone|iPad/.test(navigator.platform),
        },
      };
      chrome.storage.sync.set(defaultShortcuts);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "get_shortcuts") {
    chrome.storage.sync.get(null, (data) => {
      if (chrome.runtime.lastError) {
        console.error("Error fetching shortcuts:", chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse(data);
      }
    });
    return true;
  }

  if (request.type === "register_shortcut") {
    const { key, url, isMac } = request.payload;
    chrome.storage.sync.get(null, (data) => {
      if (data[key]) {
        sendResponse({ success: false, message: "Shortcut key already exists!" });
      } else {
        chrome.storage.sync.set(
          {
            [key]: { url, isMac },
            lastShortcutKey: key,
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Error registering shortcut:", chrome.runtime.lastError);
              sendResponse({ success: false, message: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          }
        );
      }
    });
    return true;
  }

  if (request.type === "edit_shortcut") {
    const { oldKey, newKey, url, isMac } = request.payload;
    chrome.storage.sync.get(['lastShortcutKey'], (result) => {
      chrome.storage.sync.get(null, (data) => {
        if (oldKey !== newKey && data[newKey]) {
          sendResponse({ success: false, message: "New shortcut key already exists!" });
        } else {
          chrome.storage.sync.remove(oldKey, () => {
            const updates = {
              [newKey]: { url, isMac },
            };

            if (result.lastShortcutKey === oldKey) {
              updates.lastShortcutKey = newKey;
            }

            chrome.storage.sync.set(updates, () => {
              if (chrome.runtime.lastError) {
                console.error("Error editing shortcut:", chrome.runtime.lastError);
                sendResponse({ success: false, message: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            });
          });
        }
      });
    });
    return true;
  }

  if (request.type === "delete_shortcut") {
    const { key } = request.payload;
    chrome.storage.sync.get(['lastShortcutKey'], (result) => {
      chrome.storage.sync.remove(key, () => {
        const updates = {};
        if (result.lastShortcutKey === key) {
          updates.lastShortcutKey = null;
        }

        if (Object.keys(updates).length > 0) {
          chrome.storage.sync.set(updates);
        }

        if (chrome.runtime.lastError) {
          console.error("Error deleting shortcut:", chrome.runtime.lastError);
          sendResponse({ success: false, message: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    });
    return true;
  }

  if (request.type === "open_url") {
    openUrl(request.url);
    sendResponse({ success: true });
    return true;
  }

  if (request.type === "test_platform") {
    sendResponse({
      isMac: /Mac|iPod|iPhone|iPad/.test(navigator.platform),
      isArc: navigator.userAgent.includes('Arc'),
    });
    return true;
  }

  if (request.type === "debug_log") {
    console.log("Debug from content script:", request.message);
    sendResponse({ success: true });
    return true;
  }
});

function openUrl(url) {
  if (!url) {
    console.error("No URL provided");
    return;
  }

  if (!url.startsWith('http') && !url.startsWith('chrome://') && !url.startsWith('arc://')) {
    url = 'https://' + url;
  }

  console.log("Opening URL:", url);
  chrome.tabs.create({ url: url, active: true }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error opening URL:", chrome.runtime.lastError);
    }
  });
}