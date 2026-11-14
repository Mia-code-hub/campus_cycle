import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';

const CATEGORIES = [
  'textbook',
  'bedding',
  'stationery',
  'appliance',
  'daily',
  'clothing',
  'other',
] as const;
const CONDITIONS = ['95新', '9成新', '8成新', '可用'] as const;
const MODES = ['sale', 'donate'] as const;

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
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CATEGORY', message: '类别不合法' },
      { status: 400 },
    );
  }
  if (!(CONDITIONS as readonly string[]).includes(conditionLevel)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CONDITION', message: '成色不合法' },
      { status: 400 },
    );
  }
  if (!(MODES as readonly string[]).includes(mode)) {
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

  const title = desc.length > 30 ? `${desc.slice(0, 30)}` : desc;

  const info = getDb()
    .prepare(
      `INSERT INTO items
        (owner_id, title, raw_desc, category, condition_level, mode, price, image_path, ai_edited)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      user.id,
      title,
      desc,
      category,
      conditionLevel,
      mode,
      price,
      imagePath || null,
    );

  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
