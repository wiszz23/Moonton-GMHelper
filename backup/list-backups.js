/**
 * 列出所有本地备份（供 backup.bat 调用）
 */
const fs   = require('fs');
const path = require('path');

const SCRIPT_DIR  = __dirname;
const BACKUPS_DIR = path.resolve(SCRIPT_DIR, 'backups');
const INDEX_FILE  = path.resolve(BACKUPS_DIR, 'index.json');

function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch { return null; }
}

const index = loadIndex();
if (!index || !index.backups.length) {
  console.log('暂无备份记录，请先运行 backup.js');
  return;
}

const latest = index.latest;
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║              GMHelper 备份历史                           ║');
console.log('╠══════════════════════════════════════════════════════════╣');

const sorted = index.backups.slice().reverse();
sorted.forEach(b => {
  const isLatest = (b.dir || b.date) === latest;
  const tag = isLatest ? ' ◀ LATEST' : '';
  const mode = b.full ? '全量' : '增量';
  console.log(
    `║  ${b.date}   ${mode.padEnd(4)}   用户: ${String(b.owners_written + '/' + b.owners_total).padStart(6)}   公开: ${b.public_backup ? '是' : '否'}${tag.padEnd(12)}║`
  );
});
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`\n共 ${index.backups.length} 个备份，最新: ${latest}\n`);

// 计算总大小
let totalBytes = 0;
try {
  const dirs = fs.readdirSync(BACKUPS_DIR).filter(d => !d.startsWith('.'));
  for (const dir of dirs) {
    const dirPath = path.resolve(BACKUPS_DIR, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    const files = fs.readdirSync(dirPath);
    for (const f of files) {
      totalBytes += fs.statSync(path.resolve(dirPath, f)).size;
    }
  }
  const mb = (totalBytes / 1024 / 1024).toFixed(2);
  console.log(`备份总大小: ${mb} MB\n`);
} catch {}
