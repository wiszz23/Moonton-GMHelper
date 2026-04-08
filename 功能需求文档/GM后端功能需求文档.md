# GMHelper 后端服务 — 功能需求文档

## 1. 项目概述

### 1.1 项目名称
GMHelper 后端服务（gm-backend）

### 1.2 项目类型
Node.js Express RESTful API 服务

### 1.3 核心功能
为 GMHelper Chrome 扩展提供 GM 指令数据的存储、同步和查询服务，支持 MySQL + PostgreSQL 双数据库写入。

### 1.4 技术栈
| 组件 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | v24.14.1 |
| Web 框架 | Express | ^4.18.2 |
| MySQL 驱动 | mysql2 | ^3.6.5 |
| PostgreSQL 驱动 | pg | ^8.11.3 |
| 跨域支持 | cors | ^2.8.5 |
| 打包工具 | pkg | ^5.8.1 |

### 1.5 配置文件
配置文件：`config.json`（与可执行文件同级目录）

```json
{
  "host": "0.0.0.0",
  "port": 3000,
  "database": "dual",
  "mysql": {
    "host": "10.30.138.5",
    "port": 3306,
    "user": "qa",
    "password": "qa",
    "database": "gm_webtool"
  },
  "postgresql": {
    "host": "10.30.138.5",
    "port": 5432,
    "user": "qa",
    "password": "qa",
    "database": "gm_webtool"
  }
}
```

---

## 2. 数据库设计

### 2.1 表结构

**数据库**：gm_webtool

**表名**：`userdata`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT / SERIAL | 主键，自增 |
| owner | VARCHAR(255) | 用户名，唯一约束 |
| commands | TEXT | GM 指令 JSON 字符串 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间（自动更新） |

> MySQL 使用 `AUTO_INCREMENT`，PostgreSQL 使用 `SERIAL`。两个数据库表结构一致。

### 2.2 数据模式

`commands` 字段存储 JSON 序列化的字符串，结构如下：

```json
{
  "装备": [
    { "name": "全身装备", "text": "add_gear %s 611210 1\n..." }
  ],
  "道具": [...],
  "账号": [...]
}
```

- **Key** = 分类名称（中文）
- **Value** = 该分类下的指令数组
- 每条指令包含 `name`（显示名称）和 `text`（实际 GM 命令， `%s` 占位目标玩家）

### 2.3 特殊 Owner
| Owner | 用途 |
|-------|------|
| `public` | 公开通用指令（所有 GM 工具用户共享） |
| 其他字符串 | 个人私有指令（各用户独立） |

---

## 3. API 接口

### 3.1 接口总览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/commands/public` | 获取公开通用指令 |
| POST | `/api/commands/public` | 保存公开通用指令 |
| GET | `/api/commands/:owner` | 获取指定用户的指令 |
| POST | `/api/commands` | 保存指定用户的指令 |
| DELETE | `/api/commands/:owner` | 删除指定用户的指令 |
| GET | `/api/categories/:owner` | 获取个人分组 |
| POST | `/api/categories` | 保存个人分组 |
| POST | `/api/dedup` | 清理重复 owner 记录 |

---

### 3.2 健康检查
```
GET /api/health
```

**响应：**
```json
{
  "status": "ok",
  "time": "2026-04-08 ...",
  "databases": {
    "mysql": "ok",
    "postgresql": "ok"
  }
}
```

---

### 3.3 获取公开通用指令
```
GET /api/commands/public
```

**响应：**
```json
{
  "id": 14,
  "owner": "public",
  "commands": "{\"装备\":[...],\"道具\":[...],...}",
  "created_at": "2026-03-26T09:19:11.714Z",
  "updated_at": "2026-04-08T..."
}
```

**双读逻辑**：同时从 MySQL 和 PostgreSQL 查询，按 `updated_at` 取最新记录返回。

---

### 3.4 保存公开通用指令
```
POST /api/commands/public
Content-Type: application/json

{
  "commands": "{\"装备\":[...],\"道具\":[...],...}"
}
```

**响应：**
```json
{
  "success": true,
  "owner": "public",
  "written": {
    "mysql": true,
    "postgresql": true
  }
}
```

**双写逻辑**：
- MySQL：`INSERT ... ON DUPLICATE KEY UPDATE`
- PostgreSQL：`INSERT ... ON CONFLICT (owner) DO UPDATE`

---

### 3.5 获取指定用户的指令
```
GET /api/commands/:owner
```

**响应格式** 同 3.3。

---

### 3.6 保存指定用户的指令
```
POST /api/commands
Content-Type: application/json

{
  "owner": "用户名",
  "commands": "{\"装备\":[...],\"道具\":[...],...}"
}
```

**响应：**
```json
{
  "success": true,
  "owner": "用户名",
  "written": {
    "mysql": true,
    "postgresql": true
  }
}
```

---

