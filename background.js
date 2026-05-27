// background.js - GM助手后台脚本

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
  console.log('[GM] 开始检查更新...');
  fetch(UPDATE_URL + '?t=' + Date.now())
    .then(r => r.json())
    .then(data => {
      console.log('[GM] 服务器版本:', data.version);
      const latest = data.version;
      const current = chrome.runtime.getManifest().version;
      console.log('[GM] 当前版本:', current, '最新版本:', latest, '对比:', compareVersion(latest, current));
      if (compareVersion(latest, current) > 0) {
        chrome.notifications.create('gm-update', {
          type: 'basic',
          iconUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="%234caf50"/></svg>',
          title: 'GM助手 - 发现新版本',
          message: `发现新版本 v${latest}，当前版本 v${current}\n点击下载更新`,
          priority: 2
        }, id => {
          if (chrome.runtime.lastError) return;
          chrome.notifications.onClicked.addListener(function handler(notifId) {
            if (notifId === id) {
              chrome.tabs.create({ url: data.downloadUrl });
              chrome.notifications.onClicked.removeListener(handler);
            }
          });
        });
      }
    })
    .catch(() => {});
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'gm-update-check') checkUpdate();
});

chrome.alarms.create('gm-update-check', { periodInMinutes: 60 });

// 启动时立即检查一次
checkUpdate();
