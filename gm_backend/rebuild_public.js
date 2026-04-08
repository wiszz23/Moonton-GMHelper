const http = require('http');

const payload = JSON.stringify({
  commands: JSON.stringify({
    '装备': [
      {name:'全身装备',text:'add_gear %s 611210 1\nadd_gear %s 612310 1\nadd_gear %s 613410 1\nadd_gear %s 614510 1\nadd_gear %s 615610 1\nadd_gear %s 616405 1'},
      {name:'全防装备',text:'add_gear %s 511210 1\nadd_gear %s 512310 1\nadd_gear %s 513410 1\nadd_gear %s 514510 1\nadd_gear %s 515610 1\nadd_gear %s 516405 1'}
    ],
    '道具': [
      {name:'全部道具',text:'add_item %s 3001 10000\nadd_item %s 3011 10000\nadd_item %s 3012 10000\nadd_item %s 3013 10000\nadd_item %s 3014 10000\nadd_item %s 3015 10000\nadd_item %s 3016 10000\nadd_item %s 999 10000\nadd_item %s 1 10000'},
      {name:'石头礼包',text:'add_item %s 30001 10\nadd_item %s 30003 1\nadd_item %s 30004 1\nadd_item %s 30005 1\nadd_item %s 30006 1\nadd_item %s 30007 1\nadd_item %s 30008 1\nadd_item %s 30009 1'},
      {name:'钻石+99999',text:'add_item %s 90001 99999'},
      {name:'金币+999999',text:'add_item %s 90002 999999'},
      {name:'石油+999',text:'add_item %s 90003 999'},
      {name:'石油+999',text:'add_item %s 90004 999'},
      {name:'食物+99999',text:'add_item %s 90005 99999'},
      {name:'木材+9999',text:'add_item %s 90006 9999'},
      {name:'石头+9999',text:'add_item %s 90007 9999'},
      {name:'建筑工人+9999',text:'add_item %s 90008 9999'},
      {name:'地雷阵+9999',text:'add_item %s 90009 9999'},
      {name:'rogue币+9999',text:'add_item %s 90010 9999'},
      {name:'经验药水+99',text:'add_item %s 90011 99'},
      {name:'植物药水+99',text:'add_item %s 90012 99'},
      {name:'联盟药水+99',text:'add_item %s 90013 99'},
      {name:'复活币+99',text:'add_item %s 90014 99'},
      {name:'神话复活币+99',text:'add_item %s 90015 99'},
      {name:'全资源+999',text:'add_item %s 1 999\nadd_item %s 2 999\nadd_item %s 3 999\nadd_item %s 4 999\nadd_item %s 5 999'},
      {name:'全资源+9999',text:'add_item %s 1 9999\nadd_item %s 2 9999\nadd_item %s 3 9999\nadd_item %s 4 9999\nadd_item %s 5 9999'},
      {name:'清空背包',text:'clear_bag %s'},
      {name:'增加体力',text:'add_item %s 4 100'},
      {name:'添加资源',text:'add_item %s 4 100\nadd_item %s 1 1000\nadd_item %s 99 100000\nadd_item %s 100 10000\nadd_item %s 101 10000\nadd_item %s 999 1000000'},
      {name:'增加经验',text:'add_item %s 1 10000'},
      {name:'添加月之湍流',text:'add_item %s 2 10000'},
      {name:'添加指定道具',text:'add_item %s '}
    ],
    '天赋': [
      {name:'天赋点+100',text:'add_talent_point %s 100'},
      {name:'天赋全满',text:'max_talent %s'},
      {name:'天赋重置',text:'reset_talent %s'}
    ],
    '核心': [
      {name:'核心经验+99999',text:'add_core_exp %s 99999'},
      {name:'核心等级+10',text:'add_core_level %s 10'},
      {name:'核心全满',text:'max_core %s'},
      {name:'核心重置',text:'reset_core %s'},
      {name:'指定核心等级',text:'add_core_level %s '}
    ],
    '宝石': [
      {name:'宝石+99',text:'add_gem %s 99'},
      {name:'宝石+999',text:'add_gem %s 999'},
      {name:'宝石全满',text:'max_gem %s'},
      {name:'宝石解锁',text:'unlock_gem_slot %s'},
      {name:'冰刺宝石+9999',text:'add_item %s 90016 9999'}
    ],
    '皮肤': [
      {name:'角色枪械皮肤全解锁',text:'add_item %s 135000 1\nadd_item %s 135001 1\nadd_item %s 135002 1\nadd_item %s 135003 1\nadd_item %s 135004 1\nadd_item %s 135005 1\nadd_item %s 135006 1\nadd_item %s 136001 1\nadd_item %s 136002 1\nadd_item %s 136003 1\nadd_item %s 104000 1\nadd_item %s 104001 1\nadd_item %s 104002 1\nadd_item %s 104003 1\nadd_item %s 104004 1\nadd_item %s 105001 1\nadd_item %s 105002 1\nadd_item %s 105003 1\nadd_item %s 106001 1\nadd_item %s 106002 1\nadd_item %s 106003 1'},
      {name:'角色皮肤全解锁',text:'add_item %s 135000 1\nadd_item %s 135001 1\nadd_item %s 135002 1\nadd_item %s 135003 1\nadd_item %s 135004 1\nadd_item %s 135005 1\nadd_item %s 135006 1\nadd_item %s 136001 1\nadd_item %s 136002 1\nadd_item %s 136003 1'},
      {name:'枪械皮肤全解锁',text:'add_item %s 104000 1\nadd_item %s 104001 1\nadd_item %s 104002 1\nadd_item %s 104003 1\nadd_item %s 104004 1\nadd_item %s 105001 1\nadd_item %s 105002 1\nadd_item %s 105003 1\nadd_item %s 106001 1\nadd_item %s 106002 1\nadd_item %s 106003 1'}
    ],
    '枪械': [
      {name:'子弹+999',text:'add_weapon %s 999'},
      {name:'满改枪械',text:'max_weapon %s'},
      {name:'弹药+999',text:'add_ammo %s 999'},
      {name:'枪械重置',text:'reset_weapon %s'}
    ],
    '城墙': [
      {name:'城墙满血',text:'repair_wall %s'},
      {name:'城墙血量+10000',text:'add_wall_hp %s 10000'},
      {name:'城墙等级+10',text:'add_wall_level %s 10'},
      {name:'城墙满级',text:'max_wall %s'},
      {name:'地雷+99',text:'add_trap %s 99'},
      {name:'弓箭+99',text:'add_archer %s 99'},
      {name:'投石机+99',text:'add_cannon %s 99'},
      {name:'城墙重置',text:'reset_wall %s'}
    ],
    '战斗': [
      {name:'加血10%',text:'add_hp %s 10'},
      {name:'减血10%',text:'del_hp %s 10'},
      {name:'直接死亡',text:'kill %s'},
      {name:'开启AI',text:'ai_on %s'},
      {name:'关闭AI',text:'ai_off %s'},
      {name:'升一级',text:'level_up %s 1'},
      {name:'一级满级',text:'level_up %s 999'},
      {name:'添加Buff',text:'add_buff %s '},
      {name:'移除Buff',text:'remove_buff %s '},
      {name:'添加怪物',text:'add_monster %s '},
      {name:'清除全部',text:'clear_monster %s'}
    ],
    '账号': [
      {name:'测试昵称',text:'set_name %s TestPlayer'},
      {name:'设置等级',text:'set_level %s 999'},
      {name:'设置VIP等级',text:'set_vip %s 15'},
      {name:'解锁全成就',text:'unlock_all %s'},
      {name:'重置账号',text:'reset_account %s'},
      {name:'切服',text:'change_zone %s'},
      {name:'查MSDK',text:'see_account %s'},
      {name:'解绑',text:'unbind_account msdk %s'},
      {name:'一键切服',text:'switch_server %s 1\nswitch_server %s 2\nswitch_server %s 3\nswitch_server %s 4\nswitch_server %s 5'},
      {name:'设置时间',text:'set_server_time %s'},
      {name:'删除装备',text:'clear_gear %s'},
      {name:'删除宝石',text:'clear_armband %s'},
      {name:'删除材料',text:'clear_item %s'}
    ],
    '邮件': [
      {name:'发送系统邮件',text:'send_mail %s TestMail 测试内容'}
    ],
    '关卡': [
      {name:'通关至第六关',text:'complete_level %s 6'},
      {name:'通关所有主线',text:'max_level %s'},
      {name:'清除主线所有进度',text:'reset_level %s'}
    ],
    '植物': [
      {name:'植物+9999',text:'add_plant %s 9999'},
      {name:'植物+99',text:'add_plant %s 99'},
      {name:'植物全满',text:'max_plant %s'},
      {name:'植物重置',text:'reset_plant %s'},
      {name:'植物经验+9999',text:'add_plant_exp %s 9999'},
      {name:'植物等级+10',text:'add_plant_level %s 10'},
      {name:'植物升级',text:'level_up_plant %s '},
      {name:'解锁植物',text:'unlock_plant %s '},
      {name:'添加植物碎片',text:'add_plant_piece %s '},
      {name:'添加冰刺种子',text:'add_seed %s 冰刺 99'}
    ]
  })
});

const req = http.request({
  hostname: '10.30.138.5',
  port: 3000,
  path: '/api/commands/public',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('状态:', res.statusCode);
    console.log('响应:', data);
  });
});
req.on('error', e => console.error('错误:', e.message));
req.write(payload);
req.end();
