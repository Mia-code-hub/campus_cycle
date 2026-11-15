// 上传链路的两块纯逻辑：按文件头认格式、带硬上限地读请求体。
//
// 分开写是为了能直接测：不给 detectImageKind 一个真实 JPEG 字节串，它就该说 null；
// 给 readBodyLimited 一个 30MB 的流，它必须在读到 5MB 时停下而不是读完再报错。

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageKind {
  format: ImageFormat;
  ext: '.jpg' | '.png' | '.webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
}

const KINDS: Record<ImageFormat, ImageKind> = {
  jpeg: { format: 'jpeg', ext: '.jpg', mime: 'image/jpeg' },
  png: { format: 'png', ext: '.png', mime: 'image/png' },
  webp: { format: 'webp', ext: '.webp', mime: 'image/webp' },
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let s = '';
  for (let i = start; i < start + length; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * 按魔数判定真实图片格式。
 *
 * 客户端给的 MIME 和文件名都是它自己写的，改包就能伪造；
 * 文件头是浏览器/手机真正编码出来的东西，伪造不了（伪造了也就不是图片）。
 */
export function detectImageKind(head: Uint8Array): ImageKind | null {
  // JPEG: FF D8 FF
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return KINDS.jpeg;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return KINDS.png;
  }
  // WebP: "RIFF" .... "WEBP"
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    return KINDS.webp;
  }
  return null;
}

export interface ReadBodyResult {
  ok: boolean;
  bytes?: Buffer;
  size: number;
  reason?: 'too_large' | 'empty' | 'unreadable';
}

/**
 * 边读边计数，超过上限立刻 cancel。
 *
 * 对比 `await req.formData()`：后者会先把整个 body 收进内存再让你查 size，
 * 30MB 的请求就是 30MB 的内存（实测 192ms 才回 400）。这里读到 5MB 就断。
 */
export async function readBodyLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ReadBodyResult> {
  if (!body) return { ok: false, size: 0, reason: 'empty' };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // 不读完：直接把流掐掉，剩余字节连读都不读
        await reader.cancel().catch(() => {});
        return { ok: false, size: total, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => {});
    return { ok: false, size: total, reason: 'unreadable' };
  }

  if (total === 0) return { ok: false, size: 0, reason: 'empty' };
  return { ok: true, size: total, bytes: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
}
