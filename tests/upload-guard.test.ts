import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageKind, readBodyLimited } from '../src/lib/upload.ts';

const JPEG_HEAD = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0, 0, 0, 0]);
const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

function webpHead(): Uint8Array {
  const b = new Uint8Array(16);
  b.set(Buffer.from('RIFF'), 0);
  b.set(Buffer.from('WEBP'), 8);
  return b;
}

test('按魔数识别 jpg / png / webp', () => {
  assert.equal(detectImageKind(JPEG_HEAD)?.format, 'jpeg');
  assert.equal(detectImageKind(PNG_HEAD)?.format, 'png');
  assert.equal(detectImageKind(webpHead())?.format, 'webp');
});

test('伪装文件一律拒绝：改扩展名改不掉文件头', () => {
  // "<?xml" —— 常见的 SVG/XML 伪装
  assert.equal(detectImageKind(new Uint8Array([0x3c, 0x3f, 0x78, 0x6d, 0x6c, 0x20, 0x76, 0x65])), null);
  // GIF 头，不在白名单
  assert.equal(detectImageKind(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00])), null);
  // PDF
  assert.equal(detectImageKind(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])), null);
  // 太短，读不够判定
  assert.equal(detectImageKind(new Uint8Array([0xff, 0xd8])), null);
  assert.equal(detectImageKind(new Uint8Array(0)), null);
});

test('扩展名与 MIME 取自真实格式，不跟客户端声明走', () => {
  const kind = detectImageKind(JPEG_HEAD);
  assert.equal(kind?.ext, '.jpg');
  assert.equal(kind?.mime, 'image/jpeg');

  const png = detectImageKind(PNG_HEAD);
  assert.equal(png?.ext, '.png');
  assert.equal(png?.mime, 'image/png');
});

test('readBodyLimited 读到上限就掐断，不会吞完整个流', async () => {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1000));
      if (pulled > 100) controller.close(); // 至少 100KB 的流
    },
  });

  const result = await readBodyLimited(stream, 5000);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_large');
  assert.ok(pulled < 20, `只应读到上限附近，实际读了 ${pulled} 块`);
});

test('未超限时返回全部字节', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(100));
      controller.enqueue(new Uint8Array(200));
      controller.close();
    },
  });

  const result = await readBodyLimited(stream, 5000);
  assert.equal(result.ok, true);
  assert.equal(result.size, 300);
  assert.equal(result.bytes?.length, 300);
});

test('空流与无 body 都算失败', async () => {
  assert.equal((await readBodyLimited(null, 100)).reason, 'empty');

  const empty = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });
  assert.equal((await readBodyLimited(empty, 100)).reason, 'empty');
});
