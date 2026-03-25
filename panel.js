document.addEventListener('DOMContentLoaded', async () => {
  try {
  const inputText = document.getElementById('input-text');
  const buttonsContainer = document.getElementById('buttons-container');
  const statusArea = document.getElementById('status-area');
  const autoRunCheckbox = document.getElementById('auto-run-checkbox');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const whitelistInput = document.getElementById('whitelist-input');
  const saveWhitelistBtn = document.getElementById('save-whitelist-btn');
  const historyArea = document.getElementById('history-area');
  const historyEmpty = document.getElementById('history-empty');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const searchInput = document.getElementById('search-input');
  const addCmdBtn = document.getElementById('add-cmd-btn');
  const modal = document.getElementById('add-cmd-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalCmdName = document.getElementById('modal-cmd-name');
  const modalCmdText = document.getElementById('modal-cmd-text');
  const modalCmdCategory = document.getElementById('modal-cmd-category');
  const modalTitle = document.getElementById('modal-title');

  let commands = {};
  let personalCommands = [];
  let currentTab = 'general';
  let editingIndex = -1;
  let history = [];
  let currentUserName = '';
  const BACKEND_URL = 'http://localhost:3000';
  const BACKEND_TIMEOUT = 5000; // 后端请求超时 5 秒

  // ====== 通过轮询 chrome.storage.local 获取用户名 ======
  (async function pollUserName() {
    const MAX_ATTEMPTS = 30;
    const INTERVAL = 1000;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      try {
        const result = await chrome.storage.local.get('gm_user_name');
        if (result && result.gm_user_name) {
          const name = result.gm_user_name.trim();
          if (!currentUserName || currentUserName !== name) {
            currentUserName = name;
            await reloadPersonalCommands();
          }
          return;
        }
      } catch (e) {}
      if (i < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, INTERVAL));
      }
    }
  })();

  // ====== 从本地存储加载个人指令（兜底） ======
  async function loadLocalPersonalCommands() {
    try {
      const result = await chrome.storage.local.get('gm_personal_commands');
      return (result.gm_personal_commands || []).map(cmd => ({
        name: cmd.name,
        text: cmd.text,
        category: cmd.category || '道具'
      }));
    } catch (e) {
      return [];
    }
  }

  // ====== 保存个人指令到本地存储 ======
  async function saveLocalPersonalCommands(cmds) {
    try {
      await chrome.storage.local.set({ gm_personal_commands: cmds });
    } catch (e) {}
  }

  // ====== 从后端拉取个人指令（5秒超时，失败用本地兜底） ======
  async function syncFromBackend(owner) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/commands/${encodeURIComponent(owner)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.commands) {
        const remote = JSON.parse(data.commands);
        return remote.map(cmd => ({
          name: cmd.name,
          text: cmd.text,
          category: cmd.category || '道具'
        }));
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // 超时或网络错误 → 使用本地兜底
    }
    return null;
  }

  // ====== 上传个人指令到后端（5秒超时，失败不报错） ======
  async function syncToBackend(owner, cmds) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, commands: JSON.stringify(cmds) }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      // 网络错误/超时静默忽略，指令已存在本地，下次启动会重试同步
    }
  }

  // ====== 加载+同步个人指令 ======
  async function reloadPersonalCommands() {
    const localCmds = await loadLocalPersonalCommands();
    if (!currentUserName) {
      personalCommands = localCmds;
      return;
    }
    const remoteCmds = await syncFromBackend(currentUserName);
    if (remoteCmds && remoteCmds.length > 0) {
      // 后端优先，本地同步后端
      personalCommands = remoteCmds;
      await saveLocalPersonalCommands(personalCommands);
    } else if (localCmds.length > 0) {
      // 本地兜底，上传到后端
      personalCommands = localCmds;
      await syncToBackend(currentUserName, personalCommands);
    } else {
      personalCommands = [];
    }
  }

  // ====== 通用/个人 Tab 切换 ======
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      currentKeyword = '';
      searchInput.value = '';
      // 切换 tab 时重置搜索词，分类保持当前选中状态（通用/个人均支持分类过滤）
      renderButtons();
      requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
    });
  });

  // ====== 添加指令弹层 ======
  function openModal(index) {
    editingIndex = (index !== undefined && index !== null) ? index : -1;
    if (editingIndex >= 0) {
      // 编辑模式
      const cmd = personalCommands[editingIndex];
      modalTitle.textContent = '编辑指令';
      modalConfirmBtn.textContent = '保存';
      modalCmdName.value = cmd.name;
      modalCmdText.value = cmd.text;
      modalCmdCategory.value = cmd.category || '道具';
    } else {
      // 添加模式
      modalTitle.textContent = '添加自定义指令';
      modalConfirmBtn.textContent = '添加';
      modalCmdName.value = '';
      modalCmdText.value = '';
      modalCmdCategory.value = '道具';
    }
    modal.classList.remove('hidden');
    modalCmdName.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    editingIndex = -1;
  }

  addCmdBtn.addEventListener('click', () => openModal());
  closeModalBtn.addEventListener('click', closeModal);
  modalCancelBtn.addEventListener('click', closeModal);

  // 点击遮罩层关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 添加 / 保存指令
  modalConfirmBtn.addEventListener('click', async () => {
    const name = modalCmdName.value.trim();
    const text = modalCmdText.value.trim();
    const category = modalCmdCategory.value;
    if (!name) { modalCmdName.focus(); return; }
    if (!text) { modalCmdText.focus(); return; }

    if (editingIndex >= 0) {
      // 编辑保存
      personalCommands[editingIndex] = { name, text, category };
      showStatus('指令「' + name + '」已保存');
    } else {
      // 新增
      personalCommands.push({ name, text, category });
      showStatus('指令「' + name + '」已添加');
    }

    // 保存到本地
    await saveLocalPersonalCommands(personalCommands);
    // 同步到后端
    if (currentUserName) await syncToBackend(currentUserName, personalCommands);

    closeModal();
    if (currentTab === 'personal') {
      currentKeyword = '';
      searchInput.value = '';
      renderButtons();
    }
  });

  // ====== 状态提示 ======
  let statusTimeout;
  function showStatus(message, isError = false) {
    statusArea.textContent = message;
    statusArea.className = 'status-area ' + (isError ? 'error' : 'info');
    statusArea.style.display = 'block';
    // 等待状态区渲染完成后上报新高度
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      statusArea.style.display = 'none';
      // 状态消失后也上报一次
      requestAnimationFrame(reportHeight);
    }, 3000);
  }

  // ====== 左侧 Sidebar 切换 ======
  const sidebar = document.querySelector('.sidebar');
  sidebar.addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;
    const panelName = item.dataset.panel;

    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));

    item.classList.add('active');
    document.getElementById('panel-' + panelName).classList.add('active');

    if (panelName === 'history') renderHistory();
  });

  // ====== 设置面板 ======
  settingsBtn.addEventListener('click', async () => {
    settingsPanel.classList.remove('hidden');
    // 等待面板展开渲染完成后上报新高度
    requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
    try {
      const result = typeof chrome !== 'undefined' && chrome.storage
        ? await chrome.storage.local.get('gm_whitelist')
        : {};
      const whitelist = result.gm_whitelist || getDefaultWhitelist().join('\n');
      whitelistInput.value = whitelist;
    } catch (e) {
      whitelistInput.value = getDefaultWhitelist().join('\n');
    }
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('hidden');
    // 收起后立即上报新高度
    requestAnimationFrame(reportHeight);
  });

  saveWhitelistBtn.addEventListener('click', async () => {
    const lines = whitelistInput.value.split('\n').map(l => l.trim()).filter(Boolean);
    const text = lines.join('\n');
    console.log('[GM助手] 保存白名单:', text);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ gm_whitelist: text });
        console.log('[GM助手] 保存成功');
      } else {
        console.warn('[GM助手] chrome.storage 不可用');
      }
    } catch (e) {
      console.error('[GM助手] 保存失败:', e);
    }
    showStatus('白名单已保存，已同步生效');
    settingsPanel.classList.add('hidden');
  });

  function getDefaultWhitelist() {
    return [
      'http://gm.pre.nova.moonton.com:8201',
      'http://gm.nova.oa.mt:8201',
      'https://gm-cn.yyf.muyinetwork.com:8201',
      'https://gm.jp.novagames.net:8201',
      'https://gm.usa.novagames.net:8201'
    ];
  }

  // ====== 命令加载 ======
  async function loadCommands() {
    try {
      const url = chrome.runtime.getURL('commands.json');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      commands = await response.json();
      console.log('[GM助手] 加载了', Object.keys(commands).length, '条通用指令');
    } catch (err) {
      console.error('[GM助手] 加载指令失败:', err);
      commands = {};
      buttonsContainer.innerHTML = '<div class="search-empty">指令加载失败，请刷新重试</div>';
    }
    // 加载个人指令
    await reloadPersonalCommands();
    renderButtons();
    observeHeight();
    // 等待一帧让按钮 DOM 完全渲染，再上报高度
    requestAnimationFrame(reportHeight);
  }

  // ====== 拼音兼容搜索 ======
  // 汉字 → 拼音首字母 反向映射表（每个汉字唯一对应一个拼音）
  const CHAR_PINYIN = {
    // A
    '啊':'a','爱':'ai','安':'an','暗':'an','奥':'ao','敖':'ao','阿':'a',
    '矮':'ai','挨':'ai','碍':'ai','隘':'ai','岸':'an','案':'an','鞍':'an','昂':'ang',
    // B
    '不':'b','部':'b','报':'b','别':'bie','表':'biao','并':'bing','本':'ben','把':'ba','必':'bi','百':'bai','变':'bian','办':'ban','比':'bi','半':'ban','被':'bei','保':'bao','编':'bian','北':'bei','标':'biao',
    '八':'ba','巴':'ba','拔':'ba','伯':'bo','吧':'ba','罢':'ba','芭':'ba','霸':'ba','疤':'ba','白':'bai','败':'bai','摆':'bai','拜':'bai','柏':'bai',
    '板':'ban','班':'ban','颁':'ban','扮':'ban','帮':'bang','棒':'bang','榜':'bang','绑':'bang',
    '包':'bao','宝':'bao','暴':'bao','爆':'bao','胞':'bao','倍':'bei','背':'bei','贝':'bei','杯':'bei',
    '笨':'ben','蹦':'beng','笔':'bi','毕':'bi','币':'bi','秘':'mi','闭':'bi','壁':'bi','避':'bi','臂':'bi',
    '彪':'biao','膘':'biao','憋':'bie','彬':'bin','滨':'bin','斌':'bin','濒':'bin',
    '冰':'bing','兵':'bing','博':'bo','拨':'bo','播':'bo','玻':'bo','波':'bo','勃':'bo',
    '布':'bu','步':'bu','补':'bu','捕':'bu','堡':'bu',
    // C
    '从':'cong','次':'ci','存':'cun','村':'cun','策':'ce','划':'hua','此':'ci','才':'cai','参':'can','长':'chang','厂':'chang','常':'chang','场':'chang','成':'cheng','城':'cheng','呈':'cheng','程':'cheng','持':'chi','赤':'chi','初':'chu','处':'chu','差':'cha','除':'chu','辞':'ci',
    '拆':'chai','擦':'ca',
    '采':'cai','彩':'cai','菜':'cai','蔡':'cai','餐':'can','残':'can','惭':'can','灿':'can',
    '藏':'cang','仓':'cang','苍':'cang','草':'cao','操':'cao','曹':'cao','槽':'cao',
    '测':'ce','策':'ce','册':'ce','侧':'ce','厕':'ce','层':'ceng','查':'cha','插':'cha',
    '茶':'cha','察':'cha','柴':'chai','产':'chan','单':'dan','阐':'chan','颤':'chan',
    '唱':'chang','畅':'chang','超':'chao','朝':'chao','潮':'chao','炒':'chao','吵':'chao','抄':'chao',
    '车':'che','彻':'che','陈':'chen','沉':'chen','晨':'chen','衬':'chen','称':'chen',
    '撑':'cheng','迟':'chi','池':'chi','吃':'chi','齿':'chi','充':'chong','冲':'chong','虫':'chong','重':'zhong',
    '崇':'chong','抽':'chou','愁':'chou','臭':'chou','仇':'chou','丑':'chou',
    '触':'chu','储':'chu','楚':'chu','传':'chuan','川':'chuan','穿':'chuan','船':'chuan',
    '创':'chuang','床':'chuang','闯':'chuang','吹':'chui','垂':'chui','捶':'chui',
    '春':'chun','纯':'chun','唇':'chun','醇':'chun','戳':'chuo','勿':'cong',
    '粗':'cu','促':'cu','簇':'cu','窜':'cuan','攒':'cuan','催':'cui','脆':'cui','崔':'cui',
    '错':'cuo','措':'cuo','搓':'cuo','挫':'cuo',
    // D
    '大':'da','对':'dui','地':'di','斗':'dou','动':'dong','东':'dong','西':'xi','掉':'diao','端':'duan','调':'diao','独':'du','读':'du','短':'duan','断':'duan','度':'du','队':'dui','顶':'ding','登':'deng','典':'dian','店':'dian',
    '达':'da','打':'da','答':'da','搭':'da','带':'dai','待':'dai','呆':'dai','袋':'dai',
    '蛋':'dan','胆':'dan','担':'dan','弹':'dan','淡':'dan','当':'dang','党':'dang','档':'dang','挡':'dang',
    '到':'dao','道':'dao','导':'dao','倒':'dao','刀':'dao','岛':'dao','盗':'dao',
    '的':'de','得':'de','等':'deng','灯':'deng','邓':'deng','第':'di','提':'ti','低':'di','底':'di','敌':'di','递':'di','滴':'di',
    '嗲':'dia','点':'dian','电':'dian','淀':'dian','殿':'dian',
    '吊':'diao','钓':'diao','雕':'diao','跌':'die','爹':'die','碟':'die','谍':'die','叠':'die',
    '钉':'ding','叮':'ding','丢':'diu','冬':'dong','懂':'dong','冻':'dong','洞':'dong',
    '都':'dou','豆':'dou','逗':'dou','毒':'du','渡':'du','杜':'du','段':'duan',
    '堆':'dui','吨':'dun','顿':'dun','盾':'dun','蹲':'dun','夺':'duo','朵':'duo','躲':'duo',
    // E
    '额':'e','恶':'e','饿':'e','俄':'e','鹅':'e','遏':'e','诶':'ei','恩':'en','嗯':'ng',
    // F
    '发':'fa','法':'fa','反':'fan','方':'fang','分':'fen','风':'feng','服':'fu','复':'fu','飞':'fei','福':'fu','番':'fan','放':'fang','副':'fu','封':'feng','费':'fei','范':'fan','符':'fu','罚':'fa','乏':'fa',
    '翻':'fan','饭':'fan','犯':'fan','凡':'fan','繁':'fan','纺':'fang','防':'fang','房':'fang','访':'fang',
    '非':'fei','肥':'fei','废':'fei','肺':'fei','纷':'fen','奋':'fen','粪':'fen',
    '蜂':'feng','丰':'feng','枫':'feng','佛':'fo','否':'fou','父':'fu','附':'fu','幅':'fu','赴':'fu','扶':'fu','腐':'fu','赋':'fu',
    // G
    '个':'ge','工':'gong','国':'guo','高':'gao','各':'ge','管':'guan','规':'gui','广':'guang','过':'guo','给':'gei','格':'ge','功':'gong','共':'gong','关':'guan','固':'gu','果':'guo',
    '嘎':'ga','改':'gai','概':'gai','钙':'gai','感':'gan','赶':'gan','敢':'gan','甘':'gan','肝':'gan','杆':'gan',
    '刚':'gang','钢':'gang','港':'gang','岗':'gang','搞':'gao','稿':'gao','告':'gao','糕':'gao',
    '歌':'ge','哥':'ge','革':'ge','阁':'ge','葛':'ge','根':'gen','跟':'gen','更':'geng','耕':'geng','颈':'jing','耿':'geng','梗':'geng',
    '公':'gong','共':'gong','攻':'gong','宫':'gong','贡':'gong','够':'gou','构':'gou','购':'gou','狗':'gou','钩':'gou',
    '古':'gu','顾':'gu','故':'gu','估':'gu','股':'gu','骨':'gu','谷':'gu','鼓':'gu','雇':'gu','挂':'gua','刮':'gua','瓜':'gua','寡':'gua','卦':'gua',
    '怪':'guai','乖':'guai','拐':'guai','观':'guan','官':'guan','馆':'guan','惯':'guan','罐':'guan',
    '光':'guang','逛':'guang','贵':'gui','鬼':'gui','轨':'gui','归':'gui','柜':'gui','跪':'gui','滚':'gun','棍':'gun','裹':'guo',
    // H
    '好':'hao','和':'he','会':'hui','还':'hai','火':'huo','化':'hua','工':'gong','回':'hui','互':'hu','后':'hou','话':'hua','护':'hu','或':'huo','获':'huo','红':'hong','划':'hua','呼':'hu',
    '哈':'ha','蛤':'ha','害':'hai','咳':'hai','汉':'han','含':'han','寒':'han','韩':'han','喊':'han','汗':'han','旱':'han','函':'han',
    '行':'xing','航':'hang','号':'hao','浩':'hao','毫':'hao','豪':'hao','耗':'hao',
    '河':'he','何':'he','合':'he','核':'he','喝':'he','贺':'he','赫':'he','鹤':'he','黑':'hei','嘿':'hei',
    '很':'hen','恨':'hen','横':'heng','恒':'heng','哼':'heng','洪':'hong','鸿':'hong','宏':'hong','轰':'hong',
    '候':'hou','厚':'hou','侯':'hou','户':'hu','呼':'hu','湖':'hu','虎':'hu','胡':'hu','糊':'hu','弧':'hu','忽':'hu',
    '化':'hua','华':'hua','画':'hua','花':'hua','坏':'huai','怀':'huai','淮':'huai','换':'huan','环':'huan','缓':'huan','唤':'huan','患':'huan','幻':'huan',
    '黄':'huang','荒':'huang','慌':'huang','皇':'huang','晃':'huang','汇':'hui','毁':'hui','辉':'hui','惠':'hui','徽':'hui',
    '混':'hun','婚':'hun','浑':'hun','昏':'hun','魂':'hun','祸':'huo',
    // J
    '就':'jiu','经':'jing','家':'jia','见':'jian','进':'jin','行':'xing','机':'ji','将':'jiang','交':'jiao','角':'jiao','结':'jie','教':'jiao','加':'jia','军':'jun','级':'ji','近':'jin','激':'ji','击':'ji','金':'jin','极':'ji','九':'jiu','件':'jian','技':'ji','建':'jian','具':'ju','济':'ji','集':'ji',
    '及':'ji','级':'ji','即':'ji','几':'ji','记':'ji','计':'ji','己':'ji','季':'ji','纪':'ji','击':'ji','积':'ji','激':'ji','集':'ji','极':'ji','给':'gei','辑':'ji','籍':'ji','疾':'ji','吉':'ji','鸡':'ji',
    '假':'jia','价':'jia','甲':'jia','嘉':'jia','架':'jia','佳':'jia','夹':'jia','嫁':'jia','监':'jian','减':'jian','键':'jian','尖':'jian','兼':'jian','简':'jian','碱':'jian','检':'jian',
    '奖':'jiang','讲':'jiang','降':'jiang','酱':'jiang','匠':'jiang','强':'qiang',
    '较':'jiao','教':'jiao','叫':'jiao','脚':'jiao','缴':'jiao','焦':'jiao','轿':'jiao','郊':'jiao','骄':'jiao',
    '街':'jie','节':'jie','姐':'jie','解':'jie','界':'jie','借':'jie','洁':'jie','截':'jie',
    '今':'jin','仅':'jin','紧':'jin','尽':'jin','锦':'jin','晋':'jin','禁':'jin','浸':'jin',
    '京':'jing','精':'jing','惊':'jing','竞':'jing','静':'jing','井':'jing','净':'jing','睛':'jing','景':'jing','境':'jing','镜':'jing',
    '窘':'jiong','炯':'jiong','酒':'jiu','久':'jiu','救':'jiu','旧':'jiu','舅':'jiu','纠':'jiu',
    '据':'ju','举':'ju','居':'ju','局':'ju','巨':'ju','聚':'ju','剧':'ju','拒':'ju','距':'ju','矩':'ju','鞠':'ju',
    '卷':'juan','绢':'juan','倦':'juan','掘':'jue',
    '觉':'jue','爵':'jue','嚼':'jiao','均':'jun','君':'jun','俊':'jun','骏':'jun',
    // K
    '可':'ke','开':'kai','看':'kan','口':'kou','克':'ke','空':'kong','快':'kuai','控':'kong','科':'ke','课':'ke','苦':'ku','宽':'kuan','康':'kang','恐':'kong','卡':'ka','咖':'ka','喀':'ka',
    '刊':'kan','砍':'kan','坎':'kan','堪':'kan','抗':'kang','考':'kao','靠':'kao','刻':'ke','客':'ke','颗':'ke','肯':'ken','恳':'ken','啃':'ken',
    '扣':'kou','跨':'kua','夸':'kua','垮':'kua','挎':'kua','块':'kuai','筷':'kuai','况':'kuang','框':'kuang','矿':'kuang','狂':'kuang','亏':'kui','愧':'kui',
    // L
    '了':'liao','理':'li','力':'li','里':'li','利':'li','立':'li','林':'lin','类':'lei','六':'liu','路':'lu','陆':'lu','流':'liu','楼':'lou','领':'ling','了':'le',
    '拉':'la','辣':'la','腊':'la','蜡':'la','来':'lai','赖':'lai','莱':'lai','蓝':'lan','兰':'lan','栏':'lan','拦':'lan','览':'lan','懒':'lan','烂':'lan','滥':'lan',
    '浪':'lang','郎':'lang','狼':'lang','廊':'lang','老':'lao','劳':'lao','姥':'lao','捞':'lao',
    '乐':'le','勒':'lei','累':'lei','雷':'lei','泪':'lei','擂':'lei','冷':'leng','棱':'leng',
    '李':'li','历':'li','离':'li','丽':'li','例':'li','礼':'li','栗':'li','粒':'li','厉':'li','黎':'li',
    '俩':'lia','连':'lian','联':'lian','脸':'lian','恋':'lian','练':'lian','炼':'lian','链':'lian','莲':'lian',
    '量':'liang','两':'liang','亮':'liang','凉':'liang','粮':'liang','梁':'liang','良':'liang',
    '料':'liao','疗':'liao','辽':'liao','聊':'liao','廖':'liao','燎':'liao','列':'lie','猎':'lie','烈':'lie','裂':'lie',
    '临':'lin','邻':'lin','磷':'lin','淋':'lin','另':'ling','令':'ling','领':'ling','零':'ling','铃':'ling','灵':'ling','龄':'ling',
    '留':'liu','刘':'liu','溜':'liu','瘤':'liu','龙':'long','隆':'long','笼':'long','拢':'long','陇':'long',
    '搂':'lou','篓':'lou','露':'lu','卢':'lu','炉':'lu','鲁':'lu','卤':'lu','鹿':'lu',
    '律':'lv','旅':'lv','率':'lv','绿':'lv','屡':'lv','滤':'lv','卵':'luan','略':'lve','论':'lun','轮':'lun','伦':'lun',
    '罗':'luo','落':'luo','洛':'luo','骆':'luo',
    // M
    '吗':'ma','没':'mei','每':'mei','民':'min','明':'ming','面':'mian','名':'ming','么':'me','门':'men','米':'mi','密':'mi','妈':'ma','麻':'ma','码':'ma','玛':'ma',
    '买':'mai','麦':'mai','卖':'mai','满':'man','慢':'man','瞒':'man','蔓':'man','蛮':'man',
    '忙':'mang','芒':'mang','盲':'mang','茫':'mang','毛':'mao','冒':'mao','贸':'mao','帽':'mao','猫':'mao','矛':'mao',
    '妹':'mei','魅':'mei','霉':'mei','们':'men','闷':'men','梦':'meng','盟':'meng','蒙':'meng','猛':'meng','孟':'meng',
    '迷':'mi','蜜':'mi','秘':'mi','弥':'mi','幂':'mi','棉':'mian','免':'mian','缅':'mian','腼':'mian',
    '秒':'miao','苗':'miao','庙':'miao','描':'miao','瞄':'miao','灭':'mie','蔑':'mie',
    '敏':'min','闽':'min','抿':'min','铭':'ming','谬':'miu','莫':'mo','末':'mo','模':'mo','魔':'mo','抹':'mo','默':'mo','墨':'mo',
    '某':'mou','谋':'mou','牟':'mou','木':'mu','目':'mu','母':'mu','墓':'mu','幕':'mu','牧':'mu','穆':'mu',
    // N
    '你':'ni','年':'nian','那':'na','内':'nei','难':'nan','农':'nong','南':'nan','呢':'ne','能':'neng','嗯':'ng','女':'nv','哪':'na','娜':'na','拿':'na','纳':'na','乃':'nai','奶':'nai','耐':'nai','男':'nan','喃':'nan','囊':'nang','脑':'nao','闹':'nao','恼':'nao',
    '尼':'ni','泥':'ni','逆':'ni','倪':'ni','拟':'ni','昵':'ni','念':'nian','碾':'nian','娘':'niang','酿':'niang','尿':'niao','鸟':'niao','捏':'nie','聂':'nie','镍':'nie','孽':'nie',
    '您':'nin','宁':'ning','凝':'ning','拧':'ning','牛':'niu','扭':'niu','纽':'niu','浓':'nong','弄':'nong','努':'nu','奴':'nu','怒':'nu','虐':'nve',
    '哦':'o','噢':'o','欧':'ou','偶':'ou','呕':'ou',
    // P
    '批':'pi','片':'pian','票':'piao','品':'pin','普':'pu','平':'ping','怕':'pa','爬':'pa','帕':'pa','啪':'pa',
    '排':'pai','拍':'pai','牌':'pai','判':'pan','盘':'pan','叛':'pan','番':'fan','胖':'pang','庞':'pang',
    '跑':'pao','炮':'pao','泡':'pao','抛':'pao','配':'pei','培':'pei','陪':'pei','赔':'pei','佩':'pei','沛':'pei',
    '盆':'pen','喷':'pen','朋':'peng','棚':'peng','彭':'peng','蓬':'peng','碰':'peng','疲':'pi','劈':'pi','匹':'pi','屁':'pi','僻':'pi','偏':'pian','篇':'pian','骗':'pian',
    '飘':'piao','漂':'piao','撇':'pie','瞥':'pie','贫':'pin','拼':'pin','评':'ping','瓶':'ping','凭':'ping','屏':'ping',
    '破':'po','迫':'po','泼':'po','颇':'po','坡':'po','剖':'pou','扑':'pu','铺':'pu','朴':'pu','葡':'pu',
    // Q
    '起':'qi','去':'qu','全':'quan','却':'que','取':'qu','期':'qi','七':'qi','其':'qi','奇':'qi','气':'qi','区':'qu','清':'qing','请':'qing','求':'qiu','丘':'qiu','恰':'qia','洽':'qia','掐':'qia',
    '前':'qian','千':'qian','签':'qian','欠':'qian','钱':'qian','潜':'qian','钳':'qian','浅':'qian','纤':'qian','遣':'qian',
    '墙':'qiang','抢':'qiang','桥':'qiao','乔':'qiao','巧':'qiao','敲':'qiao','悄':'qiao','俏':'qiao','窍':'qiao',
    '且':'qie','切':'qie','茄':'qie','窃':'qie','怯':'qie','亲':'qin','琴':'qin','侵':'qin','勤':'qin','秦':'qin','芹':'qin',
    '轻':'qing','情':'qing','青':'qing','倾':'qing','庆':'qing','晴':'qing','穷':'qiong','琼':'qiong','球':'qiu','秋':'qiu',
    '曲':'qu','渠':'qu','趣':'qu','屈':'qu','驱':'qu','趋':'qu','泉':'quan','券':'quan','劝':'quan','雀':'que',
    '群':'qun','裙':'qun','然':'ran','燃':'ran','染':'ran','让':'rang','嚷':'rang','绕':'rao','扰':'rao',
    '热':'re','人':'ren','任':'ren','认':'ren','仁':'ren','刃':'ren','扔':'reng','仍':'reng','日':'ri',
    '容':'rong','荣':'rong','融':'rong','绒':'rong','肉':'rou','揉':'rou','如':'ru','儒':'ru','乳':'ru','辱':'ru',
    '软':'ruan','阮':'ruan','瑞':'rui','锐':'rui','润':'run','若':'ruo','弱':'ruo',
    // S
    '是':'shi','三':'san','四':'si','所':'suo','色':'se','山':'shan','时':'shi','十':'shi','少':'shao','社':'she','数':'shu','术':'shu','思':'si','司':'si','私':'si',
    '撒':'sa','洒':'sa','塞':'sai','赛':'sai','散':'san','伞':'san','桑':'sang','丧':'sang','嗓':'sang','扫':'sao','骚':'sao','涩':'se','瑟':'se','森':'sen','僧':'seng',
    '沙':'sha','啥':'sha','傻':'sha','纱':'sha','晒':'shai','筛':'shai','删':'shan','闪':'shan','衫':'shan','善':'shan','扇':'shan',
    '伤':'shang','赏':'shang','烧':'shao','稍':'shao','哨':'shao','捎':'shao','设':'she','社':'she','折':'zhe','涉':'she','舍':'she','摄':'she',
    '深':'shen','身':'shen','神':'shen','审':'shen','沈':'shen','肾':'shen','慎':'shen','生':'sheng','声':'sheng','升':'sheng','胜':'sheng','省':'sheng','圣':'sheng','盛':'sheng',
    '世':'shi','事':'shi','式':'shi','似':'si','示':'shi','士':'shi','市':'shi','适':'shi','释':'shi','室':'shi','诗':'shi','石':'shi',
    '手':'shou','首':'shou','收':'shou','守':'shou','售':'shou','寿':'shou','授':'shou','树':'shu','属':'shu','述':'shu','输':'shu','舒':'shu','熟':'shu','署':'shu','鼠':'shu',
    '刷':'shua','耍':'shua','摔':'shuai','率':'lv','帅':'shuai','衰':'shuai','栓':'shuan','拴':'shuan','双':'shuang','爽':'shuang','霜':'shuang',
    '水':'shui','税':'shui','睡':'shui','顺':'shun','瞬':'shun','朔':'shuo','硕':'shuo','烁':'shuo','丝':'si','撕':'si','送':'song','松':'song','宋':'song','颂':'song','耸':'song',
    '搜':'sou','艘':'sou','擞':'sou','速':'su','素':'su','诉':'su','塑':'su','肃':'su','俗':'su','苏':'su','宿':'su','酸':'suan','蒜':'suan',
    '岁':'sui','随':'sui','碎':'sui','虽':'sui','遂':'sui','孙':'sun','损':'sun','笋':'sun','索':'suo','锁':'suo','缩':'suo',
    // T
    '他':'ta','她':'ta','它':'ta','同':'tong','通':'tong','条':'tiao','特':'te','体':'ti','团':'tuan','题':'ti','推':'tui','天':'tian','铁':'tie','提':'ti','探':'tan','碳':'tan','叹':'tan','炭':'tan',
    '踏':'ta','塌':'ta','沓':'ta','太':'tai','台':'tai','态':'tai','抬':'tai','泰':'tai','谈':'tan','弹':'tan','坦':'tan',
    '糖':'tang','汤':'tang','唐':'tang','堂':'tang','躺':'tang','烫':'tang','趟':'tang','讨':'tao','套':'tao','逃':'tao','桃':'tao','淘':'tao','涛':'tao',
    '腾':'teng','藤':'teng','踢':'ti','替':'ti','梯':'ti','涕':'ti','剃':'ti','田':'tian','添':'tian','甜':'tian','填':'tian',
    '跳':'tiao','迢':'tiao','铁':'tie','帖':'tie','贴':'tie','听':'ting','停':'ting','庭':'ting','厅':'ting','廷':'ting',
    '统':'tong','痛':'tong','铜':'tong','童':'tong','头':'tou','投':'tou','透':'tou','图':'tu','土':'tu','突':'tu','途':'tu','屠':'tu',
    '腿':'tui','退':'tui','吞':'tun','屯':'tun','拖':'tuo','脱':'tuo','托':'tuo','拓':'tuo',
    // W
    '我':'wo','为':'wei','位':'wei','五':'wu','外':'wai','物':'wu','文':'wen','无':'wu','问':'wen','武':'wu','王':'wang','务':'wu',
    '挖':'wa','瓦':'wa','哇':'wa','蛙':'wa','洼':'wa','歪':'wai','万':'wan','完':'wan','晚':'wan','玩':'wan','碗':'wan','挽':'wan','弯':'wan','丸':'wan',
    '往':'wang','网':'wang','忘':'wang','望':'wang','旺':'wang','亡':'wang','未':'wei','围':'wei','伟':'wei','卫':'wei','危':'wei','微':'wei','味':'wei','伪':'wei','维':'wei',
    '闻':'wen','温':'wen','稳':'wen','纹':'wen','吻':'wen','翁':'weng','嗡':'weng','握':'wo','卧':'wo','窝':'wo','沃':'wo',
    // X
    '下':'xia','学':'xue','想':'xiang','些':'xie','向':'xiang','新':'xin','西':'xi','系':'xi','行':'xing','现':'xian','小':'xiao','性':'xing','息':'xi','相':'xiang','象':'xiang',
    '息':'xi','习':'xi','细':'xi','喜':'xi','戏':'xi','希':'xi','析':'xi','席':'xi','洗':'xi','吸':'xi','袭':'xi','稀':'xi','锡':'xi','夏':'xia','吓':'xia','峡':'xia','侠':'xia','厦':'xia','瞎':'xia','霞':'xia',
    '线':'xian','县':'xian','显':'xian','险':'xian','限':'xian','献':'xian','鲜':'xian','咸':'xian','贤':'xian','箱':'xiang','详':'xiang','橡':'xiang','享':'xiang','项':'xiang',
    '效':'xiao','校':'xiao','笑':'xiao','消':'xiao','销':'xiao','萧':'xiao','晓':'xiao','孝':'xiao','肖':'xiao','霄':'xiao',
    '写':'xie','谢':'xie','协':'xie','斜':'xie','携':'xie','胁':'xie',
    '心':'xin','信':'xin','辛':'xin','欣':'xin','薪':'xin','馨':'xin','醒':'xing',
    '型':'xing','形':'xing','星':'xing','姓':'xing','雄':'xiong','兄':'xiong','熊':'xiong','胸':'xiong','凶':'xiong',
    '修':'xiu','休':'xiu','羞':'xiu','秀':'xiu','绣':'xiu','袖':'xiu','朽':'xiu','续':'xu','须':'xu','需':'xu','虚':'xu','许':'xu','徐':'xu',
    '宣':'xuan','旋':'xuan','悬':'xuan','玄':'xuan','绚':'xuan','讯':'xun','迅':'xun','寻':'xun','巡':'xun','循':'xun','训':'xun',
    // Y
    '有':'you','一':'yi','和':'he','也':'ye','要':'yao','会':'hui','义':'yi','议':'yi','与':'yu','于':'yu','又':'you','已':'yi','由':'you','用':'yong','样':'yang','应':'ying','业':'ye','因':'yin','银':'yin','引':'yin','阳':'yang',
    '压':'ya','牙':'ya','亚':'ya','呀':'ya','雅':'ya','鸭':'ya','押':'ya','严':'yan','研':'yan','眼':'yan','演':'yan','颜':'yan','延':'yan','沿':'yan','炎':'yan','宴':'yan','掩':'yan','衍':'yan',
    '养':'yang','央':'yang','杨':'yang','羊':'yang','洋':'yang','仰':'yang','药':'yao','耀':'yao','摇':'yao','邀':'yao','姚':'yao','窑':'yao','谣':'yao','咬':'yao',
    '业':'ye','夜':'ye','页':'ye','叶':'ye','野':'ye','爷':'ye','耶':'ye','咽':'yan','亿':'yi','易':'yi','仪':'yi','移':'yi','异':'yi','医':'yi','亦':'yi','衣':'yi','依':'yi','伊':'yi','椅':'yi','益':'yi',
    '印':'yin','饮':'yin','阴':'yin','音':'yin','英':'ying','影':'ying','营':'ying','映':'ying','硬':'ying','迎':'ying','赢':'ying',
    '哟':'yo','永':'yong','涌':'yong','泳':'yong','勇':'yong','雍':'yong','由':'you','友':'you','优':'you','右':'you','油':'you','游':'you','幼':'you',
    '欲':'yu','域':'yu','育':'yu','语':'yu','雨':'yu','余':'yu','预':'yu','宇':'yu','玉':'yu','遇':'yu',
    '原':'yuan','员':'yuan','圆':'yuan','源':'yuan','园':'yuan','远':'yuan','愿':'yuan','怨':'yuan','院':'yuan',
    '越':'yue','约':'yue','乐':'yue','跃':'yue','岳':'yue','云':'yun','运':'yun','允':'yun','孕':'yun','韵':'yun',
    // Z
    '在':'zai','作':'zuo','自':'zi','总':'zong','走':'zou','资':'zi','子':'zi','组':'zu','最':'zui','左':'zuo','侧':'ce','字':'zi','再':'zai','杂':'za','增':'zeng','咱':'zan',
    '砸':'za','载':'zai','灾':'zai','暂':'zan','赞':'zan','攒':'zan','脏':'zang','葬':'zang',
    '造':'zao','遭':'zao','糟':'zao','枣':'zao','则':'ze','责':'ze','泽':'ze','择':'ze','贼':'zei','怎':'zen','赠':'zeng',
    '炸':'zha','扎':'zha','渣':'zha','闸':'zha','宅':'zhai','窄':'zhai','债':'zhai','寨':'zhai','站':'zhan','占':'zhan','战':'zhan','展':'zhan','沾':'zhan','斩':'zhan','盏':'zhan','崭':'zhan',
    '掌':'zhang','涨':'zhang','帐':'zhang','障':'zhang','着':'zhao','找':'zhao','照':'zhao','招':'zhao','赵':'zhao','兆':'zhao','罩':'zhao',
    '者':'zhe','哲':'zhe','浙':'zhe','针':'zhen','震':'zhen','振':'zhen','阵':'zhen',
    '正':'zheng','政':'zheng','证':'zheng','争':'zheng','整':'zheng','征':'zheng','郑':'zheng',
    '之':'zhi','只':'zhi','直':'zhi','知':'zhi','制':'zhi','治':'zhi','质':'zhi','执':'zhi','值':'zhi','职':'zhi','止':'zhi','至':'zhi','志':'zhi',
    '中':'zhong','众':'zhong','终':'zhong','种':'zhong','钟':'zhong','周':'zhou','洲':'zhou','轴':'zhou','咒':'zhou','骤':'zhou',
    '住':'zhu','注':'zhu','助':'zhu','著':'zhu','柱':'zhu','驻':'zhu','猪':'zhu','竹':'zhu','烛':'zhu','逐':'zhu',
    '抓':'zhua','爪':'zhua','拽':'zhuai','专':'zhuan','转':'zhuan','传':'chuan','赚':'zhuan','撰':'zhuan',
    '装':'zhuang','庄':'zhuang','撞':'zhuang','妆':'zhuang','壮':'zhuang','追':'zhui','坠':'zhui','缀':'zhui','准':'zhun','卓':'zhuo','捉':'zhuo','桌':'zhuo','灼':'zhuo',
    '紫':'zi','兹':'zi','宗':'zong','综':'zong','纵':'zong','踪':'zong','棕':'zong','奏':'zou','邹':'zou',
    '足':'zu','租':'zu','阻':'zu','祖':'zu','钻':'zuan','罪':'zui','醉':'zui','做':'zuo','座':'zuo',
    // AOZ
    '添':'tian','加':'jia','装':'zhuang','备':'bei','升':'sheng','级':'ji','材':'cai','料':'liao','宝':'bao','箱':'xiang','道':'dao','具':'ju'
  };

  // 当前分类和搜索词
  let currentCategory = 'all';
  let currentKeyword = '';

  // 拼音搜索匹配：关键词可以在汉字拼音首字母中匹配
  function pinyinMatch(name, keyword) {
    const kw = keyword.toLowerCase();
    if (name.toLowerCase().includes(kw)) return true;
    let pinyinStr = '';
    for (const char of name) {
      pinyinStr += (CHAR_PINYIN[char] || char);
    }
    return pinyinStr.toLowerCase().includes(kw);
  }

  // ====== 渲染按钮（支持分类过滤 + 汉字+拼音搜索） ======
  function renderButtons() {
    buttonsContainer.innerHTML = '';

    let entries = [];

    if (currentTab === 'personal') {
      // 搜索过滤（保留原始索引用于编辑/删除）
      const kw = currentKeyword.trim();
      let filtered = personalCommands
        .map((cmd, i) => ({ cmd, i }))
        .filter(({ cmd }) => {
          // 分类过滤
          if (currentCategory !== 'all' && cmd.category !== currentCategory) return false;
          // 搜索过滤
          if (kw && !pinyinMatch(cmd.name, kw)) return false;
          return true;
        });

      if (filtered.length === 0) {
        buttonsContainer.innerHTML = '<div class="search-empty">暂无个人指令，点击「+ 添加指令」新增</div>';
      } else {
        filtered.forEach(({ cmd, i }) => renderButton(cmd.name, cmd.text, i));
      }
      return;
    } else {
      // 通用指令：从 commands.json 取
      entries = Object.entries(commands);

      // 分类过滤
      if (currentCategory !== 'all') {
        entries = entries.filter(([name]) => name.includes('【' + currentCategory + '】'));
      }

      // 搜索过滤
      const kw = currentKeyword.trim();
      if (kw) {
        entries = entries.filter(([name]) => pinyinMatch(name, kw));
      }

      if (entries.length === 0) {
        buttonsContainer.innerHTML = '<div class="search-empty">无匹配结果</div>';
      } else {
        entries.forEach(([name, text]) => renderButton(name, text));
      }
    }
  }

  function renderButton(name, text, index) {
    const isPersonal = (index !== undefined && index !== null);
    const container = document.createElement('div');
    container.className = 'personal-btn-wrap';

    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = name;
    button.title = Array.isArray(text) ? text.join('\n') : text;
    button.dataset.command = Array.isArray(text) ? text.join('\n') : text;
    button.addEventListener('click', async () => {
      try { await executeCommand(button.dataset.command, name); }
      catch (e) { console.warn('executeCommand error:', e); }
    });
    container.appendChild(button);

    // 个人指令显示编辑/删除按钮
    if (isPersonal) {
      const actions = document.createElement('div');
      actions.className = 'personal-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'personal-action-btn edit-btn';
      editBtn.textContent = '✎';
      editBtn.title = '编辑';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(index);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'personal-action-btn delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = '删除';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const removed = personalCommands.splice(index, 1)[0];
        await saveLocalPersonalCommands(personalCommands);
        if (currentUserName) await syncToBackend(currentUserName, personalCommands);
        showStatus('指令「' + removed.name + '」已删除');
        renderButtons();
        requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      container.appendChild(actions);
    }

    buttonsContainer.appendChild(container);
  }

  // ====== 搜索事件 ======
  searchInput.addEventListener('input', () => {
    currentKeyword = searchInput.value;
    renderButtons();
  });

  // ====== 分类子选项切换 ======
  document.querySelectorAll('.sidebar-sub-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-sub-item').forEach(t => t.classList.remove('active'));
      item.classList.add('active');
      currentCategory = item.dataset.category;
      currentKeyword = '';
      searchInput.value = '';
      // 如果当前在历史记录面板，切回 GM列表
      const gmlistItem = document.querySelector('.sidebar-item[data-panel="gmlist"]');
      const historyItem = document.querySelector('.sidebar-item[data-panel="history"]');
      if (historyItem && historyItem.classList.contains('active')) {
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.panel-section').forEach(p => p.classList.remove('active'));
        gmlistItem.classList.add('active');
        document.getElementById('panel-gmlist').classList.add('active');
      }
      renderButtons();
      requestAnimationFrame(() => { requestAnimationFrame(reportHeight); });
    });
  });

  // ====== 添加历史记录（去重：相同命令名则更新时间并置顶） ======
  async function addHistory(commandName, commandText, roleIds) {
    const now = new Date().toLocaleTimeString();

    // 查找是否已有同名命令，有则更新并置顶，不重复添加
    const existIdx = history.findIndex(e => e.name === commandName);
    if (existIdx !== -1) {
      history[existIdx].time = now;
      history[existIdx].roleIds = roleIds;
      // 移到最前
      const [item] = history.splice(existIdx, 1);
      history.unshift(item);
    } else {
      history.unshift({
        id: Date.now(),
        name: commandName,
        command: commandText,
        roleIds: roleIds,
        time: now
      });
      if (history.length > 100) history = history.slice(0, 100);
    }

    try {
      await (typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local.set({ gm_history: history }) : Promise.resolve());
    } catch (e) {}
  }

  // ====== 渲染历史记录 ======
  function renderHistory() {
    const doRender = (result) => {
      history = result.gm_history || [];
      historyList.innerHTML = '';
      if (history.length === 0) {
        historyEmpty.style.display = 'block';
        clearHistoryBtn.style.display = 'none';
        return;
      }
      historyEmpty.style.display = 'none';
      clearHistoryBtn.style.display = 'block';

      history.forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-item-header">
            <span class="history-name">${escapeHtml(entry.name)}</span>
            <span class="history-time">${entry.time}</span>
          </div>
          <div class="history-ids">角色ID: ${escapeHtml(entry.roleIds || '-')}</div>
          <div class="history-command">${escapeHtml(entry.command.substring(0, 60))}${entry.command.length > 60 ? '...' : ''}</div>
        `;

        // 快速执行按钮
        const execBtn = document.createElement('button');
        execBtn.className = 'history-exec-btn';
        execBtn.textContent = '▶ 快速执行';
        execBtn.addEventListener('click', () => { quickExecute(entry); });
        item.appendChild(execBtn);
        historyList.appendChild(item);
      });
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('gm_history', doRender);
    } else {
      doRender({});
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ====== 快速执行（从历史记录） ======
  async function quickExecute(entry) {
    // 自动填入角色ID
    inputText.value = entry.roleIds || '';
    // 自动触发当前命令
    showStatus(`快速执行: ${entry.name}`);
    await executeCommand(entry.command, entry.name, true);
  }

  // ====== 清空历史 ======
  clearHistoryBtn.addEventListener('click', async () => {
    history = [];
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ gm_history: [] });
      }
    } catch (e) {}
    renderHistory();
  });

  // ====== 执行命令 ======
  async function executeCommand(commandTemplate, commandName, skipHistory = false) {
    const text = inputText.value.trim();
    if (!text) {
      showStatus('角色ID不能为空', true);
      inputText.focus();
      return false;
    }
    const selector = '#ctl_gmcmd';
    const iframeSelector = "iframe[name='ifa']";

    if (!skipHistory) {
      await addHistory(commandName, commandTemplate, text);
    }

    try {
      // 查找 GM 页面：查所有标签页，按域名过滤
      const allTabs = await chrome.tabs.query({});
      const GM_DOMAINS = [
        'gm.pre.nova.moonton.com',
        'gm.nova.oa.mt',
        'gm-cn.yyf.muyinetwork.com',
        'gm.jp.novagames.net',
        'gm.usa.novagames.net'
      ];
      const gmTab = allTabs.find(t => t.url && GM_DOMAINS.some(d => t.url.includes(d)));

      if (!gmTab) {
        showStatus('未找到GM页面，请先打开GM页面', true);
        return false;
      }

      let finalText;
      const hasPlaceholder = commandTemplate.includes('%s') || commandTemplate.includes('%');
      if (hasPlaceholder) {
        const words = text.split(/\s+/).filter(Boolean);
        // 同时支持 %s 和 %，全部替换为角色ID
        finalText = words.map(word =>
          commandTemplate.replace(/%s/g, word).replace(/%(?![a-zA-Z])/g, word)
        ).join('\n');
      } else {
        finalText = commandTemplate;
      }

      showStatus(`正在执行: ${finalText.substring(0, 50)}${finalText.length > 50 ? '...' : ''}`);
      await chrome.scripting.executeScript({
        target: { tabId: gmTab.id },
        func: (sel, iframeSel, txt, shouldAutoRun) => {
          function executeInContext(doc) {
            const element = doc.querySelector(sel);
            if (element) {
              if (element.tagName === 'TEXTAREA') {
                element.value = txt;
              } else if (element.tagName === 'INPUT') {
                element.value = txt.replace(/\n/g, ' ');
              } else if (element.isContentEditable) {
                element.innerHTML = txt.replace(/\n/g, '<br>');
              }
              ['input', 'change', 'blur'].forEach(type => {
                element.dispatchEvent(new Event(type, { bubbles: true }));
              });
              if (shouldAutoRun) {
                const runBtn = doc.getElementById('ctl_run');
                if (runBtn && typeof runBtn.click === 'function') {
                  runBtn.click();
                }
              }
              return true;
            }
            return false;
          }
          if (executeInContext(document)) return true;
          const iframes = iframeSel
            ? document.querySelectorAll(iframeSel)
            : document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
              if (executeInContext(doc)) return true;
            } catch (e) {
              console.warn(`无法访问iframe: ${e.message}`);
            }
          }
          return false;
        },
        args: [selector, iframeSelector, finalText, autoRunCheckbox && autoRunCheckbox.checked]
      });

      showStatus('命令执行完成');
      return true;
    } catch (error) {
      showStatus(`执行失败: ${error.message}`, true);
      return false;
    }
  }

  // ====== 初始化 ======
  loadCommands().then(() => {
    // observeHeight 在按钮加载完成后才启动，确保 MutationObserver 不会错过初次渲染
    observeHeight();
  });

  // ====== 自适应高度：测量活跃面板内所有可见子元素高度之和 ======
  function measureContentHeight() {
    const activeSection = document.querySelector('.panel-section.active');
    if (!activeSection) return 0;

    const cs = getComputedStyle(activeSection);
    const gap = parseFloat(cs.gap) || 8;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBot = parseFloat(cs.paddingBottom) || 0;
    let total = padTop + padBot;

    // 遍历所有直接子元素（flex 子元素不受 overflow 裁剪）
    Array.from(activeSection.children).forEach(child => {
      // 隐藏元素忽略
      const style = getComputedStyle(child);
      if (style.display === 'none') return;
      total += child.offsetHeight + gap;
    });

    return Math.ceil(total);
  }

  function reportHeight() {
    const h = measureContentHeight();
    // 最低高度保障：至少能完整显示左侧侧边栏
    const sidebar = document.querySelector('.sidebar');
    const minH = sidebar ? Math.ceil(sidebar.scrollHeight) : 300;
    const finalH = Math.max(h, minH);
    if (typeof parent !== 'undefined' && parent !== window) {
      parent.postMessage({ type: 'GM_PANEL_HEIGHT', height: finalH }, '*');
    }
  }

  // 监听按钮增删，重新上报
  function observeHeight() {
    const container = document.getElementById('buttons-container');
    if (container) {
      const observer = new MutationObserver(reportHeight);
      observer.observe(container, { childList: true, subtree: true });
    }
  }

  } catch (err) {
    console.error('[GM助手] 初始化错误:', err);
  }
});
