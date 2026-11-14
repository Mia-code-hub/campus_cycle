import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { moderateListing } from '@/server/moderation';
import { moderationCategoryLabel } from '@/lib/banned-terms';

// 发布前置审核：标题 + 描述 +（可选）图片 → 是否通过、类别、理由
//
// 注意：这个接口只是「预检」，发布接口 /api/items 会自己再判一次。
// 结论绝不接受前端传入，否则改个请求体就能绕过审核。
const MAX_IMAGE_DATA_URL = 6_000_000;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function POST(req: Request) {
  const user = await getCurrentUser();
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
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请求体格式错误' },
      { status: 400 },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 50) : '';
  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';

  if (!desc && !title) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CONTENT', message: '请提供标题或描述' },
      { status: 400 },
    );
  }
  if (desc.length > 500) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CONTENT', message: '描述过长' },
      { status: 400 },
    );
  }
  if (
    imageDataUrl &&
    (imageDataUrl.length > MAX_IMAGE_DATA_URL || !DATA_URL_RE.test(imageDataUrl))
  ) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_IMAGE', message: '图片数据格式不正确' },
      { status: 400 },
    );
  }

  const run = await moderateListing({
    title,
    desc,
    imageDataUrl,
    userId: user.id,
  });
  const d = run.decision;

  return NextResponse.json({
    ok: true,
    data: {
      pass: d.pass,
      category: d.category,
      categoryLabel: moderationCategoryLabel(d.category),
      reason: d.reason,
      confidence: d.confidence,
      engine: d.engine,
      pendingReview: d.pendingReview,
      conflict: d.conflict,
      hits: d.hits.map((h) => ({ term: h.term, category: h.category, label: h.label })),
    },
    // 模型没判出来（放行待复核）或图片没能参与判定，都算降级，前端可提示
    degraded: d.engine === 'fallback' || run.imageSkipped,
    modelUsed: run.model,
    latencyMs: run.latencyMs,
    logId: run.logId,
  });
}
