# GMHelper 面试技术详解文档

> 版本：v3.22 | 项目类型：Chrome 扩展 + Node.js 后端 + 独立工具集
> 用途：面试时向面试官展示你对 GMHelper 项目的深度理解

---

## 一、项目概述（1 分钟介绍）

**GMHelper 是什么？**

GMHelper 是一套游戏运营工具套件（v3.22），面向游戏 GM（Game Master）人员，用于一键执行 GM 指令操控游戏后端服务器。

**解决了什么问题？**

- 游戏运营人员每次发装备、发道具、发邮件都需要手动在 GM 后台网页输入命令，效率低、易出错
- 团队共用的通用 GM 指令需要手动同步给每个运营人员
- 指令库分散，无法统一管理版本
- 离线环境无法访问网络

**核心功能：**

- Chrome 扩展注入浮窗面板，点击按钮即可执行 GM 命令
- 支持 14 大类 GM 指令（装备、道具、天赋、宝石、皮肤、枪械、城墙、战斗、账号、邮件、关卡、植物、佣兵、核心）
- 公共指令（团队共享）+ 个人指令（私有）+ 历史记录
- 支持多游戏环境域名白名单（6 个环境）
- Node.js 后端 API 提供数据持久化
- 离线 fallback（本地 commands.json）
- 备份/恢复工具
- 角色/用户/数据管理独立工具

---

## 二、整体架构

```
┌─────────────────────────────────────────────────┐
│              Chrome 浏览器                        │
│  ┌──────────────┐   ┌───────────────────────┐  │
│  │ GM 后台网页   │   │  GMHelper 扩展面板     │  │
│  │ (被测页面)    │◄──│  (浮窗 iframe)         │  │
│  └──────┬───────┘   └──────────┬────────────┘  │
│         │                      │                 │
│         │         ┌────────────┼────────────┐  │
│         │         │ chrome.storage.local    │  │
│         │         │ (content ⇄ panel 通信)   │  │
│         │         └────────────┼────────────┘  │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────────────────────────────────┐  │
│  │         content_script.js (789行)         │  │
│  │  - 检测当前用户名 (3层策略 TreeWalker)     │  │
│  │  - 注入浮窗 DOM 结构                      │  │
│  │  - 域名白名单校验                          │  │
│  │  - 注册快捷键 Ctrl+Shift+Y                │  │
│  └──────────────────────────────────────────┘  │
│                                                   │
│  ┌──────────────────────────────────────────┐  │
│  │           panel.js (1751行)               │  │
│  │  - 4 Tab 界面 (General/Personal/History/  │  │
│  │    Settings)                              │  │
│  │  - 指令搜索 (拼音首字母匹配)               │  │
│  │  - 指令执行 (注入 GM 网页 DOM)             │  │
│  │  - 拖拽排序 (Pointer Events API)          │  │
│  │  - 历史记录 (最多100条)                    │  │
│  │  - 后端同步 (本地优先 + 异步回写)          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│             server.js (Node.js)                  │
│         Express API Server (port 3000)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  MySQL   │  │PostgreSQL│  │ REST API │       │
│  │  gm_webtool│ │  gm_webtool│ │ /api/*   │       │
│  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              独立 HTML 工具集                      │
│  gm-role-manager.html  角色数据管理               │
│  gm-user-manager.html   用户数据管理               │
│  gm-data-manager.html   GM 数据管理                │
│  data-manager.html      综合数据管理               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              工具脚本集                            │
│  backup/backup.js      全量/增量备份到本地 JSON    │
│  backup/restore.js     从备份恢复 (交互/静默)     │
│  backup/list-backups.js 列出备份历史               │
│  fix_quest.js           修复数据库命令 JSON        │
│  start.js               本地静态文件服务器         │
└──────────────────────────────────────────────────┘
```

**三个子系统的职责边界：**

| 子系统 | 技术栈 | 职责 |
|--------|--------|------|
| Chrome 扩展 | Manifest V3 + JS | 用户交互、指令执行、界面展示 |
| Node.js 后端 | Express + MySQL + PostgreSQL | 数据持久化、公共指令存储 |
| 独立工具集 | 纯 HTML + JS / Node.js | 备份恢复、数据管理 |

---

## 三、Chrome 扩展架构（重点）

