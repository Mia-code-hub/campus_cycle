import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { guardAi } from '@/server/rate-limit';
import { generateLetter, loadLetterContext } from '@/server/letters';

// 捐赠感谢信生成 / 复用
//
// 入参只有 donationId：物品、捐赠人、受赠人署名偏好全部由服务端按 id 自查，
// 前端就算多传 nickname / college 之类字段也不会被读取。
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  const limited = guardAi(req, { userId: user.id, scope: 'write' });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const donationId = Number(body.donationId);
  if (!Number.isSafeInteger(donationId) || donationId <= 0) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_DONATION', message: '捐赠记录参数不正确' },
      { status: 400 },
    );
  }

  const ctx = loadLetterContext(donationId);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, code: 'NOT_FOUND', message: '捐赠记录不存在' },
      { status: 404 },
    );
  }
  // 只有这笔捐赠的两方与管理员能触发；其他人连存在性都不告诉
  const allowed = user.id === ctx.donorId || user.id === ctx.receiverId || user.role === 'admin';
  if (!allowed) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权查看该感谢信' }, { status: 403 });
  }

  // retryTemplate 只在「已有模板信、想升级成 AI 版」时显式传，
  // 普通调用（含重复点击）一律命中幂等，不会重复生成。
  const retryTemplate = body.retryTemplate === true;

  const result = await generateLetter(donationId, { userId: user.id, retryTemplate });
  if (!result.ok || !result.letter) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code ?? 'LETTER_FAILED',
        message: '感谢信暂时无法生成，请稍后重试',
        retryable: true,
      },
      { status: result.code === 'NOT_FOUND' ? 404 : 503 },
    );
  }

  const letter = result.letter;
  return NextResponse.json({
    ok: true,
    letter: {
      id: letter.id,
      content: letter.content,
      receiverAnonymous: letter.receiver_anonymous === 1,
      source: letter.source,
      issuedAt: letter.issued_at,
    },
    reused: result.reused === true,
    degraded: result.degraded === true,
    modelUsed: result.model ?? null,
    errorKind: result.errorKind ?? null,
    logIds: result.logIds ?? [],
    message:
      result.degraded === true
        ? 'AI 暂时不可用，已按平台模板生成；稍后再打开可升级为 AI 版本'
        : null,
  });
}
