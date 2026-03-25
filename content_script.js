// content_script.js
(function() {
  // 不再直接 return，允许 init() 进来处理最小化残留情况

  const STORAGE_KEY = 'gm_whitelist';

  // ====== GM 页面内容脚本：读取用户名后写入 chrome.storage.local ======
  const userInfo = readUserInfo();
  if (userInfo && userInfo.length > 0) {
    const rawName = userInfo[0].text;
    chrome.storage.local.set({ gm_user_name: rawName });
  }

  // ============================================================
  // 读取 GM 页面右上角用户信息
  // ============================================================
  function readUserInfo() {
    try {
      const selectors = [
      '.el-dropdown-menu__item',
      '.el-dropdown .el-dropdown-link',
      '.el-dropdown-selfdefine',
      '.user-info',
      '.user-name',
      '.header-user',
      '.nav-user',
      '[class*="user"]',
      '[class*="user-name"]',
      '[class*="userInfo"]',
      '.el-avatar + *',
      'img.el-avatar + *',
      '[title]',
      ];

    const results = [];

    selectors.forEach(sel => {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 0 && el.textContent.trim().length < 50) {
          results.push({ sel, text: el.textContent.trim(), tag: el.tagName.toLowerCase() });
        }
      } catch(e) {}
    });

    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      const names = [];
      let node;
      while (node = walker.nextNode()) {
        const t = node.textContent.trim();
        if (t.length > 2 && t.length < 60 && t.includes('(') && /[\u4e00-\u9fa5]/.test(t)) {
          names.push(t);
        }
      }
      if (names.length > 0) {
        results.push({ sel: 'treeWalker-scan', text: names.slice(0, 5).join(' | '), tag: 'text' });
      }
    } catch(e) {}

    return results;
    } catch(e) {
      console.error('[GM助手] readUserInfo执行出错:', e);
    }
  }

  // 默认域名白名单（备用）
  const DEFAULT_WHITELIST_HOSTS = [
    'gm.pre.nova.moonton.com',
    'gm.nova.oa.mt',
    'gm-cn.yyf.muyinetwork.com',
    'gm.jp.novagames.net',
    'gm.usa.novagames.net'
  ];

  // 从 URL 列表中提取 hostname
  function extractHosts(urlText) {
    if (!urlText) return [];
    const hosts = [];
    urlText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        // 优先尝试作为完整 URL 解析
        hosts.push(new URL(trimmed).hostname);
      } catch {
        // 解析失败 → 当作裸 hostname（去掉末尾的 / 后直接用）
        const bare = trimmed.replace(/\/+$/, '');
        if (bare) hosts.push(bare);
      }
    });
    return hosts;
  }

  // 检查当前 hostname 是否在白名单内（双向模糊匹配，支持子域名）
  function isGmPage(hosts) {
    const currentHost = window.location.hostname.toLowerCase();
    return hosts.some(h => {
      const hLower = h.toLowerCase();
      // 完全相等 / 当前页面包含白名单 / 白名单包含当前页面（支持子域名）
      return currentHost === hLower ||
             currentHost.includes(hLower) ||
             hLower.includes(currentHost);
    });
  }

  // 初始化：先读 storage，动态决定是否显示面板
  function init() {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const savedText = result[STORAGE_KEY];
      const hosts = savedText ? extractHosts(savedText) : DEFAULT_WHITELIST_HOSTS;
      if (!isGmPage(hosts)) {
        setupStorageWatcher();
        return;
      }

      // 面板已存在：跳过，不重复创建
      const existingContainer = document.getElementById('my-plugin-panel-container');
      if (existingContainer) {
        setupStorageWatcher();
        return;
      }

      createPanel(hosts);
      setupStorageWatcher();
    });
  }

  // 监听 storage 变化，实时更新白名单（确保只注册一次）
  let storageWatcherRegistered = false;
  function setupStorageWatcher() {
    if (storageWatcherRegistered) return;
    storageWatcherRegistered = true;
    chrome.storage.onChanged.addListener((changes) => {
      if (!changes[STORAGE_KEY]) return;
      const newText = changes[STORAGE_KEY].newValue;
      const newHosts = newText ? extractHosts(newText) : DEFAULT_WHITELIST_HOSTS;
      console.log('[GM助手] whitelist 变化，新白名单:', newHosts);

      if (isGmPage(newHosts)) {
        const existing = document.getElementById('my-plugin-panel-container');
        if (!existing) {
          console.log('[GM助手] 显示面板');
          createPanel(newHosts);
        }
      } else {
        const existing = document.getElementById('my-plugin-panel-container');
        if (existing) existing.remove();
      }
    });
  }

  // ============================================================
  // 创建悬浮窗容器
  // ============================================================
  function createPanel(hosts) {
    console.log('[GM助手] createPanel() 开始执行');
    // 读取用户信息并打日志
    readUserInfo();

    const PANEL_WIDTH = 380;
    const TOP_OFFSET = 38;
    const CTRL_HEIGHT = 32;
    // 最小容器高度（仅展示控制区，不填满视口）
    const MIN_CONTAINER_H = 240;
    const MIN_IFRAME_H = MIN_CONTAINER_H - CTRL_HEIGHT; // 118px
    // 最大不能超出视口
    const MAX_CONTAINER_H = window.innerHeight - TOP_OFFSET;
    // 初始高度：自适应，由 iframe 内容决定
    const INIT_CONTAINER_H = MIN_CONTAINER_H;

    const panelContainer = document.createElement('div');
    panelContainer.id = 'my-plugin-panel-container';
    panelContainer.style.cssText = [
      'position: fixed',
      'top: ' + TOP_OFFSET + 'px',
      'left: auto',
      'right: 20px',
      'width: ' + PANEL_WIDTH + 'px',
      'min-width: ' + PANEL_WIDTH + 'px',
      'max-width: ' + PANEL_WIDTH + 'px',
      'min-height: ' + MIN_CONTAINER_H + 'px',
      'max-height: ' + MAX_CONTAINER_H + 'px',
      'height: ' + INIT_CONTAINER_H + 'px',
      'z-index: 999999',
      'border: 1px solid #ccc',
      'background: #fff',
      'border-radius: 0 0 8px 8px',
      'box-shadow: 0 2px 12px rgba(0,0,0,0.2)',
      'overflow: hidden',
      'display: block',
      'transition: height 0.25s ease',
      'box-sizing: border-box'
    ].join(';');

    // 控制栏
    const controlBar = document.createElement('div');
    controlBar.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 32px;
      background: #1a1a2e;
      border-radius: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
      gap: 2px;
      cursor: move;
      z-index: 3;
      overflow: hidden;
      user-select: none;
    `;

    // 标题
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'GM助手';
    titleSpan.style.cssText = `
      flex: 1;
      color: #e8eaf6;
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0.5px;
    `;
    controlBar.appendChild(titleSpan);

    // 刷新按钮
    const reloadBtn = document.createElement('button');
    reloadBtn.innerHTML = '&#8635;';
    reloadBtn.title = '重新加载命令';
    reloadBtn.style.cssText = `
      width: 24px; height: 24px; border: none;
      background: transparent; color: #aaa;
      border-radius: 4px; cursor: pointer;
      font-size: 15px; display: flex;
      align-items: center; justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    `;
    reloadBtn.addEventListener('click', () => {
      // 先清空 src 强制释放，再重新赋值，确保重新加载最新资源
      panel.src = '';
      setTimeout(() => {
        panel.src = chrome.runtime.getURL('panel.html?t=' + Date.now());
        reloadBtn.style.color = '#4caf50';
        setTimeout(() => { reloadBtn.style.color = '#aaa'; }, 800);
      }, 50);
    });
    reloadBtn.addEventListener('mouseover', () => { reloadBtn.style.color = '#fff'; });
    reloadBtn.addEventListener('mouseout', () => { reloadBtn.style.color = '#aaa'; });

    // 最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style.cssText = `
      width: 24px; height: 24px; border: none;
      background: transparent; color: #aaa;
      border-radius: 4px; cursor: pointer;
      font-size: 16px; display: flex;
      align-items: center; justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    `;
    minimizeBtn.addEventListener('mouseover', () => { minimizeBtn.style.color = '#fff'; });
    minimizeBtn.addEventListener('mouseout', () => { minimizeBtn.style.color = '#aaa'; });

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      width: 24px; height: 24px; border: none;
      background: transparent; color: #aaa;
      border-radius: 4px; cursor: pointer;
      font-size: 18px; display: flex;
      align-items: center; justify-content: center;
      transition: all 0.15s;
      flex-shrink: 0;
    `;
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.color = '#fff'; closeBtn.style.background = '#f44336'; });
    closeBtn.addEventListener('mouseout', () => { closeBtn.style.color = '#aaa'; closeBtn.style.background = 'transparent'; });

    controlBar.appendChild(reloadBtn);
    controlBar.appendChild(minimizeBtn);
    controlBar.appendChild(closeBtn);

    // iframe（初始设合理值，由父窗口在 load 时读取真实高度）
    const INIT_IFRAME_H = 600;
    const panel = document.createElement('iframe');
    panel.id = 'my-plugin-panel';
    panel.src = chrome.runtime.getURL('panel.html');
    panel.style.cssText = [
      'position: absolute',
      'top: ' + CTRL_HEIGHT + 'px',
      'left: 0',
      'width: ' + PANEL_WIDTH + 'px',
      'min-width: ' + PANEL_WIDTH + 'px',
      'max-width: ' + PANEL_WIDTH + 'px',
      'height: ' + INIT_IFRAME_H + 'px',
      'border: none',
      'background: #ffffff',
      'z-index: 1',
      'box-sizing: border-box',
      'display: block'
    ].join(';');

    panelContainer.appendChild(controlBar);
    panelContainer.appendChild(panel);
    document.body.appendChild(panelContainer);

    // ---- 拖拽（绑定在容器上，整条顶部条都能拖拽） ----
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    panelContainer.addEventListener('mousedown', (e) => {
      // 点的是按钮 → 不拖拽，让按钮响应
      if (e.target.closest('button')) return;
      // 点的是控制栏区域 → 拖拽
      const rect = panelContainer.getBoundingClientRect();
      const inTitleBar = e.clientY >= rect.top && e.clientY <= rect.top + 32;
      if (inTitleBar) {
        isDragging = true;
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const maxX = window.innerWidth - PANEL_WIDTH;
      const maxY = window.innerHeight - TOP_OFFSET;
      const x = Math.max(0, Math.min(e.clientX - dragOffset.x, maxX));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.y, maxY));
      panelContainer.style.left = x + 'px';
      panelContainer.style.top = y + 'px';
      panelContainer.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });

    // ---- 最小化：隐藏面板，显示悬浮展开按钮 ----
    let expandBtn = null;
    minimizeBtn.addEventListener('click', () => {
      panelContainer.style.display = 'none';
      // 创建悬浮展开按钮
      expandBtn = document.createElement('button');
      expandBtn.id = 'my-expand-btn';
      expandBtn.textContent = '☰';
      expandBtn.title = '展开 GM助手';
      expandBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        background: linear-gradient(135deg, #1a1a2e 0%, #2e2e5e 100%);
        color: #e8eaf6;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 2px 12px rgba(0,0,0,0.35);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      `;
      expandBtn.addEventListener('mouseover', () => {
        expandBtn.style.background = 'linear-gradient(135deg, #2e2e5e 0%, #4a4a8e 100%)';
        expandBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.45)';
      });
      expandBtn.addEventListener('mouseout', () => {
        expandBtn.style.background = 'linear-gradient(135deg, #1a1a2e 0%, #2e2e5e 100%)';
        expandBtn.style.boxShadow = '0 2px 12px rgba(0,0,0,0.35)';
      });
      expandBtn.addEventListener('click', () => {
        panelContainer.style.display = 'block';
        expandBtn.remove();
        expandBtn = null;
      });
      document.body.appendChild(expandBtn);
    });

    controlBar.addEventListener('dblclick', () => { panelContainer.remove(); });

    // ---- 关闭 ----
    closeBtn.addEventListener('click', () => {
      panelContainer.remove();
      if (expandBtn) { expandBtn.remove(); expandBtn = null; }
    });

    // iframe 内容变化时（搜索/历史切换），通知父窗口重新测量
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      if (data.type === 'CLOSE_MY_PLUGIN_PANEL') {
        panelContainer.remove();
        if (expandBtn) { expandBtn.remove(); expandBtn = null; }
        return;
      }
      if (data.type === 'GM_PANEL_HEIGHT') {
        // 接收 iframe 上报的真实内容高度，加上控制栏，限制不超过视口
        const rawH = data.height || 0;
        if (rawH <= 0) return; // 内容未加载时忽略
        const targetH = Math.min(rawH + CTRL_HEIGHT, MAX_CONTAINER_H);
        panelContainer.style.height = targetH + 'px';
        panel.style.height = (targetH - CTRL_HEIGHT) + 'px';
        return;
      }
    });

    // ---- Esc 关闭 ----
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('my-plugin-panel-container')) {
        panelContainer.remove();
        if (expandBtn) { expandBtn.remove(); expandBtn = null; }
      }
    });
  }

  // 启动
  init();
})();
