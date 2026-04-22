const fs = require('fs');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

const COMMANDS_FILE = 'D:/AOZ/trunk/Assets/Document/GMHelper/commands.json';

// Target updates for "服务器" category
const UPDATES = {
  '添加服务器时间偏移天数': 'add_server_day 1',
  '添加服务器时间偏移小时': 'add_server_hour 1',
  '添加服务器时间偏移分钟': 'add_server_min 1',
};

async function main() {
  // 1. Read commands.json
  console.log('[1] Reading commands.json...');
  const raw = fs.readFileSync(COMMANDS_FILE, 'utf8');
  const json = JSON.parse(raw);

  // 2. Update "服务器" category
  const category = '服务器';
  if (!json[category]) {
    console.error('ERROR: Category "服务器" not found in commands.json');
    process.exit(1);
  }

  let updatedCount = 0;
  for (const cmd of json[category]) {
    if (UPDATES[cmd.name] !== undefined) {
      console.log(`  Updating "${cmd.name}": "${cmd.text}" -> "${UPDATES[cmd.name]}"`);
      cmd.text = UPDATES[cmd.name];
      updatedCount++;
    }
  }
  console.log(`[2] Updated ${updatedCount} commands in "${category}" category.`);

  // 3. Verify and print the updated category
  console.log(`[3] Verified "${category}" category:`);
  for (const cmd of json[category]) {
    console.log(`  - ${cmd.name}: ${cmd.text}`);
  }

  // 4. Write to both databases
  const commandsJson = JSON.stringify(json, null, 2);

  // MySQL
  console.log('[4a] Connecting to MySQL (10.30.138.5:3306)...');
  let mysqlResult = null;
  let mysqlError = null;
  try {
    const conn = await mysql.createConnection({
      host: '10.30.138.5',
      port: 3306,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
    });
    const [rows] = await conn.execute(
      'UPDATE userdata SET commands = ? WHERE owner = ?',
      [commandsJson, 'public']
    );
    mysqlResult = rows;
    console.log(`  MySQL UPDATE affectedRows: ${rows.affectedRows}, changedRows: ${rows.changedRows}`);
    await conn.end();
  } catch (err) {
    mysqlError = err.message;
    console.error(`  MySQL ERROR: ${err.message}`);
  }

  // PostgreSQL
  console.log('[4b] Connecting to PostgreSQL (10.30.138.5:5432)...');
  let pgResult = null;
  let pgError = null;
  try {
    const pgConn = new PgClient({
      host: '10.30.138.5',
      port: 5432,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
    });
    await pgConn.connect();
    const res = await pgConn.query(
      'UPDATE userdata SET commands = $1 WHERE owner = $2',
      [commandsJson, 'public']
    );
    pgResult = res;
    console.log(`  PostgreSQL UPDATE rowCount: ${res.rowCount}`);
    await pgConn.end();
  } catch (err) {
    pgError = err.message;
    console.error(`  PostgreSQL ERROR: ${err.message}`);
  }

  // 5. Write updated JSON back to file
  console.log('[5] Writing updated commands.json...');
  fs.writeFileSync(COMMANDS_FILE, commandsJson, 'utf8');
  console.log('  Written successfully.');

  // 6. Print summary
  console.log('[6] Summary:');
  console.log(`  MySQL:      ${mysqlError ? 'FAILED - ' + mysqlError : 'OK - affectedRows=' + (mysqlResult ? mysqlResult.affectedRows : 'N/A')}`);
  console.log(`  PostgreSQL: ${pgError ? 'FAILED - ' + pgError : 'OK - rowCount=' + (pgResult ? pgResult.rowCount : 'N/A')}`);
  console.log('Done.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
