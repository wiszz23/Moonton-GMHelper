document.addEventListener('DOMContentLoaded', async () => {
  // ================================================================
  //  白名单检查
  // ================================================================
  const STORAGE_KEY = 'gm_whitelist';
  const DEFAULT_WHITELIST_HOSTS = [
    'gm.pre.nova.moonton.com',
    'gm.nova.oa.mt',
    'gm.aoz.moontontech.net',
    'gm-cn.yyf.muyinetwork.com',
    'gm.jp.novagames.net',
    'gm.usa.novagames.net'
  ];

  async function isAllowedDomain() {
    try {
      const [domainResult, whitelistResult] = await Promise.all([
        chrome.storage.local.get('gm_current_domain'),
        chrome.storage.local.get(STORAGE_KEY)
      ]);
      const currentHost = (domainResult.gm_current_domain || '').replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      const hosts = whitelistResult[STORAGE_KEY]
        ? whitelistResult[STORAGE_KEY].split(/[\n,]/).map(h => h.replace(/^https?:\/\//, '').replace(/:\d+$/, '').trim()).filter(Boolean)
        : DEFAULT_WHITELIST_HOSTS;
      return hosts.some(h => currentHost.includes(h) || h.includes(currentHost));
    } catch (e) {
      return false;
    }
  }

  const isInWhitelist = await isAllowedDomain();
  if (!isInWhitelist) {
    document.body.innerHTML = '<div style="padding:16px;color:#e57373;">GM助手：当前页面不在白名单中，无法使用。</div>';
    return;
  }

  // ================================================================
  //  全局状态
  // ================================================================
  const CHAR_PINYIN = {
    '不':'b','部':'b','报':'b','别':'bie','表':'biao','并':'bing','本':'ben','把':'ba','必':'bi','百':'bai','变':'bian','办':'ban','比':'bi','半':'ban','被':'bei','保':'bao','编':'bian','北':'bei','标':'biao',
    '大':'da','对':'dui','地':'di','斗':'dou','动':'dong','东':'dong','掉':'diao','端':'duan','调':'diao','独':'du','读':'du','短':'duan','断':'duan','度':'du','队':'dui','顶':'ding','登':'deng','典':'dian','店':'dian',
    '发':'fa','法':'fa','反':'fan','方':'fang','分':'fen','风':'feng','服':'fu','复':'fu','飞':'fei','福':'fu','翻':'fan','饭':'fan','放':'fang','封':'feng','费':'fei','范':'fan',
    '给':'gei','个':'ge','工':'gong','国':'guo','高':'gao','各':'ge','管':'guan','规':'gui','广':'guang','过':'guo','格':'ge','功':'gong','共':'gong','关':'guan','固':'gu','果':'guo',
    '好':'hao','和':'he','会':'hui','还':'hai','火':'huo','化':'hua','回':'hui','互':'hu','后':'hou','话':'hua','护':'hu','或':'huo','获':'huo','红':'hong','划':'hua','呼':'hu',
    '经':'jing','家':'jia','见':'jian','进':'jin','机':'ji','将':'jiang','交':'jiao','角':'jiao','结':'jie','教':'jiao','加':'jia','军':'jun','级':'ji','近':'jin','激':'ji','击':'ji','金':'jin','极':'ji','九':'jiu','件':'jian','技':'ji','建':'jian','具':'ju','济':'ji','集':'ji','及':'ji','即':'ji','几':'ji','记':'ji','计':'ji','己':'ji','季':'ji','纪':'ji','击':'ji','积':'ji','激':'ji','集':'ji','极':'ji','给':'gei','辑':'ji','籍':'ji','疾':'ji','吉':'ji','鸡':'ji',
    '可':'ke','开':'kai','看':'kan','口':'kou','克':'ke','空':'kong','快':'kuai','控':'kong','科':'ke','课':'ke','苦':'ku','宽':'kuan','康':'kang','卡':'ka',
    '了':'liao','理':'li','力':'li','里':'li','利':'li','立':'li','林':'lin','类':'lei','六':'liu','路':'lu','陆':'lu','流':'liu','楼':'lou','领':'ling',
    '吗':'ma','没':'mei','每':'mei','民':'min','明':'ming','面':'mian','名':'ming','门':'men','米':'mi','密':'mi','妈':'ma','麻':'ma','码':'ma',
    '你':'ni','年':'nian','那':'na','内':'nei','难':'nan','农':'nong','南':'nan','呢':'ne','能':'neng','女':'nv','哪':'na',
    '批':'pi','片':'pian','票':'piao','品':'pin','普':'pu','平':'ping','怕':'pa',
    '起':'qi','去':'qu','全':'quan','期':'qi','七':'qi','其':'qi','奇':'qi','气':'qi','区':'qu','清':'qing','请':'qing','求':'qiu',
    '然':'ran','燃':'ran','染':'ran','让':'rang','人':'ren','任':'ren','认':'ren',
    '是':'shi','三':'san','四':'si','所':'suo','色':'se','山':'shan','时':'shi','十':'shi','少':'shao','社':'she','数':'shu','术':'shu','思':'si','司':'si','私':'si',
    '他':'ta','她':'ta','它':'ta','同':'tong','通':'tong','条':'tiao','特':'te','体':'ti','团':'tuan','题':'ti','推':'tui','天':'tian','铁':'tie','提':'ti','探':'tan','碳':'tan','叹':'tan','炭':'tan',
    '我':'wo','为':'wei','位':'wei','五':'wu','外':'wai','物':'wu','文':'wen','无':'wu','问':'wen','武':'wu','王':'wang','务':'wu',
    '下':'xia','学':'xue','想':'xiang','些':'xie','向':'xiang','新':'xin','西':'xi','系':'xi','现':'xian','小':'xiao','性':'xing','息':'xi','相':'xiang','象':'xiang',
    '有':'you','一':'yi','和':'he','也':'ye','要':'yao','会':'hui','义':'yi','议':'yi','与':'yu','于':'yu','又':'you','已':'yi','由':'you','用':'yong','样':'yang','应':'ying','业':'ye','因':'yin','银':'yin','引':'yin','阳':'yang',
    '在':'zai','作':'zuo','自':'zi','总':'zong','走':'zou','资':'zi','子':'zi','组':'zu','最':'zui','左':'zuo','侧':'ce','字':'zi','再':'zai','杂':'za','增':'zeng',
    '添':'tian','加':'jia','装':'zhuang','备':'bei','升':'sheng','级':'ji','材':'cai','料':'liao','宝':'bao','箱':'xiang','道':'dao','具':'ju',
    '个':'ge','道':'dao','号':'hao','好':'hao','空':'kong','扣':'kou','口':'kou','卡':'ka','开':'kai'
  };
  const BACKEND_URL = 'http://10.30.138.5:3000';
  const BACKEND_TIMEOUT = 5000;

  const ORDER_KEY_GENERAL    = 'gm_general_order';
  const ORDER_KEY_PERSONAL   = 'gm_personal_order';
  const ORDER_KEY_GEN_CATS   = 'gm_general_categories_order';
  const ORDER_KEY_PER_CATS   = 'gm_personal_categories_order';

  let currentTab = 'general';           // 'general' | 'personal' | 'history'
  let generalCommands = {};            // { "装备": [{name, text}], ... }
  let personalCommands = [];           // [{name, text, category}]
  let personalCategories = [];         // ['装备', '道具', ...]
  let generalOrder  = {};             // { "装备": ["name1", "name2", ...], ... }
  let personalOrder = {};             // { "我的分组": ["name1", "name2", ...] }
  let generalCategoriesOrder  = [];  // ['装备', '道具', ...]  通用分类 Tab 顺序
  let personalCategoriesOrder = [];   // ['我的分组', '装备', ...] 个人分类 Tab 顺序

  let currentGenKeyword = '';
  let currentGenCategory = 'all';
  let currentPerKeyword = '';
  let currentPerCategory = 'all';
  let editingIndex = -1;
  let history = [];
  let currentUserName = '';
  let personalEditingIndex = -1;

  // ================================================================
  //  DOM 引用
  // ================================================================
  const genInput = document.getElementById('input-text');
  const genSearchInput = document.getElementById('search-input');
  const genAutoRun = document.getElementById('auto-run-checkbox');
  const genContainer = document.getElementById('buttons-container');

  const perInput = document.getElementById('input-text-personal');
  const perSearchInput = document.getElementById('search-input-personal');
  const perAutoRun = document.getElementById('auto-run-personal');
  const perContainer = document.getElementById('personal-buttons-container');

  const whitelistInput = document.getElementById('whitelist-input');
  const saveWhitelistBtn = document.getElementById('save-whitelist-btn');

  const addCmdBtn = document.getElementById('add-cmd-btn');
  const cmdModal = document.getElementById('add-cmd-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalCmdName = document.getElementById('modal-cmd-name');
  const modalCmdText = document.getElementById('modal-cmd-text');
  const modalCmdCategory = document.getElementById('modal-cmd-category'); // hidden input
  const modalCategoryTags = document.getElementById('modal-category-tags');
  const modalTitle = document.getElementById('modal-title');

  const addCatBtn = document.getElementById('add-category-btn');
  const catModal = document.getElementById('add-category-modal');
  const closeCatBtn = document.getElementById('close-cat-modal-btn');
  const modalCatCancelBtn = document.getElementById('modal-cat-cancel-btn');
  const modalCatConfirmBtn = document.getElementById('modal-cat-confirm-btn');
  const modalCatName = document.getElementById('modal-cat-name');

  const historyArea = document.getElementById('history-area');
  const historyEmpty = document.getElementById('history-empty');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // ================================================================
  //  通用指令：从数据库读取 / 初始化
  // ================================================================
  async function syncGeneralFromBackend() {
    if (!isInWhitelist) return;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/commands/public`, { signal: ctrl.signal });
      clearTimeout(tid);
      console.log('[GM面板] syncGeneralFromBackend 后端响应 status:', resp.status);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      console.log('[GM面板] syncGeneralFromBackend 后端数据:', data);
      if (data.commands) {
        const parsed = JSON.parse(data.commands);
        const firstKey = Object.keys(parsed)[0];
        const firstItem = firstKey ? (Array.isArray(parsed[firstKey]) ? parsed[firstKey][0] : null) : null;
        console.log('[GM面板] 解析后 keys[0]:', firstKey, 'firstItem:', firstItem);
        if (!firstItem || typeof firstItem.name !== 'string') {
          console.log('[GM面板] 旧格式，fallback 到 commands.json');
          throw new Error('old format');
        }
        generalCommands = parsed;
        // 同步分类顺序（追加新分类到末尾）
        const backendCats = Object.keys(parsed);
        const existingSet = new Set(generalCategoriesOrder);
        backendCats.forEach(cat => { if (!existingSet.has(cat)) generalCategoriesOrder.push(cat); });
        if (generalCategoriesOrder.length > backendCats.length) {
          // 有被删除的分类 → 裁剪到仅保留仍存在的
          generalCategoriesOrder = generalCategoriesOrder.filter(c => backendCats.includes(c));
        }
        console.log('[GM面板] 通用指令从后端加载成功，分类:', Object.keys(parsed).join(', '));
        return;
      } else {
        console.log('[GM面板] 后端 commands 为 null，fallback 到 commands.json');
      }
    } catch (e) {
      console.log('[GM面板] syncGeneralFromBackend 异常:', e.message, '→ fallback');
    }
    // DB 为空：从 commands.json 初始化
    try {
      const url = chrome.runtime.getURL('commands.json');
      const r = await fetch(url);
      console.log('[GM面板] commands.json fetch 状态:', r.status);
      if (!r.ok) { console.log('[GM面板] commands.json fetch 失败'); return; }
      const local = await r.json();
      console.log('[GM面板] commands.json 解析结果 keys:', Object.keys(local).slice(0, 5).join(', '));
      if (!Object.keys(local).length) { console.log('[GM面板] commands.json 为空'); return; }
      generalCommands = local;
      console.log('[GM面板] 从 commands.json 加载成功，写入后端...');
      await saveGeneralToBackend();
      console.log('[GM面板] commands.json 写入后端完成');
    } catch (e) {
      console.error('[GM面板] commands.json 加载失败:', e);
    }
  }

  async function saveGeneralToBackend() {
    if (!isInWhitelist) return;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT);
    try {
      await fetch(`${BACKEND_URL}/api/commands/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: JSON.stringify(generalCommands) }),
        signal: ctrl.signal
      });
      clearTimeout(tid);
    } catch (e) { clearTimeout(tid); }
  }

  // ================================================================
  //  个人分组管理（本地 + 后端同步）
  // ================================================================
  async function loadLocalPersonalCategories() {
    try {
      const r = await chrome.storage.local.get('gm_personal_categories');
      const cats = r.gm_personal_categories;
      console.log('[GM面板] loadLocalPersonalCategories 返回:', cats || '(无, fallback默认)');
      return cats || ['道具', '装备', '天赋'];
    } catch (e) { return ['道具', '装备', '天赋']; }
  }

  async function saveLocalPersonalCategories(cats) {
    try { await chrome.storage.local.set({ gm_personal_categories: cats }); } catch (e) {}
  }

  async function reloadPersonalCategories() {
    console.log('[GM面板] reloadPersonalCategories start | currentUserName:', currentUserName);
    const local = await loadLocalPersonalCategories();
    if (!currentUserName) {
      console.log('[GM面板] reloadPersonalCategories → !currentUserName, local:', JSON.stringify(local));
      personalCategories = local;
      // 首次初始化 personalCategoriesOrder
      if (!personalCategoriesOrder.length) {
        personalCategoriesOrder = [...local];
        await savePersonalCategoriesOrder();
      }
      return;
    }
    // 从本地已存的完整数据中取 categories
    try {
      const r = await chrome.storage.local.get('gm_personal_full');
      const full = r.gm_personal_full;
      if (full && full.categories && Array.isArray(full.categories) && full.categories.length > 0) {
        console.log('[GM面板] reloadPersonalCategories → 从 gm_personal_full 恢复, categories:', JSON.stringify(full.categories));
        personalCategories = full.categories;
        await saveLocalPersonalCategories(personalCategories);
        // 首次初始化 personalCategoriesOrder
        if (!personalCategoriesOrder.length) {
          personalCategoriesOrder = [...personalCategories];
          await savePersonalCategoriesOrder();
        }
        return;
      }
    } catch (e) {}
    console.log('[GM面板] reloadPersonalCategories → fallback local, local:', JSON.stringify(local));
    personalCategories = local;
    if (!personalCategoriesOrder.length) {
      personalCategoriesOrder = [...local];
      await savePersonalCategoriesOrder();
    }
  }

  // ================================================================
  //  个人指令：本地存储
  // ================================================================
  async function loadLocalPersonalCommands() {
    try {
      const r = await chrome.storage.local.get('gm_personal_commands');
      const cmds = (r.gm_personal_commands || []).map(cmd => ({
        name: cmd.name || cmd, text: cmd.text || cmd, category: cmd.category || ''
      }));
      console.log('[GM面板] loadLocalPersonalCommands 返回条数:', cmds.length);
      return cmds;
    } catch (e) { return []; }
  }

  async function saveLocalPersonalCommands(cmds) {
    try { await chrome.storage.local.set({ gm_personal_commands: cmds }); } catch (e) {}
  }

  // ================================================================
  //  个人完整数据：本地存储（含分类+指令）
  // ================================================================
  async function saveLocalPersonalFull(data) {
    try { await chrome.storage.local.set({ gm_personal_full: data }); } catch (e) {}
  }

  // ================================================================
  //  个人数据：后端同步（合并结构）
  // ================================================================
  function safeParse(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw; // 已是对象不需解析
    try { return JSON.parse(raw); } catch { return null; }
  }

  async function syncPersonalDataFromBackend(owner) {
    console.log('[GM面板] syncPersonalDataFromBackend 被调用, owner:', owner);
    if (!isInWhitelist) return null;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/commands/${encodeURIComponent(owner)}`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.commands) {
        let parsed = safeParse(data.commands);
        if (!parsed) return null;
        // 新格式：{categories: [...], commands: [...]}，否则为旧格式（纯数组）
        const isNewFormat = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        // 兼容 % 和 %s 两种占位符，统一转为 %s
        const normalizeText = t => (t || '').replace(/(?<![a-zA-Z])%(?![a-zA-Z])/g, '%s');
        return {
          categories: isNewFormat ? (parsed.categories || []) : [],
          commands: isNewFormat
            ? (parsed.commands || []).map(cmd => ({ name: cmd.name || cmd, text: normalizeText(cmd.text || cmd), category: cmd.category || '' }))
            : (parsed || []).map(cmd => ({ name: cmd.name || cmd, text: normalizeText(cmd.text || cmd), category: cmd.category || '' }))
        };
      }
    } catch (e) { clearTimeout(tid); }
    return null;
  }

  // 带重试的后端同步（最多 3 次，间隔 1 秒）
  // 同步个人数据到后端，返回 true=成功，false=失败
  async function syncPersonalDataToBackend(owner, categories, commands, retries = 3) {
    if (!isInWhitelist) return false;
    // 守卫条件：commands 和 categories 都为空时不写入后端，避免覆盖已有数据
    if ((!commands || !commands.length) && (!categories || !categories.length)) return true;
    const payload = { owner, commands: JSON.stringify({ categories, commands }) };
    console.log('[GM面板] syncPersonalDataToBackend 发送请求 | owner:', owner, '| payload:', JSON.stringify(payload));
    for (let attempt = 1; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT);
      try {
        const resp = await fetch(`${BACKEND_URL}/api/commands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
        clearTimeout(tid);
        const respText = await resp.text();
        console.log('[GM面板] syncPersonalDataToBackend 响应 | attempt:', attempt, '| status:', resp.status, '| body:', respText.slice(0, 200));
        if (resp.ok) return true; // 成功
        console.warn(`[GM面板] 后端同步失败(尝试 ${attempt}/${retries}): HTTP ${resp.status}`);
      } catch (e) {
        clearTimeout(tid);
        console.warn(`[GM面板] 后端同步失败(尝试 ${attempt}/${retries}): ${e.message}`);
      }
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000));
    }
    console.error('[GM面板] 后端同步已达最大重试次数，数据已保存在本地');
    return false; // 失败
  }

  async function reloadPersonalCommands(waitForSync = false) {
    console.log('[GM面板] reloadPersonalCommands start | currentUserName:', currentUserName, '| waitForSync:', waitForSync);
    const localCmds = await loadLocalPersonalCommands();
    const localCats = await loadLocalPersonalCategories();
    console.log('[GM面板] reloadPersonalCommands localCmds.length:', localCmds.length, '| localCats.length:', localCats.length);

    // 本地已有数据（必须有 commands）→ 本地为准，以后端为备份目标
    // 仅用 localCmds 判断，避免默认分类 ['道具','装备','天赋'] 导致首次用户跳过后端拉取
    if (localCmds.length > 0) {
      console.log('[GM面板] reloadPersonalCommands → 本地已有数据分支 | localCmds:', localCmds.length, '| localCats:', localCats.length);
      personalCommands = localCmds;
      personalCategories = localCats;
      if (currentUserName) {
        console.log('[GM面板] reloadPersonalCommands → syncPersonalDataToBackend 调用, owner:', currentUserName);
        const syncPromise = syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
        if (waitForSync) await syncPromise; // 初始化时等同步完成再继续
      } else {
        console.log('[GM面板] reloadPersonalCommands → currentUserName 为空，跳过 syncPersonalDataToBackend');
      }
      return;
    }

    // 本地为空（首次访问）→ 从后端拉取
    // 初始化时 currentUserName 可能尚未从 storage 加载到，先实时查一次
    if (!currentUserName) {
      const r = await chrome.storage.local.get('gm_user_name');
      const rawName = (r?.gm_user_name || '').trim();
      if (rawName) currentUserName = rawName;
      console.log('[GM面板] reloadPersonalCommands → 实时查 gm_user_name:', currentUserName || '(空)');
    }
    if (!currentUserName) { personalCommands = []; return; }
    console.log('[GM面板] reloadPersonalCommands → 从后端拉取, owner:', currentUserName);
    const remote = await syncPersonalDataFromBackend(currentUserName);
    console.log('[GM面板] reloadPersonalCommands → syncPersonalDataFromBackend 返回, remote:', remote ? '有数据' : 'null');
    if (remote && (remote.categories.length > 0 || remote.commands.length > 0)) {
      personalCommands = remote.commands;
      personalCategories = remote.categories;
      await saveLocalPersonalCommands(personalCommands);
      await saveLocalPersonalCategories(personalCategories);
      await saveLocalPersonalFull(remote);
    } else {
      console.log('[GM面板] reloadPersonalCommands → 后端无数据, personalCommands 置为空');
      personalCommands = [];
      // 新用户：后端无数据时，从 localStorage 补充分类（fallback 默认值），并同步到后端
      personalCategories = localCats;
      if (currentUserName) {
        console.log('[GM面板] reloadPersonalCommands → 同步默认分类到后端, owner:', currentUserName);
        const syncOk = await syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
        console.log('[GM面板] reloadPersonalCommands → 同步默认分类结果:', syncOk ? '成功' : '失败');
      }
    }
  }

  // ================================================================
  //  动态生成分类 Tab
  // ================================================================
  function buildGeneralCategoryTabs() {
    console.log('[GM面板] buildGeneralCategoryTabs 调用, generalCommands keys:', Object.keys(generalCommands).join(', '));
    const list = document.getElementById('general-category-list');
    // 只删动态生成的分类项，保留"全部"
    list.querySelectorAll('.left-sidebar-item:not([data-category="all"])').forEach(el => el.remove());

    const allCats = Object.keys(generalCommands);
    // 应用存储的顺序：新分类追加到末尾
    const orderMap = {};
    generalCategoriesOrder.forEach((cat, i) => { orderMap[cat] = i; });
    const ordered = allCats
      .filter(c => c in orderMap)
      .sort((a, b) => orderMap[a] - orderMap[b]);
    const newCats = allCats.filter(c => !(c in orderMap));
    const cats = [...ordered, ...newCats];

    cats.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'left-sidebar-item';
      item.dataset.category = cat;
      item.textContent = cat;
      item.addEventListener('click', () => {
        list.querySelectorAll('.left-sidebar-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        currentGenCategory = cat;
        currentGenKeyword = '';
        genSearchInput.value = '';
        renderGeneralButtons();
      });
      list.appendChild(item);
    });
  }

  function buildPersonalCategoryTabs() {
    const list = document.getElementById('personal-category-list');
    list.querySelectorAll('.left-sidebar-item:not([data-category="all"])').forEach(el => el.remove());

    // 应用存储的 Tab 顺序：新分类追加到末尾
    const orderMap = {};
    personalCategoriesOrder.forEach((cat, i) => { orderMap[cat] = i; });
    const ordered = personalCategories
      .filter(c => c in orderMap)
      .sort((a, b) => orderMap[a] - orderMap[b]);
    const newCats = personalCategories.filter(c => !(c in orderMap));
    const cats = [...ordered, ...newCats];

    cats.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'left-sidebar-item';
      item.dataset.category = cat;
      // 分类名
      const label = document.createElement('span');
      label.className = 'cat-label';
      label.textContent = cat;
      // 操作按钮组（hover 时显示）
      const actions = document.createElement('div');
      actions.className = 'cat-actions';
      // 编辑按钮
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-cat-btn';
      editBtn.textContent = '✎';
      editBtn.title = '编辑分组';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditCategoryModal(cat);
      });
      actions.appendChild(editBtn);
      item.appendChild(label);
      item.appendChild(actions);
      item.addEventListener('click', () => {
        list.querySelectorAll('.left-sidebar-item').forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        currentPerCategory = cat;
        currentPerKeyword = '';
        perSearchInput.value = '';
        renderPersonalButtons();
      });
      list.appendChild(item);
    });
  }

  // ================================================================
  //  拖拽排序
  // ================================================================
  function initDragDrop(containerSelector, isGeneral) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    let draggedEl = null;
    let dragStarted = false;       // 是否已进入拖拽模式
    let startX = 0, startY = 0;
    const DRAG_THRESHOLD = 8;      // 超过 8px 才认定是拖拽

    container.addEventListener('pointerdown', e => {
      const wrap = e.target.closest('.personal-btn-wrap');
      if (!wrap || e.target.closest('.personal-action-btn, .edit-btn, .delete-btn')) return;
      draggedEl = wrap;
      startX = e.clientX;
      startY = e.clientY;
      dragStarted = false;
      // 不在这里 preventDefault / setPointerCapture，等确认是拖拽再说
    });

    container.addEventListener('pointermove', e => {
      if (!draggedEl || dragStarted) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return; // 未超过阈值，当点击处理

      // 正式进入拖拽模式：抢回 pointer capture，修改样式
      dragStarted = true;
      draggedEl.setPointerCapture(e.pointerId);
      draggedEl.style.opacity = '0.4';
      draggedEl.style.cursor = 'grabbing';
    });

    container.addEventListener('pointermove', e => {
      if (!draggedEl || !dragStarted) return;
      const rects = [...container.querySelectorAll('.personal-btn-wrap')];
      const midY = e.clientY;
      let insertBefore = null;
      for (const r of rects) {
        if (r === draggedEl) continue;
        const rr = r.getBoundingClientRect();
        if (midY < rr.top + rr.height / 2) { insertBefore = r; break; }
      }
      if (insertBefore) {
        container.insertBefore(draggedEl, insertBefore);
      } else {
        container.appendChild(draggedEl);
      }
    });

    container.addEventListener('pointerup', e => {
      if (!draggedEl) return;
      if (dragStarted) {
        draggedEl.style.opacity = '';
        draggedEl.style.cursor = '';
        draggedEl.releasePointerCapture(e.pointerId);

        // 收集当前 DOM 顺序
        const wraps = [...container.querySelectorAll('.personal-btn-wrap')];
        const names = wraps.map(w => (w.dataset.name || w.querySelector('.button').textContent.trim()));

        const category = isGeneral ? currentGenCategory : currentPerCategory;
        if (isGeneral) {
          generalOrder[category] = names;
          saveGeneralOrder();
        } else {
          personalOrder[category] = names;
          savePersonalOrder();
        }
      }
      draggedEl = null;
      dragStarted = false;
    });
  }

  // ================================================================
  //  分类 Tab 拖拽排序（排除「全部」）
  // ================================================================
  function initSidebarDragDrop(listSelector, isGeneral) {
    const list = document.querySelector(listSelector);
    if (!list) return;
    let draggedEl = null;
    let dragStarted = false;
    let startX = 0, startY = 0;
    const DRAG_THRESHOLD = 8;

    list.addEventListener('pointerdown', e => {
      const item = e.target.closest('.left-sidebar-item:not([data-category="all"])');
      if (!item) return;
      if (e.target.closest('.cat-actions, .edit-cat-btn')) return;
      draggedEl = item;
      startX = e.clientX;
      startY = e.clientY;
      dragStarted = false;
    });

    list.addEventListener('pointermove', e => {
      if (!draggedEl || dragStarted) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

      dragStarted = true;
      draggedEl.setPointerCapture(e.pointerId);
      draggedEl.style.opacity = '0.4';
      draggedEl.style.cursor = 'grabbing';
    });

    list.addEventListener('pointermove', e => {
      if (!draggedEl || !dragStarted) return;
      const items = [...list.querySelectorAll('.left-sidebar-item:not([data-category="all"])')];
      const midY = e.clientY;
      let insertBefore = null;
      for (const r of items) {
        if (r === draggedEl) continue;
        const rr = r.getBoundingClientRect();
        if (midY < rr.top + rr.height / 2) { insertBefore = r; break; }
      }
      if (insertBefore) {
        list.insertBefore(draggedEl, insertBefore);
      } else {
        list.appendChild(draggedEl);
      }
    });

    list.addEventListener('pointerup', e => {
      if (!draggedEl) return;
      if (dragStarted) {
        draggedEl.style.opacity = '';
        draggedEl.style.cursor = '';
        draggedEl.releasePointerCapture(e.pointerId);

        // 收集当前 DOM 顺序（排除「全部」）
        const cats = [...list.querySelectorAll('.left-sidebar-item:not([data-category="all"])')]
          .map(el => el.dataset.category);

        if (isGeneral) {
          generalCategoriesOrder = cats;
          saveGeneralCategoriesOrder();
        } else {
          personalCategoriesOrder = cats;
          personalCategories = cats;
          saveLocalPersonalCategories(personalCategories);
          savePersonalCategoriesOrder();
        }
      }
      draggedEl = null;
      dragStarted = false;
    });
  }

  // ================================================================
  //  排序数据加载 / 持久化
  // ================================================================
  async function loadGeneralOrder() {
    const r = await chrome.storage.local.get(ORDER_KEY_GENERAL);
    generalOrder = r[ORDER_KEY_GENERAL] || {};
  }
  async function loadPersonalOrder() {
    const r = await chrome.storage.local.get(ORDER_KEY_PERSONAL);
    personalOrder = r[ORDER_KEY_PERSONAL] || {};
  }
  async function saveGeneralOrder() {
    await chrome.storage.local.set({ [ORDER_KEY_GENERAL]: generalOrder });
  }
  async function savePersonalOrder() {
    await chrome.storage.local.set({ [ORDER_KEY_PERSONAL]: personalOrder });
  }
  async function loadGeneralCategoriesOrder() {
    const r = await chrome.storage.local.get(ORDER_KEY_GEN_CATS);
    generalCategoriesOrder = r[ORDER_KEY_GEN_CATS] || [];
  }
  async function loadPersonalCategoriesOrder() {
    const r = await chrome.storage.local.get(ORDER_KEY_PER_CATS);
    personalCategoriesOrder = r[ORDER_KEY_PER_CATS] || [];
  }
  async function saveGeneralCategoriesOrder() {
    await chrome.storage.local.set({ [ORDER_KEY_GEN_CATS]: generalCategoriesOrder });
  }
  async function savePersonalCategoriesOrder() {
    await chrome.storage.local.set({ [ORDER_KEY_PER_CATS]: personalCategoriesOrder });
  }

  function applyOrder(items, orderList) {
    if (!orderList || !orderList.length) return items;
    const map = {};
    items.forEach(it => { map[it.name] = it; });
    const result = [];
    orderList.forEach(name => { if (map[name]) { result.push(map[name]); delete map[name]; } });
    Object.values(map).forEach(it => result.push(it)); // 兜底：新增指令放末尾
    return result;
  }

  // ================================================================
  //  渲染通用指令按钮
  // ================================================================
  function pinyinMatch(name, keyword) {
    const kw = keyword.toLowerCase();
    if (name.toLowerCase().includes(kw)) return true;
    let py = '';
    for (const c of name) py += (CHAR_PINYIN[c] || c);
    return py.toLowerCase().includes(kw);
  }

  function renderGeneralButtons() {
    console.log('[GM面板] renderGeneralButtons 调用, currentGenCategory:', currentGenCategory, 'generalCommands keys:', Object.keys(generalCommands).join(', '));
    genContainer.innerHTML = '';
    const kw = currentGenKeyword.trim();

    if (currentGenCategory === 'all') {
      const cats = Object.keys(generalCommands).sort();
      let shown = false;
      cats.forEach(cat => {
        const items = generalCommands[cat] || [];
        const filtered = kw ? items.filter(it => pinyinMatch(it.name, kw)) : items;
        if (!filtered.length) return;
        shown = true;
        if (!kw) {
          // 无搜索关键字时显示分类标题
          const header = document.createElement('div');
          header.className = 'category-header';
          header.textContent = cat;
          genContainer.appendChild(header);
        }
        const ordered = applyOrder(filtered, generalOrder[cat] || []);
        ordered.forEach(it => renderGeneralButton(it.name, it.text));
      });
      if (!shown) genContainer.innerHTML = '<div class="search-empty">无匹配结果</div>';
    } else {
      const items = generalCommands[currentGenCategory] || [];
      const filtered = kw ? items.filter(it => pinyinMatch(it.name, kw)) : items;
      if (!filtered.length) {
        genContainer.innerHTML = '<div class="search-empty">无匹配结果</div>';
      } else {
        const ordered = applyOrder(filtered, generalOrder[currentGenCategory] || []);
        ordered.forEach(it => renderGeneralButton(it.name, it.text));
      }
    }
  }

  function renderGeneralButton(name, text) {
    const wrap = document.createElement('div');
    wrap.className = 'personal-btn-wrap';
    wrap.dataset.name = name;
    const btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = name;
    btn.title = Array.isArray(text) ? text.join('\n') : text;
    btn.dataset.command = Array.isArray(text) ? text.join('\n') : text;
    btn.addEventListener('click', () => executeGeneral(name, btn.dataset.command));
    wrap.appendChild(btn);
    genContainer.appendChild(wrap);
  }

  // ================================================================
  //  渲染个人指令按钮
  // ================================================================
  function renderPersonalButtons() {
    perContainer.innerHTML = '';
    const kw = currentPerKeyword.trim();
    let filtered = personalCommands
      .map((cmd, i) => ({ cmd, i }))
      .filter(({ cmd }) => {
        if (currentPerCategory !== 'all' && cmd.category !== currentPerCategory) return false;
        if (kw && !pinyinMatch(cmd.name, kw)) return false;
        return true;
      });

    if (!filtered.length) {
      perContainer.innerHTML = '<div class="search-empty">暂无个人指令，点击「+ 添加指令」新增</div>';
      return;
    }

    // 对当前分类应用排序（all 视图时按当前选中分类取 order）
    const perOrderKey = currentPerCategory === 'all'
      ? personalCategories[0] || ''   // all 视图不特别排序，保持原顺序
      : currentPerCategory;
    const orderedFiltered = applyOrder(
      filtered.map(({ cmd, i }) => cmd),
      personalOrder[perOrderKey] || []
    );
    // 重建 index 映射：order 后的 cmd.name → 原始 personalCommands 中的 index
    const nameToIdx = {};
    personalCommands.forEach((cmd, idx) => { nameToIdx[cmd.name] = idx; });

    if (currentPerCategory === 'all') {
      const grouped = {};
      orderedFiltered.forEach(cmd => {
        const cat = cmd.category || '(不分组)';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(cmd);
      });
      // 渲染顺序：personalCategories 已有分组 → 排在最后的未知分组（如导入的）
      // Set 保证顺序且不重复
      const allCatOrder = [...new Set([...personalCategories, ...Object.keys(grouped)])];
      allCatOrder.forEach(cat => {
        if (!grouped[cat]) return;
        const catOrdered = applyOrder(grouped[cat], personalOrder[cat] || []);
        if (!kw) {
          const header = document.createElement('div');
          header.className = 'category-header';
          header.textContent = cat;
          perContainer.appendChild(header);
        }
        catOrdered.forEach(cmd => renderPersonalButton(cmd.name, cmd.text, nameToIdx[cmd.name]));
      });
    } else {
      orderedFiltered.forEach(cmd => renderPersonalButton(cmd.name, cmd.text, nameToIdx[cmd.name]));
    }
  }

  function renderPersonalButton(name, text, index) {
    const wrap = document.createElement('div');
    wrap.className = 'personal-btn-wrap';
    wrap.dataset.name = name;
    const btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = name;
    btn.title = Array.isArray(text) ? text.join('\n') : text;
    btn.dataset.command = Array.isArray(text) ? text.join('\n') : text;
    btn.addEventListener('click', () => executePersonal(name, btn.dataset.command));
    wrap.appendChild(btn);

    const actions = document.createElement('div');
    actions.className = 'personal-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'personal-action-btn edit-btn';
    editBtn.textContent = '✎';
    editBtn.title = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPersonalModal(index);
    });

    actions.appendChild(editBtn);
    wrap.appendChild(actions);
    perContainer.appendChild(wrap);
  }

  // ================================================================
  //  执行指令
  // ================================================================
  async function executeGeneral(commandName, commandTemplate) {
    const text = genInput.value.trim();
    if (!text) { showGenStatus('角色ID不能为空', true); genInput.focus(); return; }
    const result = await executeInPage(text, commandTemplate, genAutoRun.checked);
    await addHistory(commandName, commandTemplate, text, 'general');
    if (result?.found) {
      showGenStatus('已执行: ' + commandName);
    } else {
      showGenStatus('未找到命令输入框', true);
    }
  }

  async function executePersonal(commandName, commandTemplate) {
    const text = perInput.value.trim();
    if (!text) { showPerStatus('角色ID不能为空', true); perInput.focus(); return; }
    const result = await executeInPage(text, commandTemplate, perAutoRun.checked);
    await addHistory(commandName, commandTemplate, text, 'personal');
    if (result?.found) {
      showPerStatus('已执行: ' + commandName);
    } else {
      showPerStatus('未找到命令输入框', true);
    }
  }

  async function executeInPage(roleIds, commandTemplate, autoRun) {
    // 直接获取当前活动 tab，而不是搜索所有 GM tab
    const [gmTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!gmTab || !gmTab.id) { showGenStatus('无法获取当前页面', true); return; }
    console.log('[GM面板] 目标tab:', gmTab.url);

    const hasPlaceholder = commandTemplate.includes('%s') || commandTemplate.includes('%');
    let finalText;
    if (hasPlaceholder) {
      const words = roleIds.split(/\s+/).filter(Boolean);
      // 统一替换：先处理 %s，再处理独立的 %（不是百分号，不是 %s）
      finalText = words.map(word =>
        commandTemplate.replace(/%s/g, word).replace(/(?<![a-zA-Z])%(?![a-zA-Z])/g, word)
      ).join('\n');
    } else {
      finalText = commandTemplate;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: gmTab.id },
      func: (sel, ifSel, txt, run, tabUrl) => {
        function runInDoc(doc) {
          const el = doc.querySelector(sel);
          if (el) {
            // 聚焦 + 填值
            el.focus();
            el.value = txt;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: txt }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            // jQuery autocomplete 触发
            const $el = window.$ ? $(el) : (window.jQuery ? jQuery(el) : null);
            if ($el) {
              $el.val(txt).trigger('input').trigger('change');
              if ($el.autocomplete) {
                $el.autocomplete('search', txt);
              }
            }
            if (run) {
              const b = doc.getElementById('ctl_run');
              if (b) { b.focus(); b.click(); }
            }
            return true;
          }
          return false;
        }
        if (runInDoc(document)) return { found: true, in: 'main' };

        // 提取目标域名，用于匹配正确的 iframe
        let targetHost = '';
        try { targetHost = new URL(tabUrl).hostname; } catch(e) {}

        // 分离出：src 匹配当前域名的 iframe vs 其他 iframe
        const priorityIframes = [];
        const fallbackIframes = [];
        document.querySelectorAll(ifSel).forEach(iframe => {
          try {
            const src = iframe.src || '';
            if (targetHost && src.includes(targetHost)) {
              priorityIframes.push(iframe);
            } else {
              fallbackIframes.push(iframe);
            }
          } catch(e) {}
        });

        // 优先尝试域名匹配的 iframe
        const tryIframes = [...priorityIframes, ...fallbackIframes];
        for (const iframe of tryIframes) {
          try {
            if (runInDoc(iframe.contentDocument || iframe.contentWindow.document)) {
              return { found: true, in: iframe.src || iframe.name || 'iframe' };
            }
          } catch (e) { return { found: false, error: e.message, in: 'iframe-cross-origin' }; }
        }
        return { found: false, iframes: Array.from(document.querySelectorAll('iframe')).map(f => ({ src: f.src, name: f.name, id: f.id, class: f.className })) };
      },
      args: ['#ctl_gmcmd', 'iframe#ifa, iframe[name="ifa"], iframe.iframe, iframe.ifa', finalText, autoRun, gmTab.url]
    });
    const result = results[0]?.result;
    console.log('[GM面板] executeInPage 结果:', result);
    return result;
  }

  // ================================================================
  //  历史记录
  // ================================================================
  async function addHistory(name, cmd, roleIds, tab) {
    const now = new Date().toLocaleTimeString();
    const exist = history.findIndex(h => h.name === name && h.roleIds === roleIds);
    if (exist !== -1) {
      history[exist].time = now;
      const [item] = history.splice(exist, 1);
      history.unshift(item);
    } else {
      history.unshift({ id: Date.now(), name, command: cmd, roleIds, tab, time: now });
      if (history.length > 100) history = history.slice(0, 100);
    }
    try { await chrome.storage.local.set({ gm_history: history }); } catch (e) {}
  }

  function renderHistory() {
    history = history || [];
    historyList.innerHTML = '';
    if (!history.length) { historyEmpty.style.display = 'block'; clearHistoryBtn.style.display = 'none'; return; }
    historyEmpty.style.display = 'none';
    clearHistoryBtn.style.display = 'block';
    history.forEach((entry, idx) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const header = document.createElement('div');
      header.className = 'history-item-header';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'history-name';
      nameSpan.textContent = entry.name;
      const timeSpan = document.createElement('span');
      timeSpan.className = 'history-time';
      timeSpan.textContent = entry.time;
      header.appendChild(nameSpan);
      header.appendChild(timeSpan);

      const idsRow = document.createElement('div');
      idsRow.className = 'history-ids';
      const idsLabel = document.createElement('span');
      idsLabel.textContent = '角色ID: ';
      const idsInput = document.createElement('input');
      idsInput.type = 'text';
      idsInput.className = 'history-id-input';
      idsInput.value = entry.roleIds || '';
      idsInput.placeholder = '角色ID';

      const cmdDiv = document.createElement('div');
      cmdDiv.className = 'history-command';

      // 根据当前 roleIds 动态更新详情显示
      function updateCmdDisplay() {
        const ids = idsInput.value.trim();
        history[idx].roleIds = ids;
        chrome.storage.local.set({ gm_history: history });
        let display = entry.command;
        if (ids && display.includes('%s')) {
          display = display.replace(/%s/g, ids);
        } else if (ids) {
          display = display.replace(/(?<![a-zA-Z])%(?![a-zA-Z])/g, ids);
        }
        cmdDiv.textContent = display.length > 60 ? display.substring(0, 60) + '...' : display;
        cmdDiv.title = display;
      }

      idsInput.addEventListener('input', updateCmdDisplay);
      updateCmdDisplay();

      idsRow.appendChild(idsLabel);
      idsRow.appendChild(idsInput);

      const btn = document.createElement('button');
      btn.className = 'history-exec-btn';
      btn.textContent = '▶ 快速执行';
      btn.addEventListener('click', async () => {
        const targetTab = entry.tab || 'general';
        const ids = idsInput.value.trim();
        if (targetTab === 'general') {
          genInput.value = ids;
          const result = await executeInPage(ids, entry.command, genAutoRun.checked);
          showGenStatus(result?.found ? '已执行: ' + entry.name : '未找到命令输入框');
        } else {
          perInput.value = ids;
          const result = await executeInPage(ids, entry.command, perAutoRun.checked);
          showPerStatus(result?.found ? '已执行: ' + entry.name : '未找到命令输入框');
        }
      });

      item.appendChild(header);
      item.appendChild(idsRow);
      item.appendChild(cmdDiv);
      item.appendChild(btn);
      historyList.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ================================================================
  //  浮动 Toast 通知
  // ================================================================
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }
  const showGenStatus = showToast;
  const showPerStatus = showToast;

  // ================================================================
  //  高度上报
  // ================================================================
  function measureHeight() {
    const activePage = document.querySelector('.tab-page.active');
    if (!activePage) return 0;
    let total = 0;
    Array.from(activePage.children).forEach(child => {
      if (getComputedStyle(child).display === 'none') return;
      total += child.offsetHeight;
    });
    return Math.ceil(total);
  }
  function reportHeight() {
    const h = measureHeight();
    if (parent && parent !== window) parent.postMessage({ type: 'GM_PANEL_HEIGHT', height: h }, '*');
  }

  // ================================================================
  //  顶部 Tab 切换
  // ================================================================
  document.querySelectorAll('.top-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.tab;
      document.querySelectorAll('.top-tab').forEach(tt => tt.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + t).classList.add('active');
      currentTab = t;
      if (t === 'history') renderHistory();
      if (t === 'settings') loadSettingsPage();
      requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
    });
  });

  // ================================================================
  //  通用页搜索
  // ================================================================
  genSearchInput.addEventListener('input', () => {
    currentGenKeyword = genSearchInput.value;
    renderGeneralButtons();
  });

  // ================================================================
  //  个人页搜索
  // ================================================================
  perSearchInput.addEventListener('input', () => {
    currentPerKeyword = perSearchInput.value;
    renderPersonalButtons();
  });

  // ================================================================
  //  设置页面
  // ================================================================
  async function loadSettingsPage() {
    try {
      const r = await chrome.storage.local.get(STORAGE_KEY);
      whitelistInput.value = r[STORAGE_KEY] || DEFAULT_WHITELIST_HOSTS.join('\n');
    } catch (e) { whitelistInput.value = DEFAULT_WHITELIST_HOSTS.join('\n'); }
    requestAnimationFrame(reportHeight);
  }

  document.getElementById('export-personal-btn').addEventListener('click', async () => {
    // 点击时实时查 storage，避免等轮询
    const r = await chrome.storage.local.get('gm_user_name');
    const rawName = (r?.gm_user_name || '').trim();
    if (!rawName) {
      showGenStatus('未获取到用户名，请刷新 GM 页面');
      return;
    }
    currentUserName = rawName;
    const btn = document.getElementById('export-personal-btn');
    btn.disabled = true;
    btn.textContent = '导出中...';
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), BACKEND_TIMEOUT);
      const resp = await fetch(`${BACKEND_URL}/api/commands/${encodeURIComponent(currentUserName)}`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const json = data.commands ? JSON.parse(data.commands) : { categories: [], commands: [] };

      // 合并排序数据：load 最新 order
      await loadPersonalOrder();
      await loadPersonalCategoriesOrder();

      const exportData = {
        // 不再导出 owner，避免用户混淆（导入时数据归属当前登录用户）
        updated_at: data.updated_at || new Date().toISOString(),
        categories: json.categories || [],
        commands: json.commands || [],
        // 导出排序数据，供其他用户导入时合并
        personalOrder: personalOrder || {},
        personalCategoriesOrder: personalCategoriesOrder || [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = (data.updated_at || new Date().toISOString()).replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `gm-personal-${currentUserName.replace(/[()（）]/g, '')}-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showGenStatus('导出成功');
    } catch (e) {
      showGenStatus('导出失败: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '导出 JSON';
  });

  const importFileInput = document.getElementById('import-file-input');
  document.getElementById('import-personal-btn').addEventListener('click', () => {
    importFileInput.click();
  });
  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const btn = document.getElementById('import-personal-btn');
    btn.disabled = true;
    btn.textContent = '导入中...';
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const importedCategories = imported.categories || [];
      const importedCommands = imported.commands || [];
      const importedUpdatedAt = imported.updated_at || null;
      const importedOrder = imported.personalOrder || {};
      const importedCatOrder = imported.personalCategoriesOrder || [];

      // ── 冲突检测：获取后端最新数据，对比时间戳 ──
      const r_check = await chrome.storage.local.get('gm_user_name');
      const rawName_check = (r_check?.gm_user_name || '').trim();
      let conflictResult = null; // null=无冲突，'overwrite'=覆盖云端，'local'=仅存本地
      let backendCmds = [], backendCats = [], backendUpdatedAt = null;

      if (rawName_check) {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), BACKEND_TIMEOUT);
        try {
          const resp2 = await fetch(`${BACKEND_URL}/api/commands/${encodeURIComponent(rawName_check)}`, { signal: ctrl2.signal });
          clearTimeout(tid2);
          if (resp2.ok) {
            const backendData = await resp2.json();
            if (backendData.commands) {
              const parsed = JSON.parse(backendData.commands);
              const isNew = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
              backendCats = isNew ? (parsed.categories || []) : [];
              backendCmds = isNew ? (parsed.commands || []) : (parsed || []);
              backendCmds = backendCmds.map(c => ({ name: c.name || c, text: c.text || c, category: c.category || '' }));
              backendUpdatedAt = backendData.updated_at || null;
            }
          }
        } catch (_) {}
      }

      // 若后端有新数据（updated_at 更晚），弹出冲突确认
      if (backendUpdatedAt) {
        const impTime = importedUpdatedAt ? new Date(importedUpdatedAt).getTime() : 0;
        const beTime = new Date(backendUpdatedAt).getTime();
        if (beTime > impTime) {
          conflictResult = await showConflictModal(
            importedCommands, importedCategories,
            backendCmds, backendCats,
            importedUpdatedAt, backendUpdatedAt
          );
          if (conflictResult === null) {
            // 用户取消
            btn.disabled = false;
            btn.textContent = '导入 JSON';
            importFileInput.value = '';
            return;
          }
        }
      }

      const categories = importedCategories;
      const commands = importedCommands;

      let addedCats = 0;
      let addedCmds = 0;
      let updatedCmds = 0;

      // 第一步：收集所有要合并的分组
      //    1. imported.categories 里明确声明的分组
      //    2. imported.commands 里指令引用的分组（可能 categories 字段漏填了）
      const allImportCats = new Set(categories);
      commands.forEach(cmd => {
        const cat = (cmd.category || '').trim();
        if (cat) allImportCats.add(cat);
      });

      // 第二步：增量合并分组（分组顺序追加到 personalCategoriesOrder 末尾）
      const newCatOrder = [];
      allImportCats.forEach(cat => {
        if (!personalCategories.includes(cat)) {
          personalCategories.push(cat);
          addedCats++;
          newCatOrder.push(cat);
        }
      });
      // 追加新分组到 personalCategoriesOrder 末尾
      if (newCatOrder.length > 0) {
        newCatOrder.forEach(cat => {
          if (!personalCategoriesOrder.includes(cat)) {
            personalCategoriesOrder.push(cat);
          }
        });
      }

      // 第三步：合并指令（同名覆盖，导入内容为准；新增追加）
      const existingNameMap = {};
      personalCommands.forEach((cmd, idx) => { existingNameMap[cmd.name] = idx; });
      commands.forEach(cmd => {
        const normalized = { name: cmd.name, text: cmd.text, category: cmd.category || '' };
        if (existingNameMap.hasOwnProperty(cmd.name)) {
          // 同名：以导入内容覆盖
          personalCommands[existingNameMap[cmd.name]] = normalized;
          updatedCmds++;
        } else {
          // 新增：追加到末尾
          personalCommands.push(normalized);
          addedCmds++;
        }
      });

      // 第四步：合并 personalOrder（将新指令 name 追加到对应分类的 order 列表末尾）
      // importedOrder / importedCatOrder 已在顶部提取
      Object.keys(importedOrder).forEach(cat => {
        const importedNames = importedOrder[cat] || [];
        // 确保该分类在 personalOrder 中存在
        if (!personalOrder[cat]) personalOrder[cat] = [];
        // 追加导入的 order（只追加新 name，已存在的保持原顺序）
        importedNames.forEach(name => {
          if (!personalOrder[cat].includes(name)) {
            personalOrder[cat].push(name);
          }
        });
      });
      // 合并分类顺序
      importedCatOrder.forEach(cat => {
        if (!personalCategoriesOrder.includes(cat)) {
          personalCategoriesOrder.push(cat);
        }
      });

      // 第五步：持久化全部本地存储
      await saveLocalPersonalCategories(personalCategories);
      await saveLocalPersonalCommands(personalCommands);
      await saveLocalPersonalFull({ categories: personalCategories, commands: personalCommands });
      await savePersonalOrder();         // 持久化 personalOrder
      await savePersonalCategoriesOrder(); // 持久化 personalCategoriesOrder

      // 第六步：同步后端
      // conflictResult === 'local' → 仅存本地，跳过后端同步
      // conflictResult === 'overwrite' | null → 正常同步到后端
      let syncFailed = false;
      if (conflictResult !== 'local') {
        const r = await chrome.storage.local.get('gm_user_name');
        const rawName = (r?.gm_user_name || '').trim();
        if (rawName) {
          const syncOk = await syncPersonalDataToBackend(rawName, personalCategories, personalCommands);
          if (!syncOk) syncFailed = true;
        }
      }

      buildPersonalCategoryTabs();
      renderPersonalButtons();
      if (conflictResult === 'local') {
        const updatedStr = updatedCmds > 0 ? `，覆盖 ${updatedCmds} 条` : '';
        showGenStatus(`导入完成（仅存本地）：新增 ${addedCats} 个分组、${addedCmds} 条${updatedStr}`);
      } else if (syncFailed) {
        showGenStatus(`导入完成：新增 ${addedCats} 个分组、${addedCmds} 条指令（后端同步失败，数据已存本地）`, true);
      } else {
        const updatedStr = updatedCmds > 0 ? `，覆盖 ${updatedCmds} 条` : '';
        showGenStatus(`导入完成：新增 ${addedCats} 个分组、${addedCmds} 条${updatedStr}`);
      }
    } catch (e) {
      showGenStatus('导入失败: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = '导入 JSON';
    importFileInput.value = '';
  });

  // ================================================================
  //  导入冲突确认弹窗
  // ================================================================
  const conflictModal = document.getElementById('import-conflict-modal');
  const closeConflictBtn = document.getElementById('close-conflict-modal-btn');
  const conflictOverwriteBtn = document.getElementById('conflict-overwrite-btn');
  const conflictLocalBtn = document.getElementById('conflict-local-btn');
  const conflictCancelBtn = document.getElementById('conflict-cancel-btn');

  // 'overwrite' | 'local' | null
  let conflictResolve = null;

  function formatTime(isoStr) {
    if (!isoStr) return '未知';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return isoStr; }
  }

  function showConflictModal(importedCmds, importedCats, backendCmds, backendCats, importTime, backendTime) {
    return new Promise(resolve => {
      conflictResolve = resolve;

      const impMeta = document.getElementById('conflict-import-meta');
      const beMeta = document.getElementById('conflict-backend-meta');
      const detail = document.getElementById('conflict-detail');

      impMeta.textContent = `${importedCats.length} 个分组，${importedCmds.length} 条指令\n更新时间：${formatTime(importTime)}`;
      beMeta.textContent = `${backendCats.length} 个分组，${backendCmds.length} 条指令\n更新时间：${formatTime(backendTime)}`;

      const impSet = new Set(importedCmds.map(c => c.name));
      const beSet = new Set(backendCmds.map(c => c.name));
      const onlyInImport = importedCmds.filter(c => !beSet.has(c.name));
      const onlyInBackend = backendCmds.filter(c => !impSet.has(c.name));

      let detailHtml = '';
      if (onlyInBackend.length > 0) {
        detailHtml += `<b>⚠️ 仅云端有（导入后会被合并，不会丢失）：</b><br>`;
        onlyInBackend.slice(0, 5).forEach(c => {
          detailHtml += `· ${c.name}${c.category ? ` [${c.category}]` : ''}<br>`;
        });
        if (onlyInBackend.length > 5) detailHtml += `· ...等共 ${onlyInBackend.length} 条<br>`;
      }
      detailHtml += `<br><b>仅导入文件有（将新增到云端）：</b><br>`;
      if (onlyInImport.length > 0) {
        onlyInImport.slice(0, 5).forEach(c => {
          detailHtml += `· ${c.name}${c.category ? ` [${c.category}]` : ''}<br>`;
        });
        if (onlyInImport.length > 5) detailHtml += `· ...等共 ${onlyInImport.length} 条`;
      } else {
        detailHtml += `（无）`;
      }
      detail.innerHTML = detailHtml;

      conflictModal.classList.remove('hidden');
    });
  }

  function hideConflictModal(result) {
    conflictModal.classList.add('hidden');
    if (conflictResolve) { conflictResolve(result); conflictResolve = null; }
  }

  closeConflictBtn.addEventListener('click', () => hideConflictModal(null));
  conflictCancelBtn.addEventListener('click', () => hideConflictModal(null));
  conflictModal.addEventListener('click', e => { if (e.target === conflictModal) hideConflictModal(null); });
  conflictOverwriteBtn.addEventListener('click', () => hideConflictModal('overwrite'));
  conflictLocalBtn.addEventListener('click', () => hideConflictModal('local'));

  saveWhitelistBtn.addEventListener('click', async () => {
    const lines = whitelistInput.value.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    try { await chrome.storage.local.set({ [STORAGE_KEY]: lines }); } catch (e) {}
    showGenStatus('白名单已保存');
  });

  // ================================================================
  //  分组弹窗（创建/编辑）
  // ================================================================
  const catModalTitle = document.getElementById('cat-modal-title');
  const catDeleteZone = document.getElementById('cat-delete-zone');
  const catDivider = document.getElementById('cat-divider');
  const modalCatDeleteBtn = document.getElementById('modal-cat-delete-btn');
  let editingCategory = null; // null=创建模式，string=编辑模式

  function openEditCategoryModal(cat) {
    editingCategory = cat;
    catModalTitle.textContent = '编辑分组';
    modalCatConfirmBtn.textContent = '保存';
    modalCatName.value = cat;
    catDeleteZone.classList.remove('hidden');
    catDivider.classList.remove('hidden');
    catModal.classList.remove('hidden');
    modalCatName.focus();
    modalCatName.select();
  }

  addCatBtn.addEventListener('click', () => {
    editingCategory = null;
    catModalTitle.textContent = '新建分组';
    modalCatConfirmBtn.textContent = '创建';
    modalCatName.value = '';
    catDeleteZone.classList.add('hidden');
    catDivider.classList.add('hidden');
    catModal.classList.remove('hidden');
    modalCatName.focus();
  });

  closeCatBtn.addEventListener('click', () => catModal.classList.add('hidden'));
  modalCatCancelBtn.addEventListener('click', () => catModal.classList.add('hidden'));
  catModal.addEventListener('click', (e) => { if (e.target === catModal) catModal.classList.add('hidden'); });

  modalCatConfirmBtn.addEventListener('click', async () => {
    const name = modalCatName.value.trim();
    if (!name) { modalCatName.focus(); return; }
    if (editingCategory === null) {
      // 创建模式
      if (personalCategories.includes(name)) { showPerStatus('分组已存在'); return; }
      personalCategories.push(name);
      personalCategoriesOrder.push(name);  // 同步 Tab 顺序
      showPerStatus('已创建分组: ' + name);
    } else {
      // 编辑模式
      if (name !== editingCategory) {
        if (personalCategories.includes(name)) { showPerStatus('分组名已存在'); return; }
        const idx = personalCategories.indexOf(editingCategory);
        if (idx !== -1) personalCategories[idx] = name;
        const orderIdx = personalCategoriesOrder.indexOf(editingCategory);
        if (orderIdx !== -1) personalCategoriesOrder[orderIdx] = name;  // 同步 Tab 顺序
        // 更新已有指令的分类
        personalCommands.forEach(cmd => { if (cmd.category === editingCategory) cmd.category = name; });
        await saveLocalPersonalCommands(personalCommands);
        if (currentPerCategory === editingCategory) currentPerCategory = name;
      }
      showPerStatus('已保存分组: ' + name);
    }
    await saveLocalPersonalCategories(personalCategories);
    await saveLocalPersonalFull({ categories: personalCategories, commands: personalCommands });
    if (currentUserName) await syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
    buildPersonalCategoryTabs();
    renderPersonalButtons();
    catModal.classList.add('hidden');
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
  });

  modalCatDeleteBtn.addEventListener('click', async () => {
    if (!editingCategory) return;
    personalCategories = personalCategories.filter(c => c !== editingCategory);
    personalCategoriesOrder = personalCategoriesOrder.filter(c => c !== editingCategory);  // 同步 Tab 顺序
    // 该分组下的指令归入空分组
    personalCommands.forEach(cmd => { if (cmd.category === editingCategory) cmd.category = ''; });
    await saveLocalPersonalCategories(personalCategories);
    await saveLocalPersonalCommands(personalCommands);
    await saveLocalPersonalFull({ categories: personalCategories, commands: personalCommands });
    if (currentUserName) await syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
    if (currentPerCategory === editingCategory) {
      currentPerCategory = 'all';
      renderPersonalButtons();
    }
    buildPersonalCategoryTabs();
    showPerStatus('已删除分组: ' + editingCategory);
    catModal.classList.add('hidden');
    catDeleteZone.classList.add('hidden');
    catDivider.classList.add('hidden');
    editingCategory = null;
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
  });

  // ================================================================
  //  添加/编辑个人指令弹窗
  // ================================================================
  function populateCategoryTags(selectedCategory) {
    modalCategoryTags.innerHTML = '';
    // 不分组
    const allTag = document.createElement('div');
    allTag.className = 'modal-cat-tag' + (selectedCategory === '' ? ' active' : '');
    allTag.textContent = '(不分组)';
    allTag.addEventListener('click', () => {
      modalCategoryTags.querySelectorAll('.modal-cat-tag').forEach(t => t.classList.remove('active'));
      allTag.classList.add('active');
      modalCmdCategory.value = '';
    });
    modalCategoryTags.appendChild(allTag);
    // 各分组
    personalCategories.forEach(cat => {
      const tag = document.createElement('div');
      tag.className = 'modal-cat-tag' + (selectedCategory === cat ? ' active' : '');
      tag.textContent = cat;
      tag.addEventListener('click', () => {
        modalCategoryTags.querySelectorAll('.modal-cat-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        modalCmdCategory.value = cat;
      });
      modalCategoryTags.appendChild(tag);
    });
  }

  const modalDeleteZone = document.getElementById('modal-delete-zone');
  const modalDivider = document.getElementById('modal-divider');
  const modalDeleteCmdBtn = document.getElementById('modal-delete-cmd-btn');

  addCmdBtn.addEventListener('click', () => {
    editingIndex = -1;
    modalTitle.textContent = '添加自定义指令';
    modalConfirmBtn.textContent = '添加';
    modalCmdName.value = '';
    modalCmdText.value = '';
    modalCmdCategory.value = '';
    populateCategoryTags('');
    modalDeleteZone.classList.add('hidden');
    modalDivider.classList.add('hidden');
    cmdModal.classList.remove('hidden');
    modalCmdName.focus();
  });

  function openEditPersonalModal(index) {
    editingIndex = index;
    const cmd = personalCommands[index];
    modalTitle.textContent = '编辑指令';
    modalConfirmBtn.textContent = '保存';
    modalCmdName.value = cmd.name;
    modalCmdText.value = cmd.text;
    modalCmdCategory.value = cmd.category || '';
    populateCategoryTags(cmd.category || '');
    modalDeleteZone.classList.remove('hidden');
    modalDivider.classList.remove('hidden');
    cmdModal.classList.remove('hidden');
    modalCmdName.focus();
  }

  closeModalBtn.addEventListener('click', () => cmdModal.classList.add('hidden'));
  modalCancelBtn.addEventListener('click', () => cmdModal.classList.add('hidden'));
  cmdModal.addEventListener('click', (e) => { if (e.target === cmdModal) cmdModal.classList.add('hidden'); });

  modalDeleteCmdBtn.addEventListener('click', async () => {
    if (editingIndex < 0) return;
    const removed = personalCommands.splice(editingIndex, 1)[0];
    await saveLocalPersonalCommands(personalCommands);
    if (currentUserName) await syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
    cmdModal.classList.add('hidden');
    showPerStatus('已删除: ' + removed.name);
    renderPersonalButtons();
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
  });

  modalConfirmBtn.addEventListener('click', async () => {
    const name = modalCmdName.value.trim();
    const text = modalCmdText.value.trim();
    const category = modalCmdCategory.value;
    if (!name) { modalCmdName.focus(); return; }
    if (!text) { modalCmdText.focus(); return; }

    if (editingIndex >= 0) {
      personalCommands[editingIndex] = { name, text, category };
      showPerStatus('已保存: ' + name);
    } else {
      personalCommands.push({ name, text, category });
      showPerStatus('已添加: ' + name);
    }
    await saveLocalPersonalCommands(personalCommands);
    if (currentUserName) await syncPersonalDataToBackend(currentUserName, personalCategories, personalCommands);
    cmdModal.classList.add('hidden');
    renderPersonalButtons();
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
  });

  // ================================================================
  //  清空历史
  // ================================================================
  clearHistoryBtn.addEventListener('click', async () => {
    history = [];
    try { await chrome.storage.local.set({ gm_history: [] }); } catch (e) {}
    renderHistory();
  });

  // ================================================================
  //  加载历史
  // ================================================================
  chrome.storage.local.get('gm_history', r => {
    history = r.gm_history || [];
    renderHistory();
  });

  // ================================================================
  //  初始化
  // ================================================================

  // 读取用户名并打印
  chrome.storage.local.get('gm_user_name', r => {
    console.log('[GM面板] gm_user_name =', r?.gm_user_name);
  });

  // 等待 gm_user_name 就绪（content_script 扫描需要时间）
  async function waitForUserName(maxAttempts = 15, intervalMs = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
      const r = await chrome.storage.local.get('gm_user_name');
      const rawName = (r?.gm_user_name || '').trim();
      if (rawName) return rawName;
      if (i < maxAttempts - 1) await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return '';
  }

  // 读取白名单并打印
  chrome.storage.local.get(STORAGE_KEY, r => {
    console.log('[GM面板] gm_whitelist =', r?.[STORAGE_KEY]);
  });

  // 「全部」按钮事件（静态元素，需手动绑定）
  document.querySelector('#general-category-list .left-sidebar-item[data-category="all"]')?.addEventListener('click', () => {
    document.querySelectorAll('#general-category-list .left-sidebar-item').forEach(t => t.classList.remove('active'));
    document.querySelector('#general-category-list .left-sidebar-item[data-category="all"]').classList.add('active');
    currentGenCategory = 'all';
    currentGenKeyword = '';
    genSearchInput.value = '';
    renderGeneralButtons();
  });

  document.querySelector('#personal-category-list .left-sidebar-item[data-category="all"]')?.addEventListener('click', () => {
    document.querySelectorAll('#personal-category-list .left-sidebar-item').forEach(t => t.classList.remove('active'));
    document.querySelector('#personal-category-list .left-sidebar-item[data-category="all"]').classList.add('active');
    currentPerCategory = 'all';
    currentPerKeyword = '';
    perSearchInput.value = '';
    renderPersonalButtons();
  });

  console.log('[GM面板] ===== 开始初始化 =====');
  await syncGeneralFromBackend();
  console.log('[GM面板] syncGeneralFromBackend 完成后, generalCommands keys:', Object.keys(generalCommands).join(', '));

  // 必须等个人数据全部加载完成再渲染 UI，避免闪烁和默认值污染
  // 先等用户名就绪（content_script 扫描需要时间）
  console.log('[GM面板] 开始等待 gm_user_name...');
  const name = await waitForUserName();
  console.log('[GM面板] waitForUserName 返回, name:', name || '(空)');
  if (name) currentUserName = name;
  console.log('[GM面板] currentUserName 设置为:', currentUserName);
  await reloadPersonalCategories();
  await reloadPersonalCommands(true); // 等待后端同步完成

  await loadGeneralOrder();
  await loadPersonalOrder();
  await loadGeneralCategoriesOrder();
  await loadPersonalCategoriesOrder();

  buildGeneralCategoryTabs();
  buildPersonalCategoryTabs();
  renderGeneralButtons();
  renderPersonalButtons();

  initDragDrop('#buttons-container', true);
  initDragDrop('#personal-buttons-container', false);
  initSidebarDragDrop('#general-category-list', true);
  initSidebarDragDrop('#personal-category-list', false);

  // 观察高度变化
  const genObs = new MutationObserver(reportHeight);
  genObs.observe(genContainer, { childList: true, subtree: true });
  const perObs = new MutationObserver(reportHeight);
  perObs.observe(perContainer, { childList: true, subtree: true });

  requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });

  // ================================================================
  //  新版本检查
  // ================================================================
  (async function checkUpdate() {
    try {
      const res = await fetch('https://wiszz23.github.io/Moonton-GMHelper/updates.json?t=' + Date.now());
      const data = await res.json();
      const latest = data.version;
      const current = chrome.runtime.getManifest().version;
      const v1 = latest.split('.').map(Number), v2 = current.split('.').map(Number);
      const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const na = a[i]||0, nb = b[i]||0; if (na > nb) return 1; if (na < nb) return -1; } return 0; };
      if (cmp(v1, v2) > 0) {
        const bar = document.createElement('div');
        bar.style.cssText = 'background:#FF5722;color:#fff;padding:10px 16px;font-size:13px;display:flex;align-items:center;justify-content:space-between;border-radius:6px;margin:8px 0;';
        bar.innerHTML = `<span>发现新版本 <b>v${latest}</b>（当前 v${current}）</span><a href="${data.downloadUrl}" target="_blank" style="background:#fff;color:#FF5722;padding:4px 12px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:bold;">下载更新</a>`;
        document.body.insertBefore(bar, document.body.firstChild);
      }
    } catch (e) {}
  })();

  // ================================================================
  //  用户名轮询
  // ================================================================
  (async function pollUserName() {
    for (let i = 1; i <= 30; i++) {
      try {
        const r = await chrome.storage.local.get('gm_user_name');
        const rawName = (r?.gm_user_name || '').trim();
        if (rawName) {
          if (!currentUserName || currentUserName !== rawName) {
            currentUserName = rawName;
            await reloadPersonalCategories();
            buildPersonalCategoryTabs();
            await reloadPersonalCommands(true); // 等待后端同步完成
            renderPersonalButtons();
          }
          return;
        }
      } catch (e) {}
      if (i < 30) await new Promise(r => setTimeout(r, 1000));
    }
  })();

});
