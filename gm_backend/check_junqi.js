const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function main() {
  const owner = '王俊琦(Junqi)';

  // --- MySQL ---
  console.log('=== MySQL ===');
  let mysqlConn;
  try {
    mysqlConn = await mysql.createConnection({
      host: '10.30.138.5',
      port: 3306,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
    });

    const [rows] = await mysqlConn.execute(
      `SELECT id, owner, commands, LEFT(commands, 200) as cmds_preview, LENGTH(commands) as cmds_len FROM userdata WHERE owner = ?`,
      [owner]
    );

    if (rows.length === 0) {
      console.log('No rows found for owner:', owner);
    } else {
      for (const row of rows) {
        console.log('id:', row.id);
        console.log('owner:', row.owner);
        console.log('cmds_preview:', row.cmds_preview);
        console.log('cmds_len:', row.cmds_len);

        const fullCmds = row.commands;
        if (!fullCmds || fullCmds === null || (typeof fullCmds === 'string' && fullCmds.trim() === '')) {
          console.log('DATA IS EMPTY');
        } else if (typeof fullCmds === 'string' && fullCmds.length <= 5000) {
          console.log('Full commands:');
          console.log(fullCmds);
        } else if (typeof fullCmds === 'string' && fullCmds.length > 5000) {
          console.log('Full commands (truncated, length=' + fullCmds.length + '):');
          console.log(fullCmds.substring(0, 5000));
        } else if (Array.isArray(fullCmds)) {
          const s = JSON.stringify(fullCmds);
          if (s.length <= 5000) {
            console.log('Full commands (array, stringified):');
            console.log(s);
          } else {
            console.log('Full commands (array, stringified, truncated, length=' + s.length + '):');
            console.log(s.substring(0, 5000));
          }
        } else {
          console.log('Full commands (unknown type):', fullCmds);
        }
        console.log('---');
      }
    }
  } catch (err) {
    console.error('MySQL error:', err.message);
  } finally {
    if (mysqlConn) await mysqlConn.end();
  }

  // --- PostgreSQL ---
  console.log('\n=== PostgreSQL ===');
  const pgClient = new Client({
    host: '10.30.138.5',
    port: 5432,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });

  try {
    await pgClient.connect();

    const res = await pgClient.query(
      `SELECT id, owner, commands, LEFT(commands, 200) as cmds_preview, LENGTH(commands) as cmds_len FROM userdata WHERE owner = $1`,
      [owner]
    );

    if (res.rows.length === 0) {
      console.log('No rows found for owner:', owner);
    } else {
      for (const row of res.rows) {
        console.log('id:', row.id);
        console.log('owner:', row.owner);
        console.log('cmds_preview:', row.cmds_preview);
        console.log('cmds_len:', row.cmds_len);

        const fullCmds = row.commands;
        if (!fullCmds || fullCmds === null || (typeof fullCmds === 'string' && fullCmds.trim() === '')) {
          console.log('DATA IS EMPTY');
        } else if (typeof fullCmds === 'string' && fullCmds.length <= 5000) {
          console.log('Full commands:');
          console.log(fullCmds);
        } else if (typeof fullCmds === 'string' && fullCmds.length > 5000) {
          console.log('Full commands (truncated, length=' + fullCmds.length + '):');
          console.log(fullCmds.substring(0, 5000));
        } else if (Array.isArray(fullCmds)) {
          const s = JSON.stringify(fullCmds);
          if (s.length <= 5000) {
            console.log('Full commands (array, stringified):');
            console.log(s);
          } else {
            console.log('Full commands (array, stringified, truncated, length=' + s.length + '):');
            console.log(s.substring(0, 5000));
          }
        } else {
          console.log('Full commands (unknown type):', fullCmds);
        }
        console.log('---');
      }
    }
  } catch (err) {
    console.error('PostgreSQL error:', err.message);
  } finally {
    await pgClient.end();
  }
}

main();
