/**
 * GMHelper 恢复脚本
 *
 * 功能：
 *   交互式列出本地备份 → 选择要恢复的备份集 → 推送到后端
 *   支持恢复全部 / 仅公开指令 / 仅指定用户
 *
 * 用法：
 *   node restore.js                 交互式菜单
 *   node restore.js --latest        静默恢复最新备份（全部）
 *   node restore.js --latest public    静默仅恢复公开指令
 *   node restore.js 2026-04-08         静默从指定日期备份恢复全部
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');

// ---- 路径配置 ----
const SCRIPT_DIR  = __dirname;
const ROOT_DIR    = path.resolve(SCRIPT_DIR, '..');
const BACKUPS_DIR = path.resolve(SCRIPT_DIR, 'backups');
const INDEX_FILE  = path.resolve(BACKUPS_DIR, 'index.json');
const BACKEND_HOST = '10.30.138.5';
const BACKEND_PORT = 3000;

// ---- HTTP 请求 ----
function httpReq(method, urlPath, body, timeout = 10000) {
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
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.setTimeout(timeout);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ---- 加载 index.json ----
function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch { return null; }
}

// ---- 列出所有备份目录（最新优先） ----
function listBackups() {
  const index = loadIndex();
  if (!index || !index.backups.length) {
    console.log('[恢复] 暂无备份记录');
    return [];
  }
  return index.backups.slice().reverse(); // 最新的在前
}

// ---- 加载 manifest ----
function loadManifest(backupDir) {
  const p = path.resolve(BACKUPS_DIR, backupDir, 'manifest.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

// ---- 获取备份目录下的所有 .json 文件 ----
function listBackupFiles(backupDir) {
  const dir = path.resolve(BACKUPS_DIR, backupDir);
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') && f !== 'manifest.json')
      .map(f => ({ file: f, owner: f === 'public.json' ? 'public' : f.replace(/\.json$/, '') }));
  } catch { return []; }
}

// ---- 向后端推送单条记录 ----
async function pushToBackend(owner, commandsStr) {
  const payload = owner === 'public'
    ? { commands: commandsStr }
    : { owner, commands: commandsStr };

  const urlPath = owner === 'public'
    ? '/api/commands/public'
    : '/api/commands';

  const result = await httpReq('POST', urlPath, payload);
  return result;
}

// ---- 恢复公开指令 ----
async function restorePublic(backupDir) {
  const filePath = path.resolve(BACKUPS_DIR, backupDir, 'public.json');
  if (!fs.existsSync(filePath)) {
    console.log('[恢复] 公开指令备份文件不存在，跳过');
    return 0;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.commands) {
    console.log('[恢复] 公开指令内容为空，跳过');
    return 0;
  }
  process.stdout.write('  → 正在恢复公开指令... ');
  const r = await pushToBackend('public', data.commands);
  if (r.success) {
    console.log('✓ 成功');
    return 1;
  } else {
    console.log(`✗ 失败: ${r.error || r.detail || JSON.stringify(r)}`);
    return 0;
  }
}

// ---- 恢复个人用户数据 ----
async function restorePersonal(backupDir, owners) {
  let ok = 0, fail = 0;
  for (const owner of owners) {
    const safeOwner = owner.replace(/[/\\:*?"<>|]/g, '_');
    const filePath  = path.resolve(BACKUPS_DIR, backupDir, `${safeOwner}.json`);
    if (!fs.existsSync(filePath)) {
      console.log(`  → [${owner}] 备份文件不存在，跳过`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.commands) {
      console.log(`  → [${owner}] commands 为空，跳过`);
      continue;
    }
    process.stdout.write(`  → [${owner}] `);
    const r = await pushToBackend(owner, data.commands);
    if (r.success) {
      console.log('✓ 成功');
      ok++;
    } else {
      console.log(`✗ 失败: ${r.error || r.detail || JSON.stringify(r)}`);
      fail++;
    }
  }
  return { ok, fail };
}

// ---- 交互式选择菜单 ----
function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

async function interactiveRestore() {
  const backups = listBackups();
  if (!backups.length) {
    console.log('[恢复] 没有找到任何备份，请先运行 backup.js');
    return;
  }

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   GMHelper 备份恢复                  ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\n可用备份（最新在前）：\n');

  backups.forEach((b, i) => {
    const tag = b.dir === (loadIndex() || {}).latest ? ' ← latest' : '';
    console.log(`  [${i + 1}] ${b.date}  ${b.owners_written}/${b.owners_total} 用户  ${b.full ? '全量' : '增量'}${tag}`);
  });

  console.log('\n  [A] 恢复全部（公开 + 所有用户）');
  console.log('  [P] 仅恢复公开指令');
  console.log('  [Q] 退出\n');

  const choice = await prompt('请选择备份编号或操作 [1]: ');
  if (!choice || choice.toUpperCase() === 'Q') {
    console.log('已退出'); return;
  }

  let selectedIdx = parseInt(choice) - 1;
  if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= backups.length) {
    selectedIdx = 0; // 默认选最新
  }

  const selected = backups[selectedIdx];
  console.log(`\n选中备份: ${selected.dir}`);

  const action = choice.toUpperCase();
  let restorePublic_ = false, restoreAll = false;

  if (action === 'P') {
    restorePublic_ = true;
  } else {
    restorePublic_ = true;
    restoreAll = true;
  }

  console.log('\n────────────────────────────────────────');
  console.log(` 开始恢复 → ${selected.dir}`);
  console.log('────────────────────────────────────────\n');

  let publicOk = 0;
  if (restorePublic_) {
    publicOk = await restorePublic(selected.dir);
  }

  let personalResult = { ok: 0, fail: 0 };
  if (restoreAll) {
    const manifest = loadManifest(selected.dir);
    const ownerList = manifest ? manifest.owners.map(o => o.owner) : [];
    if (ownerList.length === 0) {
      console.log('[恢复] 无个人用户数据需要恢复');
    } else {
      personalResult = await restorePersonal(selected.dir, ownerList);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(' 恢复完成');
  console.log('────────────────────────────────────────');
  console.log(`  公开指令 : ${publicOk ? '✓ 已恢复' : '跳过/失败'}`);
  if (restoreAll) {
    console.log(`  个人用户 : 成功 ${personalResult.ok}  失败 ${personalResult.fail}`);
  }
  console.log('');
}

// ---- 静默恢复（命令行参数） ----
async function silentRestore(targetDir, scope) {
  const index = loadIndex();
  if (!index) { console.error('[恢复] 找不到 index.json'); process.exit(1); }

  let backupDir;
  if (targetDir === '--latest' || targetDir === 'latest') {
    backupDir = index.latest;
  } else {
    // 尝试匹配日期前缀
    const found = index.backups.find(b => b.date.startsWith(targetDir));
    if (!found) { console.error(`[恢复] 未找到日期 ${targetDir} 对应的备份`); process.exit(1); }
    backupDir = found.dir;
  }

  if (!backupDir || !fs.existsSync(path.resolve(BACKUPS_DIR, backupDir))) {
    console.error('[恢复] 备份目录不存在:', backupDir); process.exit(1);
  }

  console.log(`[恢复] 从 ${backupDir} 恢复，范围: ${scope || '全部'}`);

  let publicOk = 0;
  if (!scope || scope === 'all' || scope === 'public') {
    if (scope === 'public') {
      publicOk = await restorePublic(backupDir);
    } else {
      publicOk = await restorePublic(backupDir);
    }
  }

  let personalResult = { ok: 0, fail: 0 };
  if (!scope || scope === 'all') {
    const manifest = loadManifest(backupDir);
    const owners   = manifest ? manifest.owners.map(o => o.owner) : [];
    personalResult = await restorePersonal(backupDir, owners);
  }

  console.log(`[恢复] 完成: 公开=${publicOk ? '✓' : '✗'} 个人=成功${personalResult.ok} 失败${personalResult.fail}`);
}

// ---- 入口 ----
const args = process.argv.slice(2);

if (args.length === 0) {
  interactiveRestore().catch(err => { console.error(err); process.exit(1); });
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log(`
用法:
  node restore.js                 交互式菜单
  node restore.js --latest        静默恢复最新备份（全部）
  node restore.js --latest public  静默仅恢复最新备份的公开指令
  node restore.js 2026-04-08      静默恢复指定日期的全部数据
  node restore.js 2026-04-08 personal  静默恢复指定日期的某用户（需指定 owner）
`);
} else {
  const scope = args[1]; // 'all' | 'public' | undefined
  silentRestore(args[0], scope).catch(err => { console.error(err); process.exit(1); });
}
