const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

async function testMysql() {
  console.log('=== MySQL Connection Test ===');
  console.log('Host: 10.30.138.5:3306 | User: qa | Database: gm_webtool');
  let conn = null;
  try {
    conn = await mysql.createConnection({
      host: '10.30.138.5',
      port: 3306,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
      connectTimeout: 10000,
    });
    const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM userdata WHERE owner = 'public'");
    console.log('RESULT:', rows);
    console.log('Status: SUCCESS - MySQL is reachable and query executed.');
    await conn.end();
    return true;
  } catch (err) {
    console.log('Status: ERROR - MySQL connection/query failed.');
    console.log('Full error:', err.message);
    if (err.stack) console.log('Stack:', err.stack);
    if (conn) await conn.end().catch(() => {});
    return false;
  }
}

async function testPostgres() {
  console.log('\n=== PostgreSQL Connection Test ===');
  console.log('Host: 10.30.138.5:5432 | User: qa | Database: gm_webtool');
  const client = new PgClient({
    host: '10.30.138.5',
    port: 5432,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const res = await client.query("SELECT COUNT(*) as cnt FROM userdata WHERE owner = 'public'");
    console.log('RESULT:', res.rows);
    console.log('Status: SUCCESS - PostgreSQL is reachable and query executed.');
    await client.end();
    return true;
  } catch (err) {
    console.log('Status: ERROR - PostgreSQL connection/query failed.');
    console.log('Full error:', err.message);
    if (err.stack) console.log('Stack:', err.stack);
    await client.end().catch(() => {});
    return false;
  }
}

(async () => {
  const mysqlOk = await testMysql();
  const pgOk = await testPostgres();
  console.log('\n=== Summary ===');
  console.log('MySQL:      ' + (mysqlOk ? 'REACHABLE' : 'NOT REACHABLE'));
  console.log('PostgreSQL: ' + (pgOk ? 'REACHABLE' : 'NOT REACHABLE'));
})();
