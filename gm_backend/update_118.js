const mysql = require('mysql2/promise');

const newCommandsJSON = `[{"name":"添加资源测试","text":"add_item %s 4 100\nadd_item %s 1 1000\nadd_item %s 2 10000 #代金券\nadd_item %s 99 100000\nadd_item %s 100 10000\nadd_item %s 101 10000\nadd_item %s 999 1000000","category":"道具"},{"name":"一键切服","text":"see_account %s\nunbind_account msdk %s\nchange_zone %s","category":"玩家"},{"name":"添加全部植物碎片","text":"add_item %s 2010 1000000\nadd_item %s 2020 1000000\nadd_item %s 2030 1000000\nadd_item %s 2040 1000000\nadd_item %s 2050 1000000\nadd_item %s 2060 1000000\nadd_item %s 2070 1000000\nadd_item %s 2080 1000000\nadd_item %s 2090 1000000","category":"道具"},{"name":"通关至第六关","text":"pass_to_stage %s 1 1101060","category":"道具"},{"name":"添加体力","text":"add_item %s 4 10000","category":"玩家"},{"name":"添加经验","text":"add_item %s 1 10000","category":"玩家"},{"name":"添加冰刺","text":"add_hero %s 20310","category":"道具"},{"name":"清除所有英雄","text":"clear_hero %s","category":"道具"},{"name":"添加其他植物","text":"add_hero %s 20010 #向日葵\nadd_hero %s 20120 #毛栗子\nadd_hero %s 20210 #玉米\nadd_hero %s 20620 #三叶草\nadd_hero %s 20410 #太阳","category":"核心"},{"name":"添加冰刺宝石","text":"add_item %s 4216424 1 #灼烧交互\nadd_item %s 4216394 1 #柠檬用发冰刺\nadd_item %s 4216410 1 #发射个数\nadd_item %s 4216411 1 #霜莲用\nadd_item %s 4216418 1 #加伤加减速\nadd_item %s 4216442 1 #重伤\nadd_item %s 4216450 1 #冻结爆炸\nadd_item %s 4216458 1 #加穿透","category":"宝石"},{"name":"添加皮肤","text":"add_item % 135000 1\t\nadd_item % 135001 1\t\nadd_item % 135002 1\t\nadd_item % 135003 1\t\nadd_item % 135004 1\t\nadd_item % 135005 1\t\nadd_item % 135006 1\t\nadd_item % 136001 1\t\nadd_item % 136002 1\t\nadd_item % 136003 1","category":"宝石"},{"name":"通关所有关卡","text":"pass_all_stage_main %s","category":"主线关"},{"name":"清除关卡进度","text":"clear_all_stage\t%s","category":"主线关"},{"name":"装备图纸","text":"add_item %s 3011 100000\nadd_item %s 3012 100000\nadd_item %s 3013 100000\nadd_item %s 3014 100000\nadd_item %s 3015 100000\nadd_item %s 3016 100000","category":"装备"},{"name":"无敌宝箱","text":"add_item %s 30001 1000","category":"道具"},{"name":"佣兵碎片","text":"add_item % 5001 100\nadd_item % 5002 100\nadd_item % 5003 100","category":"道具"},{"name":"攻击力宝石","text":"add_item %s 4211007 1\nadd_item %s 4212007 1\nadd_item %s 4213007 1\nadd_item %s 4214007 1\nadd_item %s 4215007 1\nadd_item %s 4216007 1","category":"宝石"},{"name":"添加枪械","text":"add_item % 104000 1\t\nadd_item % 104001 1\t\nadd_item % 104002 1\t\nadd_item % 104003 1\t\nadd_item % 104004 1\t\nadd_item % 105001 1\t\nadd_item % 105002 1\t\nadd_item % 105003 1\t\nadd_item % 106001 1\t\nadd_item % 106002 1\t\nadd_item % 106003 1","category":"道具"},{"name":"防线升级","text":"add_item %s 4000 1000\nadd_item %s 4001 1000\nadd_item %s 4002 1000","category":"道具"},{"name":"一键成长","text":"add_weapon  %s 135000 1\nadd_weapon  %s 135001 1\nadd_weapon  %s 135002 1\nadd_weapon  %s 135003 1\nadd_weapon  %s 135004 1\nadd_weapon  %s 135005 1\nadd_weapon  %s 135006 1\nadd_weapon  %s 136001 1\nadd_weapon  %s 136002 1\nadd_weapon  %s 136003 1\nadd_item %s 2010 10\nadd_item %s 2020 10\nadd_item %s 2030 10\nadd_item %s 2040 10\nadd_item %s 2050 10\nadd_item %s 2060 10\nadd_item %s 2070 10\nadd_item %s 2080 10\nadd_item %s 2090 10\nadd_item %s 2100 10\nadd_item %s 2110 10\nadd_item %s 2120 10\nadd_item %s 30004 30\nadd_item %s 30005 30\nadd_item %s 30006 30\nadd_item %s 30007 30\nadd_item %s 30008 30\nadd_item %s 30009 30\nadd_item %s 4 10\nadd_item %s 30010 50\nadd_item %s 30100 50\nadd_item %s 30111 50\nadd_item %s 3002 100\nadd_item %s 101 50\nadd_item %s 999 999\nadd_item %s 1050 100\nadd_item %s 1051 100\nadd_hero %s 20120\nadd_hero  %s 20210\nadd_hero %s 20620\nadd_hero  %s 20410\nadd_item %s 104000 100\nadd_item %s 104001 100\nadd_item %s 104002 100\nadd_item %s 104003 100\nadd_item %s 104004 100\nadd_item %s 105001 100\nadd_item %s 105002 100\nadd_item %s 105003 100\nadd_item %s 106001 100\nadd_item %s 106002 100\nadd_item %s 106003 100","category":"道具"},{"name":"寰球救援","text":"see_duo_level\t%s\nreset_duo_ticket %s\nadd_item %s 4006 3","category":"道具"},{"name":"换时间","text":"set_server_time","category":"道具"}]`;

async function main() {
  const pool = mysql.createPool({
    host: '10.30.138.5',
    port: 3306,
    user: 'qa',
    password: 'qa',
    database: 'gm_webtool',
    waitForConnections: true,
    connectionLimit: 1,
  });

  try {
    // Step 2: Verify row exists
    const [rows] = await pool.query('SELECT id, owner FROM userdata WHERE id = 118');
    console.log('SELECT result:', JSON.stringify(rows));

    // Step 4: Update commands
    const [updateResult] = await pool.query(
      'UPDATE userdata SET commands = ? WHERE id = 118',
      [newCommandsJSON]
    );
    console.log('UPDATE affected rows:', updateResult.affectedRows);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
