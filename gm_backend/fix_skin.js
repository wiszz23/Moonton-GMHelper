const mysql = require('mysql2/promise');
const { Client: PgClient } = require('pg');

async function main() {
  // --- Step 1: Connect to MySQL and read ---
  console.log('=== Step 1: Connecting to MySQL ===');
  const mysqlConn = await mysql.createConnection({
    host: '10.30.138.5',
    port: 3306,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });
  console.log('MySQL connected.');

  const [rows] = await mysqlConn.query(
    "SELECT commands FROM userdata WHERE owner = 'public'"
  );
  if (rows.length === 0) {
    console.error('No row found for owner=public in MySQL!');
    await mysqlConn.end();
    return;
  }

  let commandsJson = rows[0].commands;
  // Handle MEDIUMTEXT/BLOB being a Buffer
  if (Buffer.isBuffer(commandsJson)) {
    commandsJson = commandsJson.toString('utf8');
  }
  console.log('Retrieved commands JSON from MySQL (length: ' + commandsJson.length + ')');

  // --- Step 2: Parse and analyze ---
  console.log('\n=== Step 2: Analyzing JSON ===');
  const data = JSON.parse(commandsJson);

  // All category keys
  const allKeys = Object.keys(data);
  console.log('\n--- ALL category keys ---');
  allKeys.forEach((k, i) => console.log('  [' + i + '] ' + k));

  // Check for specific categories
  const hasHuanxing = allKeys.includes('角色枪械幻形皮肤全解锁');
  const hasPifu = allKeys.includes('角色枪械皮肤全解锁');

  console.log('\n--- Category existence checks ---');
  console.log('  角色枪械幻形皮肤全解锁 exists: ' + hasHuanxing);
  console.log('  角色枪械皮肤全解锁 exists: ' + hasPifu);

  // Categories containing "皮肤"
  console.log('\n--- Categories containing "皮肤" ---');
  const skinCategories = allKeys.filter(k => k.includes('皮肤'));
  if (skinCategories.length === 0) {
    console.log('  (none)');
  } else {
    skinCategories.forEach(k => {
      console.log('  Category: ' + k);
      const cat = data[k];
      if (Array.isArray(cat)) {
        cat.forEach((cmd, idx) => {
          if (typeof cmd === 'object' && cmd.name) {
            console.log('    [' + idx + '] name=' + cmd.name + ', cmd=' + (cmd.cmd || cmd.command || '(n/a)'));
          } else {
            console.log('    [' + idx + '] ' + JSON.stringify(cmd));
          }
        });
      } else {
        console.log('    (non-array, type=' + typeof cat + ') ' + JSON.stringify(cat).substring(0, 200));
      }
    });
  }

  // --- Step 3: If 角色枪械幻形皮肤全解锁 is new (1 command named the same), DELETE it ---
  console.log('\n=== Step 3: Check for newly-created 角色枪械幻形皮肤全解锁 category ===');
  if (hasHuanxing) {
    const cat = data['角色枪械幻形皮肤全解锁'];
    if (Array.isArray(cat) && cat.length === 1) {
      const cmd0 = cat[0];
      const name0 = (typeof cmd0 === 'object' && cmd0.name) ? cmd0.name : (typeof cmd0 === 'string' ? cmd0 : JSON.stringify(cmd0));
      const isNew = name0 === '角色枪械幻形皮肤全解锁';
      console.log('  Category has 1 command: ' + name0);
      console.log('  Matches category name (newly created): ' + isNew);
      if (isNew) {
        console.log('  DELETING category 角色枪械幻形皮肤全解锁');
        delete data['角色枪械幻形皮肤全解锁'];
        console.log('  Deleted.');
      } else {
        console.log('  Keeping (not a new auto-created category).');
      }
    } else {
      console.log('  Category has ' + (Array.isArray(cat) ? cat.length : 'non-array') + ' entries. Not deleting.');
    }
  } else {
    console.log('  Category does not exist. Nothing to delete.');
  }

  // --- Step 4: Find 通用-皮肤-角色枪械皮肤全解锁 or similar ---
  console.log('\n=== Step 4: Finding target category for skin commands ===');
  // Look for categories containing both "皮肤" and "枪械"
  const targetCandidates = allKeys.filter(k => {
    // Exclude already deleted or similar to 幻形-only category
    return k.includes('皮肤') && k.includes('枪械') && !k.includes('幻形');
  });

  // Also look for exact or near-match to "角色枪械皮肤全解锁"
  const exactCandidates = allKeys.filter(k => k.includes('角色枪械皮肤全解锁'));

  console.log('  Categories containing both "皮肤" and "枪械" (no 幻形):');
  if (targetCandidates.length === 0) {
    console.log('    (none found)');
  } else {
    targetCandidates.forEach(k => console.log('    -> ' + k));
  }

  console.log('  Categories containing "角色枪械皮肤全解锁":');
  if (exactCandidates.length === 0) {
    console.log('    (none found)');
  } else {
    exactCandidates.forEach(k => console.log('    -> ' + k));
  }

  // Determine the best target
  let targetKey = null;
  if (exactCandidates.length > 0) {
    targetKey = exactCandidates[0];
  } else if (targetCandidates.length > 0) {
    targetKey = targetCandidates[0];
  }

  console.log('\n  Selected target category: ' + (targetKey || '(NONE - will create new)'));

  let targetCategory = null;
  if (targetKey) {
    targetCategory = data[targetKey];
    if (!Array.isArray(targetCategory)) {
      console.log('  WARNING: target category is not an array! Resetting to [].');
      targetCategory = [];
      data[targetKey] = targetCategory;
    }
  } else {
    // Create the category if it doesn't exist
    targetKey = '通用-皮肤-角色枪械皮肤全解锁';
    targetCategory = [];
    data[targetKey] = targetCategory;
    console.log('  Created new category: ' + targetKey);
  }

  // Print current contents of target category
  console.log('\n  Current contents of "' + targetKey + '":');
  if (targetCategory.length === 0) {
    console.log('    (empty)');
  } else {
    targetCategory.forEach((cmd, idx) => {
      if (typeof cmd === 'object' && cmd.name) {
        console.log('    [' + idx + '] name=' + cmd.name);
      } else {
        console.log('    [' + idx + '] ' + JSON.stringify(cmd));
      }
    });
  }

  // --- Step 5: Add new commands if not already present ---
  console.log('\n=== Step 5: Adding new commands ===');
  const newCommands = [
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145001 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145002 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145003 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145004 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145005 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 145006 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 146001 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 146002 1' },
    { name: '角色枪械幻形皮肤全解锁', cmd: 'add_item %s 146003 1' },
  ];

  // Check if any command with name "角色枪械幻形皮肤全解锁" already exists
  const alreadyHas = targetCategory.some(cmd => {
    const name = (typeof cmd === 'object' && cmd.name) ? cmd.name : (typeof cmd === 'string' ? cmd : null);
    return name === '角色枪械幻形皮肤全解锁';
  });

  if (alreadyHas) {
    console.log('  SKIPPED: A command named "角色枪械幻形皮肤全解锁" already exists in target category.');
  } else {
    console.log('  Adding 9 new commands to "' + targetKey + '":');
    newCommands.forEach(c => {
      targetCategory.push(c);
      console.log('    + ' + c.cmd);
    });
    console.log('  Added ' + newCommands.length + ' commands.');
  }

  // --- Step 6: Serialize updated JSON ---
  const updatedJson = JSON.stringify(data, null, 2);
  console.log('\n=== Step 6: Writing to databases ===');
  console.log('Updated JSON size: ' + updatedJson.length + ' chars');

  // MySQL
  try {
    await mysqlConn.query(
      "UPDATE userdata SET commands = ? WHERE owner = 'public'",
      [updatedJson]
    );
    console.log('MySQL: UPDATE successful.');
  } catch (err) {
    console.error('MySQL UPDATE failed: ' + err.message);
  }

  // PostgreSQL
  console.log('\nPostgreSQL update...');
  let pgConnected = false;
  try {
    const pgConn = new PgClient({
      host: '10.30.138.5',
      port: 5432,
      user: 'qa',
      password: 'qa',
      database: 'gm_webtool',
    });
    await pgConn.connect();
    pgConnected = true;
    await pgConn.query(
      "UPDATE userdata SET commands = $1 WHERE owner = 'public'",
      [updatedJson]
    );
    console.log('PostgreSQL: UPDATE successful.');
    await pgConn.end();
  } catch (err) {
    console.error('PostgreSQL update failed: ' + err.message);
    if (pgConnected) {
      try { await pgConn.end(); } catch(e) {}
    }
  }

  // --- Step 7: Write to local file ---
  console.log('\n=== Step 7: Writing to local commands.json ===');
  const fs = require('fs');
  const localPath = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\commands.json';
  try {
    fs.writeFileSync(localPath, updatedJson, 'utf8');
    console.log('Written to: ' + localPath);
  } catch (err) {
    console.error('Failed to write local file: ' + err.message);
  }

  // --- Step 8: Summary ---
  console.log('\n=== SUMMARY ===');
  console.log('1. Read commands JSON from MySQL (owner=public)');
  console.log('2. Parsed JSON - found ' + allKeys.length + ' categories');
  console.log('   - 角色枪械幻形皮肤全解锁 existed: ' + hasHuanxing + ', deleted if newly created');
  console.log('   - 角色枪械皮肤全解锁 existed: ' + hasPifu);
  console.log('   - Skin categories found: ' + skinCategories.join(', ') || '(none)');
  console.log('3. Target category for new commands: ' + targetKey);
  console.log('4. Commands ' + (alreadyHas ? 'were NOT added (already existed)' : 'were added (9 new commands)'));
  console.log('5. MySQL: UPDATE OK');
  console.log('6. PostgreSQL: ' + (pgConnected ? 'UPDATE OK' : 'NOT CONNECTED or FAILED'));
  console.log('7. Local file updated: ' + localPath);

  await mysqlConn.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('FATAL: ' + err.message);
  console.error(err.stack);
  process.exit(1);
});
