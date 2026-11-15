import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';
import { relistItem, withdrawItem, type ItemStatus } from '@/server/item-state';

const ACTIONS = ['withdraw', 'relist'] as const;
type Action = (typeof ACTIONS)[number];

interface ItemRow {
  id: number;
  owner_id: number;
  status: ItemStatus;
  violation_flag: number;
}

// 物品主人撤回（下架）或重新上架自己发布的物品。
// 撤回 = status 置为 removed：列表、搜索、统计口径都会自动跳过它，
// 记录和捐赠台账原样保留，所以可以再上架。
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const actionRaw = typeof body.action === 'string' ? body.action : '';
  if (!(ACTIONS as readonly string[]).includes(actionRaw)) {
    return NextResponse.json({ ok: false, code: 'INVALID_ACTION', message: '非法动作' }, { status: 400 });
  }
  const action = actionRaw as Action;

  const db = getDb();
  const item = db
    .prepare('SELECT id, owner_id, status, violation_flag FROM items WHERE id = ?')
    .get(itemId) as ItemRow | undefined;

  // 越权一律 404：403 等于承认「这件东西存在，只是不归你管」，
  // 拿 id 递增就能摸清库里的物品分布。与申领接口保持同一个口径。
  if (!item || item.owner_id !== user.id) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  let nextStatus: ItemStatus;
  try {
    nextStatus = action === 'withdraw' ? withdrawItem(item) : relistItem(item, item.violation_flag);
  } catch (e) {
    // 状态机的原文带数据库状态字段，对外只给一句固定文案，原文留在服务端日志
    console.warn('[items] 撤回/上架被拒绝:', (e as Error).message);
    return NextResponse.json(
      { ok: false, code: 'ILLEGAL_TRANSITION', message: '当前状态不支持该操作，请刷新后再试' },
      { status: 400 },
    );
  }

  let cancelled = 0;
  db.transaction(() => {
    db.prepare('UPDATE items SET status = ? WHERE id = ?').run(nextStatus, item.id);
    if (action === 'withdraw') {
      // 撤回时把进行中的申领一并作废：留着 pending 会让对方一直等一件
      // 永远不会交付的东西，而 approved 更是已经答应过人家的。
      const info = db
        .prepare(
          "UPDATE applications SET status = 'cancelled', updated_at = datetime('now','localtime') WHERE item_id = ? AND status IN ('pending','approved')",
        )
        .run(item.id);
      cancelled = info.changes;
    }
  })();

  return NextResponse.json({ ok: true, itemStatus: nextStatus, cancelledApplications: cancelled });
}
