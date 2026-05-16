# GMHelper 备份工具

> 定时或手动将后端数据库中的公开指令和个人指令快照到本地，防止误改/误删后无法恢复。后端服务见 [gm-backend](../gm-backend/)。

---

## 目录结构

```
backup/
├── backup.js        # 备份脚本（Node.js）
├── restore.js      # 恢复脚本（Node.js，支持交互式 / 静默模式）
├── list-backups.js  # 查看备份历史
├── backup.bat      # Windows 快捷批处理（双击运行）
└── backups/        # 备份数据存放目录（自动创建）
    ├── index.json             # 最新备份指针 + 备份历史列表
    └── 2026-04-08/           # 按日期归档
        ├── manifest.json      # 本次备份元数据
        ├── public.json        # 公开通用指令快照
        ├── 张三.json           # 各用户的个人指令快照
        └── 李四.json
```

---

## 快速开始

### Windows 用户（推荐）

双击运行 `backup.bat`，按菜单选择操作：

```
[1] 全量备份（所有用户）
[2] 增量对比备份（仅记录有变化的用户）
[3] 查看备份历史
[Q] 退出
```

### 命令行用户

```bash
# 全量备份
node backup.js

# 增量对比备份（仅写入内容变化的 owner，省时省空间）
node backup.js --diff

# 查看备份列表
node list-backups.js

# 恢复最新备份（交互式）
node restore.js

# 静默恢复最新全量备份
node restore.js --latest

# 静默仅恢复公开指令
node restore.js --latest public

# 恢复指定日期的全量备份
node restore.js 2026-04-08

# 查看帮助
node restore.js --help
```

---

## 备份详情

### 全量备份（`node backup.js`）

1. 连接 MySQL（`10.30.138.5/gm_webtool`）枚举所有个人用户
2. 调用后端 API 获取每条记录的完整数据
3. **每次都写入** `public.json` + 所有用户的 `.json` 文件
4. 生成 `manifest.json` 元数据，更新 `index.json` 的 `latest` 指针

### 增量对比备份（`node backup.js --diff`）

1. 加载上一次备份的 `manifest.json`
2. 对比每个 owner 的 `commands` 字段是否变化
3. **仅写入**内容有变化的 owner（未变化的跳过）
4. 适用于频繁修改场景，减少重复备份

---

## 备份文件格式

### `public.json`（公开指令）

```json
{
  "id": 14,
  "owner": "public",
  "commands": "{ /* 序列化后的 JSON 字符串 */ }",
  "created_at": "2026-03-26T09:19:11.714Z",
  "updated_at": "2026-04-08T11:07:27.883Z"
}
```

### `{用户名}.json`（个人指令）

```json
{
  "id": 5,
  "owner": "张三(Wis)",
  "commands": "{ /* 序列化后的 JSON 字符串 */ }",
  "created_at": "...",
  "updated_at": "..."
}
```

### `manifest.json`（元数据）

```json
{
  "created_at": "2026-04-08T14:30:00.000Z",
  "mode": "full",
  "previous_backup": "2026-04-07",
  "public": {
    "file": "public.json",
    "categories": 14,
    "commands": 280,
    "updated_at": "2026-04-08T11:07:27.883Z"
  },
  "owners": [
    { "owner": "张三(Wis)", "file": "张三(Wis).json", "size_bytes": 2048, "updated_at": "..." }
  ],
  "stats": {
    "total_owners": 10,
    "written": 3,
    "unchanged_skipped": 7,
    "failed": 0
  }
}
```

### `index.json`（指针）

```json
{
  "backups": [
    { "date": "2026-04-07", "dir": "2026-04-07", "full": true, "owners_written": 10, ... },
    { "date": "2026-04-08", "dir": "2026-04-08", "full": true, "owners_written": 10, ... }
  ],
  "latest": "2026-04-08"
}
```

---

## 恢复流程

### 交互式（推荐）

```bash
node restore.js
```

菜单示例：

```
╔══════════════════════════════════════╗
║   GMHelper 备份恢复                  ║
╚══════════════════════════════════════╝

可用备份（最新在前）：

  [1] 2026-04-08  全量   用户: 10/10  公开: 是  ◀ LATEST
  [2] 2026-04-07  全量   用户: 10/10  公开: 是
  [3] 2026-04-06  增量   用户:  2/10  公开: 是

  [A] 恢复全部（公开 + 所有用户）
  [P] 仅恢复公开指令
  [Q] 退出

请选择备份编号或操作 [1]:
```

### 静默恢复

| 命令 | 效果 |
|------|------|
| `node restore.js --latest` | 恢复最新备份的全部数据（公开 + 所有用户） |
| `node restore.js --latest public` | 仅恢复最新备份的公开指令 |
| `node restore.js 2026-04-07` | 恢复指定日期备份的全部数据 |
| `node restore.js 2026-04-07 public` | 恢复指定日期备份的公开指令 |

---

## 定时备份（Windows 任务计划程序）

1. 打开 **任务计划程序** (`taskschd.msc`)
2. 创建基本任务 → 命名为 `GMHelper每日备份`
3. 触发器：每天 `09:00`
4. 操作：启动程序
   - 程序：`node.exe`（需在 PATH 中，或填完整路径如 `C:\Program Files\nodejs\node.exe`）
   - 参数：`/d "D:\AOZ\trunk\Assets\Document\GMHelper\backup" backup.js`
   - 起始位置：`D:\AOZ\trunk\Assets\Document\GMHelper\backup`
5. 勾选 **不管用户是否登录都要运行**，确认

> **提示**：增量备份（`--diff`）更适合频繁执行的定时任务，仅记录变化数据。

---

## 恢复后端 API 调用说明

恢复脚本向后端发送以下请求：

| 恢复内容 | HTTP 方法 | 路径 | 请求体 |
|---------|-----------|------|--------|
| 公开指令 | POST | `/api/commands/public` | `{ "commands": "<序列化的JSON字符串>" }` |
| 个人指令 | POST | `/api/commands` | `{ "owner": "用户名", "commands": "<序列化的JSON字符串>" }` |

> 后端将 `commands` 字段以**字符串**形式存入数据库（JSON 序列化），恢复脚本保持相同格式。

---

## 备份建议

| 场景 | 推荐策略 |
|------|---------|
| 日常预防 | 每天一次全量备份（`backup.js`） |
| 频繁修改期间 | 每小时一次增量备份（`backup.js --diff`） |
| 重大变更前 | 手动执行一次全量备份，再进行操作 |
| 误删恢复 | 立即用 `restore.js` 从最新备份恢复 |

---

## 依赖

- **Node.js**（需要 `mysql2` 驱动，由后端 `gm-backend/node_modules/` 提供）
- 脚本会自动查找以下位置的 `config.json` 和 `node_modules`：
  - `../gm_backend/`（原路径，与 GMHelper 同级的后端目录）
  - `../../gm-backend/`（分离后的后端目录）
- 运行路径需能访问 `http://10.30.138.5:3000`

> 如果 `mysql2` 模块找不到，请确保 `gm-backend/node_modules` 存在（运行 `npm install`），或参考上方路径说明。
