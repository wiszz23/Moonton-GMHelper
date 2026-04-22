const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');

const PG_CONFIG = {
  host: '10.30.138.5',
  port: 5432,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

const MYSQL_CONFIG = {
  host: '10.30.138.5',
  port: 3306,
  user: 'qa',
  password: 'qa',
  database: 'gm_webtool',
};

const OWNER = '王俊琦(Junqi)';

async function main() {
  // --- Step 1: Query PostgreSQL ---
  console.log('=== Step 1: Query PostgreSQL ===');
  const pgClient = new PgClient(PG_CONFIG);
  await pgClient.connect();
  const pgResult = await pgClient.query(
    `SELECT commands FROM userdata WHERE owner = $1`,
    [OWNER]
  );
  await pgClient.end();

  if (pgResult.rows.length === 0) {
    console.log('No rows found in PostgreSQL for owner:', OWNER);
    return;
  }

  let pgCommandsRaw = pgResult.rows[0].commands;
  console.log('Raw commands value (type):', typeof pgCommandsRaw);
  console.log('Raw commands value:', pgCommandsRaw);
  console.log('Raw commands length:', pgCommandsRaw ? pgCommandsRaw.length : 0);

  // --- Step 2: Parse PostgreSQL commands (handle double-encoding) ---
  console.log('\n=== Step 2: Parse PostgreSQL commands ===');
  let parsed = pgCommandsRaw;

  // Try to parse as JSON string if it's a string
  if (typeof parsed === 'string') {
    // The data is double-encoded: outer is a JSON string literal, inner uses ""
    // to represent quote characters (PostgreSQL string-literal format).
    // Step A: parse the outer JSON string wrapper → gives inner JSON string
    let innerStr;
    try {
      innerStr = JSON.parse(parsed);
      if (typeof innerStr !== 'string') {
        // Not double-encoded, parsed directly to object
        parsed = innerStr;
        console.log('Parsed as JSON object directly (not double-encoded).');
      }
    } catch {
      // Fallback: try replacing "" with \" first
      innerStr = null;
    }

    // Step B: fix "" → \" in the inner string, then parse as JSON
    if (typeof innerStr === 'string') {
      console.log('  innerStr first 20 chars:', JSON.stringify(innerStr.substring(0, 20)));
      const fixed = innerStr.replace(/""/g, '\\"');
      console.log('  fixed first 20 chars:', JSON.stringify(fixed.substring(0, 20)));
      try {
        parsed = JSON.parse(fixed);
        console.log('Double-encoding detected, parsed twice.');
      } catch (e2) {
        console.error('  Failed to parse fixed inner JSON:', e2.message);
        // Try without fix in case inner already has proper \" escapes
        try {
          parsed = JSON.parse(innerStr);
          console.log('Double-encoding detected, parsed twice (inner had \\" escapes).');
        } catch (e3) {
          console.error('  Failed to parse inner JSON (no fix):', e3.message);
          return;
        }
      }
    }
  }

  // Ensure it's an array
  if (!Array.isArray(parsed)) {
    console.error('Parsed result is not an array! Type:', typeof parsed);
    return;
  }

  console.log('Number of commands found:', parsed.length);

  // --- Step 3: Convert to MySQL format ---
  console.log('\n=== Step 3: Convert to MySQL format ===');
  const uniqueCategories = [...new Set(parsed.map(cmd => cmd.category).filter(Boolean))];
  const finalJSON = {
    categories: uniqueCategories,
    commands: parsed,
  };

  console.log('Final JSON structure:');
  console.log('  categories count:', finalJSON.categories.length);
  console.log('  categories:', JSON.stringify(finalJSON.categories));
  console.log('  commands count:', finalJSON.commands.length);

  const finalJSONString = JSON.stringify(finalJSON);
  console.log('Final JSON string length:', finalJSONString.length);

  // --- Step 4: Update MySQL ---
  console.log('\n=== Step 4: Update MySQL ===');
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  const [result] = await mysqlConn.query(
    `UPDATE userdata SET commands = ? WHERE owner = ?`,
    [finalJSONString, OWNER]
  );
  await mysqlConn.end();

  console.log('Affected rows:', result.affectedRows);

  // --- Step 5: Verify update ---
  console.log('\n=== Step 5: Verify update ===');
  const verifyConn = await mysql.createConnection(MYSQL_CONFIG);
  const [rows] = await verifyConn.query(
    `SELECT commands FROM userdata WHERE owner = ?`,
    [OWNER]
  );
  await verifyConn.end();

  if (rows.length === 0) {
    console.log('No rows found in MySQL for owner:', OWNER);
    return;
  }

  const mysqlCommands = rows[0].commands;
  let mysqlParsed;
  try {
    mysqlParsed = typeof mysqlCommands === 'string' ? JSON.parse(mysqlCommands) : mysqlCommands;
  } catch (e) {
    mysqlParsed = mysqlCommands;
  }

  const cmdArray = Array.isArray(mysqlParsed) ? mysqlParsed : (mysqlParsed.commands || []);
  console.log('MySQL commands length:', mysqlCommands ? mysqlCommands.length : 0);
  console.log('MySQL commands array count:', cmdArray.length);
  console.log('MySQL commands preview (first 500 chars):', mysqlCommands ? mysqlCommands.substring(0, 500) : 'N/A');

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