### 3.1 Manifest V3 配置

```json
{
  "manifest_version": 3,
  "name": "GMHelper",
  "version": "3.22",
  "permissions": ["storage", "scripting", "activeTab", "sidePanel", "commands"],
  "host_permissions": ["*://gm.pre.nova.moonton.com/*", ...],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content_script.js"] }]
}
```

**关键设计点：**
- 使用 `service_worker` 而非 `background.html`（Manifest V3 要求）
- `sidePanel` 权限支持将面板注册为浏览器侧边栏
- `commands` 注册键盘快捷键 `Ctrl+Shift+Y`
- `host_permissions` 使用通配符支持多域名白名单

### 3.2 content_script.js：用户名检测（核心难点）

用户名检测是整个扩展的入口——只有知道当前是哪个 GM 在操作，才能获取该用户的个人指令。

**为什么难？** GM 后台是内部系统，DOM 结构不固定，不能依赖固定的 class 或 id。

**三段式检测策略（优先级递减）：**

```
策略1: Element Plus 下拉菜单
  → 查找 .el-dropdown-menu 的第一个 <li>
  → 直接取其文本内容
  → 速度最快，命中率最高

策略2: 头像锚点链路
  → 查找 .el-avatar
  → 向上找最近的 <a> 标签
  → 向下找用户下拉菜单
  → 提取用户名文本

策略3: TreeWalker 全 DOM 扫描（兜底）
  → 遍历所有文本节点
  → 寻找"中文名(XXX)"格式
  → 用打分算法排除噪音
```

**打分算法核心代码思路：**

```javascript
function scoreMatch(text) {
  let score = 0;
  if (isChineseWithParens(text)) score += 25;   // 中文名(昵称)格式
  if (isEnglishName(text))      score += 20;   // 纯英文 3-21 字符
  if (isShortSingleChar(text))  score -= 50;  // 短单字扣分
  if (matchesBlacklist(text))   score -= 100; // 黑名单直接否决
  return score;
}

function isValidOwnerCandidate(text) {
  // 精确过滤：不能包含管道符、换行符、超长、无效括号
  if (text.includes('|') || text.includes('\n')) return false;
  if (text.length < 2 || text.length > 21) return false;
  if (KNOWN_BAD_TEXTS.has(text)) return false;       // 30+ 精确黑名单
  if (KNOWN_BAD_PATTERNS.some(p => p.test(text))) return false; // 10+ 正则黑名单
  return true;
}
```

**面试加分点：**
- **TreeWalker API** 的使用——这是浏览器提供的遍历任意 DOM 子树的 API，比 `querySelectorAll` 更灵活
- **打分制优先级**——不是"找到就返回"，而是给所有候选打分，取最高分
- **黑名单双重保护**——精确匹配 + 正则匹配，过滤广告文本、按钮文字等噪音

### 3.3 浮窗注入机制

content_script 创建的浮窗 DOM 结构：

```
<div id="gmhelper-panel-root">           ← 固定定位浮窗容器
  ├─ <div class="panel-header">          ← 可拖拽标题栏
  │    └─ 控制按钮: 最小化/展开/设置/关闭
  └─ <iframe id="gmhelper-iframe">       ← panel.html 渲染区域
       └─ panel.js 逻辑
```

**高度动态适应机制（跨域 iframe 通信）：**

```
panel.js (iframe内)
  ↓ postMessage({ type: 'height', value: 600 })
content_script.js (父页面)
  ↓ 监听 message 事件
  ↓ 调整 iframe height
```

因为 iframe 和父页面可能同域也可能跨域（GM 后台是内部域名），所以用 `postMessage` 而非直接访问 iframe 的 `contentWindow`。

### 3.4 panel.js：核心交互逻辑

#### 状态管理（纯 JS 变量，无框架）

```javascript
let generalCommands = {};      // 公共指令 { "装备": [{name, text}], ... }
let personalCommands = [];    // 个人指令 [{name, text, category}]
let personalCategories = [];  // 个人分类 ['装备', '道具']
let generalOrder = {};        // 公共指令排序 {"装备": ["全身装备", "武器"]}
let personalOrder = {};      // 个人排序 {"我的分类": ["指令1"]}
let history = [];             // 执行历史 (最多100条)
let currentUserName = '';     // 当前用户名
```

