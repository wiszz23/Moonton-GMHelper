const mysql = require('mysql2/promise');
const { Client } = require('pg');

const data = {
  "categories": ["道具", "玩家", "核心", "宝石", "主线关", "装备"],
  "commands": [
    {"name": "添加资源测试", "text": "add_item %s 4 100\nadd_item %s 1 1000\nadd_item %s 2 10000 #代金券\nadd_item %s 99 100000\nadd_item %s 100 10000\nadd_item %s 101 10000\nadd_item %s 999 1000000", "category": "道具"},
    {"name": "一键切服", "text": "see_account %s\nunbind_account msdk %s\nchange_zone %s", "category": "玩家"},
    {"name": "添加全部植物碎片", "text": "add_item %s 2010 1000000\nadd_item %s 2020 1000000\nadd_item %s 2030 1000000\nadd_item %s 2040 1000000\nadd_item %s 2050 1000000\nadd_item %s 2060 1000000\nadd_item %s 2070 1000000\nadd_item %s 2080 1000000\nadd_item %s 2090 1000000", "category": "道具"},
    {"name": "通关至第六关", "text": "pass_to_stage %s 1 1101060", "category": "道具"},
    {"name": "添加体力", "text": "add_item %s 4 10000", "category": "玩家"},
    {"name": "添加经验", "text": "add_item %s 1 10000", "category": "玩家"},
    {"name": "添加冰刺", "text": "add_hero %s 20310", "category": "道具"},
    {"name": "清除所有英雄", "text": "clear_hero %s", "category": "道具"},
    {"name": "添加其他植物", "text": "add_hero %s 20010 #向日葵\nadd_hero %s 20120 #毛栗子\nadd_hero %s 20210 #玉米\nadd_hero %s 20620 #三叶草\nadd_hero %s 20410 #太阳", "category": "核心"},
    {"name": "添加冰刺宝石", "text": "add_item %s 4216424 1 #灼烧交互\nadd_item %s 4216394 1 #柠檬用发冰刺\nadd_item %s 4216410 1 #发射个数\nadd_item %s 4216411 1 #霜莲用\nadd_item %s 4216418 1 #加伤加减速\nadd_item %s 4216442 1 #重伤\nadd_item %s 4216450 1 #冻结爆炸\nadd_item %s 4216458 1 #加穿透", "category": "宝石"},
    {"name": "添加皮肤", "text": "add_item %s 135000 1\nadd_item %s 135001 1\nadd_item %s 135002 1\nadd_item %s 135003 1\nadd_item %s 135004 1\nadd_item %s 135005 1\nadd_item %s 135006 1\nadd_item %s 136001 1\nadd_item %s 136002 1\nadd_item %s 136003 1", "category": "宝石"},
    {"name": "通关所有关卡", "text": "pass_all_stage_main %s", "category": "主线关"},
    {"name": "清除关卡进度", "text": "clear_all_stage %s", "category": "主线关"},
    {"name": "装备图纸", "text": "add_item %s 3011 100000\nadd_item %s 3012 100000\nadd_item %s 3013 100000\nadd_item %s 3014 100000\nadd_item %s 3015 100000\nadd_item %s 3016 100000", "category": "装备"},
    {"name": "无敌宝箱", "text": "add_item %s 30001 1000", "category": "道具"},
    {"name": "佣兵碎片", "text": "add_item %s 5001 100\nadd_item %s 5002 100\nadd_item %s 5003 100", "category": "道具"},
    {"name": "攻击力宝石", "text": "add_item %s 4211007 1\nadd_item %s 4212007 1\nadd_item %s 4213007 1\nadd_item %s 4214007 1\nadd_item %s 4215007 1\nadd_item %s 4216007 1", "category": "宝石"},
    {"name": "添加枪械", "text": "add_item %s 104000 1\nadd_item %s 104001 1\nadd_item %s 104002 1\nadd_item %s 104003 1\nadd_item %s 104004 1\nadd_item %s 105001 1\nadd_item %s 105002 1\nadd_item %s 105003 1\nadd_item %s 106001 1\nadd_item %s 106002 1\nadd_item %s 106003 1", "category": "道具"},
    {"name": "防线升级", "text": "add_item %s 4000 1000\nadd_item %s 4001 1000\nadd_item %s 4002 1000", "category": "道具"},
    {"name": "一键成长", "text": "add_weapon %s 135000 1\nadd_weapon %s 135001 1\nadd_weapon %s 135002 1\nadd_weapon %s 135003 1\nadd_weapon %s 135004 1\nadd_weapon %s 135005 1\nadd_weapon %s 135006 1\nadd_weapon %s 136001 1\nadd_weapon %s 136002 1\nadd_weapon %s 136003 1\nadd_item %s 2010 10\nadd_item %s 2020 10\nadd_item %s 2030 10\nadd_item %s 2040 10\nadd_item %s 2050 10\nadd_item %s 2060 10\nadd_item %s 2070 10\nadd_item %s 2080 10\nadd_item %s 2090 10\nadd_item %s 2100 10\nadd_item %s 2110 10\nadd_item %s 2120 10\nadd_item %s 30004 30\nadd_item %s 30005 30\nadd_item %s 30006 30\nadd_item %s 30007 30\nadd_item %s 30008 30\nadd_item %s 30009 30\nadd_item %s 4 10\nadd_item %s 30010 50\nadd_item %s 30100 50\nadd_item %s 30111 50\nadd_item %s 3002 100\nadd_item %s 101 50\nadd_item %s 999 999\nadd_item %s 1050 100\nadd_item %s 1051 100\nadd_hero %s 20120\nadd_hero %s 20210\nadd_hero %s 20620\nadd_hero %s 20410\nadd_item %s 104000 100\nadd_item %s 104001 100\nadd_item %s 104002 100\nadd_item %s 104003 100\nadd_item %s 104004 100\nadd_item %s 105001 100\nadd_item %s 105002 100\nadd_item %s 105003 100\nadd_item %s 106001 100\nadd_item %s 106002 100\nadd_item %s 106003 100", "category": "道具"},
    {"name": "寰球救援", "text": "see_duo_level %s\nreset_duo_ticket %s\nadd_item %s 4006 3", "category": "道具"},
    {"name": "换时间", "text": "set_server_time", "category": "道具"}
  ]
};

