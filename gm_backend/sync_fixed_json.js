const fs = require('fs');
const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

const COMMANDS_PATH = 'D:/AOZ/trunk/Assets/Document/GMHelper/commands.json';

// Step 1: Read and parse JSON
console.log('=== Step 1: Reading and parsing commands.json ===');
const raw = fs.readFileSync(COMMANDS_PATH, 'utf8');
const data = JSON.parse(raw);
console.log('JSON parsed successfully.');

// Step 2: Print last 2 commands of "皮肤" category
console.log('\n=== Step 2: Last 2 commands in "皮肤" category ===');
const skinCmds = data['皮肤'];
const lastTwo = skinCmds.slice(-2);
lastTwo.forEach((cmd, i) => {
  console.log(`  [${i}] ${cmd.name}`);
});
if (lastTwo[1].name !== '角色枪械幻形皮肤全解锁') {
  console.error('ERROR: Last command name is not "角色枪械幻形皮肤全解锁"');
  process.exit(1);
}
console.log('Last command name verified: "角色枪械幻形皮肤全解锁"');

// Step 3: MySQL update
const jsonString = JSON.stringify(data);

async function updateMySQL() {
  console.log('\n=== Step 3: MySQL UPDATE ===');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '10.30.138.5',
      port: 3306,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
    });
    const [result] = await conn.execute(
      'UPDATE userdata SET commands = ? WHERE owner = ?',
      [jsonString, 'public']
    );
    console.log(`MySQL UPDATE affectedRows: ${result.affectedRows}`);
    console.log(`MySQL update ${result.affectedRows > 0 ? 'SUCCEEDED' : 'NO ROW UPDATED'}`);
    return true;
  } catch (err) {
    console.error(`MySQL ERROR: ${err.message}`);
    return false;
  } finally {
    if (conn) await conn.end();
  }
}

// Step 4: PostgreSQL update
async function updatePostgres() {
  console.log('\n=== Step 4: PostgreSQL UPDATE ===');
  const client = new PgClient({
    host: '10.30.138.5',
    port: 5432,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });
  try {
    await client.connect();
    const result = await client.query(
      'UPDATE userdata SET commands = $1 WHERE owner = $2',
      [jsonString, 'public']
    );
    console.log(`PostgreSQL UPDATE rowCount: ${result.rowCount}`);
    console.log(`PostgreSQL update ${result.rowCount !== null && result.rowCount > 0 ? 'SUCCEEDED' : 'NO ROW UPDATED'}`);
    return true;
  } catch (err) {
    console.error(`PostgreSQL ERROR: ${err.message}`);
    return false;
  } finally {
    await client.end();
  }
}

// Step 5: Run both updates
(async () => {
  const [mysqlOk, pgOk] = await Promise.all([updateMySQL(), updatePostgres()]);

  console.log('\n=== Step 5: Summary ===');
  console.log(`MySQL update:      ${mysqlOk ? 'SUCCEEDED' : 'FAILED'}`);
  console.log(`PostgreSQL update: ${pgOk ? 'SUCCEEDED' : 'FAILED'}`);

  if (!mysqlOk || !pgOk) {
    process.exit(1);
  }
})();
