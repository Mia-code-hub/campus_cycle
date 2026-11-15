import test from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../src/lib/ui/cn.ts';
import { activeNavHref, isNavActive, normalizePath } from '../src/lib/ui/nav.ts';
import {
  TOAST_DURATION_MS,
  TOAST_MAX,
  dismiss,
  enqueue,
  type ToastItem,
} from '../src/lib/ui/toast.ts';

test('cn 只拼有效类名，跳过 false/null/空串', () => {
  assert.equal(cn('a', 'b'), 'a b');
  assert.equal(cn('a', false, null, undefined, '', '  ', 'b'), 'a b');
  assert.equal(cn(), '');
  // 不 trim 内部空格：调用方传进来的多类字符串原样保留
  assert.equal(cn(' bg-panel  text-ink '), 'bg-panel  text-ink');
});

test('normalizePath 去掉查询串、hash 与结尾斜杠', () => {
  assert.equal(normalizePath('/me/'), '/me');
  assert.equal(normalizePath('/me?tab=fav'), '/me');
  assert.equal(normalizePath('/admin#top'), '/admin');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('me'), '/me');
});

test('isNavActive：首页精确匹配，其余按前缀', () => {
  assert.equal(isNavActive('/', { href: '/', label: '首页' }), true);
  assert.equal(isNavActive('/items/3', { href: '/', label: '首页' }), false, '详情页不该高亮首页');
  assert.equal(isNavActive('/me/donations', { href: '/me', label: '我的' }), true);
  assert.equal(isNavActive('/me', { href: '/me', label: '我的' }), true);
  assert.equal(isNavActive('/memo', { href: '/me', label: '我的' }), false, '前缀必须落在路径分隔符上');
});

test('activeNavHref 取最长匹配，台账不会被看板抢走', () => {
  const admin = [
    { href: '/admin', label: '看板' },
    { href: '/admin/violations', label: '复核' },
    { href: '/admin/donations', label: '台账' },
  ];
  assert.equal(activeNavHref('/admin', admin), '/admin');
  assert.equal(activeNavHref('/admin/donations', admin), '/admin/donations');
  assert.equal(activeNavHref('/admin/violations?page=2', admin), '/admin/violations');
  assert.equal(activeNavHref('/search', admin), null);
});

const base: ToastItem = {
  id: 1,
  title: '已复制',
  tone: 'ok',
  duration: TOAST_DURATION_MS,
};

test('enqueue：新的排在最前，默认填充 tone/duration', () => {
  const { list, item } = enqueue([base], { title: '已提交' }, 2);
  assert.equal(item.id, 2);
  assert.equal(item.tone, 'info');
  assert.equal(item.duration, TOAST_DURATION_MS);
  assert.deepEqual(
    list.map((t) => t.title),
    ['已提交', '已复制'],
  );
});

test('enqueue：超过上限丢弃最旧的', () => {
  let list: ToastItem[] = [];
  for (let i = 0; i < TOAST_MAX + 2; i++) {
    list = enqueue(list, { title: `第 ${i} 条` }, i + 1).list;
  }
  assert.equal(list.length, TOAST_MAX);
  assert.equal(list[0].title, `第 ${TOAST_MAX + 1} 条`);
  assert.ok(!list.some((t) => t.title === '第 0 条'));
});

test('enqueue：同 key 只保留一条（连点两次收藏不刷屏）', () => {
  const first = enqueue([], { title: '已加入收藏', key: 'fav-3' }, 1).list;
  const second = enqueue(first, { title: '已取消收藏', key: 'fav-3' }, 2).list;
  assert.equal(second.length, 1);
  assert.equal(second[0].title, '已取消收藏');
});

test('dismiss 按 id 移除，不存在的 id 不影响列表', () => {
  const list = enqueue(enqueue([], { title: 'a' }, 1).list, { title: 'b' }, 2).list;
  assert.deepEqual(
    dismiss(list, 1).map((t) => t.id),
    [2],
  );
  assert.equal(dismiss(list, 99).length, 2);
});
