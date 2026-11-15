import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import { requireUser } from '@/server/auth';
import { detectImageKind, readBodyLimited, type ImageKind } from '@/lib/upload';
import { consume, rateLimitedResponse } from '@/server/rate-limit';
import { recordUpload } from '@/server/uploads';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
// multipart 的边界、其它字段、头部都要占字节，给 64KB 余量
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
// 统一缩到长边 2400：手机直出 4000×3000 的照片没必要原样存
const MAX_EDGE = 2400;
// 单用户上传配额（每小时）。传了不发布、发布了又下架，文件会一直留在磁盘上
const UPLOAD_PER_HOUR = 40;

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

/**
 * 重编码：`rotate()` 按 EXIF 方向摆正，编码器默认丢弃全部元数据
 * （GPS 经纬度、设备型号、拍摄时间都不再跟着图片走），
 * 顺手把「合法图片头 + 夹带二进制」的文件洗成一份干净的像素输出。
 */
async function normalizeImage(input: Buffer, kind: ImageKind): Promise<Buffer> {
  const pipeline = sharp(input).resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });
  switch (kind.format) {
    case 'jpeg':
      return pipeline.rotate().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
    case 'png':
      return pipeline.rotate().png({ compressionLevel: 9, palette: true }).toBuffer();
    case 'webp':
      return pipeline.rotate().webp({ quality: 84 }).toBuffer();
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return fail('UNAUTHORIZED', '请先登录', 401);
  }

  // 配额：按用户每小时 40 张，防「传了不发布」把磁盘塞满
  const quota = consume(`upload:u:${user.id}:h`, { limit: UPLOAD_PER_HOUR, windowMs: 60 * 60_000 });
  if (!quota.ok) return rateLimitedResponse(quota, '上传太频繁');

  // ① 声明长度就超限：一个字节都不读，直接 413
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return fail('FILE_TOO_LARGE', '图片不能超过 5MB', 413);
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return fail('BAD_REQUEST', '请上传文件', 400);
  }

  // ② 流式读取：读到上限就掐断，不把大文件收进内存
  const body = await readBodyLimited(req.body, MAX_BODY_BYTES);
  if (!body.ok || !body.bytes) {
    if (body.reason === 'too_large') return fail('FILE_TOO_LARGE', '图片不能超过 5MB', 413);
    return fail('BAD_REQUEST', '请上传文件', 400);
  }

  // ③ 交给 undici 解析 multipart（自己解析边界容易漏掉 \r\n 之类的细节）
  let form: FormData;
  try {
    const blob = new Blob([new Uint8Array(body.bytes)]);
    form = await new Response(blob, { headers: { 'content-type': contentType } }).formData();
  } catch {
    return fail('BAD_REQUEST', '表单解析失败', 400);
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return fail('BAD_REQUEST', '请上传文件', 400);
  }

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return fail('UNSUPPORTED_TYPE', '仅支持 jpg/png/webp 图片', 415);
  }
  if (file.size === 0) {
    return fail('EMPTY_FILE', '文件为空', 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return fail('FILE_TOO_LARGE', '图片不能超过 5MB', 413);
  }

  const input = Buffer.from(await file.arrayBuffer());

  // ④ 以文件头为准，不信扩展名与客户端声明的 MIME
  const kind = detectImageKind(input.subarray(0, 16));
  if (!kind) {
    return fail('UNSUPPORTED_TYPE', '这不是有效的 jpg/png/webp 图片', 415);
  }

  let output: Buffer;
  try {
    output = await normalizeImage(input, kind);
  } catch {
    return fail('UNSUPPORTED_TYPE', '图片已损坏或无法解析', 415);
  }
  if (output.byteLength === 0) {
    return fail('UNSUPPORTED_TYPE', '图片已损坏或无法解析', 415);
  }
  if (output.byteLength > MAX_IMAGE_BYTES) {
    return fail('FILE_TOO_LARGE', '处理后的图片仍超过 5MB，请压缩后再传', 413);
  }

  // ⑤ 文件名只由服务端生成，扩展名取自真实格式，和用户输入无关
  const filename = `${randomUUID()}${kind.ext}`;
  const dir = join(process.cwd(), 'public', 'uploads');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), output);

  // ⑥ 记归属：发布时校验「这张图是不是你传的」，靠的就是这一行
  recordUpload(user.id, `/uploads/${filename}`);

  return NextResponse.json({
    ok: true,
    path: `/uploads/${filename}`,
    size: output.byteLength,
  });
}