**为什么不引入 Vue/React？**
- 扩展代码需要注入到任意页面，框架会增加污染风险
- 纯 JS + DOM 操作足够轻量，维护成本低
- 1751 行的逻辑用原生 JS 也能组织清晰

#### 数据加载策略：本地优先 + 异步回写

```javascript
async function reloadPersonalCommands(waitForSync) {
  // Step 1: 立刻从 chrome.storage.local 加载（最快）
  const localData = await chrome.storage.local.get('gm_personal_full');
  if (localData.gm_personal_full) {
    renderPersonalButtons(localData.gm_personal_full);
  }

  // Step 2: 如果有网络，后台异步从后端拉取
  // 用 % 和 %s 的混用问题说明：后端存的是 %，前端显示的是 %s，需要归一化
  const backendData = await fetchBackend();
  if (backendData) {
    if (isNewer(backendData, localData)) {
      showConflictModal(); // 让用户选择用哪份
    }
  }
}
```

**面试加分点：**
- **离线优先**——即使后端宕机，扩展仍可正常使用
- **冲突检测**——通过时间戳比较，发现本地和云端数据不一致时弹出模态框让用户选择
- **归一化处理**——后端用 `%`，前端用 `%s`，双向同步时需要相互转换

#### GM 命令执行（核心注入逻辑）

```javascript
async function executeInPage(roleIds, commandTemplate, autoRun) {
  // 1. 格式化指令: %s 替换为以空格分隔的角色ID列表
  //    "add_gear %s 611210" + ["10001", "10002"]
  //    → "add_gear 10001 10002\nadd_gear 10001 10002"
  const commands = roleIds
    .map(id => commandTemplate.replace(/%s|%/g, id))
    .join('\n');

  // 2. 通过 chrome.scripting.executeScript 注入执行函数
  chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func: runInDoc,
    args: [commands]
  });
}

function runInDoc(commands) {
  // 3. 找到 GM 后台网页的输入框
  const input = document.querySelector('#ctl_gmcmd');

  // 4. 填入指令
  input.value = commands;

  // 5. 触发完整的事件链（保证 autocomplete 插件响应）
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));

  // 6. 触发 jQuery autocomplete（GM 后台用 jQuery）
  const $input = window.jQuery ? jQuery(input) : null;
  if ($input) {
    $input.val(commands).trigger('input').trigger('change');
  }
}
```

**面试加分点：**
- **不只是 `input.value = xxx`**——需要触发完整的事件链（`input`/`change`/`blur`），否则 GM 后台的 autocomplete 插件不会响应
- **jQuery 兼容性**——GM 后台用 jQuery，需要额外触发 `$input.val().trigger()`
- **多目标 iframe 搜索**——先在同域 iframe 中搜索，再在跨域 iframe 中搜索兜底

#### 拼音首字母搜索

```javascript
// 内置常用汉字→拼音首字母映射表（约400+汉字）
const PINYIN_MAP = { '装': 'Z', '备': 'B', '道': 'D', '具': 'J', ... };

function pinyinMatch(name, keyword) {
  // 将每个汉字转为拼音首字母
  const pinyin = name.split('').map(c => PINYIN_MAP[c] || c).join('');
  // 检查关键字的拼音首字母是否在目标拼音串中
  return pinyin.includes(keyword.toUpperCase());
}

// 示例: 搜索 "zbdj" 能匹配 "装备道具"
```

**面试加分点：**
- **无需引入拼音库**——自己维护一个精简的映射表，零依赖
- **模糊匹配**——支持拼音首字母的子串匹配，比如 `zbdj` 可以匹配 `装备道具`

#### 拖拽排序（Pointer Events API）

```javascript
function initDragDrop() {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

function onPointerDown(e) {
  if (!isButton(e.target)) return;
  draggedEl = e.target;
  startX = e.clientX; startY = e.clientY;
  e.target.setPointerCapture(e.pointerId); // 关键：捕获指针事件
}
```

**面试加分点：**
- **Pointer Events API**——比 Mouse Events 更通用，支持触屏和鼠标统一处理
- **setPointerCapture**——拖出边界后仍能继续接收事件，保证流畅的跨边界拖拽
- **分类 Tab 也支持拖拽排序**——不仅按钮可以排序，分类 Tab 也可以

---

