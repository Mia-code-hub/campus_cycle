// 把演示视频作为 GitHub Release 附件上传（不进 git 历史，单文件上限 2GB）
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = 'Mia-code-hub/campus_cycle';
const VIDEO = process.argv[2];
const ASSET_NAME = 'campus-cycle-demo-20261116.mp4';

// 1. 从 git 凭据管理器取 token
const cred = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
});
const token = (cred.stdout.match(/^password=(.+)$/m) || [])[1];
if (!token) { console.error('取不到 GitHub 凭据'); process.exit(1); }

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'campus-cycle-upload',
};

// 2. 若已有同名 release 先复用，否则创建
let releaseId;
const list = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/demo-video`, { headers });
if (list.ok) {
  releaseId = (await list.json()).id;
  console.log('复用已有 release:', releaseId);
} else {
  const create = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: 'demo-video',
      name: '演示视频',
      body: '校园闲置物资循环 AI 平台 · 作品演示视频\n\n录制时间：2026-11-16\n配套文档见仓库《README复现指南.md》与作品介绍文档。',
    }),
  });
  const j = await create.json();
  if (!create.ok) { console.error('创建 release 失败:', j.message, JSON.stringify(j.errors || '')); process.exit(1); }
  releaseId = j.id;
  console.log('已创建 release:', releaseId, j.html_url);
}

// 3. 流式上传视频附件
const stat = fs.statSync(VIDEO);
console.log('开始上传:', (stat.size / 1024 / 1024).toFixed(1), 'MB');
const started = Date.now();
const up = await fetch(
  `https://uploads.github.com/repos/${REPO}/releases/${releaseId}/assets?name=${ASSET_NAME}`,
  {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': String(stat.size) },
    body: fs.createReadStream(VIDEO),
    duplex: 'half',
  },
);
const res = await up.json();
if (!up.ok) { console.error('上传失败:', up.status, res.message); process.exit(1); }
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`上传完成（${secs}s，${(stat.size / 1024 / 1024 / secs * 60).toFixed(1)} MB/min）`);
console.log('在线播放页:', res.browser_download_url);
