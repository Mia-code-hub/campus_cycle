import { NextResponse, after, type NextRequest } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';
import { CATEGORIES, CONDITIONS, MODES } from '@/lib/constants';
import { listItems, toNum } from '@/server/items';
import { embedItem } from '@/lib/ai/embed';
import { moderateListing, uploadToDataUrl } from '@/server/moderation';
import { violationNote } from '@/lib/ai/moderate';
import { moderationCategoryLabel } from '@/lib/banned-terms';
import { isOwnUpload, markUploadUsed } from '@/server/uploads';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { total, items } = listItems({
    category: sp.get('category') ?? undefined,
    mode: sp.get('mode') ?? undefined,
    condition: sp.get('condition') ?? undefined,
    minPrice: toNum(sp.get('minPrice')),
    maxPrice: toNum(sp.get('maxPrice')),
    page: toNum(sp.get('page')),
    pageSize: toNum(sp.get('pageSize')),
  });
  return NextResponse.json({ ok: true, total, items });
}

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
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请求体格式错误' },
      { status: 400 },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const conditionLevel = typeof body.conditionLevel === 'string' ? body.conditionLevel : '';
  const mode = typeof body.mode === 'string' ? body.mode : '';
  const imagePath = typeof body.imagePath === 'string' ? body.imagePath : '';

  if (!desc) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_DESC', message: '请填写一句话描述' },
      { status: 400 },
    );
  }
  if (desc.length > 200) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_DESC', message: '描述过长（最多 200 字）' },
      { status: 400 },
    );
  }
  if (!CATEGORIES.some((c) => c.value === category)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CATEGORY', message: '类别不合法' },
      { status: 400 },
    );
  }
  if (!CONDITIONS.includes(conditionLevel)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CONDITION', message: '成色不合法' },
      { status: 400 },
    );
  }
  if (!MODES.includes(mode)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_MODE', message: '流转方式不合法' },
      { status: 400 },
    );
  }

  let price = 0;
  if (mode === 'sale') {
    price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_PRICE', message: '转售价必须大于 0' },
        { status: 400 },
      );
    }
  }
  // donate 强制 price = 0

  // image_path 校验前缀，防路径穿越
  if (imagePath && !/^\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(imagePath)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_IMAGE', message: '图片路径不合法' },
      { status: 400 },
    );
  }

  // 路径合法 ≠ 图片是你的。没有这一条，任何登录用户都能把别人的图片 / 违规图
  // 挂到自己发布的物品上：盗图、栽赃、让别人背锅都只需要猜一串 uuid。
  if (imagePath && !isOwnUpload(user.id, imagePath)) {
    return NextResponse.json(
      { ok: false, code: 'IMAGE_NOT_OWNED', message: '请上传自己的图片' },
      { status: 400 },
    );
  }

  // AI 辅助字段（可选，来自 /api/ai/analyze 的回填，用户可改）
  const aiTitle = typeof body.title === 'string' ? body.title.trim().slice(0, 50) : '';
  const aiDesc = typeof body.aiDesc === 'string' ? body.aiDesc.trim().slice(0, 500) : '';
  const aiTags = Array.isArray(body.aiTags)
    ? [
        ...new Set(
          body.aiTags
            .filter((t): t is string => typeof t === 'string')
            .map((t) => t.trim().slice(0, 12))
            .filter(Boolean),
        ),
      ].slice(0, 6)
    : [];
  // ai_edited: 0=未用 AI，1=AI 填写且未改，2=AI 填写后用户改过
  const aiEditedRaw = Number(body.ai_edited);
  const aiEdited = [0, 1, 2].includes(aiEditedRaw) ? aiEditedRaw : 0;

  // AI 参考价区间（仅转售存，用户可只采纳 suggested）
  const priceNum = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) && n > 0 && n <= 100_000 ? Math.round(n) : null;
  };
  const aiPriceLow = mode === 'sale' ? priceNum(body.aiPriceLow) : null;
  const aiPriceHigh = mode === 'sale' ? priceNum(body.aiPriceHigh) : null;
  // 公益标签只在捐赠时保存，长度对齐 prompt 约束
  const donateTag =
    mode === 'donate' && typeof body.donateTag === 'string'
      ? body.donateTag.trim().slice(0, 20)
      : '';

  const title = (aiTitle || (desc.length > 30 ? desc.slice(0, 30) : desc)).slice(0, 50);

  // 发布前审核：本地词表 + 模型判定，全部在服务端完成。
  // 不接受前端传来的「已通过」结论，否则改个请求体就能绕过审核。
  const moderation = await moderateListing({
    title,
    desc: [desc, aiDesc].filter(Boolean).join('\n'),
    imageDataUrl: await uploadToDataUrl(imagePath),
    userId: user.id,
  });
  const decision = moderation.decision;

  if (!decision.pass) {
    // 拦截不入库：既不留垃圾数据，也避免「被拦的物品还能被搜到」。
    // 用户改完描述可以立刻重试，不限制次数。
    return NextResponse.json(
      {
        ok: false,
        code: 'MODERATION_BLOCKED',
        message: decision.reason,
        category: decision.category,
        categoryLabel: moderationCategoryLabel(decision.category),
        hits: decision.hits.map((h) => h.term),
        engine: decision.engine,
        logId: moderation.logId,
      },
      { status: 422 },
    );
  }

  // 模型故障时必须放行（否则 AI 挂了谁都不能发布），但打上待复核标记，
  // 由管理员在 /admin/violations 兜底 —— 不能变成「审核失败就放行」的漏洞。
  const violationFlag = decision.pendingReview ? 2 : 0;
  const violationReason = violationNote(decision, moderation.errorKind);

  const info = getDb()
    .prepare(
      `INSERT INTO items
        (owner_id, title, raw_desc, ai_desc, category, condition_level, mode, price, image_path,
         ai_tags, ai_edited, ai_price_low, ai_price_high, donate_tag, violation_flag, violation_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      title,
      desc,
      aiDesc || null,
      category,
      conditionLevel,
      mode,
      price,
      imagePath || null,
      aiTags.length ? JSON.stringify(aiTags) : null,
      aiEdited,
      aiPriceLow,
      aiPriceHigh,
      donateTag || null,
      violationFlag,
      violationReason,
    );

  const newId = Number(info.lastInsertRowid);

  // 把「这张图用在哪件物品上」补进 uploads，清理孤儿文件时有据可依
  if (imagePath) markUploadUsed(imagePath, newId);

  // 向量化放在响应之后跑：发布不等 AI，模型挂了也不影响物品上架，
  // 列表页的补算逻辑会把缺向量的记录补上。
  after(async () => {
    await embedItem(newId, { userId: user.id });
  });

  return NextResponse.json({
    ok: true,
    id: newId,
    pendingReview: violationFlag === 2,
  });
}
