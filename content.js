if (!window.__shortcutsListenerAdded) {
  window.__shortcutsListenerAdded = true;

  let lastProcessedTime = 0;
  const DEBOUNCE_MS = 500;

  function handleKeyEvent(event) {
    if (event.defaultPrevented) {
      console.log("Event already handled, skipping");
      return;
    }

    if (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.isContentEditable
    ) {
      console.log("Keypress in input field, ignoring");
      return;
    }

    const key = event.key.toLowerCase();
    const isMacOS = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modifierPressed = isMacOS ? event.metaKey : event.ctrlKey;
    const shiftPressed = event.shiftKey;

    if (modifierPressed && shiftPressed && !event.altKey && key.length === 1) {
      const now = Date.now();
      if (now - lastProcessedTime < DEBOUNCE_MS) {
        console.log(`Debounced shortcut: ${isMacOS ? "⌘+Shift+" : "Ctrl+Shift+"}${key}`);
        return;
      }

      console.log(`Detected shortcut: ${isMacOS ? "⌘+Shift+" : "Ctrl+Shift+"}${key}`);

      chrome.storage.sync.get(null, (data) => {
        if (chrome.runtime.lastError) {
          console.error("Storage error:", chrome.runtime.lastError);
          chrome.runtime.sendMessage({
            type: "debug_log",
            message: `Storage error for key ${key}: ${chrome.runtime.lastError.message}`,
          });
          return;
        }

        if (data[key] && key !== "platformSettings") {
          const shortcut = data[key];
          const url = typeof shortcut === 'string' ? shortcut : shortcut.url;

          if (url) {
            event.preventDefault();
            event.stopImmediatePropagation();
            lastProcessedTime = now;

            chrome.storage.sync.set({ lastShortcutKey: key }, () => {
              if (chrome.runtime.lastError) {
                console.error("Error saving lastShortcutKey:", chrome.runtime.lastError);
                chrome.runtime.sendMessage({
                  type: "debug_log",
                  message: `Error saving lastShortcutKey ${key}: ${chrome.runtime.lastError.message}`,
                });
              }
            });

            console.log("Opening URL via shortcut:", url);
            chrome.runtime.sendMessage({
              type: "open_url",
              url: url,
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Message error:", chrome.runtime.lastError);
                chrome.runtime.sendMessage({
                  type: "debug_log",
                  message: `Message error for URL ${url}: ${chrome.runtime.lastError.message}`,
                });
              }
            });
          } else {
            console.log("No URL found for key:", key);
            chrome.runtime.sendMessage({
              type: "debug_log",
              message: `No URL found for shortcut ${key}`,
            });
          }
        } else {
          console.log("No shortcut defined for key:", key);
          chrome.runtime.sendMessage({
            type: "debug_log",
            message: `No shortcut defined for key ${key}`,
          });
        }
      });
    }
  }

  document.addEventListener('keydown', handleKeyEvent, { capture: true });

  if (navigator.userAgent.includes('Arc')) {
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        console.log("Arc browser: Meta/Control keyup detected");
        chrome.runtime.sendMessage({
          type: "test_platform",
        });
      }
    });
  }
}
