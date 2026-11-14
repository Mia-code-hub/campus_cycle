import { getDb } from './db';
import { CATEGORIES, CONDITIONS, MODES } from '@/lib/constants';

export interface ItemListFilter {
  category?: string;
  mode?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export interface ItemSummary {
  id: number;
  title: string;
  image_path: string | null;
  category: string;
  condition_level: string | null;
  mode: string;
  price: number;
  view_count: number;
  created_at: string;
}

export interface ItemDetail {
  id: number;
  owner_id: number;
  title: string;
  raw_desc: string | null;
  ai_desc: string | null;
  category: string;
  condition_level: string | null;
  mode: string;
  price: number;
  ai_tags: string | null;
  image_path: string | null;
  donate_tag: string | null;
  status: string;
  view_count: number;
  created_at: string;
  owner_nickname: string;
  owner_college: string | null;
}

export function toNum(v: string | undefined | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// 只出在架物品（status='listed' 且 violation_flag=0），字段名固定、值全参数化
export function listItems(filter: ItemListFilter): { total: number; items: ItemSummary[] } {
  const db = getDb();
  const where = ["status = 'listed'", 'violation_flag = 0'];
  const args: (string | number)[] = [];

  if (filter.category && CATEGORIES.some((c) => c.value === filter.category)) {
    where.push('category = ?');
    args.push(filter.category);
  }
  if (filter.mode && MODES.includes(filter.mode)) {
    where.push('mode = ?');
    args.push(filter.mode);
  }
  if (filter.condition && CONDITIONS.includes(filter.condition)) {
    where.push('condition_level = ?');
    args.push(filter.condition);
  }
  if (typeof filter.minPrice === 'number' && Number.isFinite(filter.minPrice)) {
    where.push('price >= ?');
    args.push(filter.minPrice);
  }
  if (typeof filter.maxPrice === 'number' && Number.isFinite(filter.maxPrice)) {
    where.push('price <= ?');
    args.push(filter.maxPrice);
  }

  const whereSql = ` WHERE ${where.join(' AND ')}`;

  const total = (
    db.prepare(`SELECT count(*) AS c FROM items${whereSql}`).get(...args) as { c: number }
  ).c;

  const page = Math.max(1, Math.floor(filter.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(filter.pageSize ?? 12)));
  const offset = (page - 1) * pageSize;

  const items = db
    .prepare(
      `SELECT id, title, image_path, category, condition_level, mode, price, view_count, created_at
       FROM items${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, offset) as ItemSummary[];

  return { total, items };
}

// 浏览量自增并返回物品详情（含发起人昵称与学院）
export function getItemDetail(id: number): ItemDetail | null {
  const db = getDb();
  db.prepare('UPDATE items SET view_count = view_count + 1 WHERE id = ?').run(id);
  const row = db
    .prepare(
      `SELECT i.id, i.owner_id, i.title, i.raw_desc, i.ai_desc, i.category, i.condition_level,
              i.mode, i.price, i.ai_tags, i.image_path, i.donate_tag, i.status, i.view_count,
              i.created_at, u.nickname AS owner_nickname, u.college AS owner_college
       FROM items i
       JOIN users u ON u.id = i.owner_id
       WHERE i.id = ?`,
    )
    .get(id) as ItemDetail | undefined;
  return row ?? null;
}

export function isFavorited(userId: number, itemId: number): boolean {
  return !!getDb()
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId);
}
