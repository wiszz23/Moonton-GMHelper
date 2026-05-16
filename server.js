/**
 * Role 数据管理工具 - 简单后端服务
 * 用于测试 gm-role-manager.html
 *
 * 启动方式: node server.js
 * 访问地址: http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();

const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 模拟数据库 - Role 数据
let roles = [
  {
    id: 1,
    name: "战士",
    type: "DPS",
    description: "近战输出职业，擅长物理伤害",
    skills: [
      { id: 101, name: "斩击", damage: 100 },
      { id: 102, name: "冲锋", damage: 150 }
    ],
    base_stats: {
      hp: 1000,
      attack: 100,
      defense: 50,
      speed: 80
    }
  },
  {
    id: 2,
    name: "法师",
    type: "MAGE",
    description: "远程魔法职业，擅长魔法伤害",
    skills: [
      { id: 201, name: "火球", damage: 150 },
      { id: 202, name: "冰冻", damage: 120 }
    ],
    base_stats: {
      hp: 600,
      attack: 80,
      defense: 30,
      speed: 100
    }
  },
  {
    id: 3,
    name: "治疗",
    type: "HEAL",
    description: "支援职业，擅长治疗队友",
    skills: [
      { id: 301, name: "治疗术", heal: 200 },
      { id: 302, name: "群体治疗", heal: 150 }
    ],
    base_stats: {
      hp: 700,
      attack: 50,
      defense: 40,
      speed: 85
    }
  },
  {
    id: 4,
    name: "坦克",
    type: "TANK",
    description: "防御职业，擅长承伤",
    skills: [
      { id: 401, name: "盾防", damage: 0 },
      { id: 402, name: "嘲讽", damage: 50 }
    ],
    base_stats: {
      hp: 1500,
      attack: 60,
      defense: 150,
      speed: 60
    }
  },
  {
    id: 5,
    name: "刺客",
    type: "BURST",
    description: "爆发职业，擅长秒杀单目标",
    skills: [
      { id: 501, name: "背刺", damage: 300 },
      { id: 502, name: "潜行", damage: 0 }
    ],
    base_stats: {
      hp: 700,
      attack: 150,
      defense: 30,
      speed: 120
    }
  }
];

let roleIdCounter = Math.max(...roles.map(r => r.id)) + 1;

// ============ 工具函数 ============
function generateResponse(code, data = null, message = 'success') {
  return {
    code,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

// ============ 健康检查 ============
app.get('/api/health', (req, res) => {
  res.json(generateResponse(0, {
    status: 'healthy',
    version: '1.0.0',
    db_connection: 'ok'
  }));
});

// ============ Role 相关接口 ============

/**
 * 获取所有 Role
 * GET /api/roles?page=1&limit=50&search=
 */
app.get('/api/roles', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();

    let filtered = roles;

    // 搜索过滤
    if (search) {
      filtered = roles.filter(role => {
        const name = (role.name || '').toLowerCase();
        const id = String(role.id).toLowerCase();
        const type = (role.type || '').toLowerCase();
        const description = (role.description || '').toLowerCase();
        return name.includes(search) || id.includes(search) || type.includes(search) || description.includes(search);
      });
    }

    // 分页
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedRoles = filtered.slice(start, end);

    res.json(generateResponse(0, {
      roles: paginatedRoles,
      total: filtered.length,
      page,
      limit,
      has_next: end < filtered.length
    }));
  } catch (error) {
    res.status(400).json(generateResponse(400, null, error.message));
  }
});

/**
 * 获取单个 Role
 * GET /api/roles/:id
 */
app.get('/api/roles/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const role = roles.find(r => r.id === id);

    if (!role) {
      return res.status(404).json(generateResponse(404, null, 'Role 不存在'));
    }

    res.json(generateResponse(0, role));
  } catch (error) {
    res.status(400).json(generateResponse(400, null, error.message));
  }
});

