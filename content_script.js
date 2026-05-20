// content_script.js
(function() {
  const STORAGE_KEY = 'gm_whitelist';

  // 写入当前域名（同步可用）
  chrome.storage.local.set({ gm_current_domain: window.location.hostname });

  // ============================================================
  // 读取 GM 页面右上角用户信息
  // ============================================================

  // 已知的错误匹配值，直接排除
  const KNOWN_BAD_TEXTS = new Set([
    '性能概况', 'undefined', 'null', '登录', '注册',
    '退出', 'logout', 'sign out', '设置', 'settings',
    '个人中心', '用户中心', '我的', '首页', '帮助',
    // 新增：构建/版本信息
    'Build #', '最近一次构建(', '构建', 'Build',
    // 新增：语言设置
    '中文(简体)', '中文(繁体)', '简体中文', '繁體中文', 'English',
    // 新增：测试用例
    '[TC-', 'TC-',
    // 新增：监控/性能
    '性能概况', 'ABS(', '移动设备(', '长期服务基线(',
    // 新增：时间戳格式
    '最近一次构建(', '#', '年月日',
    // 新增：功能菜单（过长文本）
    '交换源语言和目标语言', '发送时间开始计算', '有初值(包含任意)',
    // 新增：其他常见错误
    '全部任务', '任务', 'menu', 'Menu',
  ]);

  // 正则黑名单（用于检测特定模式）
  const KNOWN_BAD_PATTERNS = [
    /^Build\s*#/,                        // Build #1722
    /^#\d+\s*\(/,                        // #3 (2026年4月5日...)
    /^\[TC-\d+\]/,                       // [TC-04] ...
    /^最近一次构建\(#?\d+\)/,             // 最近一次构建(#305)...
    /^\d{4}年\d+月\d+日/,                 // 2026年4月5日
    /^中文|^繁體/,                        // 语言开头
    /^交换|^天后|^发送/,                  // 功能菜单
    /^(有初值|包含任意)/,                 // 查询条件
    /^(移动设备|长期服务)/,               // 系统信息
    /ABS\(|性能概况/,                    // 监控图表
    /^(全部任务|任务)/,                   // 任务相关
  ];

  // 获取元素向上 N 层的路径描述（用于日志定位）
  function getParentChain(el, depth) {
    const parts = [];
    let cur = el;
    for (let i = 0; i < depth && cur; i++) {
      const tag = cur.tagName || '';
      const cls  = cur.className && typeof cur.className === 'string'
                     ? '.' + cur.className.split(' ').slice(0, 2).join('.') : '';
      const id   = cur.id ? '#' + cur.id : '';
      parts.unshift(tag + cls + id);
      cur = cur.parentElement;
    }
    return parts.join(' → ');
  }

  // 判断文本是否像真实的"用户名(账号)"格式
  function looksLikeUsername(text) {
    const t = text.trim();

    // 1. 排除管道符（多选合并）
    if (t.includes('|')) return false;

    // 2. 排除换行符
    if (t.includes('\n')) return false;

    // 3. 排除正则黑名单匹配
    for (const pattern of KNOWN_BAD_PATTERNS) {
      if (pattern.test(t)) return false;
    }

    // 4. 典型格式：中文名(英文账号) 如 "封庆扬(Wis)"
    if (/^[\u4e00-\u9fa5]+[\u4e00-\u9fa5_a-zA-Z0-9]*\([a-zA-Z][a-zA-Z0-9_]*\)$/.test(t)) {
      return true;
    }

    // 5. 纯英文账号 如 "Wis" 或 "User123"
    if (/^[a-zA-Z][a-zA-Z0-9_]{2,20}$/.test(t)) {
      return true;
    }

    // 6. 短英文名 如 "A" "AB" (2字符)
    if (/^[a-zA-Z]{1,2}$/.test(t)) {
      return true;
    }

    return false;
  }

  // 额外校验：检测是否为有效 owner（用于综合评分）
  function isValidOwnerCandidate(text) {
    const t = text.trim();

    // 管道符 → 多选合并，绝对无效
    if (t.includes('|')) return { valid: false, reason: 'pipe' };

    // 换行符 → 多行文本，绝对无效
    if (t.includes('\n')) return { valid: false, reason: 'newline' };

    // 长度限制
    if (t.length < 1 || t.length > 40) return { valid: false, reason: 'length' };

    // 正则黑名单
    for (const pattern of KNOWN_BAD_PATTERNS) {
      if (pattern.test(t)) return { valid: false, reason: 'blacklist' };
    }

    // 纯中文无括号（可能是菜单/标签，但也可能是合法用户名）
    // 注：根据业务需求，纯中文用户名（2-10字符）视为合法用户
    // if (/^[\u4e00-\u9fa5]+$/.test(t) && !t.includes('(')) {
    //   return { valid: false, reason: 'pure_chinese' };
    // }

    // 包含括号但不匹配用户格式
    if (t.includes('(') && !/^[\u4e00-\u9fa5]+.*\([a-zA-Z]/.test(t)) {
      return { valid: false, reason: 'bad_bracket' };
    }

    return { valid: true };
  }

  // 给匹配结果打分，越高越可能是真实用户名
  function scoreMatch(text) {
    let score = 0;
    const t = text.trim();
    const scoreDetails = []; // 评分明细

    // ===== 加分项 =====

    // 1. 格式正确加分
    if (looksLikeUsername(t)) {
      score += 15;
      scoreDetails.push('looksLikeUsername: +15');
    }

    // 2. 中文名(英文账号) 格式 - 最典型GM账号格式
    if (/^[\u4e00-\u9fa5]+[\u4e00-\u9fa5_a-zA-Z0-9]*\([a-zA-Z][a-zA-Z0-9_]*\)$/.test(t)) {
      score += 10;
      scoreDetails.push('中文名(英文)格式: +10');
    }

    // 3. 英文账号格式
    if (/^[a-zA-Z][a-zA-Z0-9_]{2,20}$/.test(t)) {
      score += 8;
      scoreDetails.push('英文账号格式: +8');
    }

    // 4. 长度合理 (5-30字符最佳)
    if (t.length >= 5 && t.length <= 30) {
      score += 3;
      scoreDetails.push('长度合理(' + t.length + '字符): +3');
    } else if (t.length > 30 && t.length <= 40) {
      score += 1;
      scoreDetails.push('长度偏长(' + t.length + '字符): +1');
    } else if (t.length < 3) {
      score -= 5;
      scoreDetails.push('长度过短(' + t.length + '字符): -5');
    }

    // ===== 扣分项 =====

    // 5. 括号不匹配
    if (t.includes('(') && !t.includes(')')) {
      score -= 10;
      scoreDetails.push('括号不匹配: -10');
    }
    if (!t.includes('(') && t.includes(')')) {
      score -= 10;
      scoreDetails.push('括号不匹配: -10');
    }

    // 6. 管道符（多选合并）- 严重扣分
    if (t.includes('|')) {
      score -= 100;
      scoreDetails.push('含管道符: -100');
    }

    // 7. 换行符
    if (t.includes('\n')) {
      score -= 50;
      scoreDetails.push('含换行符: -50');
    }

    // 8. 正则黑名单匹配 - 严重扣分
    for (const pattern of KNOWN_BAD_PATTERNS) {
      if (pattern.test(t)) {
        score -= 100;
        scoreDetails.push('命中黑名单: -100');
        break;
      }
    }

    // 9. 纯中文无括号（可能是菜单/标签，但也可能是合法用户名）
    // if (/^[\u4e00-\u9fa5]+$/.test(t) && !t.includes('(')) {
    //   score -= 20;
    //   scoreDetails.push('纯中文无括号: -20');
    // }

    // 10. 包含特殊字符（非用户名的括号格式）
    if (t.includes('(') && !/^[\u4e00-\u9fa5]+.*\(/.test(t) && !/\([a-zA-Z]/.test(t)) {
      score -= 10;
      scoreDetails.push('异常括号格式: -10');
    }

    // 11. 包含数字开头的括号格式 (可能是日期/版本)
    if (/\(\d/.test(t)) {
      score -= 15;
      scoreDetails.push('括号含数字开头: -15');
    }

    // 12. 过长的文本（可能是说明文字）
    if (t.length > 50) {
      score -= 10;
      scoreDetails.push('文本过长(' + t.length + '字符): -10');
    }

    // 记录评分明细
    if (scoreDetails.length > 0) {
      console.log('[GM助手] [评分明细] "' + t + '" | 总分: ' + score + ' | ' + scoreDetails.join(' | '));
    } else {
      console.log('[GM助手] [评分明细] "' + t + '" | 总分: ' + score);
    }

    return score;
  }

  // 读取 GM 页面右上角用户名
  // DOM 结构固定：用户名 = .el-dropdown-menu 中第一个 <li> 的直接文本（非 <a>/<span> 子元素内容）
  function readUserInfo() {
    const results = [];

    console.log('[GM助手] ═══════════════════════════════════════════');
    console.log('[GM助手] 🔍 开始扫描 Owner（用户名检测）');
    console.log('[GM助手] ═══════════════════════════════════════════');

    // =========================================================
    // 策略一（最优先）：直接扫描所有 .el-dropdown-menu 的第一个 <li>
    // Element Plus 标准结构：第一个 <li> 直接文本 = 用户名，其余是菜单项
    // 额外验证：用户名所在 dropdown 里一定有头像元素（区分用户区下拉 vs 普通功能下拉）
    // =========================================================
    console.log('[GM助手] [策略一] dropdown首项扫描 | 共扫描 ' + document.querySelectorAll('.el-dropdown-menu').length + ' 个下拉菜单');
    try {
      const dropdowns = document.querySelectorAll('.el-dropdown-menu');
      dropdowns.forEach((menu, idx) => {
        const firstLi = menu.querySelector('li:first-child');
        if (!firstLi) return;
        // 只取直接文本节点，忽略 <a>/<span> 等子元素的文本
        const directText = Array.from(firstLi.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent)
          .join('')
          .trim();
        if (!directText || directText.length > 60) return;
        if (KNOWN_BAD_TEXTS.has(directText)) return;

        // 使用 isValidOwnerCandidate 进行严格校验
        const validity = isValidOwnerCandidate(directText);
        if (!validity.valid) {
          console.log('[GM助手] [策略一-dropdown首项] 过滤无效候选:', JSON.stringify(directText), '| 原因:', validity.reason);
          return;
        }

        // 用户名不含 <a> 或 <span> 子元素（修改密码/退出登录都在子元素里）
        const hasChildLink = firstLi.querySelector('a, span');
        if (hasChildLink) return;
        // 头像身份验证（menu 父容器链）：
        // 从 menu.parentElement 向上遍历，如果某个祖先包含 .el-avatar 则为用户区下拉
        // 因为头像和 menu 同在 .avatar-container（也是 .el-dropdown）内，menu.parentElement 就是它
        let menuCtx = menu.parentElement;
        let hasAvatar = false;
        for (let i = 0; i < 6 && menuCtx; i++) {
          if (menuCtx.classList && (
            menuCtx.classList.contains('avatar-container') ||
            menuCtx.classList.contains('avatarContainer') ||
            menuCtx.classList.contains('el-dropdown') ||
            menuCtx.classList.contains('header-user') ||
            menuCtx.classList.contains('user-info')
          )) {
            hasAvatar = !!(menuCtx.querySelector('.el-avatar, img.el-avatar, .user-avatar'));
            break;
          }
          menuCtx = menuCtx.parentElement;
        }
        // 无头像的 dropdown（普通功能下拉）降分，不作为主要候选
        const score = scoreMatch(directText) + (hasAvatar ? 10 : -5);
        console.log('[GM助手] [策略一-dropdown首项] 匹配:', JSON.stringify(directText), '| 评分:', score, '| dropdownIdx:', idx, '| hasAvatar:', hasAvatar);
        results.push({ sel: 'dropdown-first-li', text: directText, score, tag: 'li', hasAvatar });
      });
    } catch(e) {}

    // =========================================================
    // 策略二：从头像 el-avatar 出发，在其所在 dropdown 中找用户名
    // =========================================================
    console.log('[GM助手] [策略二] 头像锚点扫描 | 共扫描 ' + document.querySelectorAll('.el-avatar, img.el-avatar').length + ' 个头像');
    try {
      const avatars = document.querySelectorAll('.el-avatar, img.el-avatar');
      avatars.forEach((avatar, idx) => {
        // 从头像向上找最近的 .el-dropdown 容器
        let cur = avatar.parentElement;
        let dropdownRoot = null;
        for (let i = 0; i < 6 && cur; i++) {
          if (cur.classList && (cur.classList.contains('el-dropdown') || cur.classList.contains('el-dropdown__wrapper'))) {
            dropdownRoot = cur;
            break;
          }
          cur = cur.parentElement;
        }
        if (!dropdownRoot) return;
        // 找第一个不含子元素链接的 <li>
        const items = dropdownRoot.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu__item--divided');
        items.forEach(item => {
          if (item.querySelector('a, span')) return; // 跳过有链接/按钮的菜单项
          const text = (item.textContent || '').trim();
          if (!text || text.length > 60 || KNOWN_BAD_TEXTS.has(text)) return;

          // 使用 isValidOwnerCandidate 进行严格校验
          const validity = isValidOwnerCandidate(text);
          if (!validity.valid) {
            console.log('[GM助手] [策略二-头像锚点] 过滤无效候选:', JSON.stringify(text), '| 原因:', validity.reason);
            return;
          }

          const score = scoreMatch(text) + 5;
          console.log('[GM助手] [策略二-头像锚点] 匹配:', JSON.stringify(text), '| 评分:', score, '| avatarIdx:', idx);
          results.push({ sel: 'avatar-anchor', text, score, tag: 'li' });
        });
      });
    } catch(e) {}

    // =========================================================
    // 策略三（兜底）：TreeWalker 扫描全 DOM，含中文+括号的文本
    // =========================================================
    console.log('[GM助手] [策略三] TreeWalker 兜底扫描中...');
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        const t = (node.textContent || '').trim();
        if (t.length < 4 || t.length > 60) continue;
        if (!/[\u4e00-\u9fa5]/.test(t)) continue;
        if (!t.includes('(') || !t.includes(')')) continue;
        if (KNOWN_BAD_TEXTS.has(t)) continue;

        // 使用 isValidOwnerCandidate 进行严格校验
        const validity = isValidOwnerCandidate(t);
        if (!validity.valid) {
          console.log('[GM助手] [策略三-treeWalker] 过滤无效候选:', JSON.stringify(t), '| 原因:', validity.reason);
          continue;
        }

        // 跳过在 <a>/<span> 子元素里的文本（菜单项）
        let parent = node.parentElement;
        let isMenuItem = false;
        for (let i = 0; i < 3 && parent; i++) {
          if (parent.tagName === 'A' || (parent.tagName === 'SPAN' && parent.className.includes('el-dropdown'))) {
            isMenuItem = true; break;
          }
          parent = parent.parentElement;
        }
        if (isMenuItem) continue;
        const score = scoreMatch(t);
        console.log('[GM助手] [策略三-treeWalker] 匹配:', JSON.stringify(t), '| 评分:', score, '| 父链:', getParentChain(node.parentElement, 4));
        results.push({ sel: 'treeWalker', text: t, score, tag: 'text' });
      }
    } catch(e) {}

    // =========================================================
    // 最终选用：评分最高者
    // =========================================================
    console.log('[GM助手] ───────────────────────────────────────────');
    console.log('[GM助手] 📊 扫描完成，共找到 ' + results.length + ' 个候选');

    if (results.length > 0) {
      // 按评分排序
      results.sort((a, b) => (b.score || 0) - (a.score || 0));

      // 输出所有候选的排名
      console.log('[GM助手] 📋 候选排名:');
      results.forEach((r, idx) => {
        const marker = idx === 0 ? '👑' : '  ';
        console.log('[GM助手]   ' + marker + ' #' + (idx + 1) + ' "' + r.text + '" | 策略: ' + r.sel + ' | 评分: ' + r.score);
      });

      const chosen = results[0];
      console.log('[GM助手] ═══════════════════════════════════════════');
      console.log('[GM助手] ★ 最终选用: "' + chosen.text + '"');
      console.log('[GM助手]    策略: ' + chosen.sel + ' | 评分: ' + chosen.score);
      console.log('[GM助手] ═══════════════════════════════════════════');
      return [{ sel: chosen.sel, text: chosen.text }];
    }
    console.log('[GM助手] ❌ 未找到有效的用户名');
    console.log('[GM助手] ═══════════════════════════════════════════');
    return [];
  }

  // 默认域名白名单（备用）
  const DEFAULT_WHITELIST_HOSTS = [
    'gm.pre.nova.moonton.com',
    'gm.nova.oa.mt',
    'gm.aoz.moontontech.net',
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
  // 轮询读取用户名（GM 页面内容异步加载，需要重试）
  let userReadAttempts = 0;
  const MAX_USER_READ_ATTEMPTS = 30;
  function pollReadUser() {
    userReadAttempts++;
    const userInfo = readUserInfo();
    if (userInfo && userInfo.length > 0) {
      const rawName = userInfo[0].text;
      const safeName = (rawName || '').trim();
      console.log('[GM助手] 最终选用:', safeName, '| 来源 selector:', userInfo[0].sel, '| 重试次数:', userReadAttempts);
      if (safeName) {
        chrome.storage.local.set({ gm_user_name: safeName });
      }
      return; // 找到就停止
    }
    if (userReadAttempts < MAX_USER_READ_ATTEMPTS) {
      setTimeout(pollReadUser, 1000);
    } else {
      console.log('[GM助手] 用户名读取已达最大重试次数(' + MAX_USER_READ_ATTEMPTS + ')，放弃');
    }
  }

  function init() {
    // 面板创建不依赖用户名是否拿到
    const proceed = () => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const savedText = result[STORAGE_KEY];
        const hosts = savedText ? extractHosts(savedText) : DEFAULT_WHITELIST_HOSTS;
        if (!isGmPage(hosts)) {
          setupStorageWatcher();
          return;
        }
        const existingContainer = document.getElementById('my-plugin-panel-container');
        if (existingContainer) {
          setupStorageWatcher();
          return;
        }
        createPanel(hosts);
        setupStorageWatcher();

        // 仅在白名单页面内启动用户名轮询
        const startUserRead = () => { setTimeout(pollReadUser, 100); };
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          startUserRead();
        } else {
          window.addEventListener('DOMContentLoaded', () => { startUserRead(); });
        }
      });
    };

    // 面板先创建，用户名轮询读取
    proceed();
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
    console.log('[GM助手] createPanel() 开始执行, INIT_CONTAINER_H=600, INIT_IFRAME_H=568');
    // 读取用户信息并打日志
    readUserInfo();

    const PANEL_WIDTH = 380;
    const TOP_OFFSET = 38;
    const CTRL_HEIGHT = 32;
    // 最小容器高度（仅展示控制区，不填满视口）
    const MIN_CONTAINER_H = 600;
    const MIN_IFRAME_H = MIN_CONTAINER_H - CTRL_HEIGHT; // 118px
    // 最大不能超出视口
    const MAX_CONTAINER_H = Math.max(window.innerHeight - TOP_OFFSET, 600);
    // 初始高度：自适应，由 iframe 内容决定
    const INIT_CONTAINER_H = 600;

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
      'overflow: hidden',
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
    const INIT_IFRAME_H = 568;
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

    // 固定面板高度（GM 页面自身 DOM 不稳定，不动态响应内容变化）
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      if (data.type === 'CLOSE_MY_PLUGIN_PANEL') {
        panelContainer.remove();
        if (expandBtn) { expandBtn.remove(); expandBtn = null; }
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
