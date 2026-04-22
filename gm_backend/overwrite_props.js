const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// Load config from same directory
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// The new commands to set (52 items)
const NEW_COMMANDS = [
  {"name": "add_weapon %s 135000 1", "text": "add_weapon %s 135000 1"},
  {"name": "add_weapon %s 135001 1", "text": "add_weapon %s 135001 1"},
  {"name": "add_weapon %s 135002 1", "text": "add_weapon %s 135002 1"},
  {"name": "add_weapon %s 135003 1", "text": "add_weapon %s 135003 1"},
  {"name": "add_weapon %s 135004 1", "text": "add_weapon %s 135004 1"},
  {"name": "add_weapon %s 135005 1", "text": "add_weapon %s 135005 1"},
  {"name": "add_weapon %s 135006 1", "text": "add_weapon %s 135006 1"},
  {"name": "add_weapon %s 136001 1", "text": "add_weapon %s 136001 1"},
  {"name": "add_weapon %s 136002 1", "text": "add_weapon %s 136002 1"},
  {"name": "add_weapon %s 136003 1", "text": "add_weapon %s 136003 1"},
  {"name": "add_item %s 2010 10", "text": "add_item %s 2010 10"},
  {"name": "add_item %s 2020 10", "text": "add_item %s 2020 10"},
  {"name": "add_item %s 2030 10", "text": "add_item %s 2030 10"},
  {"name": "add_item %s 2040 10", "text": "add_item %s 2040 10"},
  {"name": "add_item %s 2050 10", "text": "add_item %s 2050 10"},
  {"name": "add_item %s 2060 10", "text": "add_item %s 2060 10"},
  {"name": "add_item %s 2070 10", "text": "add_item %s 2070 10"},
  {"name": "add_item %s 2080 10", "text": "add_item %s 2080 10"},
  {"name": "add_item %s 2090 10", "text": "add_item %s 2090 10"},
  {"name": "add_item %s 2100 10", "text": "add_item %s 2100 10"},
  {"name": "add_item %s 2110 10", "text": "add_item %s 2110 10"},
  {"name": "add_item %s 2120 10", "text": "add_item %s 2120 10"},
  {"name": "add_item %s 30004 30", "text": "add_item %s 30004 30"},
  {"name": "add_item %s 30005 30", "text": "add_item %s 30005 30"},
  {"name": "add_item %s 30006 30", "text": "add_item %s 30006 30"},
  {"name": "add_item %s 30007 30", "text": "add_item %s 30007 30"},
  {"name": "add_item %s 30008 30", "text": "add_item %s 30008 30"},
  {"name": "add_item %s 30009 30", "text": "add_item %s 30009 30"},
  {"name": "add_item %s 4 10", "text": "add_item %s 4 10"},
  {"name": "add_item %s 30010 50", "text": "add_item %s 30010 50"},
  {"name": "add_item %s 30100 50", "text": "add_item %s 30100 50"},
  {"name": "add_item %s 30111 50", "text": "add_item %s 30111 50"},
  {"name": "add_item %s 3002 100", "text": "add_item %s 3002 100"},
  {"name": "add_item %s 101 50", "text": "add_item %s 101 50"},
  {"name": "add_item %s 999 999", "text": "add_item %s 999 999"},
  {"name": "add_item %s 1050 100", "text": "add_item %s 1050 100"},
  {"name": "add_item %s 1051 100", "text": "add_item %s 1051 100"},
  {"name": "add_hero %s 20120", "text": "add_hero %s 20120"},
  {"name": "add_hero %s 20210", "text": "add_hero %s 20210"},
  {"name": "add_hero %s 20620", "text": "add_hero %s 20620"},
  {"name": "add_hero %s 20410", "text": "add_hero %s 20410"},
  {"name": "add_item %s 104000 100", "text": "add_item %s 104000 100"},
  {"name": "add_item %s 104001 100", "text": "add_item %s 104001 100"},
  {"name": "add_item %s 104002 100", "text": "add_item %s 104002 100"},
  {"name": "add_item %s 104003 100", "text": "add_item %s 104003 100"},
  {"name": "add_item %s 104004 100", "text": "add_item %s 104004 100"},
  {"name": "add_item %s 105001 100", "text": "add_item %s 105001 100"},
  {"name": "add_item %s 105002 100", "text": "add_item %s 105002 100"},
  {"name": "add_item %s 105003 100", "text": "add_item %s 105003 100"},
  {"name": "add_item %s 106001 100", "text": "add_item %s 106001 100"},
  {"name": "add_item %s 106002 100", "text": "add_item %s 106002 100"},
  {"name": "add_item %s 106003 100", "text": "add_item %s 106003 100"},
  {"name": "add_core_fashion %s 145001 1", "text": "add_core_fashion %s 145001 1"},
  {"name": "add_core_fashion %s 145002 1", "text": "add_core_fashion %s 145002 1"},
  {"name": "add_core_fashion %s 145003 1", "text": "add_core_fashion %s 145003 1"},
  {"name": "add_core_fashion %s 145004 1", "text": "add_core_fashion %s 145004 1"},
  {"name": "add_core_fashion %s 145005 1", "text": "add_core_fashion %s 145005 1"},
  {"name": "add_core_fashion %s 145006 1", "text": "add_core_fashion %s 145006 1"},
  {"name": "add_core_fashion %s 146001 1", "text": "add_core_fashion %s 146001 1"},
  {"name": "add_core_fashion %s 146002 1", "text": "add_core_fashion %s 146002 1"},
  {"name": "add_core_fashion %s 146003 1", "text": "add_core_fashion %s 146003 1"},
];

