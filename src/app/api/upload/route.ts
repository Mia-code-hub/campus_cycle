import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { requireUser } from '@/server/auth';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请上传文件' },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请上传文件' },
      { status: 400 },
    );
  }

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { ok: false, code: 'UNSUPPORTED_TYPE', message: '仅支持 jpg/png/webp 图片' },
      { status: 415 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { ok: false, code: 'UNSUPPORTED_TYPE', message: '仅支持 jpg/png/webp 图片' },
      { status: 415 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json(
      { ok: false, code: 'EMPTY_FILE', message: '文件为空' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, code: 'FILE_TOO_LARGE', message: '图片不能超过 5MB' },
      { status: 400 },
    );
  }

  const filename = `${randomUUID()}${ext}`;
  const dir = join(process.cwd(), 'public', 'uploads');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ ok: true, path: `/uploads/${filename}` });
}
