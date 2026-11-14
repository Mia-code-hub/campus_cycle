import { getDb } from './db';
import type { ItemSummary } from './items';

export interface MyStats {
  posted: number;
  donated: number;
  received: number;
}

export type MyItemRow = ItemSummary & { status: string };

export interface ReceivedApplicationRow {
  id: number;
  item_id: number;
  item_title: string;
  applicant_id: number;
  applicant_nickname: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface MyApplicationRow {
  id: number;
  item_id: number;
  item_title: string;
  owner_nickname: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface DonationRow {
  id: number;
  donated_at: string;
  green_weight_kg: number;
  item_title: string;
  category: string;
  receiver_nickname: string;
  receiver_anonymous: number | null;
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
      'SELECT id, title, image_path, category, condition_level, mode, price, view_count, status, created_at FROM items WHERE owner_id = ? ORDER BY created_at DESC, id DESC',
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

export function getReceivedApplications(userId: number): ReceivedApplicationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.item_id, i.title AS item_title, a.applicant_id, u.nickname AS applicant_nickname,
              a.reason, a.status, a.created_at
       FROM applications a
       JOIN items i ON i.id = a.item_id
       JOIN users u ON u.id = a.applicant_id
       WHERE i.owner_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
    )
    .all(userId) as ReceivedApplicationRow[];
}

export function getMyApplications(userId: number): MyApplicationRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.item_id, i.title AS item_title, u.nickname AS owner_nickname,
              a.reason, a.status, a.created_at
       FROM applications a
       JOIN items i ON i.id = a.item_id
       JOIN users u ON u.id = i.owner_id
       WHERE a.applicant_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
    )
    .all(userId) as MyApplicationRow[];
}

export function getMyDonations(userId: number): DonationRow[] {
  return getDb()
    .prepare(
      `SELECT d.id, d.donated_at, d.green_weight_kg, i.title AS item_title, i.category,
              u.nickname AS receiver_nickname, l.receiver_anonymous
       FROM donations d
       JOIN items i ON i.id = d.item_id
       JOIN users u ON u.id = d.receiver_id
       LEFT JOIN letters l ON l.donation_id = d.id
       WHERE d.donor_id = ?
       ORDER BY d.donated_at DESC, d.id DESC`,
    )
    .all(userId) as DonationRow[];
}
