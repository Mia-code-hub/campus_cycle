import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import {
  getCategoryDistribution,
  getCollegeBenefit,
  getModeByCategory,
  getModeSplit,
  getMonthlyTrend,
  getOverview,
  getPlatformStats,
  statsCaliber,
} from '../src/server/stats.ts';
import { METRIC_CALIBER } from '../src/lib/stats-defs.ts';
import { CO2_PER_KG } from '../src/lib/green-factors.ts';

// 统计层的关键数字在这里钉死：数据是手工造的，期望值是手算出来的，
// 谁改了 SQL 而口径没跟着改，这几条断言会先炸。

function seedDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/server/schema.sql', 'utf8'));

  const user = db.prepare(
    `INSERT INTO users (username, password_hash, salt, nickname, is_aid_approved)
     VALUES (?, 'x', 'x', ?, ?)`,
  );
  user.run('admin', '管理员', 0); // 1
  user.run('grad1', '毕业生甲', 0); // 2
  user.run('grad2', '毕业生乙', 0); // 3
  user.run('fresh1', '新生甲', 1); // 4 帮扶生
  user.run('fresh2', '新生乙', 1); // 5 帮扶生
  user.run('fresh3', '新生丙', 3); // 6 被驳回

  // 时间用 SQL 表达式写，避免测试被「今天几号」影响
  const add = (
    owner: number,
    title: string,
    cat: string,
    mode: string,
    status: string,
    flag: number,
    whenSql: string,
  ) => {
    db.prepare(
      `INSERT INTO items (owner_id, title, category, mode, price, status, violation_flag, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${whenSql})`,
    ).run(owner, title, cat, mode, mode === 'sale' ? 20 : 0, status, flag);
    return Number((db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id);
  };

  const bedItemId = add(2, '被褥', 'bedding', 'donate', 'completed', 0, "datetime('now','localtime')");
  add(2, '高数教材', 'textbook', 'sale', 'completed', 0, "datetime('now','localtime')");
  add(2, '中性笔', 'stationery', 'sale', 'completed', 0, "datetime('now','localtime')");
  add(2, '外套', 'clothing', 'donate', 'completed', 0, "datetime('now','localtime','-40 days')");
  add(3, '四级词汇', 'textbook', 'sale', 'listed', 0, "datetime('now','localtime')");
  add(2, '违规日用品', 'daily', 'donate', 'completed', 1, "datetime('now','localtime')");
  add(2, '已下架台灯', 'appliance', 'sale', 'removed', 0, "datetime('now','localtime')");

  // 只给被褥写捐赠记录（快照 2.5kg），外套故意不写 → 走类目系数兜底
  db.prepare(
    `INSERT INTO donations (item_id, donor_id, receiver_id, green_weight_kg, donated_at)
     VALUES (?, 2, 4, 2.5, datetime('now','localtime'))`,
  ).run(bedItemId);

  return { db, bedItemId };
}

test('总览：下架与违规物品不计入，转售/捐赠分别统计', () => {
  const { db } = seedDb();
  const o = getOverview(db);
  // 可计入的是 4 件已完成 + 1 件在架，共 5 件
  assert.equal(o.totalItems, 5);
  assert.equal(o.completedItems, 4);
  assert.equal(o.saleCount, 2);
  assert.equal(o.donateCount, 2);
  assert.equal(o.completedItems, o.saleCount + o.donateCount);
  db.close();
});

test('总览：帮扶资格人数与实际受助人数是两种口径', () => {
  const { db } = seedDb();
  const o = getOverview(db);
  assert.equal(o.aidedStudents, 2); // 通过审核的两名新生
  assert.equal(o.benefitedStudents, 1); // 只发过 1 条捐赠记录
  db.close();
});

test('总览：活跃用户只认近 30 天发过物品的人', () => {
  const { db } = seedDb();
  // 近 30 天发布的是 2 号与 3 号用户，40 天前那条不算
  assert.equal(getOverview(db).activeUsers, 2);
  db.close();
});

