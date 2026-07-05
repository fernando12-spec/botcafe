chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DEVICE_ACTIVE') {
    chrome.storage.local.set({
      activeDevice: {
        type: request.device,
        index: request.index,
        timestamp: Date.now(),
        tabId: sender.tab.id,
        tabTitle: sender.tab.title,
        tabUrl: sender.tab.url
      }
    });
    sendResponse({ success: true });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get('activeDevice', (result) => {
    if (result.activeDevice && result.activeDevice.tabId === tabId) {
      chrome.storage.local.remove('activeDevice');
    }
  });
});
