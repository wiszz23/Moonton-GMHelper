const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '10.30.138.5',
    port: 3306,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });

  const [rows] = await connection.execute(
    "SELECT id, owner, updated_at FROM userdata WHERE owner LIKE '%Junqi%' OR owner LIKE '%俊琦%' OR owner LIKE '%王俊琦%'"
  );

  if (rows.length === 0) {
    console.log('No matching rows found.');
  } else {
    console.log(`Found ${rows.length} matching row(s):`);
    for (const row of rows) {
      console.log(`  id=${row.id}, owner=${row.owner}, updated_at=${row.updated_at}`);
    }
  }

  await connection.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
