// 向量序列化与相似度计算：纯函数，不碰数据库与网络，便于单测。
// 存储约定：Float32Array（1024 维）按小端 float32 写入 items.embedding BLOB。

export const EMBED_DIM = 1024;

// number[] / Float32Array → Buffer。
// 先切出独立的 ArrayBuffer 副本再包 Buffer，避免原数组的 byteOffset 不是 4 的倍数时读串位。
export function serializeVector(vec: number[] | Float32Array): Buffer {
  const f32 = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  const copy = new ArrayBuffer(f32.byteLength);
  new Uint8Array(copy).set(new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength));
  return Buffer.from(copy);
}

// Buffer → Float32Array；空值或长度不是 4 的倍数时返回 null（老数据/脏数据不崩）
export function deserializeVector(
  blob: Buffer | Uint8Array | ArrayBuffer | null | undefined,
): Float32Array | null {
  if (!blob) return null;
  const bytes =
    blob instanceof ArrayBuffer
      ? new Uint8Array(blob)
      : new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
  if (bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) return null;
  // 拷贝到对齐的独立内存再解释为 float32
  const aligned = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(aligned).set(bytes);
  return new Float32Array(aligned);
}

// 余弦相似度：范围 [-1, 1]，零向量返回 0（不抛异常），维度不一致属于调用方 bug，直接抛
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) {
    throw new RangeError(`向量维度不一致：${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / Math.sqrt(na * nb);
  return Number.isFinite(sim) ? Math.max(-1, Math.min(1, sim)) : 0;
}
