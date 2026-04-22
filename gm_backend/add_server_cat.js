const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

const COMMANDS_FILE = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\commands.json';

const MYSQL_CONFIG = {
  host: '10.30.138.5',
  port: 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'gm',
};

const PG_CONFIG = {
  host: '10.30.138.5',
  port: 5432,
  user: process.env.PGUSER || process.env.PG_USER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'gm',
};

const NEW_CATEGORY = {
  '服务器': [
    { name: '添加服务器时间偏移天数', text: 'add_server_day %s' },
    { name: '添加服务器时间偏移小时', text: 'add_server_hour %s' },
    { name: '添加服务器时间偏移分钟', text: 'add_server_min %s' },
  ],
};

async function updateMysql(commandsJson) {
  const conn = await mysql.createConnection(MYSQL_CONFIG);
  try {
    const sql = 'UPDATE userdata SET commands = ? WHERE owner = ?';
    const [result] = await conn.execute(sql, [commandsJson, 'public']);
    return result;
  } finally {
    await conn.end();
  }
}

async function updatePostgres(commandsJson) {
  const client = new PgClient(PG_CONFIG);
  try {
    await client.connect();
    const sql = 'UPDATE userdata SET commands = $1 WHERE owner = $2';
    const result = await client.query(sql, [commandsJson, 'public']);
    return result;
  } finally {
    await client.end();
  }
}

async function main() {
  // 1. Read commands.json
  const raw = fs.readFileSync(COMMANDS_FILE, 'utf8');
  const json = JSON.parse(raw);

  // 2. Check if "服务器" exists
  const categoryKey = '服务器';
  const existed = Object.prototype.hasOwnProperty.call(json, categoryKey);
  let mysqlResult = null;
  let pgResult = null;
  let mysqlError = null;
  let pgError = null;

  if (existed) {
    console.log(`[INFO] "${categoryKey}" category already exists in commands.json:`);
    console.log(JSON.stringify(json[categoryKey], null, 2));
  } else {
    console.log(`[INFO] "${categoryKey}" category does not exist. Creating...`);
    json[categoryKey] = NEW_CATEGORY[categoryKey];
    console.log(`[INFO] Created "${categoryKey}" category.`);
  }

  // 3. Serialize updated JSON
  const updatedJson = JSON.stringify(json, null, 2);

  // 4. Write back to commands.json
  fs.writeFileSync(COMMANDS_FILE, updatedJson, 'utf8');
  console.log(`[INFO] Updated commands.json written to disk.`);

  // 5. Update MySQL
  try {
    mysqlResult = await updateMysql(updatedJson);
    console.log(`[MySQL] Rows affected: ${mysqlResult.affectedRows}`);
  } catch (err) {
    mysqlError = err.message;
    console.error(`[MySQL] ERROR: ${mysqlError}`);
  }

  // 6. Update PostgreSQL
  try {
    pgResult = await updatePostgres(updatedJson);
    console.log(`[PostgreSQL] Rows affected: ${pgResult.rowCount}`);
  } catch (err) {
    pgError = err.message;
    console.error(`[PostgreSQL] ERROR: ${pgError}`);
  }

  // 7. Summary
  console.log('\n=== SUMMARY ===');
  console.log(`"${categoryKey}" existed before: ${existed}`);
  console.log(`"${categoryKey}" action: ${existed ? 'no change (already present)' : 'created'}`);
  console.log(`MySQL update: ${mysqlError ? 'FAILED - ' + mysqlError : 'OK (' + (mysqlResult ? mysqlResult.affectedRows + ' row(s) affected' : 'N/A') + ')'}`);
  console.log(`PostgreSQL update: ${pgError ? 'FAILED - ' + pgError : 'OK (' + (pgResult ? pgResult.rowCount + ' row(s) affected' : 'N/A') + ')'}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
