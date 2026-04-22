const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

const MYSQL_CONFIG = {
  host: '10.30.138.5',
  port: 3306,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

const PG_CONFIG = {
  host: '10.30.138.5',
  port: 5432,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

// Valid owners — real names seen in the codebase
const VALID_OWNERS = new Set([
  'public',
  '封庆扬(Wis)',
  '邓思浩',
  '李程(Cheng)',
  '叶雨柔(Yoyo)',
  '秦雄凌(Jerry)',
  '曹超骏',
  '王俊琦(Junqi)',
  '李妍(Neecoo)',
  '黄嘉宝(Garbo)',
  '姜笑蓉(Xiaorong)',
  '张佳乐(Daniel)',
  '张哲(Akako)',
  '杨凯晴(Amelia)',
  '张文豪(Wenhao)',
  '许华(Rex)',
  '潘笑海',
  '熊守伟(Bob)',
  '樊鹏(Fanpeng)',
  '梅子剑(Scott)',
  '颜权(Quan)',
  '余成浩(Cyrus)',
  '杨海涛(Haitao)',
  '马雷鸣(Archmage)',
  '王惠莹(Cassie)',
  '刘辉圳(Josh)',
  '厉华(Liz)',
  '杜啸山(Sam)',
  '翁渊文(Evin)',
  '徐显坤(Blando)',
]);

// Patterns that indicate invalid/corrupted owner strings
const INVALID_PATTERNS = [
  /^#\d+$/,                          // build numbers like #130
  /\d{4}年/,                          // timestamps containing year: 2026年
  /大学数学网/,                        // URLs
  /www\.|http:\/\/|https:\/\//,      // URL patterns
  /^.{1,2}$/,                         // single or very short chars like "f"
  /[\u0000-\u001F\u007F-\u009F]/,     // control characters
  /^\s+$/,                           // whitespace only
  /^[\?\!]+$/,                       // punctuation only
  /\?{2,}/,                          // multiple question marks (garbled)
  /�/g,                              // replacement character (garbled encoding)
  // garbled / gibberish: mix of rare/unexpected chars, or very long random strings
  // Check for strings that look like base64 or hashes
  /^[A-Za-z0-9+\/=]{20,}$/,
];

function isValidOwner(owner) {
  if (!owner || typeof owner !== 'string') return false;
  const trimmed = owner.trim();
  if (VALID_OWNERS.has(trimmed)) return true;
  // Check invalid patterns
  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }
  // Reasonable Chinese name: 2-4 chars (possibly with parentheses)
  // Or "public"
  if (/^[\u4e00-\u9fff]{2,4}(?:\([A-Za-z0-9]+\))?$/.test(trimmed)) return true;
  if (/^[A-Za-z]+$/.test(trimmed) && trimmed.length <= 2) return false; // short english only = invalid
  return true; // keep if we can't prove it's invalid
}

function isInvalidOwner(owner) {
  return !isValidOwner(owner);
}

async function queryMysql() {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  const [rows] = await conn.execute(
    'SELECT id, owner, updated_at FROM userdata ORDER BY id'
  );
  await conn.end();
  return rows;
}

async function queryPostgres() {
  const client = new PgClient(PG_CONFIG);
  await client.connect();
  const res = await client.query(
    'SELECT id, owner, updated_at FROM userdata ORDER BY id'
  );
  await client.end();
  return res.rows;
}

async function deleteMysqlInvalid(ids) {
  if (ids.length === 0) return 0;
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  const placeholders = ids.map(() => '?').join(',');
  const [result] = await conn.execute(
    `DELETE FROM userdata WHERE id IN (${placeholders})`,
    ids
  );
  await conn.end();
  return result.affectedRows;
}

async function deletePostgresInvalid(ids) {
  if (ids.length === 0) return 0;
  const client = new PgClient(PG_CONFIG);
  await client.connect();
  const res = await client.query(
    'DELETE FROM userdata WHERE id = ANY($1)',
    [ids]
  );
  await client.end();
  return res.rowCount;
}

async function countMysql() {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM userdata');
  await conn.end();
  return Number(rows[0].cnt);
}

async function countPostgres() {
  const client = new PgClient(PG_CONFIG);
  await client.connect();
  const res = await client.query('SELECT COUNT(*) as cnt FROM userdata');
  await client.end();
  return Number(res.rows[0].cnt);
}

async function main() {
  console.log('=== Connecting to MySQL and PostgreSQL in parallel ===\n');

  const [mysqlRows, pgRows] = await Promise.all([
    queryMysql().catch(e => { console.error('MySQL query failed:', e.message); return []; }),
    queryPostgres().catch(e => { console.error('PostgreSQL query failed:', e.message); return []; }),
  ]);

  // --- Print all owners found in both databases ---
  console.log('=== ALL OWNERS FOUND ===\n');

  console.log(`--- MySQL (${mysqlRows.length} rows) ---`);
  for (const row of mysqlRows) {
    const status = isInvalidOwner(row.owner) ? ' [INVALID]' : '';
    console.log(`  id=${row.id}  owner="${row.owner}"  updated_at=${row.updated_at}${status}`);
  }

  console.log(`\n--- PostgreSQL (${pgRows.length} rows) ---`);
  for (const row of pgRows) {
    const status = isInvalidOwner(row.owner) ? ' [INVALID]' : '';
    console.log(`  id=${row.id}  owner="${row.owner}"  updated_at=${row.updated_at}${status}`);
  }

  // --- Identify invalid rows ---
  const mysqlInvalid = mysqlRows.filter(r => isInvalidOwner(r.owner));
  const pgInvalid = pgRows.filter(r => isInvalidOwner(r.owner));

  console.log('\n=== INVALID ROWS TO BE DELETED ===\n');

  console.log(`--- MySQL (${mysqlInvalid.length} rows) ---`);
  for (const row of mysqlInvalid) {
    console.log(`  id=${row.id}  owner="${row.owner}"  updated_at=${row.updated_at}`);
  }

  console.log(`\n--- PostgreSQL (${pgInvalid.length} rows) ---`);
  for (const row of pgInvalid) {
    console.log(`  id=${row.id}  owner="${row.owner}"  updated_at=${row.updated_at}`);
  }

  // --- Delete ---
  const mysqlIds = mysqlInvalid.map(r => r.id);
  const pgIds = pgInvalid.map(r => r.id);

  console.log('\n=== DELETING INVALID ROWS ===\n');

  const [mysqlDeleted, pgDeleted] = await Promise.all([
    deleteMysqlInvalid(mysqlIds).catch(e => { console.error('MySQL delete failed:', e.message); return 0; }),
    deletePostgresInvalid(pgIds).catch(e => { console.error('PostgreSQL delete failed:', e.message); return 0; }),
  ]);

  console.log(`MySQL: deleted ${mysqlDeleted} row(s)`);
  console.log(`PostgreSQL: deleted ${pgDeleted} row(s)`);

  // --- Final counts ---
  const [finalMysql, finalPg] = await Promise.all([
    countMysql().catch(e => { console.error('MySQL count failed:', e.message); return -1; }),
    countPostgres().catch(e => { console.error('PostgreSQL count failed:', e.message); return -1; }),
  ]);

  console.log('\n=== FINAL ROW COUNTS ===\n');
  console.log(`MySQL:     ${finalMysql} rows remaining`);
  console.log(`PostgreSQL: ${finalPg} rows remaining`);
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
