// background.js - GM助手后台脚本
// 简化版：主要负责快捷键打开面板

let panelWindowId = null;

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
});

function createPanel() {
  chrome.windows.create({
    url: chrome.runtime.getURL('panel.html'),
    type: 'popup',
    width: 400,
    height: 700
  }, win => {
    panelWindowId = win.id;
  });
}

chrome.windows.onRemoved.addListener(function(windowId) {
  if (windowId === panelWindowId) {
    panelWindowId = null;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-panel") {
    if (panelWindowId !== null) {
      chrome.windows.update(panelWindowId, { focused: true }, win => {
        if (chrome.runtime.lastError || !win) {
          createPanel();
        }
      });
    } else {
      createPanel();
    }
  }
});
