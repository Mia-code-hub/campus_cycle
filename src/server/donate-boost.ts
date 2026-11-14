import { getDb } from './db';

// 通过审核的帮扶生对捐赠物品的额外排序权重（/donate 与 R12 语义检索复用，规则集中在此一处）
export function donateBoost(viewerId: number | null): number {
  if (viewerId == null) return 0;
  const row = getDb().prepare('SELECT is_aid_approved FROM users WHERE id = ?').get(viewerId) as
    | { is_aid_approved: number }
    | undefined;
  return row && row.is_aid_approved === 1 ? 0.3 : 0;
}