test('环保折算：捐赠快照优先，其余按类目系数，减碳量按系数乘', () => {
  const { db } = seedDb();
  const o = getOverview(db);
  // 被褥快照 2.5 + 外套(clothing 0.3) + 高数教材(textbook 0.35) + 中性笔(stationery 0.15) = 3.3
  assert.equal(o.greenWeightKg, 3.3);
  assert.equal(o.co2SavedKg, Math.round(3.3 * CO2_PER_KG * 10) / 10);
  assert.equal(o.co2SavedKg, 6.9);
  db.close();
});

test('节约纸张：只算教材与文具，且不超过折算重量', () => {
  const { db } = seedDb();
  const o = getOverview(db);
  // 高数教材 0.35 × 0.9 = 0.315 + 中性笔 0.15 × 0.5 = 0.075，合计 0.39
  assert.equal(o.paperSavedKg, 0.39);
  assert.ok(o.paperSavedKg < o.greenWeightKg, '纸张量应当小于总折算重量');
  db.close();
});

test('环保折算：总览重量恒等于类别分布各类之和', () => {
  const { db } = seedDb();
  const o = getOverview(db);
  const sumOfCategories = getCategoryDistribution(db).reduce((s, c) => s + c.greenWeightKg, 0);
  // 两处都从同一份逐件明细汇总，差 0.01 都算 SQL 写歪了
  assert.ok(
    Math.abs(o.greenWeightKg - sumOfCategories) < 0.011,
    `总览 ${o.greenWeightKg} ≠ 各类之和 ${sumOfCategories}`,
  );
  db.close();
});

test('月度趋势：补齐空月份，只算已完成', () => {
  const { db } = seedDb();
  const trend = getMonthlyTrend(db, 4);
  assert.equal(trend.length, 4);
  assert.equal(trend.at(-1)?.count, 3); // 本月完成 3 件
  // 40 天前那件落在窗口内的某个月，其余月份补 0
  assert.equal(
    trend.reduce((s, p) => s + p.count, 0),
    4,
  );
  assert.match(trend[0].month, /^\d{4}-\d{2}$/);
  db.close();
});

test('月度趋势：月份参数被夹在 1–24 之间', () => {
  const { db } = seedDb();
  assert.equal(getMonthlyTrend(db, 0).length, 1);
  assert.equal(getMonthlyTrend(db, 999).length, 24);
  assert.equal(getMonthlyTrend(db, Number.NaN).length, 6);
  db.close();
});

test('类别分布：占比之和为 1，重量按类目折算', () => {
  const { db } = seedDb();
  const cats = getCategoryDistribution(db);
  assert.equal(
    cats.reduce((s, c) => s + c.count, 0),
    4,
  );
  const sumShare = cats.reduce((s, c) => s + c.share, 0);
  assert.ok(Math.abs(sumShare - 1) < 1e-9, `占比之和应为 1，实际 ${sumShare}`);
  const bedding = cats.find((c) => c.category === 'bedding');
  assert.equal(bedding?.count, 1);
  assert.equal(bedding?.greenWeightKg, 2.5); // 用捐赠快照，不按系数重算
  assert.equal(cats.every((c) => c.label.length > 0), true);
  db.close();
});

test('转售与捐赠占比：两份之和等于完成数', () => {
  const { db } = seedDb();
  const split = getModeSplit(db);
  assert.equal(split.sale, 2);
  assert.equal(split.donate, 2);
  assert.equal(split.saleShare, 0.5);
  assert.equal(split.donateShare, 0.5);
  assert.equal(split.sale + split.donate, getOverview(db).completedItems);
  db.close();
});

test('按类别拆分：转售与捐赠各自合计等于总表', () => {
  const { db } = seedDb();
  const buckets = getModeByCategory(db);
  const split = getModeSplit(db);
  assert.equal(
    buckets.reduce((s, b) => s + b.sale, 0),
    split.sale,
  );
  assert.equal(
    buckets.reduce((s, b) => s + b.donate, 0),
    split.donate,
  );
  // 教材那行只转售、被褥那行只捐赠
  assert.deepEqual(
    buckets.find((b) => b.category === 'textbook'),
    { category: 'textbook', label: '教材', sale: 1, donate: 0 },
  );
  assert.deepEqual(
    buckets.find((b) => b.category === 'bedding'),
    { category: 'bedding', label: '被褥', sale: 0, donate: 1 },
  );
  db.close();
});

