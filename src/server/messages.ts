import { getDb } from './db';

export interface MessageRow {
  id: number;
  item_id: number;
  from_user_id: number;
  to_user_id: number;
  content: string;
  read_flag: number;
  created_at: string;
}

// 返回当前用户在物品下的对话对方（owner ↔ 已 approved 的申领人）；非相关人返回 null
export function getConversationPeer(itemId: number, userId: number): number | null {
  const db = getDb();
  const item = db.prepare('SELECT owner_id FROM items WHERE id = ?').get(itemId) as
    | { owner_id: number }
    | undefined;
  if (!item) return null;

  if (item.owner_id === userId) {
    const app = db
      .prepare(
        "SELECT applicant_id FROM applications WHERE item_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1",
      )
      .get(itemId) as { applicant_id: number } | undefined;
    return app ? app.applicant_id : null;
  }

  const app = db
    .prepare(
      "SELECT 1 FROM applications WHERE item_id = ? AND applicant_id = ? AND status = 'approved' LIMIT 1",
    )
    .get(itemId, userId);
  return app ? item.owner_id : null;
}

export function listMessages(itemId: number, userId: number, peerId: number): MessageRow[] {
  return getDb()
    .prepare(
      `SELECT id, item_id, from_user_id, to_user_id, content, read_flag, created_at
       FROM messages
       WHERE item_id = ?
         AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
       ORDER BY created_at ASC, id ASC`,
    )
    .all(itemId, userId, peerId, peerId, userId) as MessageRow[];
}

export function insertMessage(
  itemId: number,
  fromUserId: number,
  toUserId: number,
  content: string,
): MessageRow {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO messages (item_id, from_user_id, to_user_id, content) VALUES (?, ?, ?, ?)')
    .run(itemId, fromUserId, toUserId, content);
  return db
    .prepare(
      'SELECT id, item_id, from_user_id, to_user_id, content, read_flag, created_at FROM messages WHERE id = ?',
    )
    .get(info.lastInsertRowid) as MessageRow;
}
