import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, deserializeVector, serializeVector } from '../src/lib/ai/vector.ts';

test('同向向量相似度为 1', () => {
  assert.equal(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
  assert.equal(cosineSimilarity([0, 1], [0, 5]), 1);
});

test('正交向量相似度为 0', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0, 0], [-3, 0, 0]), -1);
});

test('零向量不抛异常，返回 0', () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
  assert.equal(cosineSimilarity([0, 0], [0, 0]), 0);
});

test('维度不一致直接报错，避免静默错分', () => {
  assert.throws(() => cosineSimilarity([1, 2], [1, 2, 3]), RangeError);
});

test('序列化往返后数值不变且维度一致', () => {
  const vec = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.1);
  const buf = serializeVector(vec);
  assert.equal(buf.byteLength, 1024 * 4);

  const back = deserializeVector(buf);
  assert.ok(back);
  assert.equal(back.length, 1024);
  for (let i = 0; i < 1024; i++) assert.equal(back[i], vec[i]);

  // 往返后还能和原向量算出 1，说明字节序与对齐都对
  assert.ok(Math.abs(cosineSimilarity(vec, back) - 1) < 1e-6);
});

test('空值与脏长度返回 null 而不是崩溃', () => {
  assert.equal(deserializeVector(null), null);
  assert.equal(deserializeVector(Buffer.alloc(0)), null);
  assert.equal(deserializeVector(Buffer.alloc(6)), null);
});