// 学院口径单独造数据：主 seed 的用户没填学院，混在一起会掩盖去重逻辑
function seedCollegeDb() {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/server/schema.sql', 'utf8'));

  const user = db.prepare(
    `INSERT INTO users (username, password_hash, salt, nickname, college) VALUES (?, 'x', 'x', ?, ?)`,
  );
  user.run('donor', '捐赠人', '计算机学院'); // 1
  user.run('a', '学生甲', '计算机学院'); // 2
  user.run('b', '学生乙', '计算机学院'); // 3
  user.run('c', '学生丙', '外国语学院'); // 4
  user.run('d', '学生丁', null); // 5 没填学院

  const item = db.prepare(
    `INSERT INTO items (owner_id, title, category, mode, price, status) VALUES (1, ?, 'textbook', 'donate', 0, 'completed')`,
  );
  const ids = ['书一', '书二', '书三', '书四'].map(
    (t) => Number((item.run(t), db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id),
  );

  const don = db.prepare(
    `INSERT INTO donations (item_id, donor_id, receiver_id, green_weight_kg) VALUES (?, 1, ?, 0.35)`,
  );
  don.run(ids[0], 2);
  don.run(ids[1], 2); // 同一人收第二件：受益人数不涨，人次涨
  don.run(ids[2], 4);
  don.run(ids[3], 5); // 学院为空

  return db;
}

test('学院受益：人数去重、人次单算，空学院归入未填写', () => {
  const db = seedCollegeDb();
  const rows = getCollegeBenefit(db);
  assert.equal(rows.length, 3);
  const by = new Map(rows.map((r) => [r.college, r]));
  assert.deepEqual(by.get('计算机学院'), {
    college: '计算机学院',
    benefited: 1,
    donations: 2,
    items: 2,
  });
  assert.deepEqual(by.get('外国语学院'), {
    college: '外国语学院',
    benefited: 1,
    donations: 1,
    items: 1,
  });
  assert.deepEqual(by.get('未填写'), { college: '未填写', benefited: 1, donations: 1, items: 1 });
  // 各学院受益人数之和 = 实际受助人数；人次之和 = 捐赠记录数
  assert.equal(
    rows.reduce((s, r) => s + r.benefited, 0),
    getOverview(db).benefitedStudents,
  );
  const donationRows = (db.prepare('SELECT COUNT(*) AS c FROM donations').get() as { c: number }).c;
  assert.equal(
    rows.reduce((s, r) => s + r.donations, 0),
    donationRows,
  );
  db.close();
});

test('空库：全 0、占比 0，不抛错', () => {
  const db = new Database(':memory:');
  db.exec(readFileSync('src/server/schema.sql', 'utf8'));
  const s = getPlatformStats(db, { months: 3 });
  assert.equal(s.overview.totalItems, 0);
  assert.equal(s.overview.co2SavedKg, 0);
  assert.equal(s.modeSplit.saleShare, 0); // 0/0 不能变成 NaN
  assert.equal(s.trend.length, 3);
  assert.equal(s.categories.length, 0);
  db.close();
});

test('口径覆盖：返回值里每个指标都有对应说明', () => {
  const { db } = seedDb();
  const keys = Object.keys(getOverview(db)).sort();
  const documented = Object.keys(METRIC_CALIBER).sort();
  assert.deepEqual(keys, documented);

  const caliber = statsCaliber(6);
  assert.equal(caliber.version, 'R17');
  assert.equal(caliber.window.trendMonths, 6);
  assert.equal(caliber.window.activeUserDays, 30);
  assert.match(caliber.formulas.greenWeightKg, /参考估算值/);
  assert.equal(caliber.formulas.co2FactorPerKg, CO2_PER_KG);
  assert.ok(caliber.metrics.every((m) => m.formula.length > 0 && m.label.length > 0));
  db.close();
});
