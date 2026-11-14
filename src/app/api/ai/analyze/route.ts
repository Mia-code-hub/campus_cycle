import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { chat, type ChatMessage } from '@/lib/ai/client';
import { safeParseJson } from '@/lib/ai/json';
import { withAiLog } from '@/lib/ai/withAiLog';
import { buildAnalyzePrompt } from '@/lib/ai/prompts';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
const CONDITION_VALUES = [...CONDITIONS];

export interface AnalyzeOutput {
  category: string;
  conditionLevel: string;
  title: string;
  aiDesc: string;
  tags: string[];
}

// 枚举白名单校验 + 非法值兜底；关键字段（title/aiDesc）都无法解析时返回 null（视为 parse_error）
function validateAnalyze(raw: unknown): AnalyzeOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const category = CATEGORY_VALUES.includes(o.category as string) ? (o.category as string) : 'other';
  const conditionLevel = CONDITION_VALUES.includes(o.conditionLevel as string)
    ? (o.conditionLevel as string)
    : '可用';
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 22) : '';
  const aiDesc = typeof o.aiDesc === 'string' ? o.aiDesc.trim() : '';
  const tags = Array.isArray(o.tags)
    ? o.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean).slice(0, 6)
    : [];
  if (!title && !aiDesc) return null;
  return { category, conditionLevel, title, aiDesc, tags };
}

// AI 辅助：图片 + 一句话描述 → 类别/成色/标题/文案/标签
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST', message: '请求体格式错误' }, { status: 400 });
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';

  const model = process.env.VLM_MODEL ?? 'qwen-vl-max';
  const prompt = buildAnalyzePrompt(desc, 'sale', imageDataUrl);
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user as unknown as ChatMessage['content'] },
  ];

  const result = await withAiLog<AnalyzeOutput>({
    feature: 'analyze',
    model,
    userId: user.id,
    buildPrompt: () => `${prompt.system}\n\n${JSON.stringify(prompt.user)}`,
    run: () => chat({ model, messages, maxTokens: 800 }),
    parse: (r) => validateAnalyze(safeParseJson(r)),
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, data: result.parsed });
  }
  return NextResponse.json(
    { ok: false, kind: result.kind, degraded: true, message: 'AI 暂不可用，请手动填写' },
    { status: 502 },
  );
}
