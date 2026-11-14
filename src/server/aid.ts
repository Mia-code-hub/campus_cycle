import { getDb } from './db';

export interface AidApplicationRow {
  id: number;
  user_id: number;
  reason: string;
  proof_note: string | null;
  status: string;
  reviewed_by: number | null;
  created_at: string;
  reviewed_at: string | null;
  username: string;
  nickname: string;
  college: string | null;
  grade: string | null;
}

export function getAidStatus(userId: number): number {
  const row = getDb().prepare('SELECT is_aid_approved FROM users WHERE id = ?').get(userId) as
    | { is_aid_approved: number }
    | undefined;
  return row?.is_aid_approved ?? 0;
}

// 提交帮扶申请：写 aid_applications(pending) 并把用户标记为待审(2)
export function applyAid(userId: number, reason: string, proofNote: string | null): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('INSERT INTO aid_applications (user_id, reason, proof_note, status) VALUES (?, ?, ?, ?)').run(
      userId,
      reason,
      proofNote,
      'pending',
    );
    db.prepare('UPDATE users SET is_aid_approved = 2 WHERE id = ?').run(userId);
  })();
}

export function listAidApplications(): AidApplicationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.user_id, a.reason, a.proof_note, a.status, a.reviewed_by, a.created_at, a.reviewed_at,
              u.username, u.nickname, u.college, u.grade
       FROM aid_applications a
       JOIN users u ON u.id = a.user_id
       ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at ASC, a.id ASC`,
    )
    .all() as AidApplicationRow[];
}

// 审核：通过置 is_aid_approved=1，驳回置 3，回写 reviewed_by/reviewed_at；非 pending 返回 null
export function reviewAid(
  applicationId: number,
  reviewerId: number,
  approved: boolean,
): { userId: number } | null {
  const db = getDb();
  const app = db
    .prepare('SELECT user_id, status FROM aid_applications WHERE id = ?')
    .get(applicationId) as { user_id: number; status: string } | undefined;
  if (!app || app.status !== 'pending') return null;

  db.transaction(() => {
    db.prepare(
      "UPDATE aid_applications SET status = ?, reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?",
    ).run(approved ? 'approved' : 'rejected', reviewerId, applicationId);
    db.prepare('UPDATE users SET is_aid_approved = ? WHERE id = ?').run(
      approved ? 1 : 3,
      app.user_id,
    );
  })();

  return { userId: app.user_id };
}
