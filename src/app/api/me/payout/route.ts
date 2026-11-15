import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { isPaymentMethod, setOwnerQr } from '@/server/payments';
import { isOwnUpload } from '@/server/uploads';

/**
 * 物主维护自己的收款码。qrPath 必须是本人通过 /api/upload 传的图
 * （收款码挂的是收款人身份，不能引用别人上传的文件），null 表示清除。
 */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  if (!isPaymentMethod(body.method)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_METHOD', message: '渠道只能是微信或支付宝' },
      { status: 400 },
    );
  }

  const qrPath = body.qrPath;
  if (qrPath == null) {
    setOwnerQr(user.id, body.method, null);
    return NextResponse.json({ ok: true });
  }
  if (typeof qrPath !== 'string' || !qrPath.startsWith('/uploads/')) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_PATH', message: '收款码路径不合法' },
      { status: 400 },
    );
  }
  // 种子演示数据没有 uploads 记录，isOwnUpload 会判定无主——
  // 无主文件不含任何身份信息，允许覆盖为收款码；有归属的记录则只能本人引用
  if (!isOwnUpload(user.id, qrPath) && isOwnedByAnyone(qrPath)) {
    return NextResponse.json(
      { ok: false, code: 'NOT_YOUR_UPLOAD', message: '只能使用你本人上传的收款码图片' },
      { status: 400 },
    );
  }

  setOwnerQr(user.id, body.method, qrPath);
  return NextResponse.json({ ok: true });
}

function isOwnedByAnyone(qrPath: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM uploads WHERE path = ?').get(qrPath);
}
