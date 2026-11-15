import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relistItem, transition, withdrawItem } from '../src/server/item-state.ts';

// 正常链路
test('approve: pending+listed → reserved+approved', () => {
  assert.deepEqual(transition({ status: 'listed' }, { status: 'pending' }, 'approve'), {
    itemStatus: 'reserved',
    applicationStatus: 'approved',
  });
});

test('reject: pending → rejected（物品状态不变）', () => {
  assert.deepEqual(transition({ status: 'listed' }, { status: 'pending' }, 'reject'), {
    itemStatus: 'listed',
    applicationStatus: 'rejected',
  });
});

test('complete: approved+reserved → completed+completed', () => {
  assert.deepEqual(transition({ status: 'reserved' }, { status: 'approved' }, 'complete'), {
    itemStatus: 'completed',
    applicationStatus: 'completed',
  });
});

test('cancel: pending（listed）→ cancelled，物品不变', () => {
  assert.deepEqual(transition({ status: 'listed' }, { status: 'pending' }, 'cancel'), {
    itemStatus: 'listed',
    applicationStatus: 'cancelled',
  });
});

test('cancel: approved+reserved 且无其他进行中 → 物品回 listed', () => {
  assert.deepEqual(transition({ status: 'reserved' }, { status: 'approved' }, 'cancel', false), {
    itemStatus: 'listed',
    applicationStatus: 'cancelled',
  });
});

test('cancel: approved+reserved 且有其他进行中 → 物品保持 reserved', () => {
  assert.deepEqual(transition({ status: 'reserved' }, { status: 'approved' }, 'cancel', true), {
    itemStatus: 'reserved',
    applicationStatus: 'cancelled',
  });
});

// 非法流转
test('approve 非 pending 抛错', () => {
  assert.throws(() => transition({ status: 'listed' }, { status: 'approved' }, 'approve'));
});

test('approve 非 listed 抛错', () => {
  assert.throws(() => transition({ status: 'reserved' }, { status: 'pending' }, 'approve'));
});

test('reject 非 pending 抛错', () => {
  assert.throws(() => transition({ status: 'listed' }, { status: 'approved' }, 'reject'));
});

test('complete 非 approved 抛错', () => {
  assert.throws(() => transition({ status: 'reserved' }, { status: 'pending' }, 'complete'));
});

test('complete 非 reserved 抛错', () => {
  assert.throws(() => transition({ status: 'listed' }, { status: 'approved' }, 'complete'));
});

test('cancel 已完成申领抛错', () => {
  assert.throws(() => transition({ status: 'listed' }, { status: 'completed' }, 'cancel'));
});

test('cancel 已完成物品抛错', () => {
  assert.throws(() => transition({ status: 'completed' }, { status: 'approved' }, 'cancel'));
});

// 撤回与重新上架（物品主人的自主操作，与申领状态机解耦）
test('withdraw: listed → removed', () => {
  assert.equal(withdrawItem({ status: 'listed' }), 'removed');
});

test('withdraw: reserved → removed（已答应别人的也能撤，申领由调用方一并作废）', () => {
  assert.equal(withdrawItem({ status: 'reserved' }), 'removed');
});

test('withdraw 已完成物品抛错', () => {
  assert.throws(() => withdrawItem({ status: 'completed' }));
});

test('withdraw 已撤回物品抛错（避免重复操作）', () => {
  assert.throws(() => withdrawItem({ status: 'removed' }));
});

test('relist: removed → listed', () => {
  assert.equal(relistItem({ status: 'removed' }), 'listed');
});

test('relist 在架物品抛错', () => {
  assert.throws(() => relistItem({ status: 'listed' }));
});

test('relist 已完成物品抛错（不能把交割完的东西重新上架）', () => {
  assert.throws(() => relistItem({ status: 'completed' }));
});

test('relist 违规下架的物品抛错（不能绕过审核）', () => {
  assert.throws(() => relistItem({ status: 'removed' }, 1));
});

test('relist 非违规的已撤回物品正常恢复', () => {
  assert.equal(relistItem({ status: 'removed' }, 0), 'listed');
  assert.equal(relistItem({ status: 'removed' }, 2), 'listed');
});
