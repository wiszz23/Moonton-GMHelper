# Role 数据管理工具 - 启动指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务

```bash
npm start
```

输出应该如下：
```
=====================================
  Role 数据管理工具 - 后端服务
=====================================

✓ 服务已启动: http://localhost:3000

📚 API 端点:
  GET  /api/roles              - 获取所有 Role
  GET  /api/roles/:id          - 获取单个 Role
  POST /api/roles              - 创建或更新 Role
  DELETE /api/roles/:id        - 删除 Role
  GET  /api/commands/public    - 获取 public 指令
  GET  /api/health             - 健康检查
```

### 3. 打开工具

1. 在浏览器中打开 `gm-role-manager.html`
2. 点击"⚙️ 设置"，确认 API 地址为 `http://localhost:3000`
3. 点击"🔄 刷新"或页面自动加载数据

---

## 功能测试

### 1. 加载数据
- 页面打开时自动加载所有 Role
- 应该显示 5 个默认 Role（战士、法师、治疗、坦克、刺客）

### 2. 搜索 Role
- 输入 Role 名称（如"战士"）
- 点击"搜索"或按 Enter
- 表格应该过滤出相匹配的 Role

### 3. 新增 Role
```
1. 点击"➕ 新增 Role"
2. 填写表单:
   - ID: 6
   - 名称: 弓箭手
   - 类型: RANGE
   - 描述: 远程物理职业
3. 点击"保存"
4. 新 Role 应该出现在列表中
```

### 4. 编辑 Role
```
1. 点击表格中的某个 Role 行
2. 右侧显示 JSON
3. 修改 JSON 内容
4. 点击"🚀 推送到 DB"
5. 确认修改成功
```

### 5. 快速编辑
```
1. 选中一个 Role
2. 切换到"快速编辑"Tab
3. 在表单中修改字段
4. 自动同步到 JSON 编辑器
5. 点击"🚀 推送到 DB"保存
```

### 6. 删除 Role
```
1. 勾选要删除的 Role（支持多选）
2. 点击"🗑️ 删除选中"
3. 确认删除
4. Role 应该从列表中消失
```

### 7. 导出 JSON
```
1. 搜索或选中要导出的 Role
2. 点击"📥 导出 JSON"
3. 浏览器自动下载 JSON 文件
```

### 8. 导入 JSON
```
1. 点击"📤 导入 JSON"
2. 选择之前导出的 JSON 文件
3. 确认导入
4. 新 Role 应该添加到列表中
```

### 9. 撤销/重做
```
1. 编辑一个 Role
2. 点击"↶ 撤销"恢复上一步
3. 点击"↷ 重做"重新应用修改
4. 或使用快捷键 Ctrl+Z / Ctrl+Shift+Z
```

---

## 后端 API 详解

### 获取所有 Role

```bash
GET /api/roles?page=1&limit=50&search=

查询参数:
  page: 页码（默认 1）
  limit: 每页数量（默认 50）
  search: 搜索关键词（可选）

响应:
{
  "code": 0,
  "data": {
    "roles": [...],
    "total": 5,
    "page": 1,
    "limit": 50,
    "has_next": false
  }
}
```

### 创建或更新 Role

```bash
POST /api/roles

请求体:
{
  "id": 1,
  "name": "战士",
  "type": "DPS",
  "description": "近战输出职业",
  "skills": [...],
  "base_stats": {...}
}

响应:
{
  "code": 0,
  "data": {...},
  "message": "创建成功" 或 "更新成功"
}
```

### 删除 Role

```bash
DELETE /api/roles/1

响应:
{
  "code": 0,
  "data": {...},
  "message": "删除成功"
}
```

### 健康检查

```bash
GET /api/health

响应:
{
  "code": 0,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "db_connection": "ok"
  }
}
```

---

## 故障排除

### 连接失败 (无法连接到 API)
- ✓ 确保后端服务已启动：`npm start`
- ✓ 确认 API 地址是否正确：`http://localhost:3000`
- ✓ 检查防火墙是否阻止了 3000 端口
- ✓ 尝试在浏览器中访问 `http://localhost:3000/api/health`

### 404 错误 (端点不存在)
- ✓ 确保使用的 API 地址不包含 `/api` 前缀
- ✓ 后端服务应该是 `http://localhost:3000`，不是 `http://localhost:3000/api`

### CORS 错误 (跨域问题)
- ✓ 确保后端已启用 CORS 支持
- ✓ 检查浏览器控制台错误信息

### 数据丢失
- ✓ 此后端服务使用内存存储，关闭服务后数据会丢失
- ✓ 若需持久化，请导出 JSON 文件备份

---

## 配置修改

### 修改端口

编辑 `server.js`：
```javascript
const PORT = process.env.PORT || 3000;  // 改为你需要的端口
```

启动时：
```bash
PORT=5000 npm start
```

### 修改默认数据

编辑 `server.js` 中的 `roles` 数组，或通过 API 添加新数据。

---

## 注意事项

- ⚠️ 此后端服务仅用于开发和测试
- ⚠️ 数据存储在内存中，服务重启后会丢失
- ⚠️ 生产环境请使用真实数据库（MySQL、PostgreSQL 等）

---

## 下一步

如果你想要真实的数据库支持，可以：

1. **使用 MySQL**
   - 安装 MySQL 驱动：`npm install mysql2`
   - 配置数据库连接
   - 修改 API 为真实数据库查询

2. **使用 PostgreSQL**
   - 安装 PostgreSQL 驱动：`npm install pg`
   - 配置数据库连接
   - 修改 API 为真实数据库查询

3. **使用 MongoDB**
   - 安装 MongoDB 驱动：`npm install mongoose`
   - 配置数据库连接
   - 修改 API 为真实数据库查询

需要帮助集成数据库吗？

