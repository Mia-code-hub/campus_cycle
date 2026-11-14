'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';

const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

const STEPS = ['图片与描述', '类别成色价格', '转售或捐赠'];

export default function PublishForm() {
  const [step, setStep] = useState(1);
  const [desc, setDesc] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<'sale' | 'donate' | ''>('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        return;
      }
      setImagePath(data.path);
    } catch {
      setError('上传失败，请检查网络');
      setImagePreview('');
      setImagePath('');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const canNext = step === 1 ? desc.trim().length > 0 : !!category && !!condition;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
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
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '发布失败，请重试');
        return;
      }
      window.location.href = `/items/${data.id}`;
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                title="下一轮接入"
                className="cursor-not-allowed rounded-card bg-lilac/40 px-4 py-2 text-sm font-medium text-ink opacity-50"
              >
                AI 帮我完善
              </button>
              <span className="text-xs text-ink-soft">下一轮接入</span>
            </div>
            {/* AI 识别结果骨架屏占位：R10 接入时在此渲染 */}
            <div className="hidden" data-ai-skeleton />

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-soft">类别</span>
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
              <span className="text-sm text-ink-soft">成色</span>
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
              <span className="text-sm text-ink-soft">转售价（元）</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="转售才需要，捐赠免费"
                className="rounded-card-sm border border-black/10 bg-panel px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
            </label>
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
            {desc.trim() || '一句话描述…'}
          </h3>
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
