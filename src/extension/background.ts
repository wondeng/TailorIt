function canMessageUrl(url?: string) {
  if (!url) return false;
  return (
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("https://chrome.google.com/webstore")
  );
}

async function sendExtractJD(tabId: number) {
  // Try to message first
  chrome.tabs.sendMessage(tabId, { type: "EXTRACT_JD" }, async () => {
    // If no listener, inject then try again
    if (chrome.runtime.lastError) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["contentScript.js"]
        });

        chrome.tabs.sendMessage(tabId, { type: "EXTRACT_JD" });
      } catch (e) {
        console.error("Failed to inject content script:", e);
      }
    }
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !canMessageUrl(tab.url)) return;

  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }

  await sendExtractJD(tab.id);
});

// forward extracted JD to sidepanel
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg?.type === "JD_EXTRACTED") chrome.runtime.sendMessage(msg);
});
