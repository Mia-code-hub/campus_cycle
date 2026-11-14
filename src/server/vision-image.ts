import sharp from 'sharp';

// 视觉模型的前置处理：手机直出的图动辄 3–5MB，转成 base64 要膨胀 1/3，
// 传上去既慢又按 token 计费。统一缩到长边 1280、JPEG q82，
// 识别精度几乎无损，单次耗时从「半分钟起」压到十几秒。
// 任何一步失败都退回原图——宁可慢，也不能因为图片处理挂掉识图。

const MAX_EDGE = 1280;
const JPEG_QUALITY = 82;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

export function parseDataUrl(dataUrl: string): { mime: string; buf: Buffer } | null {
  const m = DATA_URL_RE.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
    if (buf.byteLength === 0 || buf.byteLength > MAX_INPUT_BYTES) return null;
    return { mime: m[1].toLowerCase(), buf };
  } catch {
    return null;
  }
}

export function bufferToDataUrl(buf: Buffer, mime = 'image/jpeg'): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// 已经是小图就不重复编码，避免二次压缩损失
export async function downscaleBuffer(buf: Buffer): Promise<{ buf: Buffer; mime: string }> {
  try {
    const meta = await sharp(buf).metadata();
    const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (edge > 0 && edge <= MAX_EDGE && buf.byteLength <= 400 * 1024) {
      return { buf, mime: meta.format === 'png' ? 'image/png' : 'image/jpeg' };
    }
    const out = await sharp(buf)
      .rotate() // 按 EXIF 摆正，否则竖拍的照片模型看到的是躺着的
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buf: out, mime: 'image/jpeg' };
  } catch {
    return { buf, mime: 'image/jpeg' };
  }
}

export async function prepareVisionDataUrl(dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;
  const out = await downscaleBuffer(parsed.buf);
  return bufferToDataUrl(out.buf, out.mime);
}

export async function fileToVisionDataUrl(buf: Buffer): Promise<string> {
  const out = await downscaleBuffer(buf);
  return bufferToDataUrl(out.buf, out.mime);
}
