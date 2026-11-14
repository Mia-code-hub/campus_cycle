import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';
import { greenWeightKg } from '@/lib/green-factors';
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

  // 授权：越权一律 403
  const isOwner = item.owner_id === user.id;
  const isApplicant = app.applicant_id === user.id;
  if (action === 'approve' || action === 'reject' || action === 'complete') {
    if (!isOwner) {
      return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权操作该申领单' }, { status: 403 });
    }
  } else {
    // cancel：申领人或主人
    if (!isApplicant && !isOwner) {
      return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权操作该申领单' }, { status: 403 });
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
    return NextResponse.json(
      { ok: false, code: 'ILLEGAL_TRANSITION', message: (e as Error).message },
      { status: 400 },
    );
  }

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
      db.prepare(
        'INSERT INTO donations (application_id, item_id, donor_id, receiver_id, green_weight_kg) VALUES (?, ?, ?, ?, ?)',
      ).run(app.id, item.id, item.owner_id, app.applicant_id, greenWeightKg(item.category));
    }
  })();

  return NextResponse.json({
    ok: true,
    itemStatus: next.itemStatus,
    applicationStatus: next.applicationStatus,
  });
}