## 四、后端架构

### 4.1 技术选型

- **Express.js** —— 轻量、灵活，适合内部工具
- **MySQL 8 + PostgreSQL 15 双数据库** —— 两个数据库同时存同一份 `userdata` 表
- **无 ORM** —— 内部工具直接拼接 SQL，减少依赖

### 4.2 核心 API 设计

```
GET  /api/health                  → 健康检查
GET  /api/commands/public         → 获取公共指令 (JSON)
POST /api/commands/public         → 保存公共指令
GET  /api/roles                   → 分页+搜索查询角色列表
GET  /api/roles/:id               → 获取单个角色
POST /api/roles                   → 创建/更新角色
DELETE /api/roles/:id             → 删除角色
```

### 4.3 数据库设计

```sql
CREATE TABLE userdata (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  owner       VARCHAR(255) UNIQUE,   -- 'public' = 公共指令 | 用户名 = 个人指令
  commands    TEXT,                   -- JSON 序列化后的命令对象
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
);
```

**设计思路：**
- 用 `owner` 字段区分公共和个人数据——公共指令 `owner='public'`，个人指令 `owner=用户名`
- 一张表搞定两种数据，减少维护复杂度
- `commands` 存 JSON 序列化后的字符串（因为 `TEXT` 类型不支持原生 JSON）

### 4.4 响应格式统一

```javascript
// 所有接口统一响应格式
{
  code: 0,           // 0=成功, 其他=失败
  message: 'success',
  data: { ... },
  timestamp: '2026-05-28T10:00:00.000Z'
}
```

---

## 五、备份恢复系统

### 5.1 备份策略：全量 + 增量

```javascript
// backup.js 核心逻辑
const allOwners = await queryAllOwners(); // SELECT DISTINCT owner FROM userdata

for (const owner of allOwners) {
  const newData = JSON.stringify(commands);  // 序列化当前数据

  if (diffMode && lastBackup[owner] === newData) {
    continue; // 数据没变化，跳过（节省磁盘）
  }

  writeBackupFile(owner, newData);
  manifest[owner] = { size, timestamp, checksum };
}
```

**面试加分点：**
- **增量备份**——比对 `JSON.stringify` 结果，仅写入有变化的数据
- **变更摘要记录**——`backups/index.json` 记录每次备份的变更统计
- **双数据库查询**——同时连接 MySQL 和 PostgreSQL，取两者的并集

### 5.2 恢复策略：交互式 + 静默式

```javascript
// restore.js 支持两种模式
if (argv.silent) {
  // 静默模式：直接 POST 到后端
  await postToBackend(owner, data);
} else {
  // 交互模式：显示差异，用户确认后再执行
  const diff = diffRemoteAndBackup(owner, data);
  if (confirm(`Owner: ${owner}\n差异: ${diff}`)) {
    await postToBackend(owner, data);
  }
}
```

---

## 六、数据修复工具（fix_quest.js）

### 6.1 场景

线上数据库中有一批 GM 指令的 `text` 字段被错误地拼接了额外的目标字符串（如 `"xxx"`），需要从所有指令的 `text` 中删除这个目标字符串。

### 6.2 递归深度替换（避免引用 Bug）

```javascript
function deepReplace(obj, search, onHit) {
  // 关键：必须深拷贝，否则会修改原对象引用
  const clone = JSON.parse(JSON.stringify(obj));

  function traverse(node) {
    if (typeof node === 'string') {
      if (node.includes(search)) {
        const result = node.split(search).join('');
        onHit(); return result;
      }
    } else if (typeof node === 'object' && node !== null) {
      for (const key in node) {
        node[key] = traverse(node[key]);
      }
    }
    return node;
  }
  return traverse(clone);
}
```

**面试加分点：**
- **`JSON.parse(JSON.stringify())` 深拷贝**——手动实现深拷贝容易遗漏边界情况，用序列化/反序列化是最保险的方式
- **递归遍历**——处理嵌套 JSON 结构，通用性强
- **双数据库同时写回**——MySQL 和 PostgreSQL 都需要更新

---

## 七、独立工具集

### 7.1 gm-role-manager.html

角色数据管理工具，提供角色的增删改查。

