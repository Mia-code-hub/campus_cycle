import { NextResponse, after } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';
import { greenWeightKg } from '@/lib/green-factors';
import { ensureLetterQuietly } from '@/server/letters';
import {
  transition,
  type ApplicationAction,
  type ApplicationStatus,
  type ItemStatus,
} from '@/server/item-state';

const ACTIONS: ApplicationAction[] = ['approve', 'reject', 'complete', 'cancel'];

interface AppRow {
  id: number;
  item_id: number;
  applicant_id: number;
  status: ApplicationStatus;
}
interface ItemRow {
  id: number;
  owner_id: number;
  status: ItemStatus;
  mode: string;
  category: string;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    return NextResponse.json({ ok: false, code: 'INVALID_ID', message: '申领单不存在' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const actionRaw = typeof body.action === 'string' ? body.action : '';
  if (!(ACTIONS as string[]).includes(actionRaw)) {
    return NextResponse.json({ ok: false, code: 'INVALID_ACTION', message: '非法动作' }, { status: 400 });
  }
  const action = actionRaw as ApplicationAction;

  const db = getDb();
  const app = db
    .prepare('SELECT id, item_id, applicant_id, status FROM applications WHERE id = ?')
    .get(appId) as AppRow | undefined;
  if (!app) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '申领单不存在' }, { status: 404 });
  }
  const item = db
    .prepare('SELECT id, owner_id, status, mode, category FROM items WHERE id = ?')
    .get(app.item_id) as ItemRow | undefined;
  if (!item) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  // 授权：越权一律 404（不是 403）。
  // 403 与 404 混用等于告诉外部「这张申领单存在，只是你没权限」，
  // 拿 id 递增就能摸清库里有几条申领、哪些还没处理。
  const isOwner = item.owner_id === user.id;
  const isApplicant = app.applicant_id === user.id;
  if (action === 'approve' || action === 'reject' || action === 'complete') {
    if (!isOwner) {
      return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '申领单不存在' }, { status: 404 });
    }
  } else {
    // cancel：申领人或主人
    if (!isApplicant && !isOwner) {
      return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '申领单不存在' }, { status: 404 });
    }
  }

  const otherActive =
    (
      db
        .prepare(
          "SELECT count(*) AS c FROM applications WHERE item_id = ? AND id != ? AND status IN ('pending','approved')",
        )
        .get(app.item_id, app.id) as { c: number }
    ).c > 0;

  let next;
  try {
    next = transition(item, app, action, otherActive);
  } catch (e) {
    // transition() 的原文带数据库状态字段与内部规则（如「当前为 completed」），
    // 对外只给一句固定文案，原文留在服务端日志里
    console.warn('[applications] 状态机拒绝:', (e as Error).message);
    return NextResponse.json(
      { ok: false, code: 'ILLEGAL_TRANSITION', message: '当前状态不支持该操作，请刷新后再试' },
      { status: 400 },
    );
  }

  const created = { donationId: 0 };
  db.transaction(() => {
    db.prepare("UPDATE applications SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(
      next.applicationStatus,
      app.id,
    );
    if (next.itemStatus !== item.status) {
      db.prepare('UPDATE items SET status = ? WHERE id = ?').run(next.itemStatus, item.id);
    }
    // 捐赠物品完成交割 → 写捐赠台账，重量按类别系数折算
    if (action === 'complete' && item.mode === 'donate') {
      const info = db
        .prepare(
          'INSERT INTO donations (application_id, item_id, donor_id, receiver_id, green_weight_kg) VALUES (?, ?, ?, ?, ?)',
        )
        .run(app.id, item.id, item.owner_id, app.applicant_id, greenWeightKg(item.category));
      created.donationId = Number(info.lastInsertRowid);
    }
  })();

  // 交割完成后在响应结束时生成感谢信（幂等）：写信失败绝不影响交割结果，
  // 台账页再点一次「生成感谢信」会重试。
  if (created.donationId > 0) {
    const id = created.donationId;
    after(() => ensureLetterQuietly(id));
  }

  return NextResponse.json({
    ok: true,
    itemStatus: next.itemStatus,
    applicationStatus: next.applicationStatus,
  });
}
