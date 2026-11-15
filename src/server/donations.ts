import { getDb } from './db';
import { categoryLabel } from '@/lib/constants';
import type { LedgerRow } from '@/lib/donation-ledger';

// 捐赠台账查询层（管理端）。
// 一条捐赠记录 = 一件物品从谁手里到谁手里；感谢信与来源申请按 donation_id 左连接，
// 没有信也要出现在台账里（未生成），否则对账时会被算成「捐赠丢了」。

export interface LedgerFilter {
  from?: string | null;
  to?: string | null;
  category?: string | null;
}

type RawRow = Omit<LedgerRow, 'categoryLabel'>;

export function listDonationLedger(filter: LedgerFilter = {}, limit = 5000): LedgerRow[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.from) {
    clauses.push('date(d.donated_at) >= date(?)');
    params.push(filter.from);
  }
  if (filter.to) {
    clauses.push('date(d.donated_at) <= date(?)');
    params.push(filter.to);
  }
  if (filter.category) {
    clauses.push('i.category = ?');
    params.push(filter.category);
  }
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 5000, 1), 20000);

  const rows = getDb()
    .prepare(
      `SELECT d.id AS id,
              d.donated_at AS donatedAt,
              d.application_id AS applicationId,
              i.id AS itemId,
              i.title AS itemTitle,
              i.category AS category,
              i.condition_level AS conditionLevel,
              d.donor_id AS donorId,
              donor.nickname AS donorNickname,
              donor.college AS donorCollege,
              d.receiver_id AS receiverId,
              recv.nickname AS receiverNickname,
              recv.college AS receiverCollege,
              d.green_weight_kg AS weightKg,
              l.id AS letterId,
              l.source AS letterSource
         FROM donations d
         JOIN items i ON i.id = d.item_id
         JOIN users donor ON donor.id = d.donor_id
         JOIN users recv ON recv.id = d.receiver_id
         LEFT JOIN letters l ON l.donation_id = d.id
         ${where}
        ORDER BY d.donated_at DESC, d.id DESC
        LIMIT ?`,
    )
    .all(...params, safeLimit) as RawRow[];

  return rows.map((r) => ({ ...r, categoryLabel: categoryLabel(r.category) }));
}