**角色对象结构：**
```json
{
  "id": 1,
  "name": "战士",
  "type": "DPS",
  "description": "近战输出职业",
  "skills": [{ "id": 101, "name": "斩击", "damage": 100 }],
  "base_stats": { "hp": 1000, "attack": 100, "defense": 50, "speed": 80 }
}
```

### 7.2 gm-data-manager.html

GM 数据管理综合工具，管理所有 GM 相关数据。

### 7.3 这些工具为什么是独立 HTML？

- **零部署**——不需要后端服务器，双击 HTML 文件即可在浏览器打开
- **后端解耦**——如果后端服务不可用，这些工具仍能工作
- **职责单一**——每个工具只管一个领域，符合单一职责原则

---

## 八、技术亮点汇总（面试重点）

### 亮点 1：TreeWalker + 打分算法实现用户名检测

- 不依赖固定 DOM 结构，通过 TreeWalker 遍历所有文本节点
- 三层降级策略（Element Plus → 头像链路 → TreeWalker）
- 打分制而非"第一个匹配"，避免误判

### 亮点 2：本地优先 + 异步回写的数据策略

- 扩展在内部网络使用，网络可能不稳定
- chrome.storage.local 毫秒级响应，后端同步保证数据不丢失
- 冲突检测 + 模态框让用户决策

### 亮点 3：跨域 iframe 高度自适应

- GM 后台页面可能嵌入了多个 iframe（主游戏服选择、左侧菜单等）
- 用 `postMessage` 解耦父子页面通信
- 面板高度随内容自动调整

### 亮点 4：GM 命令注入的事件链

- 不只是 `input.value = xxx`，触发完整事件链：`input` → `change` → `blur`
- 额外处理 jQuery autocomplete 兼容
- 多 iframe 目标搜索（同域优先，跨域兜底）

### 亮点 5：自研拼音首字母搜索

- 内置 400+ 汉字映射表，零外部依赖
- `zbdj` 搜索可以匹配"装备道具"

### 亮点 6：Pointer Events 拖拽排序

- 支持触屏和鼠标统一处理
- `setPointerCapture` 保证拖出边界后的流畅体验

### 亮点 7：增量备份算法

- 对比序列化后的 JSON 字符串判断是否变化
- 节省磁盘空间，减少不必要的数据写入

### 亮点 8：递归深拷贝防引用 Bug

- `JSON.parse(JSON.stringify())` 在递归遍历前做深拷贝
- 避免修改原始对象引用

---

## 九、遇到的技术挑战与解决方案

| 挑战 | 解决方案 |
|------|----------|
| GM 后台 DOM 结构未知且不固定 | 三层降级检测 + 打分算法 |
| 离线环境无法访问后端 | 本地 commands.json 作为 fallback |
| 后端和本地数据冲突 | 时间戳比较 + 冲突模态框 |
| iframe 高度动态变化 | postMessage 双向通信 |
| GM 后台 autocomplete 不响应 | 触发完整事件链 + jQuery 兼容 |
| 备份文件过多占用磁盘 | 增量备份，只写变化的数据 |
| 数据库 JSON 字段需要全局替换 | 递归深拷贝遍历 + 写回 |

---

## 十、架构设计原则

### 10.1 扩展性

- **指令分类可配置**：`commands.json` 中增加一个顶级 key 即可新增分类
- **工具独立运行**：每个 HTML 工具都是独立文件，不依赖主项目
- **后端 RESTful**：新增接口只需在 `server.js` 中加路由

### 10.2 可维护性

- **单一职责**：content_script 只管检测和注入，panel 只管 UI 和逻辑
- **无框架依赖**：纯 JS 实现，降低学习成本和外部依赖风险
- **中文注释**：核心逻辑都有中文注释，便于内部维护

### 10.3 健壮性

- **重试机制**：后端同步 3 次重试（1 秒间隔）
- **错误降级**：后端不可用时自动 fallback 到本地数据
- **输入校验**：用户名检测有黑名单 + 正则双重保护

### 10.4 用户体验

- **toast 通知**：2.5s 自动消失的提示动画
- **拖拽排序**：灵活定制界面布局
- **快捷键**：`Ctrl+Shift+Y` 快速打开面板
- **版本检测**：启动时检查更新

---

## 十一、面试回答示例

### Q: 你是怎么检测到当前登录的 GM 用户名的？