const commandsJson = JSON.stringify(data);

async function main() {
  console.log('=== Starting GM commands update for 王俊琦(Junqi) ===\n');

  // --- MySQL ---
  console.log('[MySQL] Connecting to 10.30.138.5:3306...');
  const mysqlConn = await mysql.createConnection({
    host: '10.30.138.5',
    port: 3306,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });

  console.log('[MySQL] Updating userdata SET commands...');
  await mysqlConn.execute(
    "UPDATE userdata SET commands = ? WHERE owner = '王俊琦(Junqi)'",
    [commandsJson]
  );

  console.log('[MySQL] Verifying update...');
  const [mysqlRows] = await mysqlConn.execute(
    "SELECT commands FROM userdata WHERE owner = '王俊琦(Junqi)'"
  );
  if (mysqlRows.length > 0) {
    const mysqlCmds = mysqlRows[0].commands;
    console.log(`[MySQL] commands length: ${mysqlCmds ? mysqlCmds.length : 0}`);
    console.log(`[MySQL] commands first 100 chars: ${(mysqlCmds || '').substring(0, 100)}`);
  } else {
    console.log('[MySQL] WARNING: No rows found for owner 王俊琦(Junqi)');
  }

  await mysqlConn.end();
  console.log('[MySQL] Done.\n');

  // --- PostgreSQL ---
  console.log('[PostgreSQL] Connecting to 10.30.138.5:5432...');
  const pgConn = new Client({
    host: '10.30.138.5',
    port: 5432,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
  });
  await pgConn.connect();

  console.log('[PostgreSQL] Updating userdata SET commands...');
  await pgConn.query(
    "UPDATE userdata SET commands = $1 WHERE owner = '王俊琦(Junqi)'",
    [commandsJson]
  );

  console.log('[PostgreSQL] Verifying update...');
  const pgRes = await pgConn.query(
    "SELECT commands FROM userdata WHERE owner = '王俊琦(Junqi)'"
  );
  if (pgRes.rows.length > 0) {
    const pgCmds = pgRes.rows[0].commands;
    console.log(`[PostgreSQL] commands length: ${pgCmds ? pgCmds.length : 0}`);
    console.log(`[PostgreSQL] commands first 100 chars: ${(pgCmds || '').substring(0, 100)}`);
  } else {
    console.log('[PostgreSQL] WARNING: No rows found for owner 王俊琦(Junqi)');
  }

  await pgConn.end();
  console.log('[PostgreSQL] Done.\n');

  console.log('=== Summary ===');
  console.log(`Commands JSON length: ${commandsJson.length} chars`);
  console.log(`Categories: ${data.categories.join(', ')}`);
  console.log(`Total commands: ${data.commands.length}`);
  console.log('Both MySQL and PostgreSQL updated successfully.');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
