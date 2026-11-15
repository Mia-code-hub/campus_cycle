import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// db.ts 在模块求值时就读 DATABASE_PATH，必须先设环境变量再动态 import
process.env.DATABASE_PATH = resolve('./data/test-payments.db');

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

const {
  selectPaymentMethod,
  markPaid,
  settleOnComplete,
  getPaymentByApplication,
  getOwnerQr,
  setOwnerQr,
} = await import('../src/server/payments.ts');
const { getDb } = await import('../src/server/db.ts');

// —— 建库与造数 ——
// 用户：1 卖家(双渠道收款码) / 2 买家 / 3 无码卖家 / 4 买家乙
const db = getDb();
db.exec(readFileSync('src/server/schema.sql', 'utf8'));
db.exec(
  'DELETE FROM payments; DELETE FROM applications; DELETE FROM items; DELETE FROM users;',
);
const addUser = db.prepare(
  `INSERT INTO users (username, password_hash, salt, nickname, role, wechat_qr, alipay_qr)
   VALUES (?, 'x', 'x', ?, 'user', ?, ?)`,
);
addUser.run('seller', '卖家甲', '/uploads/qr-w.svg', '/uploads/qr-a.svg'); // 1
addUser.run('buyer', '买家甲', null, null); // 2
addUser.run('noqr', '无码卖家', null, null); // 3
addUser.run('buyer2', '买家乙', null, null); // 4

const addItem = db.prepare(
  `INSERT INTO items (owner_id, title, category, mode, price, status, created_at)
   VALUES (?, ?, 'textbook', ?, ?, 'listed', datetime('now','localtime'))`,
);
addItem.run(1, '出售的教材', 'sale', 15); // 物品 1 → 申领 1（approved）
addItem.run(1, '另一本出售教材', 'sale', 8); // 物品 2 → 申领 2（pending，还没同意）
addItem.run(1, '捐赠的台灯', 'donate', 0); // 物品 3 → 申领 3（approved，捐赠）
addItem.run(3, '无码卖家的书', 'sale', 6); // 物品 4 → 申领 4（approved，物主无码）

const addApp = db.prepare(
  `INSERT INTO applications (item_id, applicant_id, status, created_at)
   VALUES (?, ?, ?, datetime('now','localtime'))`,
);
addApp.run(1, 2, 'approved'); // 申领 1：主流程
addApp.run(2, 2, 'pending'); // 申领 2：还没同意
addApp.run(3, 2, 'approved'); // 申领 3：捐赠
addApp.run(4, 2, 'approved'); // 申领 4：物主无码
db.prepare("UPDATE items SET status='reserved' WHERE id IN (1,3,4)").run();

// —— 选择支付方式 ——
test('买家选定微信支付：写入 pending 记录，金额取物品价', () => {
  assert.equal(selectPaymentMethod(2, 1, 'wechat'), null);
  const p = getPaymentByApplication(1);
  assert.equal(p?.method, 'wechat');
  assert.equal(p?.status, 'pending');
  assert.equal(p?.amount, 15);
});

test('换支付宝：同一条记录更新方式并重置为 pending', () => {
  assert.equal(selectPaymentMethod(2, 1, 'alipay'), null);
  const p = getPaymentByApplication(1);
  assert.equal(p?.method, 'alipay');
  assert.equal(p?.status, 'pending');
});

test('非申领人操作返回 NOT_FOUND（不泄露存在性）', () => {
  assert.equal(selectPaymentMethod(4, 1, 'wechat'), 'NOT_FOUND');
  assert.equal(markPaid(4, 1), 'NOT_FOUND');
});

test('还没被同意的申领不能发起支付', () => {
  assert.equal(selectPaymentMethod(2, 2, 'wechat'), 'NOT_APPROVED');
});

test('捐赠物品不需要支付', () => {
  assert.equal(selectPaymentMethod(2, 3, 'wechat'), 'DONATE_NOT_PAYABLE');
});

test('物主没设置该渠道收款码时不能选这个渠道', () => {
  assert.equal(selectPaymentMethod(2, 4, 'wechat'), 'OWNER_NO_QR');
});

// —— 我已转账 ——
test('声明已转账：pending → paid，记录时间', () => {
  assert.equal(markPaid(2, 1), null);
  const p = getPaymentByApplication(1);
  assert.equal(p?.status, 'paid');
  assert.ok(p?.paid_at);
});

test('重复声明幂等，不再改状态', () => {
  assert.equal(markPaid(2, 1), null);
  assert.equal(getPaymentByApplication(1)?.status, 'paid');
});

test('没选过方式就声明转账会被拒绝', () => {
  // 申领 4 已同意（approved）但物主无收款码、从未发起支付
  assert.equal(markPaid(2, 4), 'NO_PAYMENT');
});

// —— 交割联动 ——
test('买家还没声明转账：交割被拦', () => {
  // 申领 4 有 approved 但物主无码（无支付记录）→ 不拦；
  // 给申领 1 造一条 pending 记录来测拦截：先重置为 pending
  selectPaymentMethod(2, 1, 'wechat'); // paid → pending（换方式重置）
  const settle = settleOnComplete(1);
  assert.deepEqual(settle, { blocked: true, reason: 'PAYMENT_PENDING' });
});

test('买家已声明转账：交割时支付置 confirmed', () => {
  markPaid(2, 1);
  const settle = settleOnComplete(1);
  assert.deepEqual(settle, { blocked: false });
  const p = getPaymentByApplication(1);
  assert.equal(p?.status, 'confirmed');
  assert.ok(p?.confirmed_at);
});

test('confirmed 之后再次交割不重复写', () => {
  assert.deepEqual(settleOnComplete(1), { blocked: false });
});

test('无支付记录（捐赠或线下自由交割）不受影响', () => {
  assert.deepEqual(settleOnComplete(3), { blocked: false });
  assert.deepEqual(settleOnComplete(4), { blocked: false });
});

// —— 收款码读写 ——
test('收款码可更新与清除', () => {
  setOwnerQr(3, 'wechat', '/uploads/new-qr.svg');
  assert.equal(getOwnerQr(3, 'wechat'), '/uploads/new-qr.svg');
  setOwnerQr(3, 'wechat', null);
  assert.equal(getOwnerQr(3, 'wechat'), null);
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