**A:**
> GM 后台是内部系统，我无法依赖后端接口或固定 DOM 结构。我实现了三层降级策略：
>
> 第一层，Element Plus 的下拉菜单直接取第一个 `<li>` 的文本，速度最快。第二层，如果找不到，就通过 `.el-avatar` 找关联的用户下拉菜单。第三层兜底，用 TreeWalker API 遍历页面上所有文本节点，寻找 `中文名(昵称)` 格式的文本。
>
> 为了避免误判（比如把页面上的广告文本识别成用户名），我设计了一个打分算法。每个候选文本有分数加成或扣分项，比如"中文+括号"格式加 25 分，短单字扣 50 分，黑名单中的词直接扣 100 分。最终取分数最高的那个。
>
> 具体代码在 content_script.js 的 `readUserInfo()` 和 `scoreMatch()` 函数中。

---

### Q: 面板的 iframe 高度是怎么实现的？

**A:**
> GM 后台页面嵌入了多个 iframe，我不知道面板会被注入到哪个 iframe 中。而且 iframe 内部的内容高度是动态变化的（取决于有多少个指令分类）。
>
> 我用 `postMessage` 实现跨域通信：panel.js 在内容高度变化时，通过 `window.parent.postMessage()` 把高度值发给 content_script.js；content_script.js 监听 message 事件，动态调整 iframe 的 height 属性。
>
> 同时我还在 panel.js 中用 MutationObserver 监听 DOM 变化，高度变化时自动重新测量和上报。这样即使用户拖拽排序改变了界面布局，高度也能自动适应。

---

### Q: 你们的备份系统是怎么设计的？

**A:**
> 备份系统有两个设计目标：一是数据不丢，二是节省磁盘空间。
>
> 连接数据库直接枚举所有 `owner`（公共+所有个人用户），然后用 JSON 序列化每条记录。在增量模式下，比对上次备份的序列化结果，如果没变化就跳过，只写入变化了的数据。
>
> 备份文件按日期组织，每次备份生成一份 `manifest.json` 记录元数据，同时更新 `backups/index.json` 作为最新指针。
>
> 恢复时支持两种模式：交互式会显示每个 owner 的数据差异，让用户确认后再恢复；静默模式用于自动化脚本，`--latest` 直接恢复最近一份备份。

---

### Q: GM 命令是怎么注入到 GM 后台网页的？

**A:**
> 这是整个扩展最核心的部分。GM 后台网页有一个 `#ctl_gmcmd` 的输入框，我需要把指令填进去并触发执行。
>
> 关键难点是：GM 后台用了 autocomplete 插件，只设 `input.value` 它不会响应。我需要触发完整的事件链——`input`、`change`、`blur` 三个事件，同时还要触发 jQuery 的 `.trigger('input').trigger('change')`。
>
> 另外，GM 后台页面里可能有多个 iframe，我需要先在同域 iframe 中搜索输入框，找不到才在跨域 iframe 中搜索兜底。

---

## 十二、项目结构速查

```
GMHelper/
├── manifest.json              ← Chrome 扩展配置 (v3.22)
├── content_script.js          ← 用户名检测 + 浮窗注入 (789行)
├── background.js              ← Service Worker (快捷键 + 窗口管理)
├── panel.html                 ← 面板 HTML (4 Tab 布局)
├── panel.js                   ← 面板核心逻辑 (1751行)
├── popup.html                 ← 弹窗入口
├── styles.css                 ← 样式 (~1180行)
├── commands.json              ← 离线公共指令库 (14分类)
├── server.js                  ← Node.js API (port 3000)
├── fix_quest.js               ← 数据库修复工具 (MySQL+PostgreSQL)
├── start.js                   ← 本地开发静态服务器
├── test.html                  ← API 连接测试工具
├── gm-role-manager.html       ← 角色管理工具
├── gm-user-manager.html       ← 用户管理工具
├── gm-data-manager.html       ← GM 数据管理工具
├── data-manager/
│   └── data-manager.html      ← 综合数据管理
└── backup/
    ├── backup.js              ← 全量/增量备份
    ├── restore.js             ← 备份恢复
    ├── list-backups.js        ← 备份列表
    ├── add_yongbing.js        ← 修复补丁脚本
    └── backups/                ← 备份数据存储目录
```

---

*文档更新日期：2026-05-28*
