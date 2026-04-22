const path = require('path');
const gmBackendNodeModules = 'D:/AOZ/trunk/Assets/Document/GMHelper/gm_backend/node_modules';
const mysql = require(path.join(gmBackendNodeModules, 'mysql2/promise'));
const { Pool } = require(path.join(gmBackendNodeModules, 'pg'));

const MYSQL_CONFIG = {
  host: '10.30.138.5',
  port: 3306,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool'
};

const PG_CONFIG = {
  host: '10.30.138.5',
  port: 5432,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool'
};

const TARGET = ' 90030000008763881';

async function processDb(getPool, querySql, writeSql, writeParams, dbName) {
  const pool = getPool();
  try {
    const raw = await pool.query(querySql, ['public']);
    // mysql2 returns [rows, fields]; pg returns { rows, ... }
    const rows = Array.isArray(raw) ? raw[0] : raw.rows;
    if (rows.length === 0) {
      console.log(`[${dbName}] No row found for owner='public'`);
      return 0;
    }

    const row = rows[0];
    let commandsJson = row.commands;

    // Handle both text and JSON column types
    if (typeof commandsJson === 'string') {
      commandsJson = JSON.parse(commandsJson);
    }

    let modifiedCount = 0;
    const updated = deepReplace(commandsJson, TARGET, () => { modifiedCount++; });
    const newJson = JSON.stringify(updated);

    // Only write back if something changed
    if (modifiedCount > 0) {
      const params = writeParams(newJson);
      await pool.query(writeSql, params);
      console.log(`[${dbName}] Modified ${modifiedCount} command(s), row updated.`);
    } else {
      console.log(`[${dbName}] No matching commands found, nothing to update.`);
    }

    return modifiedCount;
  } finally {
    await pool.end();
  }
}

function deepReplace(obj, search, onHit) {
  if (Array.isArray(obj)) {
    return obj.map(item => deepReplace(item, search, onHit));
  } else if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'text' && typeof v === 'string' && v.includes(search)) {
        const newText = v.replace(search, '');
        result[k] = newText;
        onHit();
      } else {
        result[k] = deepReplace(v, search, onHit);
      }
    }
    return result;
  }
  return obj;
}

async function main() {
  console.log('=== Starting fix_quest script ===\n');

  // MySQL
  const mysqlModified = await processDb(
    () => mysql.createPool(MYSQL_CONFIG),
    'SELECT owner, commands FROM userdata WHERE owner = ?',
    'UPDATE userdata SET commands = ?, updated_at = CURRENT_TIMESTAMP WHERE owner = ?',
    (newJson) => [newJson, 'public'],
    'MySQL'
  );

  // PostgreSQL
  const pgModified = await processDb(
    () => new Pool(PG_CONFIG),
    'SELECT owner, commands FROM userdata WHERE owner = $1',
    'UPDATE userdata SET commands = $2, updated_at = CURRENT_TIMESTAMP WHERE owner = $1',
    (newJson) => ['public', newJson],
    'PostgreSQL'
  );

  console.log('\n=== Summary ===');
  console.log(`MySQL:      ${mysqlModified} command(s) modified`);
  console.log(`PostgreSQL: ${pgModified} command(s) modified`);
  console.log('=== Done ===');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
