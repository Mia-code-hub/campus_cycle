import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { guardAi } from '@/server/rate-limit';
import { generateReport } from '@/server/reports';

// POST /api/ai/report —— 生成一份环保报告（管理员限定）
// 入参只有 months（统计窗口），所有数字由服务端 SQL 聚合，前端传不了任何数值。
// 报告写不写得成由服务端校验决定：校验不过也返回 200 + id，
// 但那份记录是 verify_status='fail'，页面读到 fail 就不渲染正文——
// 「不通过就不展示」是一条数据规则，不是前端的一次判断。

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权限' }, { status: 403 });
  }

  // 报告单次要跑 2 次调用 + 300s，管理员脚本循环就是烧钱
  const limited = guardAi(req, { userId: user.id, scope: 'write' });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const months = Number(body.months);

  const result = await generateReport({
    userId: user.id,
    months: Number.isFinite(months) && months > 0 ? months : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message, logIds: result.logIds ?? [] },
      { status: 503 },
    );
  }

  const { report } = result;
  return NextResponse.json({
    ok: true,
    id: report.id,
    verified: result.verified,
    verifyStatus: report.verify_status,
    charCount: report.char_count,
    attempts: result.attempts,
    unmatched: report.check?.unmatched ?? [],
    issues: report.check?.issues ?? [],
    message: result.message,
    logIds: result.logIds,
  });
}
