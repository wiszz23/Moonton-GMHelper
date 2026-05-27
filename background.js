// background.js - GM助手后台脚本

let panelWindowId = null;
let updateDownloadUrl = null; // 有新版本时存储下载地址

// 点击扩展图标：有更新则下载，无更新则打开面板
chrome.action.onClicked.addListener((tab) => {
  if (updateDownloadUrl) {
    chrome.tabs.create({ url: updateDownloadUrl });
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('panel.html') });
  }
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

// ---------- 自动更新检查 ----------
const UPDATE_URL = 'https://wiszz23.github.io/Moonton-GMHelper/updates.json';

function compareVersion(v1, v2) {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const na = a[i] || 0;
    const nb = b[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function checkUpdate() {
  fetch(UPDATE_URL + '?t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      const latest = data.version;
      const current = chrome.runtime.getManifest().version;
      if (compareVersion(latest, current) > 0) {
        updateDownloadUrl = data.downloadUrl;
        chrome.action.setBadgeText({ text: 'NEW' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF5722' });
      } else {
        updateDownloadUrl = null;
        chrome.action.setBadgeText({ text: '' });
      }
    })
    .catch(() => {});
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'gm-update-check') checkUpdate();
});

chrome.alarms.create('gm-update-check', { periodInMinutes: 60 });
checkUpdate();
