import { getDb } from './db';

export type PaymentMethod = 'wechat' | 'alipay';
export type PaymentStatus = 'pending' | 'paid' | 'confirmed';

export interface PaymentRow {
  id: number;
  application_id: number;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  created_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
}

const METHOD_QR_COLUMN: Record<PaymentMethod, 'wechat_qr' | 'alipay_qr'> = {
  wechat: 'wechat_qr',
  alipay: 'alipay_qr',
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === 'wechat' || v === 'alipay';
}

interface AppContextRow {
  id: number;
  applicant_id: number;
  status: string;
  item_id: number;
  item_owner_id: number;
  item_mode: string;
  item_price: number;
}

/** 加载一笔申领的完整上下文（申领 + 物品），供各操作前置校验 */
export function loadPaymentContext(applicationId: number): AppContextRow | null {
  const row = getDb()
    .prepare(
      `SELECT a.id, a.applicant_id, a.status, a.item_id,
              i.owner_id AS item_owner_id, i.mode AS item_mode, i.price AS item_price
       FROM applications a JOIN items i ON i.id = a.item_id
       WHERE a.id = ?`,
    )
    .get(applicationId) as AppContextRow | undefined;
  return row ?? null;
}

export function getPaymentByApplication(applicationId: number): PaymentRow | null {
  return (
    (getDb()
      .prepare('SELECT id, application_id, method, amount, status, created_at, paid_at, confirmed_at FROM payments WHERE application_id = ?')
      .get(applicationId) as PaymentRow | undefined) ?? null
  );
}

export function getOwnerQr(ownerId: number, method: PaymentMethod): string | null {
  const col = METHOD_QR_COLUMN[method];
  const row = getDb()
    .prepare(`SELECT ${col} AS qr FROM users WHERE id = ?`)
    .get(ownerId) as { qr: string | null } | undefined;
  return row?.qr ?? null;
}

export function setOwnerQr(userId: number, method: PaymentMethod, qrPath: string | null): void {
  const col = METHOD_QR_COLUMN[method];
  getDb()
    .prepare(`UPDATE users SET ${col} = ? WHERE id = ?`)
    .run(qrPath, userId);
}

/**
 * 买家选定支付方式（或换方式）：upsert 一条 pending 记录。
 * 只允许申领人本人操作处于 approved 的出售类申领。
 * 返回错误码供路由层转成 HTTP 响应，成功返回 null。
 */
export function selectPaymentMethod(
  userId: number,
  applicationId: number,
  method: PaymentMethod,
): string | null {
  const ctx = loadPaymentContext(applicationId);
  if (!ctx || ctx.applicant_id !== userId) return 'NOT_FOUND';
  if (ctx.status !== 'approved') return 'NOT_APPROVED';
  if (ctx.item_mode !== 'sale') return 'DONATE_NOT_PAYABLE';

  const qr = getOwnerQr(ctx.item_owner_id, method);
  if (!qr) return 'OWNER_NO_QR';

  const db = getDb();
  db.prepare(
    `INSERT INTO payments (application_id, method, amount, status)
     VALUES (?, ?, ?, 'pending')
     ON CONFLICT(application_id) DO UPDATE SET
       method = excluded.method,
       amount = excluded.amount,
       status = 'pending',
       paid_at = NULL,
       confirmed_at = NULL`,
  ).run(applicationId, method, ctx.item_price);
  return null;
}

/**
 * 买家声明已转账：pending → paid。
 * paid 幂等返回成功（重复点击不该报错）；confirmed 之后不再允许改动。
 */
export function markPaid(userId: number, applicationId: number): string | null {
  const ctx = loadPaymentContext(applicationId);
  if (!ctx || ctx.applicant_id !== userId) return 'NOT_FOUND';
  if (ctx.status !== 'approved') return 'NOT_APPROVED';

  const payment = getPaymentByApplication(applicationId);
  if (!payment) return 'NO_PAYMENT';
  if (payment.status === 'confirmed') return 'ALREADY_CONFIRMED';
  if (payment.status === 'paid') return null;

  getDb()
    .prepare(
      "UPDATE payments SET status = 'paid', paid_at = datetime('now','localtime') WHERE id = ?",
    )
    .run(payment.id);
  return null;
}

/**
 * 交割（complete）时的支付联动。在 applications 的事务里调用：
 * - paid → 置 confirmed，写 confirmed_at（确认收款 = 交割完成）
 * - pending → 返回拒绝理由，交割不允许越过买家的转账声明
 * - 无记录或 donate → 不干预，走原有流程
 */
export function settleOnComplete(
  applicationId: number,
): { blocked: false } | { blocked: true; reason: 'PAYMENT_PENDING' } {
  const payment = getPaymentByApplication(applicationId);
  if (!payment) return { blocked: false };
  if (payment.status === 'pending') return { blocked: true, reason: 'PAYMENT_PENDING' };
  if (payment.status === 'confirmed') return { blocked: false };
  getDb()
    .prepare(
      "UPDATE payments SET status = 'confirmed', confirmed_at = datetime('now','localtime') WHERE id = ?",
    )
    .run(payment.id);
  return { blocked: false };
}