async function main() {
  let mysqlConn;
  let pgPool;

  try {
    // Step 1: Connect to MySQL and read data
    console.log('Connecting to MySQL...');
    mysqlConn = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
    });

    const [rows] = await mysqlConn.execute(
      "SELECT commands FROM userdata WHERE owner = 'public'"
    );

    if (rows.length === 0) {
      console.error('No rows found for owner=public in MySQL');
      process.exit(1);
    }

    let commandsJson = rows[0].commands;

    // Handle BLOB vs string
    if (Buffer.isBuffer(commandsJson)) {
      commandsJson = commandsJson.toString('utf8');
    }

    console.log('Raw commands JSON length:', commandsJson.length);

    // Step 2: Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(commandsJson);
    } catch (e) {
      console.error('Failed to parse commands JSON:', e.message);
      process.exit(1);
    }

    // Step 3: Find all category keys
    const allCategoryKeys = Object.keys(parsed).sort();
    console.log('\n=== ALL CATEGORY KEYS ===');
    allCategoryKeys.forEach(k => console.log(' ', k));

    // Find keys containing "道具" or "全部道具"
    const toolKeys = allCategoryKeys.filter(k =>
      k.includes('道具') || k.includes('全部道具')
    );
    console.log('\n=== KEYS CONTAINING "道具" ===');
    if (toolKeys.length === 0) {
      console.log('  (none found)');
    } else {
      toolKeys.forEach(k => console.log(' ', k));
    }

    // Target key to replace
    const TARGET_KEY = '通用-道具-全部道具gm';
    let replacedKey = null;

    if (allCategoryKeys.includes(TARGET_KEY)) {
      console.log(`\n=== FOUND TARGET KEY: "${TARGET_KEY}" ===`);
      const oldCmds = parsed[TARGET_KEY];
      console.log(`  Old commands count: ${oldCmds ? oldCmds.length : 0}`);
      if (oldCmds && oldCmds.length > 0) {
        console.log('  Old commands:');
        oldCmds.forEach(c => console.log(`    name="${c.name}" text="${c.text}"`));
      }
      replacedKey = TARGET_KEY;
    } else {
      console.log(`\n=== TARGET KEY "${TARGET_KEY}" NOT FOUND ===`);
      console.log('  Here are all keys to help identify the correct one:');
      allCategoryKeys.forEach(k => console.log(`    "${k}"`));
    }

    // Step 4: Replace the target category's command array
    if (replacedKey) {
      parsed[replacedKey] = NEW_COMMANDS;
      console.log(`\nReplaced category "${replacedKey}" with ${NEW_COMMANDS.length} commands.`);
    } else {
      console.log('\nNo replacement done (target key not found).');
    }

    // Step 5: Serialize updated JSON
    const updatedJson = JSON.stringify(parsed, null, 2);

    // Step 6: Update MySQL
    if (replacedKey) {
      console.log('\nUpdating MySQL...');
      await mysqlConn.execute(
        "UPDATE userdata SET commands = ? WHERE owner = 'public'",
        [updatedJson]
      );
      console.log('MySQL updated successfully.');
    }

    // Step 7: Update PostgreSQL
    if (replacedKey) {
      console.log('Connecting to PostgreSQL...');
      pgPool = new Pool({
        host: config.postgresql.host,
        port: config.postgresql.port,
        user: config.postgresql.user,
        password: config.postgresql.password,
        database: config.postgresql.database,
      });

      const pgResult = await pgPool.query(
        "SELECT commands FROM userdata WHERE owner = 'public'"
      );

      if (pgResult.rows.length > 0) {
        await pgPool.query(
          "UPDATE userdata SET commands = $1 WHERE owner = 'public'",
          [updatedJson]
        );
        console.log('PostgreSQL updated successfully.');
      } else {
        console.log('No rows found for owner=public in PostgreSQL. Skipping.');
      }
    }

    // Step 8: Write local file
    const localFilePath = path.join(
      path.dirname(__dirname),
      'commands.json'
    );
    fs.writeFileSync(localFilePath, updatedJson, 'utf8');
    console.log(`Local file written: ${localFilePath}`);

    // Step 9: Summary
    console.log('\n=== SUMMARY ===');
    console.log(`All category keys: ${allCategoryKeys.length}`);
    console.log(`Keys with "道具": ${toolKeys.length}`);
    console.log(`Replaced key: ${replacedKey || '(none)'}`);
    if (replacedKey) {
      console.log(`New command count: ${NEW_COMMANDS.length}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (mysqlConn) await mysqlConn.end();
    if (pgPool) await pgPool.end();
    console.log('\nDone.');
  }
}

main();
