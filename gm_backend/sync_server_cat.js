'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

// Paths
const COMMANDS_JSON_PATH = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\commands.json';

// --- Step 1: Read commands.json via fs.readFileSync ---
console.log('=== Step 1: Reading commands.json ===');
let rawJson;
try {
  rawJson = fs.readFileSync(COMMANDS_JSON_PATH, 'utf8');
  console.log('fs.readFileSync succeeded. File size:', rawJson.length, 'bytes');
} catch (err) {
  console.error('FAILED to read commands.json:', err.message);
  process.exit(1);
}

// --- Step 2: Verify "服务器" category ---
console.log('\n=== Step 2: Verifying "服务器" category ===');
let commands;
try {
  commands = JSON.parse(rawJson);
  console.log('JSON.parse succeeded.');
} catch (err) {
  console.error('FAILED to parse JSON:', err.message);
  process.exit(1);
}

if (!commands['服务器']) {
  console.error('FAILED: "服务器" category not found in commands.json');
  process.exit(1);
}

console.log('SUCCESS: "服务器" category found.');
console.log('Contents of "服务器":');
commands['服务器'].forEach((cmd, i) => {
  console.log(`  [${i}] name="${cmd.name}"`);
  console.log(`      text="${cmd.text}"`);
});

// Serialize for DB update
const serverCatJson = JSON.stringify(commands['服务器'], null, 2);

// --- Step 3: MySQL ---
console.log('\n=== Step 3: MySQL Update ===');
let mysqlSuccess = false;
let mysqlResult = null;
const MYSQL_CONFIG = {
  host: '10.30.138.5',
  port: 3306,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

async function runMysql() {
  let conn;
  try {
    console.log('Connecting to MySQL...');
    conn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('MySQL connection established.');

    const sql = "UPDATE userdata SET commands = ? WHERE owner = 'public'";
    console.log('Executing:', sql);
    const [result] = await conn.execute(sql, [serverCatJson]);
    mysqlResult = result;
    console.log('MySQL result:', JSON.stringify(result));
    mysqlSuccess = true;
    console.log('MySQL UPDATE SUCCESS - affectedRows:', result.affectedRows);
  } catch (err) {
    console.error('MySQL FAILED:', err.message);
    mysqlSuccess = false;
  } finally {
    if (conn) {
      try { await conn.end(); } catch (_) {}
    }
  }
}

// --- Step 4: PostgreSQL ---
console.log('\n=== Step 4: PostgreSQL Update ===');
let pgSuccess = false;
let pgResult = null;
const PG_CONFIG = {
  host: '10.30.138.5',
  port: 5432,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

async function runPg() {
  const client = new PgClient(PG_CONFIG);
  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('PostgreSQL connection established.');

    const sql = "UPDATE userdata SET commands = $1 WHERE owner = 'public'";
    console.log('Executing:', sql);
    const result = await client.query(sql, [serverCatJson]);
    pgResult = result;
    console.log('PostgreSQL result:', JSON.stringify(result));
    pgSuccess = true;
    console.log('PostgreSQL UPDATE SUCCESS - rowCount:', result.rowCount);
  } catch (err) {
    console.error('PostgreSQL FAILED:', err.message);
    pgSuccess = false;
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// --- Step 5: Run both and report ---
(async () => {
  await runMysql();
  await runPg();

  console.log('\n=== Step 5: Overall Summary ===');
  console.log('MySQL:     ', mysqlSuccess ? 'SUCCESS' : 'FAILURE', mysqlResult ? `(${JSON.stringify(mysqlResult)})` : '');
  console.log('PostgreSQL:', pgSuccess   ? 'SUCCESS' : 'FAILURE', pgResult   ? `(${JSON.stringify(pgResult)})` : '');

  if (!mysqlSuccess || !pgSuccess) {
    process.exit(1);
  }
})();
