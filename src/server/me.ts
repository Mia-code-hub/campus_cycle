import { getDb } from './db';
import type { ItemSummary } from './items';

export interface MyStats {
  posted: number;
  donated: number;
  received: number;
}

export type MyItemRow = ItemSummary & { status: string; violation_flag: number };

export interface ReceivedApplicationRow {
  id: number;
  item_id: number;
  item_title: string;
  item_mode: string;
  item_price: number;
  applicant_id: number;
  applicant_nickname: string;
  /** 申请人是否已通过帮扶资格审核：捐赠物品的申领要按这个优先 */
  applicant_aid: number;
  reason: string | null;
  status: string;
  created_at: string;
  /** 出售物品的支付进度：null=还没发起，pending=买家选了方式没转账，paid=买家已声明转账 */
  payment_method: string | null;
  payment_status: string | null;
}

export interface MyApplicationRow {
  id: number;
  item_id: number;
  item_title: string;
  item_mode: string;
  item_price: number;
  owner_nickname: string;
  /** 物主的收款码：买家支付面板要展示，没传的渠道置灰 */
  owner_wechat_qr: string | null;
  owner_alipay_qr: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  payment_method: string | null;
  payment_status: string | null;
}

export interface DonationRow {
  id: number;
  donated_at: string;
  green_weight_kg: number;
  item_title: string;
  category: string;
  receiver_nickname: string;
  /** 信件里实际采用的匿名口径；还没生成信时取本人偏好；都没取到按匿名处理 */
  receiver_anonymous: number;
  letter_id: number | null;
}

export function getMyStats(userId: number): MyStats {
  const db = getDb();
  return {
    posted: (db.prepare('SELECT count(*) AS c FROM items WHERE owner_id = ?').get(userId) as { c: number }).c,
    donated: (db.prepare('SELECT count(*) AS c FROM donations WHERE donor_id = ?').get(userId) as { c: number }).c,
    received: (db.prepare('SELECT count(*) AS c FROM donations WHERE receiver_id = ?').get(userId) as { c: number }).c,
  };
}

export function getMyItems(userId: number): MyItemRow[] {
  return getDb()
    .prepare(
      'SELECT id, title, image_path, category, condition_level, mode, price, view_count, status, violation_flag, created_at FROM items WHERE owner_id = ? ORDER BY created_at DESC, id DESC',
    )
    .all(userId) as MyItemRow[];
}

export function getMyFavorites(userId: number): ItemSummary[] {
  return getDb()
    .prepare(
      `SELECT i.id, i.title, i.image_path, i.category, i.condition_level, i.mode, i.price, i.view_count, i.created_at
       FROM favorites f JOIN items i ON i.id = f.item_id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(userId) as ItemSummary[];
}

export function getMyPayout(userId: number): { wechat_qr: string | null; alipay_qr: string | null } {
  return getDb()
    .prepare('SELECT wechat_qr, alipay_qr FROM users WHERE id = ?')
    .get(userId) as { wechat_qr: string | null; alipay_qr: string | null };
}

// 捐赠物品的申领按「帮扶生优先」排：已通过帮扶资格审核的申请人置顶，其余仍按时间倒序。
// 只对 mode='donate' 生效——二手交易讲究先来后到，不能因为身份插队。
export function getReceivedApplications(userId: number): ReceivedApplicationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.item_id, i.title AS item_title, i.mode AS item_mode, i.price AS item_price,
              a.applicant_id, u.nickname AS applicant_nickname,
              u.is_aid_approved AS applicant_aid,
              a.reason, a.status, a.created_at,
              p.method AS payment_method, p.status AS payment_status
       FROM applications a
       JOIN items i ON i.id = a.item_id
       JOIN users u ON u.id = a.applicant_id
       LEFT JOIN payments p ON p.application_id = a.id
       WHERE i.owner_id = ?
       ORDER BY CASE WHEN i.mode = 'donate' AND u.is_aid_approved = 1 THEN 0 ELSE 1 END,
                a.created_at DESC, a.id DESC`,
    )
    .all(userId) as ReceivedApplicationRow[];
}

export function getMyApplications(userId: number): MyApplicationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.item_id, i.title AS item_title, i.mode AS item_mode, i.price AS item_price,
              u.nickname AS owner_nickname,
              u.wechat_qr AS owner_wechat_qr, u.alipay_qr AS owner_alipay_qr,
              a.reason, a.status, a.created_at,
              p.method AS payment_method, p.status AS payment_status
       FROM applications a
       JOIN items i ON i.id = a.item_id
       JOIN users u ON u.id = i.owner_id
       LEFT JOIN payments p ON p.application_id = a.id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
    )
    .all(userId) as MyApplicationRow[];
}

export function getMyDonations(userId: number): DonationRow[] {
  return getDb()
    .prepare(
      `SELECT d.id, d.donated_at, d.green_weight_kg, i.title AS item_title, i.category,
              u.nickname AS receiver_nickname,
              COALESCE(l.receiver_anonymous, u.letter_anonymous, 1) AS receiver_anonymous,
              l.id AS letter_id
       FROM donations d
       JOIN items i ON i.id = d.item_id
       JOIN users u ON u.id = d.receiver_id
       LEFT JOIN letters l ON l.donation_id = d.id
       WHERE d.donor_id = ?
       ORDER BY d.donated_at DESC, d.id DESC`,
    )
    .all(userId) as DonationRow[];
}

/** 本人是否同意在感谢信里署昵称（默认匿名） */
export function getLetterAnonymous(userId: number): boolean {
  const row = getDb()
    .prepare('SELECT letter_anonymous FROM users WHERE id = ?')
    .get(userId) as { letter_anonymous: number } | undefined;
  return (row?.letter_anonymous ?? 1) === 1;
}
