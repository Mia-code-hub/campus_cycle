import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// db.ts 在模块求值时就读 DATABASE_PATH，所以必须先设环境变量再动态 import，
// 静态 import 会被提升到文件最顶部、先于 env 赋值执行。
process.env.DATABASE_PATH = resolve('./data/test-aid.db');

// server 源码的相对导入不带 .ts 扩展名（turbopack 允许，Node 原生跑 .ts 不允许）。
// 注册一个解析钩子补上扩展名，测试就能直接 import 真实的 server 模块。
// @ts-expect-error Node ≥22.15 提供 registerHooks，项目的 @types/node 版本还没有它的类型定义
import { registerHooks } from 'node:module';

registerHooks({
  resolve(
    specifier: string,
    context: { parentURL?: string | undefined },
    nextResolve: (specifier: string, context: { parentURL?: string | undefined }) => unknown,
  ) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { getAidStatus, applyAid, reviewAid } = await import('../src/server/aid.ts');
const { getReceivedApplications } = await import('../src/server/me.ts');
const { getDb } = await import('../src/server/db.ts');

// —— 建库与造数 ——
// 用户：1 捐赠物主 / 2 已认证帮扶生 / 3 普通新生 / 4 走认证流程 / 5 管理员
const db = getDb();
db.exec(readFileSync('src/server/schema.sql', 'utf8'));
db.exec(`DELETE FROM aid_applications; DELETE FROM applications; DELETE FROM items; DELETE FROM users;`);
const addUser = db.prepare(
  `INSERT INTO users (username, password_hash, salt, nickname, role, is_aid_approved)
   VALUES (?, 'x', 'x', ?, ?, ?)`,
);
addUser.run('owner', '物主', 'user', 0); // 1
addUser.run('aided', '帮扶生', 'user', 1); // 2
addUser.run('fresh', '新生', 'user', 0); // 3
addUser.run('seeker', '申请人', 'user', 0); // 4
addUser.run('admin', '管理员', 'admin', 0); // 5
addUser.run('again', '重新申请者', 'user', 0); // 6 专门走驳回流程，避免污染排序断言里的身份值

const addItem = db.prepare(
  `INSERT INTO items (owner_id, title, category, mode, status, created_at)
   VALUES (?, ?, 'daily', ?, 'listed', datetime('now', 'localtime'))`,
);
addItem.run(1, '台灯（公益捐赠）', 'donate'); // 物品 1
addItem.run(1, '自行车（二手出售）', 'sale'); // 物品 2

// 申请时间故意让普通新生更早——验证优先级能压过「先来后到」
const addApp = db.prepare(
  `INSERT INTO applications (item_id, applicant_id, status, created_at)
   VALUES (?, ?, 'pending', ?)`,
);
addApp.run(1, 3, '2026-01-01 09:00:00'); // 捐赠物品：普通新生先申请
addApp.run(1, 2, '2026-01-01 12:00:00'); // 捐赠物品：帮扶生晚 3 小时申请
addApp.run(2, 3, '2026-01-01 10:00:00'); // 出售物品：普通新生申请

// —— 帮扶资格认证的状态流转 ——
test('未申请的用户状态为 0', () => {
  assert.equal(getAidStatus(4), 0);
});

test('提交申请后置为审核中(2)并写入 pending 记录', () => {
  applyAid(4, '新生入学，家里暂时无法负担教材与生活用品的开销。', null);
  assert.equal(getAidStatus(4), 2);
  const row = db
    .prepare("SELECT user_id, status FROM aid_applications WHERE user_id = 4 AND status = 'pending'")
    .get() as { user_id: number; status: string } | undefined;
  assert.ok(row, '应有 pending 的申请记录');
});

test('审核通过后用户置 1，申请记录回写审核人', () => {
  const appId = (
    db.prepare("SELECT id FROM aid_applications WHERE user_id = 4 ORDER BY id DESC LIMIT 1").get() as {
      id: number;
    }
  ).id;
  const r = reviewAid(appId, 5, true);
  assert.deepEqual(r, { userId: 4 });
  assert.equal(getAidStatus(4), 1);
  const row = db.prepare('SELECT status, reviewed_by FROM aid_applications WHERE id = ?').get(appId) as {
    status: string;
    reviewed_by: number;
  };
  assert.equal(row.status, 'approved');
  assert.equal(row.reviewed_by, 5);
});

test('已处理过的申请不能再次审核', () => {
  const appId = (
    db.prepare("SELECT id FROM aid_applications WHERE user_id = 4 ORDER BY id DESC LIMIT 1").get() as {
      id: number;
    }
  ).id;
  assert.equal(reviewAid(appId, 5, true), null);
  assert.equal(getAidStatus(4), 1, '状态不能被二次审核改写');
});

test('驳回后置 3，且可以重新提交申请', () => {
  applyAid(6, '家里情况暂时困难，希望申请帮扶资格获得基本学习用品。', null);
  assert.equal(getAidStatus(6), 2);
  const appId = (
    db.prepare("SELECT id FROM aid_applications WHERE user_id = 6 ORDER BY id DESC LIMIT 1").get() as {
      id: number;
    }
  ).id;
  assert.deepEqual(reviewAid(appId, 5, false), { userId: 6 });
  assert.equal(getAidStatus(6), 3, '驳回后应为 3');

  applyAid(6, '补充了乡镇民政部门开具的家庭经济情况说明，重新提交申请。', '备注');
  assert.equal(getAidStatus(6), 2, '驳回后允许重新申请');
});

// —— 捐赠申领的「帮扶生优先」——
test('捐赠物品的帮扶生申领置顶，压过先申请的普通新生', () => {
  const apps = getReceivedApplications(1);
  assert.equal(apps.length, 3);
  // 排序应当是：捐赠物品-帮扶生(12:00) → 出售物品-新生(10:00) → 捐赠物品-新生(09:00)
  // 时间上普通新生最早，但帮扶生在捐赠物品上优先
  assert.equal(apps[0].item_id, 1);
  assert.equal(apps[0].applicant_id, 2);
  assert.equal(apps[0].applicant_aid, 1);
  assert.equal(apps[0].item_mode, 'donate');
  const rest = [apps[1], apps[2]].map((a) => a.created_at);
  assert.deepEqual(rest, ['2026-01-01 10:00:00', '2026-01-01 09:00:00']);
});

test('普通新生在捐赠物品的申领上带出身份字段，供前端判断徽章', () => {
  const apps = getReceivedApplications(1);
  const plain = apps.find((a) => a.applicant_id === 3 && a.item_id === 1);
  assert.ok(plain);
  assert.equal(plain.applicant_aid, 0);
});

// —— 清理临时库 ——
test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(process.env.DATABASE_PATH! + suffix);
    } catch {
      /* Windows 上偶发文件锁，留给下次运行覆盖 */
    }
  }
});
