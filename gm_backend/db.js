const fs = require('fs');
const path = require('path');

// 读取配置文件（兼容 pkg 打包后的路径）
function getConfig() {
  const possiblePaths = [
    path.join(__dirname, 'config.json'),
    path.join(process.cwd(), 'config.json'),
    'config.json'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  throw new Error('找不到 config.json 配置文件');
}

const config = getConfig();
let dbType = config.database || 'postgresql';

// 每次 upsert/query 前重新读取 config（兼容 pkg 打包后 config.json 独立更新的场景）
function getDbType() {
  try {
    const fresh = getConfig();
    dbType = fresh.database || 'postgresql';
  } catch (e) {}
  return dbType;
}

// ---- MySQL ----
let mysqlPool = null;
let mysql = null;
if (config.mysql) {
  const mysql2 = require('mysql2/promise');
  mysqlPool = mysql2.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });
  mysql = {
    async query(sql, params) {
      const [rows] = await mysqlPool.query(sql, params);
      return rows;
    },
    async getConnection() {
      return mysqlPool.getConnection();
    }
  };
  console.log(`[GM后端] MySQL: ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
}

// ---- PostgreSQL ----
let pgPool = null;
let pg = null;
if (config.postgresql) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    host: config.postgresql.host,
    port: config.postgresql.port,
    user: config.postgresql.user,
    password: config.postgresql.password,
    database: config.postgresql.database,
    max: 5,
    idleTimeoutMillis: 30000
  });
  pg = {
    async query(sql, params) {
      const result = await pgPool.query(sql, params);
      return result.rows;
    },
    async getConnection() {
      return pgPool.connect();
    }
  };
  console.log(`[GM后端] PostgreSQL: ${config.postgresql.host}:${config.postgresql.port}/${config.postgresql.database}`);
}

// ---- SQL 占位符转换：MySQL(?) → PostgreSQL($1, $2, ...) ----
function convertToPg(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => '$' + (++idx));
}

// ---- SQL 占位符反向转换：PostgreSQL($1) → MySQL(?) ----
function convertToMysql(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

// ---- 统一查询接口 ----
const db = {
  // 查询（双读：自动适配 MySQL(?) / PostgreSQL($1) 占位符格式）
  async query(sql, params) {
    const results = [];

    if (getDbType() === 'mysql' || getDbType() === 'dual') {
      try {
        const mysqlSql = convertToMysql(sql);  // $1 → ?
        const rows = await mysql.query(mysqlSql, params);
        results.push(...rows);
      } catch (e) {
        console.warn('[GM后端] MySQL 查询失败:', e.message);
      }
    }

    if (getDbType() === 'postgresql' || getDbType() === 'dual') {
      try {
        const rows = await pg.query(convertToPg(sql), params);
        results.push(...rows);
      } catch (e) {
        console.warn('[GM后端] PostgreSQL 查询失败:', e.message);
      }
    }

    return results;
  },

  // 写操作（同时写 MySQL + PostgreSQL）
  async write(sql, params) {
    const written = { mysql: false, postgresql: false };

    if (getDbType() === 'mysql' || getDbType() === 'dual') {
      try {
        await mysql.query(convertToMysql(sql), params);
        written.mysql = true;
      } catch (e) {
        console.warn('[GM后端] MySQL 写入失败:', e.message);
      }
    }

    if (getDbType() === 'postgresql' || getDbType() === 'dual') {
      try {
        await pg.query(convertToPg(sql), params);
        written.postgresql = true;
      } catch (e) {
        console.warn('[GM后端] PostgreSQL 写入失败:', e.message);
      }
    }

    return written;
  },

  // upsert（双写：MySQL + PostgreSQL 各自有独立的 upsert 语法）
  async upsert(owner, commands) {
    const written = { mysql: false, postgresql: false };
    console.log('[GM后端] upsert 调用，dbType=', getDbType(), 'mysql=', typeof mysql, 'pg=', typeof pg);

    if (getDbType() === 'mysql' || getDbType() === 'dual') {
      console.log('[GM后端] MySQL 分支命中，mysql 对象:', !!mysql);
      if (!mysql) {
        console.warn('[GM后端] MySQL 未初始化，跳过');
      } else {
        try {
          console.log('[GM后端] MySQL upsert 开始，owner=', owner);
          // MySQL: INSERT ... ON DUPLICATE KEY UPDATE
          await mysql.query(
            'INSERT INTO userdata (owner, commands) VALUES (?, ?) ON DUPLICATE KEY UPDATE commands = VALUES(commands), updated_at = CURRENT_TIMESTAMP',
            [owner, commands]
          );
          written.mysql = true;
          console.log('[GM后端] MySQL upsert 成功');
        } catch (e) {
          console.warn('[GM后端] MySQL upsert 失败:', e.code, e.message);
        }
      }
    }

    if (getDbType() === 'postgresql' || getDbType() === 'dual') {
      console.log('[GM后端] PostgreSQL 分支命中，pg 对象:', !!pg);
      if (!pg) {
        console.warn('[GM后端] PostgreSQL 未初始化，跳过');
      } else {
        try {
          console.log('[GM后端] PostgreSQL upsert 开始，owner=', owner);
          // PostgreSQL: INSERT ... ON CONFLICT
          await pg.query(
            'INSERT INTO userdata (owner, commands) VALUES ($1, $2) ON CONFLICT (owner) DO UPDATE SET commands = $2, updated_at = CURRENT_TIMESTAMP',
            [owner, commands]
          );
          written.postgresql = true;
          console.log('[GM后端] PostgreSQL upsert 成功');
        } catch (e) {
          console.warn('[GM后端] PostgreSQL upsert 失败:', e.message);
        }
      }
    }

    return written;
  },

  async getConnection() {
    // 返回主库连接（按当前 dbType）
    if (getDbType() === 'mysql') return mysql.getConnection();
    return pg.getConnection();
  },

  // 合并多结果集（用于双读时取最新数据）
  mergeResults(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    // 按 updated_at 取最新记录，owner 相同的取最新
    const map = {};
    for (const row of rows) {
      const key = row.owner;
      if (!map[key]) {
        map[key] = row;
      } else {
        const a = new Date(map[key].updated_at || 0);
        const b = new Date(row.updated_at || 0);
        if (b > a) map[key] = row;
      }
    }
    return Object.values(map);
  }
};

module.exports = db;
module.exports.getPool = () => dbType === 'mysql' ? mysqlPool : pgPool;
module.exports.getDbType = getDbType;
module.exports.getConfig = () => config;
