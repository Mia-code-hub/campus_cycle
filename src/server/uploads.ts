import { getDb } from './db';

// 上传文件的归属账本。
//
// 文件名是 randomUUID，本身不含任何身份信息；「这张图是谁传的」只能靠记录。
// 发布时校验归属，读取时也能据此判断「你有没有资格看这张私有图」。
// 历史遗留的图片（种子数据、早期版本上传）没有记录，一律视为无主——
// 它们只出现在既有物品上，不会被重新发布，所以不影响演示。

export function recordUpload(userId: number, path: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO uploads (path, user_id) VALUES (?, ?)')
    .run(path, userId);
}

export function isOwnUpload(userId: number, path: string): boolean {
  return !!getDb()
    .prepare('SELECT 1 FROM uploads WHERE path = ? AND user_id = ?')
    .get(path, userId);
}

export function markUploadUsed(path: string, itemId: number): void {
  getDb().prepare('UPDATE uploads SET used_item_id = ? WHERE path = ?').run(itemId, path);
}

export function countUploadsSince(userId: number, sinceIso: string): number {
  const row = getDb()
    .prepare('SELECT count(*) AS c FROM uploads WHERE user_id = ? AND created_at >= ?')
    .get(userId, sinceIso) as { c: number };
  return row.c;
}
