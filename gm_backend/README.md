# GM助手 后端服务

GM助手 Chrome 插件的个人指令同步后端，为插件提供数据持久化能力。

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 运行环境 | Node.js | 后端运行环境 |
| Web 框架 | Express.js | 处理 HTTP 请求 |
| 数据库 | MySQL | 关系型数据库 |
| MySQL 驱动 | mysql2 | 支持 Promise、性能好 |
| 跨域 | cors | 允许前端跨域访问 API |

---

## 数据库

### 连接信息

| 项目 | 值 |
|------|-----|
| 地址 | `10.30.138.5` |
| 端口 | `3306` |
| 数据库 | `gm_webtool` |
| 表名 | `userdata` |
| 用户名 | `qa` |
| 密码 | `qa` |

### 建库建表 SQL

```sql
CREATE DATABASE IF NOT EXISTS gm_webtool DEFAULT CHARACTER SET utf8mb4;
USE gm_webtool;

CREATE TABLE IF NOT EXISTS userdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner VARCHAR(255) NOT NULL UNIQUE COMMENT '用户名',
  commands TEXT COMMENT '个人指令 JSON',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 注意：`owner` 字段设置 `UNIQUE`，每个用户只有一行数据，commands 以 JSON 数组形式存储该用户的所有个人指令。

---

## API 接口

| 方法 | 路径 | 说明 | 请求/响应示例 |
|------|------|------|--------------|
| GET | `/api/commands/:owner` | 查询某用户的个人指令 | `GET /api/commands/封庆扬(Wis)` |
| POST | `/api/commands` | 保存/更新个人指令 | `POST /api/commands` body: `{"owner":"封庆扬(Wis)","commands":"[ {...} ]"}` |
| DELETE | `/api/commands/:owner` | 删除某用户的个人指令 | `DELETE /api/commands/封庆扬(Wis)` |
| GET | `/api/health` | 健康检查 | `GET /api/health` → `{"status":"ok","time":"..."}` |

### 请求示例（保存）

```bash
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "封庆扬(Wis)",
    "commands": "[{\"name\":\"加钻石\",\"text\":\"add_item %s 90001 99999\",\"category\":\"道具\"}]"
  }'
```

---

## 本地开发

### 1. 安装依赖

```bash
cd gm_backend
npm install
```

### 2. 配置数据库连接

编辑 `db.js`：

```js
const pool = mysql.createPool({
  host: '10.30.138.5',   // 数据库地址
  port: 3306,             // 端口
  user: 'qa',             // 用户名
  password: 'qa',          // 密码
  database: 'gm_webtool'  // 数据库名
});
```

### 3. 启动服务

```bash
npm start
```

启动成功输出：
```
[GM后端] 表 userdata 初始化完成
[GM后端] 服务已启动: http://localhost:3000
```

---

## 部署到公共服务器

### 1. 上传代码到服务器

```bash
scp -r gm_backend user@服务器IP:/opt/
```

### 2. 安装依赖

```bash
ssh user@服务器IP
cd /opt/gm_backend
npm install
```

### 3. 配置开机自启（pm2）

```bash
# 安装 pm2
npm install -g pm2

# 启动服务
pm2 start server.js --name gm-backend

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
# 根据提示执行生成的命令
```

### 4. 开放防火墙端口

```bash
# CentOS/RHEL
firewall-cmd --zone=public --add-port=3000/tcp --permanent
fireware-cmd --reload

# Ubuntu/Debian
ufw allow 3000/tcp
```

### 5. 修改插件后端地址

在 `panel.js` 中修改：

```js
const BACKEND_URL = 'http://服务器IP:3000';
```

重新打包插件后分发给同事使用。

---

## 常用命令

```bash
# 启动
pm2 start server.js --name gm-backend

# 重启
pm2 restart gm-backend

# 停止
pm2 stop gm-backend

# 查看日志
pm2 logs gm-backend

# 查看状态
pm2 status
```

---

## 数据流程

```
┌─────────────────────────────────────────────────────────┐
│                     Chrome 插件                          │
│                                                         │
│  GM页面 content_script                                  │
│    └─ 读取右上角用户名                                  │
│         └─ 写入 chrome.storage.local                   │
│              ↓                                          │
│  iframe panel.js                                        │
│    └─ 轮询检测到用户名                                 │
│         └─ 请求后端 API → MySQL 数据库                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    公共服务器                            │
│                                                         │
│  Node.js + Express + mysql2                            │
│    └─ /api/commands/:owner  增删改查                  │
│              ↓                                          │
│  MySQL (10.30.138.5:3306)                             │
│    └─ gm_webtool.userdata                             │
└─────────────────────────────────────────────────────────┘
```
