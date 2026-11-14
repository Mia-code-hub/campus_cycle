'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import { aiEditedCode, badgeFor, type AiFill } from '@/lib/publish-ai';

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const STEPS = ['图片与描述', '类别成色价格', '转售或捐赠'];

interface AiPrice {
  low: number;
  high: number;
  suggested: number;
  reason?: string;
}

interface AnalyzeData {
  category: string;
  conditionLevel: string;
  title?: string;
  aiDesc?: string;
  tags?: string[];
  priceRange?: { low: number; high: number; suggested: number };
  priceReason?: string;
  donateTag?: string;
}

interface AnalyzeResponse {
  ok: boolean;
  degraded?: boolean;
  data?: AnalyzeData;
  message?: string;
}

// 把图压到最长边 1024px、jpeg 质量 0.8，再转 dataURL，减少 token 与耗时
function compressToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1024;
      let w = img.width;
      let h = img.height;
      if (w > max || h > max) {
        if (w >= h) {
          h = Math.round((h * max) / w);
          w = max;
        } else {
          w = Math.round((w * max) / h);
          h = max;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function FieldBadge({ state }: { state: 'AI' | '已修改' | null }) {
  if (!state) return null;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        state === 'AI' ? 'bg-lilac/40 text-ink' : 'bg-sky/40 text-ink'
      }`}
    >
      {state}
    </span>
  );
}

// 参考价区间条：low—high 渐变，suggested 打点，点一下填入价格框
function PriceRangeBar({ range, onPick }: { range: AiPrice; onPick: (v: number) => void }) {
  const span = Math.max(range.high - range.low, 1);
  const pct = Math.min(100, Math.max(0, ((range.suggested - range.low) / span) * 100));
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => onPick(range.suggested)}
        aria-label={`填入建议价 ${range.suggested} 元`}
        className="relative block h-2.5 w-full rounded-full bg-gradient-to-r from-sky/50 via-sky/80 to-blush transition hover:opacity-90"
      >
        <span
          className="absolute -top-[3px] h-4 w-4 rounded-full border-2 border-panel bg-ink shadow"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </button>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-soft">
        <span>¥{range.low}</span>
        <span>建议 ¥{range.suggested}</span>
        <span>¥{range.high}</span>
      </div>
    </div>
  );
}

export default function PublishForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [desc, setDesc] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [title, setTitle] = useState('');
  const [aiDesc, setAiDesc] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<'sale' | 'donate' | ''>('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [aiFill, setAiFill] = useState<AiFill | null>(null);
  const [aiPrice, setAiPrice] = useState<AiPrice | null>(null);
  const [aiDonateTag, setAiDonateTag] = useState('');
  const [donateTag, setDonateTag] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 当前表单值快照，用于和 AI 回填值比对出「AI / 已修改」徽章
  const current: AiFill = { category, condition, title, aiDesc, tags };

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
      setError('仅支持 jpg/png/webp 图片');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('图片不能超过 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setError('');
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '上传失败，请重试');
        setImagePreview('');
        setImagePath('');
        setSourceFile(null);
        return;
      }
      setImagePath(data.path);
      setSourceFile(file);
      setAiFill(null); // 换图后旧 AI 结果作废
    } catch {
      setError('上传失败，请检查网络');
      setImagePreview('');
      setImagePath('');
      setSourceFile(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // 统一的分析请求：sale 出估价、donate 出公益标签；失败只提示，绝不阻断
  async function requestAnalyze(analyzeMode: 'sale' | 'donate'): Promise<AnalyzeResponse | null> {
    if (!desc.trim()) return null;
    setAiNotice('');
    setAiLoading(true);
    try {
      let dataUrl = '';
      if (sourceFile) dataUrl = (await compressToDataUrl(sourceFile)) ?? '';
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desc: desc.trim(), imageDataUrl: dataUrl, mode: analyzeMode }),
      });
      const data = (await res.json().catch(() => null)) as AnalyzeResponse | null;
      if (!data?.ok || !data.data) {
        setAiNotice(data?.message ?? 'AI 暂不可用，已保留手动填写');
        return null;
      }
      return data;
    } catch {
      setAiNotice('AI 暂不可用，已保留手动填写');
      return null;
    } finally {
      setAiLoading(false);
    }
  }

  async function onAiFill() {
    if (aiLoading) return;
    const res = await requestAnalyze(mode === 'donate' ? 'donate' : 'sale');
    const d = res?.data;
    if (!d) return;
    const next: AiFill = {
      category: d.category,
      condition: d.conditionLevel,
      title: d.title ?? '',
      aiDesc: d.aiDesc ?? '',
      tags: d.tags ?? [],
    };
    setCategory(next.category);
    setCondition(next.condition);
    setTitle(next.title);
    setAiDesc(next.aiDesc);
    setTags(next.tags);
    setAiFill(next);

    setAiPrice(d.priceRange ? { ...d.priceRange, reason: d.priceReason } : null);
    // 价格框空着就顺手填建议价，用户可改
    if (d.priceRange && !price) setPrice(String(d.priceRange.suggested));
    setAiDonateTag(d.donateTag ?? '');
    setDonateTag(d.donateTag ?? '');

    setAiNotice(
      res?.degraded
        ? '已按文字描述生成，图片未参与识别，请核对细节'
        : 'AI 已填写，可直接修改后发布',
    );
  }

  // 捐赠模式下的公益标签：AI 生成失败也能手填
  async function onAiDonateTag() {
    if (aiLoading) return;
    const res = await requestAnalyze('donate');
    const tag = res?.data?.donateTag;
    if (!tag) {
      setAiNotice((prev) => prev || '没拿到公益标签，可手动填写');
      return;
    }
    setDonateTag(tag);
    setAiDonateTag(tag);
    setAiNotice('已生成公益标签，可修改');
  }

  const canNext = step === 1 ? desc.trim().length > 0 : !!category && !!condition;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    const aiEdited = aiEditedCode(aiFill, current);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: desc.trim(),
          category,
          conditionLevel: condition,
          mode,
          price: mode === 'sale' ? Number(price) : 0,
          imagePath,
          title,
          aiDesc,
          aiTags: tags,
          ai_edited: aiEdited,
          aiPriceLow: aiPrice?.low,
          aiPriceHigh: aiPrice?.high,
          donateTag,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '发布失败，请重试');
        return;
      }
      router.push(`/items/${data.id}`);
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label ?? '';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  i + 1 <= step ? 'bg-blush text-ink' : 'bg-panel text-ink-soft'
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${i + 1 <= step ? 'text-ink' : 'text-ink-soft'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-black/10" />}
            </div>
          ))}
        </div>

        {error && (
          <p className="rounded-card-sm bg-blush/20 px-4 py-2.5 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card-lg border-2 border-dashed border-black/10 bg-panel p-8 text-center transition hover:border-blush">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onFileChange}
              />
              {uploading ? (
                <span className="text-sm text-ink-soft">上传中…</span>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="已上传图片"
                  className="max-h-48 rounded-card object-contain"
                />
              ) : (
                <>
                  <span className="text-sm font-medium text-ink">点击上传图片（可选）</span>
                  <span className="text-xs text-ink-soft">jpg / png / webp，不超过 5MB</span>
                </>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-soft">一句话描述你的物品</span>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="例：高数上下册，九成新，笔记齐全"
                className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-card-lg bg-cream/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onAiFill}
                  disabled={aiLoading || !desc.trim()}
                  className={`rounded-card px-4 py-2 text-sm font-medium transition ${
                    aiLoading
                      ? 'cursor-wait bg-lilac/40 text-ink'
                      : 'bg-lilac/40 text-ink hover:bg-lilac/60 disabled:opacity-50'
                  }`}
                >
                  {aiLoading ? 'AI 正在识别…' : 'AI 帮我完善'}
                </button>
                {aiNotice && <span className="text-xs text-ink-soft">{aiNotice}</span>}
              </div>
              <p className="text-xs leading-relaxed text-ink-soft">
                {sourceFile
                  ? '会结合图片和你的描述生成；'
                  : '未上传图片，将只依据文字描述生成；'}
                AI 只写能确认的信息，不编造品牌型号。徽章「AI」表示 AI 填的，你改动后自动变「已修改」，不影响发布。
              </p>
            </div>

            {aiLoading && (
              <div className="flex flex-col gap-3 rounded-card-lg bg-panel p-4" aria-busy="true">
                <div className="h-8 w-1/2 animate-pulse rounded-card bg-cream" />
                <div className="h-8 w-2/3 animate-pulse rounded-card bg-cream" />
                <div className="h-20 w-full animate-pulse rounded-card bg-cream" />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                类别
                <FieldBadge state={badgeFor(aiFill, current, 'category')} />
              </span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${
                      category === c.value
                        ? 'bg-blush text-ink'
                        : 'bg-panel text-ink-soft hover:bg-cream'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                成色
                <FieldBadge state={badgeFor(aiFill, current, 'condition')} />
              </span>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${
                      condition === c
                        ? 'bg-sky text-ink'
                        : 'bg-panel text-ink-soft hover:bg-cream'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                标题
                <FieldBadge state={badgeFor(aiFill, current, 'title')} />
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                placeholder="AI 可自动生成，也可手动填写"
                className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                转让文案
                <FieldBadge state={badgeFor(aiFill, current, 'aiDesc')} />
              </span>
              <textarea
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="AI 可自动生成，也可手动填写"
                className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                标签
                <FieldBadge state={badgeFor(aiFill, current, 'tags')} />
              </span>
              <input
                type="text"
                value={tags.join('、')}
                onChange={(e) => setTags(e.target.value.split(/[，,、]/).filter(Boolean))}
                placeholder="例：教材、数学、九成新（用顿号分隔）"
                className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
            </label>

            {mode === 'donate' ? (
              <p className="rounded-card-sm bg-blush/15 px-3 py-2 text-xs text-ink-soft">
                已选公益捐赠，不需要定价。公益标签在下一步生成。
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm text-ink-soft">转售价（元）</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="转售才需要，捐赠免费"
                    className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
                  />
                </label>
                {aiPrice && (
                  <div className="rounded-card-lg border border-black/10 bg-panel px-3 py-2.5">
                    <div className="flex items-center justify-between text-xs text-ink-soft">
                      <span>
                        AI 参考价 ¥{aiPrice.low}–{aiPrice.high}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPrice(String(aiPrice.suggested))}
                        className="rounded-full bg-sky/40 px-2.5 py-0.5 text-[11px] font-medium text-ink transition hover:bg-sky/60"
                      >
                        填入建议价 ¥{aiPrice.suggested}
                      </button>
                    </div>
                    <PriceRangeBar range={aiPrice} onPick={(v) => setPrice(String(v))} />
                    {aiPrice.reason && (
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                        {aiPrice.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <span className="text-sm text-ink-soft">选择流转方式</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('sale')}
                className={`rounded-card-lg border-2 p-5 text-left transition ${
                  mode === 'sale' ? 'border-sky bg-sky/15' : 'border-black/10 bg-panel hover:border-sky'
                }`}
              >
                <span className="text-base font-semibold">低价转售</span>
                <p className="mt-1 text-sm text-ink-soft">低价卖给需要的同学</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('donate')}
                className={`rounded-card-lg border-2 p-5 text-left transition ${
                  mode === 'donate'
                    ? 'border-blush bg-blush/15'
                    : 'border-black/10 bg-panel hover:border-blush'
                }`}
              >
                <span className="text-base font-semibold">公益捐赠</span>
                <p className="mt-1 text-sm text-ink-soft">免费捐给通过审核的困难生</p>
              </button>
            </div>

            {mode === 'donate' && (
              <div className="flex flex-col gap-2 rounded-card-lg border border-black/10 bg-panel p-4">
                <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                  公益标签
                  <FieldBadge
                    state={
                      aiDonateTag ? (donateTag === aiDonateTag ? 'AI' : '已修改') : null
                    }
                  />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={donateTag}
                    onChange={(e) => setDonateTag(e.target.value)}
                    maxLength={20}
                    placeholder="例：教材援助 · 让知识继续流转"
                    className="min-w-0 flex-1 rounded-card-sm border border-black/10 bg-cream/40 px-3 py-2 text-sm outline-none focus:border-blush-deep"
                  />
                  <button
                    type="button"
                    onClick={onAiDonateTag}
                    disabled={aiLoading || !desc.trim()}
                    className="rounded-card bg-lilac/40 px-3 py-2 text-xs font-medium text-ink transition hover:bg-lilac/60 disabled:opacity-50"
                  >
                    {aiLoading ? '生成中…' : 'AI 生成'}
                  </button>
                </div>
                <p className="text-xs text-ink-soft">
                  会展示在捐赠页。不出现价格，也不出现「贫困」「资助」这类标签化表述。
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-card bg-panel px-5 py-2.5 text-sm text-ink transition hover:bg-cream"
            >
              上一步
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className="rounded-card bg-blush px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
            >
              下一步
            </button>
          ) : (
            <button
              type="submit"
              disabled={!mode || submitting}
              className="rounded-card bg-blush px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
            >
              {submitting ? '发布中…' : '发布'}
            </button>
          )}
        </div>
      </form>

      <aside className="w-full lg:w-80">
        <div className="rounded-card-lg bg-panel p-4 shadow-soft lg:sticky lg:top-20">
          <p className="mb-3 text-sm font-medium text-ink-soft">实时预览</p>
          <div className="overflow-hidden rounded-card bg-cream/70">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="物品预览"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-ink-soft">
                暂无图片
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {mode === 'donate' && (
              <span className="rounded-full bg-blush px-2.5 py-0.5 text-xs font-medium text-ink">
                公益捐赠
              </span>
            )}
            {mode === 'sale' && (
              <span className="rounded-full bg-sky px-2.5 py-0.5 text-xs font-medium text-ink">
                低价转售
              </span>
            )}
            {!mode && (
              <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs text-ink-soft">
                未选择方式
              </span>
            )}
          </div>
          <h3 className="mt-2 line-clamp-2 text-base font-medium">
            {title || desc.trim() || '一句话描述…'}
          </h3>
          {mode === 'donate' && donateTag && (
            <p className="mt-1 w-fit rounded-full bg-blush/30 px-2 py-0.5 text-[10px] text-ink">
              {donateTag}
            </p>
          )}
          {aiDesc && <p className="mt-1 line-clamp-3 text-xs text-ink-soft">{aiDesc}</p>}
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-lilac/30 px-2 py-0.5 text-[10px] text-ink">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {mode === 'donate' ? '免费' : price ? `¥${price}` : '¥—'}
            </span>
            <span className="text-xs text-ink-soft">
              {[categoryLabel, condition].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
