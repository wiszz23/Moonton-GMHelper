const fs = require('fs');
const path = require('path');

// ---- Load db.js (shares MySQL + PostgreSQL pools) ----
const db = require('./db.js');

const COMMANDS_FILE = 'D:\\AOZ\\trunk\\Assets\\Document\\GMHelper\\commands.json';

const newText = `add_weapon %s 135000 1
add_weapon %s 135001 1
add_weapon %s 135002 1
add_weapon %s 135003 1
add_weapon %s 135004 1
add_weapon %s 135005 1
add_weapon %s 135006 1
add_weapon %s 136001 1
add_weapon %s 136002 1
add_weapon %s 136003 1
add_item %s 2010 10
add_item %s 2020 10
add_item %s 2030 10
add_item %s 2040 10
add_item %s 2050 10
add_item %s 2060 10
add_item %s 2070 10
add_item %s 2080 10
add_item %s 2090 10
add_item %s 2100 10
add_item %s 2110 10
add_item %s 2120 10
add_item %s 30004 30
add_item %s 30005 30
add_item %s 30006 30
add_item %s 30007 30
add_item %s 30008 30
add_item %s 30009 30
add_item %s 4 10
add_item %s 30010 50
add_item %s 30100 50
add_item %s 30111 50
add_item %s 3002 100
add_item %s 101 50
add_item %s 999 999
add_item %s 1050 100
add_item %s 1051 100
add_hero %s 20120
add_hero %s 20210
add_hero %s 20620
add_hero %s 20410
add_item %s 104000 100
add_item %s 104001 100
add_item %s 104002 100
add_item %s 104003 100
add_item %s 104004 100
add_item %s 105001 100
add_item %s 105002 100
add_item %s 105003 100
add_item %s 106001 100
add_item %s 106002 100
add_item %s 106003 100
add_core_fashion %s 145001 1
add_core_fashion %s 145002 1
add_core_fashion %s 145003 1
add_core_fashion %s 145004 1
add_core_fashion %s 145005 1
add_core_fashion %s 145006 1
add_core_fashion %s 146001 1
add_core_fashion %s 146002 1
add_core_fashion %s 146003 1`;

async function main() {
  // 1. Read commands.json
  const raw = fs.readFileSync(COMMANDS_FILE, 'utf8');
  const json = JSON.parse(raw);

  // 2. Find 道具 category, find "全部道具", replace text
  let found = false;
  let oldText = '';
  const daoJu = json['道具'];
  if (daoJu && Array.isArray(daoJu)) {
    for (const cmd of daoJu) {
      if (cmd.name === '全部道具') {
        oldText = cmd.text;
        cmd.text = newText;
        found = true;
        break;
      }
    }
  }

  if (!found) {
    console.error('ERROR: "全部道具" not found in 道具 category');
    process.exit(1);
  }

  // 3. Print confirmation
  console.log('Found "全部道具"');
  console.log('Old text length:', oldText.length);
  console.log('New text length:', newText.length, '(expected ~1700)');

  const updatedJson = JSON.stringify(json, null, 2);

  // 4. Write to MySQL and PostgreSQL
  // MySQL  UPDATE userdata SET commands = ?  WHERE owner = 'public'
  // PostgreSQL UPDATE userdata SET commands = $1 WHERE owner = 'public'
  let mysqlOk = false;
  let pgOk = false;

  try {
    const mysqlResult = await db.query(
      'UPDATE userdata SET commands = ? WHERE owner = ?',
      [updatedJson, 'public']
    );
    mysqlOk = true;
    console.log('MySQL update: SUCCESS');
  } catch (e) {
    console.log('MySQL update: FAILED —', e.message);
  }

  try {
    const pgResult = await db.query(
      'UPDATE userdata SET commands = $1 WHERE owner = $2',
      [updatedJson, 'public']
    );
    pgOk = true;
    console.log('PostgreSQL update: SUCCESS');
  } catch (e) {
    console.log('PostgreSQL update: FAILED —', e.message);
  }

  // 5. Write back to commands.json
  fs.writeFileSync(COMMANDS_FILE, updatedJson, 'utf8');
  console.log('commands.json written successfully');

  // 6. Summary
  console.log('\n--- Summary ---');
  console.log('MySQL:    ', mysqlOk ? 'OK' : 'FAILED');
  console.log('PostgreSQL:', pgOk ? 'OK' : 'FAILED');
}

main().catch(e => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