/**
 * 创建或更新 Role
 * POST /api/roles
 *
 * 请求体:
 * {
 *   "id": 1,
 *   "name": "战士",
 *   "type": "DPS",
 *   "description": "...",
 *   ...其他字段
 * }
 */
app.post('/api/roles', (req, res) => {
  try {
    const roleData = req.body;

    // 验证必要字段
    if (!roleData.id || !roleData.name) {
      return res.status(400).json(generateResponse(400, null, 'Role ID 和名称不能为空'));
    }

    // 查找是否已存在
    const existingIndex = roles.findIndex(r => r.id === roleData.id);

    if (existingIndex >= 0) {
      // 更新
      roles[existingIndex] = {
        ...roles[existingIndex],
        ...roleData,
        updated_at: new Date().toISOString()
      };
      res.json(generateResponse(0, roles[existingIndex], '更新成功'));
    } else {
      // 新增
      const newRole = {
        ...roleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      roles.push(newRole);
      res.json(generateResponse(0, newRole, '创建成功'));
    }
  } catch (error) {
    res.status(400).json(generateResponse(400, null, error.message));
  }
});

/**
 * 删除 Role
 * DELETE /api/roles/:id
 */
app.delete('/api/roles/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = roles.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json(generateResponse(404, null, 'Role 不存在'));
    }

    const deleted = roles.splice(index, 1);
    res.json(generateResponse(0, deleted[0], '删除成功'));
  } catch (error) {
    res.status(400).json(generateResponse(400, null, error.message));
  }
});

// ============ Public 指令相关接口（兼容 GM 助手） ============

/**
 * 获取 Public 指令
 * GET /api/commands/public
 */
app.get('/api/commands/public', (req, res) => {
  const commands = {
    "装备": [
      { "name": "全身装备", "text": "add_gear %s 611210 1\nadd_gear %s 611211 1\nadd_gear %s 611212 1" },
      { "name": "武器装备", "text": "add_gear %s 611210 1" }
    ],
    "道具": [
      { "name": "钻石+99999", "text": "add_item %s 90001 99999" },
      { "name": "金币+999999", "text": "add_item %s 90002 999999" }
    ],
    "技能": [
      { "name": "解锁所有技能", "text": "unlock_all_skills %s" },
      { "name": "升级技能", "text": "upgrade_skill %s 1 10" }
    ]
  };

  res.json(generateResponse(0, commands));
});

// ============ 用户相关接口 ============

/**
 * 获取用户列表
 * GET /api/gm/users?search=&page=1&limit=50
 */
app.get('/api/gm/users', (req, res) => {
  res.json(generateResponse(0, {
    users: [],
    total: 0,
    page: 1
  }, '用户接口示例'));
});

/**
 * 更新用户
 * POST /api/gm/users
 */
app.post('/api/gm/users', (req, res) => {
  res.json(generateResponse(0, req.body, '用户更新成功'));
});

// ============ 错误处理 ============
app.use((req, res) => {
  res.status(404).json(generateResponse(404, null, '端点不存在'));
});

// ============ 启动服务 ============
app.listen(PORT, () => {
  console.log(`\n=====================================`);
  console.log(`  Role 数据管理工具 - 后端服务`);
  console.log(`=====================================`);
  console.log(`\n✓ 服务已启动: http://localhost:${PORT}`);
  console.log(`\n📚 API 端点:`);
  console.log(`  GET  /api/roles              - 获取所有 Role`);
  console.log(`  GET  /api/roles/:id          - 获取单个 Role`);
  console.log(`  POST /api/roles              - 创建或更新 Role`);
  console.log(`  DELETE /api/roles/:id        - 删除 Role`);
  console.log(`  GET  /api/commands/public    - 获取 public 指令`);
  console.log(`  GET  /api/health             - 健康检查`);
  console.log(`\n🧪 测试工具:`);
  console.log(`  打开 gm-role-manager.html`);
  console.log(`  API 地址设置为: http://localhost:3000`);
  console.log(`\n按 Ctrl+C 停止服务\n`);
});

module.exports = app;
