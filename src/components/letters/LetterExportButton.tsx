'use client';

import { useState } from 'react';
import { exportFileName, wrapText } from '@/lib/letter-canvas';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { readPaintTokens } from '@/lib/ui/tokens';

const SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';

// 纯 canvas 导出：不引 html2canvas（省 200KB，也避免跨域字体/图片脏画布问题）。
// 版式与 /letters/[id] 的信纸保持一致：米白底、细双框、居中徽标、衬线正文。
export default function LetterExportButton({
  content,
  itemTitle,
}: {
  content: string;
  itemTitle: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const W = 1240;
      const PAD_X = 118;
      const PAD_TOP = 186;
      const FONT = 34;
      const LINE = 62;

      // 纸色、纸纹线、印章粉都从主题令牌读，导出图与网页上的信纸是同一套配色
      const paint = readPaintTokens();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-canvas');

      const fontSpec = `${FONT}px ${SERIF}`;
      ctx.font = fontSpec;
      const lines = wrapText(content, {
        maxWidth: W - PAD_X * 2,
        measure: (s) => ctx.measureText(s).width,
      });
      const H = Math.max(1754, PAD_TOP + lines.length * LINE + 280);

      // 改尺寸会重置绘图状态，先定尺寸再设样式
      canvas.width = W;
      canvas.height = H;
      ctx.font = fontSpec;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      // 纸底 + 双细框
      ctx.fillStyle = paint.paper;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = paint.lineStrong;
      ctx.lineWidth = 2;
      ctx.strokeRect(46, 46, W - 92, H - 92);
      ctx.strokeStyle = paint.paperLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(62, 62, W - 124, H - 124);

      // 顶部徽标
      ctx.fillStyle = paint.inkSoft;
      ctx.font = `500 22px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillText('校园闲置物资循环平台 · 电子感谢信', W / 2, 128);
      ctx.beginPath();
      ctx.moveTo(PAD_X, 154);
      ctx.lineTo(W - PAD_X, 154);
      ctx.strokeStyle = paint.line;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 正文
      ctx.textAlign = 'left';
      ctx.fillStyle = paint.ink;
      ctx.font = fontSpec;
      let y = PAD_TOP + FONT;
      for (const line of lines) {
        if (line) ctx.fillText(line, PAD_X, y);
        y += LINE;
      }

      // 页脚
      const footerY = H - 150;
      ctx.strokeStyle = paint.paperLine;
      ctx.beginPath();
      ctx.moveTo(PAD_X, footerY - 40);
      ctx.lineTo(W - PAD_X, footerY - 40);
      ctx.stroke();
      ctx.fillStyle = paint.inkSoft;
      ctx.font = `18px ${SERIF}`;
      ctx.fillText('本信依据平台捐赠记录生成，不公开受赠人身份信息', PAD_X, footerY);

      // 印章：同一支粉色笔画，用 globalAlpha 区分粗细与浓淡，省掉三个半透明色值
      const sealX = W - 168;
      const sealY = footerY - 4;
      ctx.strokeStyle = paint.blush;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(sealX, sealY, 46, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(sealX, sealY, 39, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = paint.blush;
      ctx.font = `500 34px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillText('谢', sealX, sealY + 12);
      ctx.globalAlpha = 1;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('toBlob-failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(itemTitle);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.push({
        tone: 'danger',
        title: '导出失败',
        description: '可以右键信纸另存为图片。',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={download} loading={busy} loadingText="正在导出…">
      下载为图片
    </Button>
  );
}
