const mysql = require('mysql2/promise');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

const OUTPUT_FILE = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\commands.json';
const WORK_DIR = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\gm_backend\\';

async function fetchFromMySQL() {
  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const [rows] = await conn.query("SELECT commands FROM userdata WHERE owner = 'public'");
    if (rows.length > 0 && rows[0].commands) {
      return JSON.parse(rows[0].commands);
    }
    return null;
  } catch (err) {
    console.error('[MySQL] Error fetching commands:', err.message);
    return null;
  } finally {
    if (conn) await conn.end();
  }
}

async function updateMySQL(json) {
  let conn;
  try {
    conn = await mysql.createConnection(MYSQL_CONFIG);
    const str = JSON.stringify(json);
    await conn.query("UPDATE userdata SET commands = ? WHERE owner = 'public'", [str]);
    return true;
  } catch (err) {
    console.error('[MySQL] Error updating commands:', err.message);
    return false;
  } finally {
    if (conn) await conn.end();
  }
}

async function fetchFromPG() {
  let client;
  try {
    client = new Client(PG_CONFIG);
    await client.connect();
    const res = await client.query("SELECT commands FROM userdata WHERE owner = 'public'");
    if (res.rows.length > 0 && res.rows[0].commands) {
      return JSON.parse(res.rows[0].commands);
    }
    return null;
  } catch (err) {
    console.error('[PostgreSQL] Error fetching commands:', err.message);
    return null;
  } finally {
    if (client) await client.end();
  }
}

async function updatePG(json) {
  let client;
  try {
    client = new Client(PG_CONFIG);
    await client.connect();
    const str = JSON.stringify(json);
    await client.query("UPDATE userdata SET commands = $1 WHERE owner = 'public'", [str]);
    return true;
  } catch (err) {
    console.error('[PostgreSQL] Error updating commands:', err.message);
    return false;
  } finally {
    if (client) await client.end();
  }
}

async function main() {
  process.chdir(WORK_DIR);

  console.log('=== Fetching from both databases in parallel ===');
  const [mysqlData, pgData] = await Promise.all([fetchFromMySQL(), fetchFromPG()]);

  console.log(`[MySQL]     Data found: ${mysqlData !== null}`);
  console.log(`[PostgreSQL] Data found: ${pgData !== null}`);

  let json;
  let source = 'none';

  if (mysqlData !== null && pgData !== null) {
    const mCount = Object.values(mysqlData).flat().length;
    const pCount = Object.values(pgData).flat().length;
    console.log(`[Info] Both DBs returned data. MySQL total commands: ${mCount}, PostgreSQL total commands: ${pCount}`);
    json = mCount >= pCount ? mysqlData : pgData;
    source = mCount >= pCount ? 'MySQL' : 'PostgreSQL';
    console.log(`[Info] Using data from ${source} (${json === mysqlData ? 'MySQL' : 'PostgreSQL'})`);
  } else if (mysqlData !== null) {
    json = mysqlData;
    source = 'MySQL';
    console.log('[Info] Using data from MySQL (PostgreSQL had no data)');
  } else if (pgData !== null) {
    json = pgData;
    source = 'PostgreSQL';
    console.log('[Info] Using data from PostgreSQL (MySQL had no data)');
  } else {
    console.error('[Error] Neither database returned data. Cannot proceed.');
    process.exit(1);
  }

  console.log('\n=== Modifying JSON ===');

  const TARGET_CAT = '通用皮肤';
  const NEW_CAT = '角色枪械幻形皮肤全解锁';
  const NEW_CMD = {
    name: '角色枪械幻形皮肤全解锁',
    text: 'add_item %s 145001 1\nadd_item %s 145002 1\nadd_item %s 145003 1\nadd_item %s 145004 1\nadd_item %s 145005 1\nadd_item %s 145006 1\nadd_item %s 146001 1\nadd_item %s 146002 1\nadd_item %s 146003 1',
  };

  let created = false;
  let hadOldCategory = TARGET_CAT in json;
  let renamed = false;

  if (TARGET_CAT in json) {
    // Rename the key
    const arr = json[TARGET_CAT];
    delete json[TARGET_CAT];
    json[NEW_CAT] = arr;
    renamed = true;
    console.log(`  - "${TARGET_CAT}" existed with ${arr.length} command(s) -> renamed to "${NEW_CAT}"`);
  } else {
    // Create the new category fresh
    json[NEW_CAT] = [];
    created = true;
    console.log(`  - "${TARGET_CAT}" did NOT exist -> created new category "${NEW_CAT}"`);
  }

  // Now check for duplicate in the (possibly new) category
  const catArr = json[NEW_CAT];
  const existingIndex = catArr.findIndex(c => c.name === NEW_CMD.name);

  if (existingIndex === -1) {
    catArr.push(NEW_CMD);
    console.log(`  - Added new command "${NEW_CMD.name}" to category "${NEW_CAT}"`);
  } else {
    console.log(`  - Command "${NEW_CMD.name}" already exists in category "${NEW_CAT}" at index ${existingIndex} -> skipping duplicate`);
  }

  console.log(`\n=== Final state of category "${NEW_CAT}" ===`);
  console.log(`  - Total commands: ${catArr.length}`);
  catArr.forEach((c, i) => console.log(`    [${i}] ${c.name}`));

  console.log('\n=== Writing updated JSON to local file ===');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(json, null, 2), 'utf8');
  console.log(`[OK] Written to ${OUTPUT_FILE}`);

  console.log('\n=== Updating databases ===');
  const [mysqlOk, pgOk] = await Promise.all([updateMySQL(json), updatePG(json)]);

  console.log(`[MySQL]     Update: ${mysqlOk ? 'SUCCESS' : 'FAILED'}`);
  console.log(`[PostgreSQL] Update: ${pgOk ? 'SUCCESS' : 'FAILED'}`);

  console.log('\n=== Summary ===');
  console.log(`  - "${TARGET_CAT}" existed and was renamed: ${renamed ? 'YES' : 'NO (did not exist)'}`);
  console.log(`  - Category "${NEW_CAT}" was created fresh: ${created ? 'YES' : 'NO (already existed or renamed from old)'}`);
  console.log(`  - Commands now in "${NEW_CAT}": ${catArr.length}`);
  console.log(`  - MySQL updated: ${mysqlOk ? 'YES' : 'NO'}`);
  console.log(`  - PostgreSQL updated: ${pgOk ? 'YES' : 'NO'}`);

  if (!mysqlOk || !pgOk) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});
