/**
 * GMHelper 新增分类「佣兵」到后端公开指令
 *
 * 功能：
 *   1. GET /api/commands/public  获取当前公开指令
 *   2. 解析内层 commands JSON
 *   3. 新增分类「佣兵」及两条指令
 *   4. POST 回 /api/commands/public
 *
 * 用法：node add_yongbing.js
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ---- 配置 ----
const BACKEND_HOST = '10.30.138.5';
const BACKEND_PORT = 3000;
const BACKUP_DIR   = path.resolve(__dirname);

// ---- HTTP 请求封装 ----
function httpReq(method, urlPath, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BACKEND_HOST,
      port:     BACKEND_PORT,
      path:     urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.setTimeout(timeout);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---- 备份文件 ----
function backup(data, label) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.resolve(BACKUP_DIR, `backup_${label}_${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓ 备份已保存: ${path.basename(file)}`);
  return file;
}

// ---- 主流程 ----
async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  GMHelper 新增分类「佣兵」');
  console.log('══════════════════════════════════════════\n');

  // ── 1. GET 当前公开指令 ──────────────────────────
  console.log('[1/5] 读取后端公开指令...');
  let raw;
  try {
    raw = await httpReq('GET', '/api/commands/public');
  } catch (e) {
    console.error('  ✗ 连接失败:', e.message);
    process.exit(1);
  }

  if (!raw.commands) {
    console.error('  ✗ 后端返回 commands 为空');
    process.exit(1);
  }
  console.log('  ✓ 读取成功');

  // ── 2. 双重解析 JSON ──────────────────────────────
  console.log('[2/5] 解析指令结构...');
  let cmds;
  try {
    cmds = JSON.parse(raw.commands);
  } catch (e) {
    console.error('  ✗ JSON 解析失败:', e.message);
    process.exit(1);
  }

  // 备份原始数据
  backup({ ...raw, commands: raw.commands }, 'before');

  const cats = Object.keys(cmds);
  console.log(`  ✓ 当前分类 (${cats.length}): ${cats.join(', ')}`);

  // ── 3. 检查/新增「佣兵」分类 ──────────────────────
  console.log('[3/5] 新增「佣兵」分类...');
  const CATEGORY = '佣兵';

  if (cmds[CATEGORY]) {
    console.log(`  ⚠  分类「${CATEGORY}」已存在，将追加指令`);
  } else {
    cmds[CATEGORY] = [];
    console.log(`  ✓ 新建分类「${CATEGORY}」`);
  }

  const CATEGORY_CMDS = [
    {
      name: '佣兵道具全解锁',
      text: 'add_item %s 5001 1000\nadd_item %s 5002 1000\nadd_item %s 5003 1000',
    },
    {
      name: '佣兵道具清理',
      text: 'clear_item %s 5001 1000\nclear_item %s 5002 1000\nclear_item %s 5003 1000',
    },
  ];

  const beforeCount = cmds[CATEGORY].length;
  CATEGORY_CMDS.forEach(c => {
    const exists = cmds[CATEGORY].some(existing => existing.name === c.name);
    if (exists) {
      console.log(`  ⚠  指令「${c.name}」已存在，跳过`);
    } else {
      cmds[CATEGORY].push(c);
      console.log(`  ✓ 新增指令「${c.name}」`);
    }
  });
  console.log(`  分类「${CATEGORY}」现有指令: ${beforeCount} → ${cmds[CATEGORY].length}`);

  // ── 4. 预览变更 ──────────────────────────────────
  console.log('\n[4/5] 变更预览:');
  console.log(`  新增分类: ${CATEGORY}`);
  CATEGORY_CMDS.forEach(c => {
    console.log(`    • ${c.name}`);
    c.text.split('\n').forEach(line => console.log(`        ${line}`));
  });

  // ── 5. POST 回后端 ────────────────────────────────
  console.log('\n[5/5] 写入后端数据库...');
  const newCommandsStr = JSON.stringify(cmds);

  let result;
  try {
    result = await httpReq('POST', '/api/commands/public', { commands: newCommandsStr });
  } catch (e) {
    console.error('  ✗ 写入失败:', e.message);
    process.exit(1);
  }

  if (result.success) {
    console.log('  ✓ 写入成功');
    console.log(`    MySQL: ${result.written?.mysql}`);
    console.log(`    PG:    ${result.written?.postgresql}`);
  } else {
    console.error('  ✗ 写入失败:', result.error || result.detail || JSON.stringify(result));
    process.exit(1);
  }

  // 备份新数据
  backup({ owner: 'public', commands: newCommandsStr, updated_at: result.updated_at }, 'after');

  console.log('\n══════════════════════════════════════════');
  console.log('  完成！请刷新 GMHelper 面板验证');
  console.log('══════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
