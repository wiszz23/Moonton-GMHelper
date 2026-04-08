const express = require('express');
const cors = require('cors');
const db = require('./db');
const { getDbType, getConfig } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dbType = getDbType(); // 启动时快照，运行中不变
const config = getConfig();

// ---- 初始化表结构（同时初始化 MySQL 和 PostgreSQL） ----
async function initTable() {
  // MySQL 表
  if (config.mysql) {
    try {
      const mysql2 = require('mysql2/promise');
      const conn = await mysql2.createConnection({
        host: config.mysql.host, port: config.mysql.port,
        user: config.mysql.user, password: config.mysql.password,
        database: config.mysql.database
      });
      await conn.query(`
        CREATE TABLE IF NOT EXISTS userdata (
          id INT AUTO_INCREMENT PRIMARY KEY,
          owner VARCHAR(255) NOT NULL UNIQUE COMMENT '用户名',
          commands TEXT COMMENT '个人指令 JSON',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log(`[GM后端] MySQL 表 userdata 初始化完成`);
      conn.end();
    } catch (err) {
      console.error('[GM后端] MySQL 初始化表失败:', err.message);
    }
  }

  // PostgreSQL 表
  if (config.postgresql) {
    try {
      const { Pool } = require('pg');
      const tmpPool = new Pool({
        host: config.postgresql.host, port: config.postgresql.port,
        user: config.postgresql.user, password: config.postgresql.password,
        database: config.postgresql.database
      });
      await tmpPool.query(`
        CREATE TABLE IF NOT EXISTS userdata (
          id SERIAL PRIMARY KEY,
          owner VARCHAR(255) NOT NULL UNIQUE,
          commands TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try {
        await tmpPool.query(`
          CREATE OR REPLACE FUNCTION update_updated_at()
          RETURNS TRIGGER AS $$
          BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql
        `);
        await tmpPool.query(`
          DO $$ BEGIN
            CREATE TRIGGER userdata_updated_at
            BEFORE UPDATE ON userdata
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
          EXCEPTION WHEN duplicate_object THEN NULL;
          END $$
        `);
      } catch (e) {}
      tmpPool.end();
      console.log(`[GM后端] PostgreSQL 表 userdata 初始化完成`);
    } catch (err) {
      console.error('[GM后端] PostgreSQL 初始化表失败:', err.message);
    }
  }
}

// ---- GET /api/commands/:owner — 双读，取最新数据 ----
app.get('/api/commands/:owner', async (req, res) => {
  const { owner } = req.params;
  try {
    const rows = await db.query('SELECT * FROM userdata WHERE owner = $1', [owner]);
    const merged = db.mergeResults(rows);
    if (merged.length === 0) {
      return res.json({ owner, commands: null });
    }
    res.json(merged[0]);
  } catch (err) {
    console.error('[GM后端] 查询失败:', err.message);
    res.status(500).json({ error: '查询失败', detail: err.message });
  }
});

// ---- GET /api/commands/public — 获取公开通用指令 ----
app.get('/api/commands/public', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM userdata WHERE owner = $1', ['public']);
    const merged = db.mergeResults(rows);
    if (merged.length === 0) {
      return res.json({ owner: 'public', commands: null });
    }
    res.json(merged[0]);
  } catch (err) {
    console.error('[GM后端] 查询公开指令失败:', err.message);
    res.status(500).json({ error: '查询失败', detail: err.message });
  }
});

// ---- POST /api/commands/public — 保存公开通用指令 ----
app.post('/api/commands/public', async (req, res) => {
  const { commands } = req.body;
  try {
    const written = await db.upsert('public', commands);
    console.log(`[GM后端] 保存公开指令: MySQL=${written.mysql} PG=${written.postgresql}`);
    res.json({ success: true, owner: 'public', written });
  } catch (err) {
    console.error('[GM后端] 保存公开指令失败:', err.message);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

// ---- POST /api/commands — 双写（MySQL + PostgreSQL 同时写入） ----
app.post('/api/commands', async (req, res) => {
  const { owner, commands } = req.body;
  if (!owner) {
    return res.status(400).json({ error: 'owner 不能为空' });
  }
  try {
    const written = await db.upsert(owner, commands);
    console.log(`[GM后端] 保存 ${owner}: MySQL=${written.mysql} PG=${written.postgresql}`);
    res.json({ success: true, owner, written });
  } catch (err) {
    console.error('[GM后端] 保存失败:', err.message);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

// ---- GET /api/categories/:owner — 获取个人分组 ----
app.get('/api/categories/:owner', async (req, res) => {
  const { owner } = req.params;
  try {
    const rows = await db.query('SELECT * FROM userdata WHERE owner = $1', [owner]);
    const merged = db.mergeResults(rows);
    if (merged.length === 0) return res.json({ owner, categories: null });
    res.json(merged[0]);
  } catch (err) {
    console.error('[GM后端] 查询个人分组失败:', err.message);
    res.status(500).json({ error: '查询失败', detail: err.message });
  }
});

// ---- POST /api/categories — 保存个人分组 ----
app.post('/api/categories', async (req, res) => {
  const { owner, categories } = req.body;
  if (!owner) return res.status(400).json({ error: 'owner 不能为空' });
  try {
    const written = await db.upsert(owner, categories);
    res.json({ success: true, owner, written });
  } catch (err) {
    console.error('[GM后端] 保存个人分组失败:', err.message);
    res.status(500).json({ error: '保存失败', detail: err.message });
  }
});

// ---- POST /api/dedup — 清理重复 owner（保留最新一条） ----
app.post('/api/dedup', async (req, res) => {
  try {
    // MySQL
    if (config.mysql) {
      await db.write(`
        DELETE t1 FROM userdata t1
        INNER JOIN userdata t2
        WHERE t1.id < t2.id AND t1.owner = t2.owner
      `, []);
    }
    // PostgreSQL
    if (config.postgresql) {
      await db.write(`
        DELETE FROM userdata t1
        USING userdata t2
        WHERE t1.id < t2.id AND t1.owner = t2.owner
      `, []);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[GM后端] dedup 失败:', err.message);
    res.status(500).json({ error: '清理失败', detail: err.message });
  }
});

// ---- DELETE /api/commands/:owner — 双删 ----
app.delete('/api/commands/:owner', async (req, res) => {
  const { owner } = req.params;
  try {
    const written = await db.write('DELETE FROM userdata WHERE owner = $1', [owner]);
    res.json({ success: true });
  } catch (err) {
    console.error('[GM后端] 删除失败:', err.message);
    res.status(500).json({ error: '删除失败', detail: err.message });
  }
});

// ---- GET /api/health — 健康检查 ----
app.get('/api/health', async (req, res) => {
  const health = { status: 'ok', time: new Date().toLocaleString(), databases: {} };
  try {
    if (config.mysql) {
      health.databases.mysql = 'ok';
    }
  } catch (e) {
    health.databases.mysql = 'error: ' + e.message;
  }
  try {
    if (config.postgresql) {
      health.databases.postgresql = 'ok';
    }
  } catch (e) {
    health.databases.postgresql = 'error: ' + e.message;
  }
  res.json(health);
});

// ---- 启动 ----
const HOST = config.host || '0.0.0.0';
const PORT = config.port || 3000;
initTable().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`[GM后端] 服务已启动: http://${HOST}:${PORT}`);
    console.log(`[GM后端] 双库模式: MySQL + PostgreSQL`);
  });
});