### 3.7 删除指定用户的指令
```
DELETE /api/commands/:owner
```

**响应：**
```json
{ "success": true }
```

---

### 3.8 清理重复记录
```
POST /api/dedup
```

删除同一 owner 的重复记录，保留 id 最大（最新）的一条。

---

## 4. 双库模式

### 4.1 模式配置

`config.json` 中 `database` 字段控制：

| 值 | 行为 |
|----|------|
| `dual` | 同时读写 MySQL + PostgreSQL |
| `mysql` | 仅操作 MySQL |
| `postgresql` | 仅操作 PostgreSQL |

### 4.2 占位符适配

MySQL 使用 `?` 占位符，PostgreSQL 使用 `$1, $2, ...`。

`db.js` 中通过 `convertToPg()` 和 `convertToMysql()` 自动转换。

### 4.3 读写策略

| 操作 | 策略 |
|------|------|
| 查询（GET） | 双读，mergeResults 取最新 |
| 写入（POST） | 双写，返回各库写入结果 |
| 删除（DELETE） | 双删 |

---

## 5. 当前公开指令数据

### 5.1 分类汇总

| 分类 | 指令数量 |
|------|----------|
| 装备 | 153 条 |
| 道具 | 25 条 |
| 天赋 | 3 条 |
| 核心 | 5 条 |
| 宝石 | 5 条 |
| 皮肤 | 7 条 |
| 枪械 | 4 条 |
| 城墙 | 8 条 |
| 战斗 | 11 条 |
| 账号 | 15 条 |
| 邮件 | 1 条 |
| 关卡 | 3 条 |
| 植物 | 8 条 |
| **合计** | **248 条** |

### 5.2 装备分类详情（153条）

**固定指令（3条）：**
| 名称 | 指令 |
|------|------|
| 获取装备材料 | add_item %s 3001-3016 各 10000 |
| 全身装备 | add_gear %s 611210/612310/... |
| 全防装备 | add_gear %s 511210/512310/... |

**随机装备宝箱（150条）：**
- 阶数：1阶 ~ 30阶
- 品质：普通 / 精良 / 稀有 / 史诗 / 传说
- ID 规律：33001 + 阶数×10 + 品质偏移（1-5）
- 示例：1阶普通=33011，30阶传说=33305

### 5.3 道具分类详情（25条）

包含：全部道具、石头礼包、钻石/金币/石油/食物/木材/石头/建筑工人/地雷阵/rogue币、各类药水、复活币、全资源、清空背包、增加体力、添加资源、增加经验、添加月之湍流、添加指定道具等。

### 5.4 账号分类详情（15条）

| 名称 | 指令 |
|------|------|
| 测试昵称 | set_name %s TestPlayer |
| 设置等级 | set_level %s 999 |
| 设置VIP等级 | set_vip %s 15 |
| 解锁全成就 | unlock_all %s |
| 重置账号 | reset_account %s |
| 切服 | change_zone %s |
| 查MSDK | see_account %s |
| 解绑 | unbind_account msdk %s |
| 一键切服 | switch_server %s 1-5 |
| 设置时间 | set_server_time %s |
| 删除装备 | clear_gear %s |
| 删除宝石 | clear_armband %s |
| 删除材料 | clear_item %s |
| 增加经验 | add_item %s 1 10 |
| 至尊星辰源点宝箱 | add_item %s 30001 1 |

### 5.5 植物分类详情（8条）

| 名称 | 指令 |
|------|------|
| 添加毛栗装甲 | add_hero %s 20120 |
| 添加玉米炸弹 | add_hero %s 20210 |
| 添加冰刺穿透弹 | add_hero %s 20310 |
| 添加三叶草飞镖 | add_hero %s 20620 |
| 添加太阳狙击 | add_hero %s 20410 |
| 添加全部植物碎片 | add_item %s 2010-2090 各 1000000 |
| 添加所有植物 | add_all_hero %s |
| 清除英雄 | clear_hero %s |

---

## 6. 部署

### 6.1 开发环境启动
```bash
npm install
node server.js
```

### 6.2 生产环境（打包）
```bash
npm run pkg        # 打包为 gm-backend.exe
./gm-backend.exe   # 直接运行，无需 Node.js 环境
```

### 6.3 依赖文件
| 文件 | 说明 |
|------|------|
| `server.js` | 主服务入口 |
| `db.js` | 数据库操作封装 |
| `config.json` | 配置文件（可独立修改） |
| `gm-backend.exe` | 打包后的可执行文件 |

---

## 7. 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-04-08 | 新增装备宝箱（1-30阶×5品质），皮肤幻形/时装宝箱，账号切服/解绑/MSDK指令，植物完整指令集 |
| 2026-04-08 | 实现双库模式（MySQL + PostgreSQL） |
| 2026-04-07 | 初始版本，基础 CRUD + 公开指令 API |
