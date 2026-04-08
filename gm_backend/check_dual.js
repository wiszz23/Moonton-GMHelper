const mysql2 = require('mysql2/promise');
const { Pool } = require('pg');

async function main() {
  const owner = '封庆扬(Wis)';

  // MySQL
  try {
    const mc = await mysql2.createConnection({
      host: '10.30.138.5', port: 3306,
      user: 'qa', password: 'qa', database: 'gm_webtool'
    });
    const [rows] = await mc.query('SELECT * FROM userdata WHERE owner = ?', [owner]);
    console.log('MySQL:', rows.length > 0 ? rows[0] : '(无记录)');
    mc.end();
  } catch(e) {
    console.log('MySQL 错误:', e.message);
  }

  // PostgreSQL
  try {
    const pgPool = new Pool({
      host: '10.30.138.5', port: 5432,
      user: 'qa', password: 'qa', database: 'gm_webtool'
    });
    const r = await pgPool.query('SELECT * FROM userdata WHERE owner = $1', [owner]);
    console.log('PostgreSQL:', r.rows.length > 0 ? r.rows[0] : '(无记录)');
    pgPool.end();
  } catch(e) {
    console.log('PostgreSQL 错误:', e.message);
  }
}

main();
