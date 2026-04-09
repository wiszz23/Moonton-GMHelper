/**
 * GMHelper 备份脚本
 *
 * 功能：
 *   1. 连接 MySQL 直接枚举所有 owner
 *   2. 拉取每条记录的 commands（JSON 字符串，直接存盘，保持与 DB 一致）
 *   3. 按日期归档到 backups/YYYY-MM-DD/，含 manifest.json 元数据
 *   4. 更新 backups/index.json（latest 指针）
 *
 * 用法：
 *   node backup.js                  全量备份
 *   node backup.js --diff          增量对比（diff 模式，本次有变化的 owner 才写入文件）
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

// ---- 配置路径（相对于本文件） ----
const SCRIPT_DIR = __dirname;
const ROOT_DIR   = path.resolve(SCRIPT_DIR, '..');          // GMHelper/
const CONFIG_PATH = path.resolve(ROOT_DIR, 'gm_backend', 'config.json');
const BACKUPS_DIR = path.resolve(SCRIPT_DIR, 'backups');
const INDEX_FILE  = path.resolve(BACKUPS_DIR, 'index.json');

// ---- 读取 config.json ----
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log('[备份] 已加载配置:', CONFIG_PATH);
} catch (e) {
  console.error('[备份] 读取配置文件失败:', CONFIG_PATH, e.message);
  process.exit(1);
}

const BACKEND_HOST = '10.30.138.5';
const BACKEND_PORT = 3000;

// ---- HTTP 请求封装（GET / POST） ----
function httpRequest(method, urlPath, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BACKEND_HOST,
      port:     BACKEND_PORT,
      path:     urlPath,
      method,
      headers:  { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.setTimeout(timeout);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---- MySQL 连接封装（mysql2） ----
// 从 gm_backend/node_modules/ 加载（backup.js 与 gm_backend/ 是兄弟目录）
function loadMysql2() {
  try { return require('mysql2/promise'); }
  catch {
    // 尝试从父级 gm_backend/ 加载
    const gmBackendNodeModules = path.resolve(ROOT_DIR, 'gm_backend', 'node_modules');
    return require(path.resolve(gmBackendNodeModules, 'mysql2/promise'));
  }
}
async function createMysqlPool() {
  const mysql2 = loadMysql2();
  return mysql2.createPool({
    host:     config.mysql.host,
    port:     config.mysql.port,
    user:     config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: 5,
  });
}

// ---- 获取所有 owner 列表（直接从 MySQL） ----
async function getAllOwners(pool) {
  const [rows] = await pool.query(
    'SELECT DISTINCT owner FROM userdata WHERE owner != "public" ORDER BY owner'
  );
  return rows.map(r => r.owner);
}

// ---- 获取单条 userdata ----
async function fetchUserdata(owner) {
  try {
    const data = await httpRequest('GET', `/api/commands/${encodeURIComponent(owner)}`);
    return data;
  } catch (e) {
    console.warn(`[备份] 获取 ${owner} 失败: ${e.message}`);
    return null;
  }
}

// ---- 解析 commands JSON 字符串（用于 manifest 统计） ----
function parseCommands(commandsStr) {
  if (!commandsStr) return null;
  try { return JSON.parse(commandsStr); }
  catch { return null; }
}

// ---- 获取分类数量 & 指令数量（从 commands JSON） ----
function countItems(commandsStr) {
  const parsed = parseCommands(commandsStr);
  if (!parsed) return { categories: 0, commands: 0 };
  const cats = Object.keys(parsed);
  const cmds = cats.reduce((sum, cat) => sum + (Array.isArray(parsed[cat]) ? parsed[cat].length : 0), 0);
  return { categories: cats.length, commands: cmds };
}

// ---- 加载 index.json ----
function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return { backups: [], latest: null };
  }
}

// ---- 保存 index.json ----
function saveIndex(idx) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
}

// ---- 主备份流程 ----
async function runBackup(diffMode = false) {
  const ts       = new Date();
  const dateStr  = ts.toISOString().slice(0, 10);               // YYYY-MM-DD
  const timeStr  = ts.toISOString().replace(/[:.]/g, '-');      // 完整时间戳
  const destDir  = path.resolve(BACKUPS_DIR, dateDir = `backups/${dateStr}`);
  const destDir2  = path.resolve(BACKUPS_DIR, dateStr);

  // 两个路径都尝试（兼容）
  const finalDir = fs.existsSync(destDir2) ? destDir2 : fs.mkdirSync(destDir2, { recursive: true }), destDir2;

  console.log('\n========================================');
  console.log(` GMHelper 备份  ${ts.toLocaleString()}`);
  console.log('========================================');
  console.log('[备份] 模式:', diffMode ? '增量对比（仅记录有变化的 owner）' : '全量备份');

  // --- 1. 连接 MySQL 获取 owner 列表 ---
  let pool;
  let owners = [];
  try {
    pool   = await createMysqlPool();
    owners = await getAllOwners(pool);
    console.log(`[备份] 共找到 ${owners.length} 个个人用户`);
  } catch (e) {
    console.warn('[备份] MySQL 连接失败，将仅备份公开指令:', e.message);
  }

  // --- 2. 获取公开指令 ---
  let publicData = null;
  try {
    publicData = await httpRequest('GET', '/api/commands/public');
    console.log('[备份] 公开指令获取成功');
  } catch (e) {
    console.error('[备份] 公开指令获取失败:', e.message);
  }

  // --- 3. 获取上一次备份的 manifest，对比 diff ---
  const index    = loadIndex();
  const prevManifest = index.latest
    ? loadManifest(path.resolve(BACKUPS_DIR, index.latest, 'manifest.json'))
    : null;

  function loadManifest(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return null; }
  }

  function hasChanged(owner, newData) {
    if (!prevManifest) return true;
    const prev = prevManifest.owners.find(o => o.owner === owner);
    if (!prev) return true;                                    // 新增
    return prev.commands_str !== (newData && newData.commands); // 内容变化
  }

  // --- 4. 写入公开指令（每次都写） ---
  if (publicData && publicData.commands) {
    const pubDest = path.resolve(finalDir, 'public.json');
    fs.writeFileSync(pubDest, JSON.stringify(publicData, null, 2), 'utf8');
    const cnt = countItems(publicData.commands);
    console.log(`[备份] 公开指令 → ${pubDest}`);
    console.log(`        分类: ${cnt.categories}  指令: ${cnt.commands}`);
  }

  // --- 5. 写入个人用户数据 ---
  const writtenOwners = [];
  let unchangedCount = 0;
  let changedCount  = 0;
  let failedCount   = 0;

  for (const owner of owners) {
    const data = await fetchUserdata(owner);
    if (!data) { failedCount++; continue; }

    if (diffMode && !hasChanged(owner, data)) {
      unchangedCount++;
      continue;
    }

    const safeOwner = owner.replace(/[/\\:*?"<>|]/g, '_');
    const filePath  = path.resolve(finalDir, `${safeOwner}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    writtenOwners.push({
      owner,
      file:        `${safeOwner}.json`,
      size_bytes:  Buffer.byteLength(JSON.stringify(data), 'utf8'),
      updated_at:  data.updated_at || null,
    });
    changedCount++;
  }

  // --- 6. 生成 manifest.json ---
  const manifest = {
    created_at:       ts.toISOString(),
    backup_time:       ts.toISOString(),
    mode:              diffMode ? 'incremental' : 'full',
    previous_backup:   index.latest || null,
    public: publicData ? {
      file:            'public.json',
      categories:       countItems(publicData.commands).categories,
      commands:         countItems(publicData.commands).commands,
      updated_at:       publicData.updated_at || null,
    } : null,
    owners:            writtenOwners,
    stats: {
      total_owners:      owners.length,
      written:           changedCount,
      unchanged_skipped:  unchangedCount,
      failed:            failedCount,
    },
  };
  fs.writeFileSync(
    path.resolve(finalDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  // --- 7. 更新 index.json ---
  const newEntry = {
    date:          dateStr,
    time:          ts.toISOString(),
    dir:           path.relative(BACKUPS_DIR, finalDir),
    full:          !diffMode,
    owners_written: changedCount,
    owners_total:  owners.length,
    public_backup: !!(publicData && publicData.commands),
  };
  index.backups.push(newEntry);
  index.latest = path.relative(BACKUPS_DIR, finalDir);
  saveIndex(index);

  if (pool) await pool.end();

  // --- 8. 输出摘要 ---
  console.log('\n========================================');
  console.log(' 备份完成');
  console.log('========================================');
  console.log(` 备份目录 : ${finalDir}`);
  console.log(` 备份模式 : ${diffMode ? '增量' : '全量'}`);
  console.log(` 个人用户 : 总数=${owners.length}  写入=${changedCount}  跳过=${unchangedCount}  失败=${failedCount}`);
  console.log(` 公开指令 : ${publicData && publicData.commands ? '已备份' : '未备份'}`);
  console.log(` 历史备份 : ${index.backups.length} 个（含本次）`);
  console.log('');
}

// ---- 入口 ----
const diffMode = process.argv.includes('--diff');
runBackup(diffMode).catch(err => {
  console.error('[备份] 异常退出:', err);
  process.exit(1);
});
