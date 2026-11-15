import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { isPaymentMethod, markPaid, selectPaymentMethod } from '@/server/payments';

const CODE_TO_HTTP: Record<string, { message: string; status: number }> = {
  NOT_FOUND: { message: '申领单不存在', status: 404 },
  NOT_APPROVED: { message: '对方还没同意这次申领，暂不能支付', status: 400 },
  DONATE_NOT_PAYABLE: { message: '公益捐赠不需要支付', status: 400 },
  OWNER_NO_QR: { message: '对方还没有设置这个渠道的收款码', status: 400 },
  NO_PAYMENT: { message: '请先选择支付方式', status: 400 },
  ALREADY_CONFIRMED: { message: '这笔支付已经完成交割，无需再操作', status: 400 },
};

export async function POST(req: Request) {
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
  const applicationId = Number(body.applicationId);
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_ID', message: '申领单不存在' },
      { status: 400 },
    );
  }

  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'select') {
    if (!isPaymentMethod(body.method)) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_METHOD', message: '支付方式只能是微信或支付宝' },
        { status: 400 },
      );
    }
    const err = selectPaymentMethod(user.id, applicationId, body.method);
    if (err) {
      const mapped = CODE_TO_HTTP[err] ?? { message: '操作失败', status: 400 };
      return NextResponse.json({ ok: false, code: err, message: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'paid') {
    const err = markPaid(user.id, applicationId);
    if (err) {
      const mapped = CODE_TO_HTTP[err] ?? { message: '操作失败', status: 400 };
      return NextResponse.json({ ok: false, code: err, message: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, code: 'INVALID_ACTION', message: '非法动作' }, { status: 400 });
}
