// 审核结论的归一化与合并规则。
// 单独成文件的原因：这里是唯一「可以拦下用户发布」的判定逻辑，必须能脱离 Next.js 单测。
// 因此本文件不引入任何运行时依赖（词表只作类型引用），与 analyze.ts / vector.ts 同一处理方式。

import type { BannedHit, RiskCategory } from '../banned-terms';

// 与 banned-terms.ts 的 RISK_CATEGORIES 保持一致（那边有单测做一致性校验）
export const MODERATION_CATEGORIES = [
  'ok',
  'prohibited',
  'dangerous',
  'medical',
  'animal',
  'indecent',
  'offcampus',
] as const;

export type ModerationCategory = 'ok' | RiskCategory;

const MAX_REASON = 50;
const DEFAULT_CONFIDENCE = 0.6;

/** 模型侧的原始判词（已归一化） */
export interface ModelVerdict {
  pass: boolean;
  category: ModerationCategory;
  reason: string;
  confidence: number;
}

/** 最终结论：模型 + 本地词表合并后的结果，也是接口返回给前端的结构 */
export interface ModerationDecision {
  pass: boolean;
  category: ModerationCategory;
  reason: string;
  confidence: number;
  /** 判定来源，便于答辩说明「哪一层拦下的」 */
  engine: 'model' | 'local' | 'hybrid' | 'fallback';
  hits: BannedHit[];
  /** 模型不可用而放行，必须进人工复核队列 */
  pendingReview: boolean;
  /** 模型放行但本地命中：记录模型漏判，后续可据此补 prompt */
  conflict: boolean;
}

const CATEGORY_ALIASES: Record<string, ModerationCategory> = {
  ok: 'ok',
  pass: 'ok',
  safe: 'ok',
  normal: 'ok',
  none: 'ok',
  prohibited: 'prohibited',
  banned: 'prohibited',
  dangerous: 'dangerous',
  hazardous: 'dangerous',
  medical: 'medical',
  medicine: 'medical',
  drug: 'medical',
  animal: 'animal',
  live: 'animal',
  indecent: 'indecent',
  porn: 'indecent',
  offcampus: 'offcampus',
  resale: 'offcampus',
};

const CATEGORY_TEXT: Record<string, string> = {
  prohibited: '违禁品',
  dangerous: '危险品',
  medical: '药品与医疗器械',
  animal: '活体动物',
  indecent: '不良内容',
  offcampus: '疑似校外倒卖',
};

export function categoryText(category: string): string {
  return CATEGORY_TEXT[category] ?? category;
}

function cleanReason(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*#>`_]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .trim();
  return text.length > MAX_REASON ? `${text.slice(0, MAX_REASON - 1)}…` : text;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONFIDENCE;
  // 模型偶尔给 85 这种百分数；1.2 / 1.7 属于超界小数，按越界截断而不是当百分数
  const c = n >= 5 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, Math.round(c * 100) / 100));
}

export function normalizeCategory(value: unknown): ModerationCategory | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? null;
}

/**
 * 把模型输出收敛成内部结构。
 * 返回 null = 这一轮没有可用判词（上层记 parse_error，走「放行 + 待复核」）。
 *
 * 两条保守规则：
 *   1. pass 与 category 矛盾时以「更严格」的一方为准 —— category 非 ok 一律视为不放行；
 *   2. pass=false 却给了 ok/非法类别时，归到 prohibited（未知违规），不能因为类别写错就放行。
 */
export function normalizeModerationOutput(raw: unknown): ModelVerdict | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const hasPass = typeof o.pass === 'boolean';
  const parsedCategory = normalizeCategory(o.category);
  if (!hasPass && parsedCategory === null) return null;

  const rawPass = hasPass ? (o.pass as boolean) : parsedCategory === 'ok';
  let category: ModerationCategory = parsedCategory ?? (rawPass ? 'ok' : 'prohibited');
  if (!rawPass && category === 'ok') category = 'prohibited';

  const pass = category === 'ok' && rawPass;
  const reason = cleanReason(o.reason) || (pass ? '未发现违规' : `判定为${categoryText(category)}`);

  return {
    pass,
    category,
    reason,
    confidence: clampConfidence(o.confidence),
  };
}

/** 本地命中 → 拦截理由。带上命中词，用户才知道该改哪里。 */
export function localReason(hit: BannedHit): string {
  return `命中本地关键词「${hit.term}」，${hit.hint}`;
}

/**
 * 合并顺序（严格优先）：
 *   本地命中          → 拦截（即使模型放行，也拦）
 *   模型判定不放行     → 拦截
 *   模型不可用（null） → 放行 + 待人工复核
 *   两边都放行         → 通过
 */
export function decideModeration(opts: {
  model: ModelVerdict | null;
  local: BannedHit[];
}): ModerationDecision {
  const { model, local } = opts;
  const hit = local.length > 0 ? local[0] : null;

  if (hit) {
    return {
      pass: false,
      category: hit.category,
      reason: localReason(hit),
      confidence: 1,
      engine: model ? 'hybrid' : 'local',
      hits: local,
      pendingReview: false,
      // 模型说放行、本地却命中，说明模型漏判，记下来
      conflict: !!model && model.pass,
    };
  }

  if (model && !model.pass) {
    return {
      pass: false,
      category: model.category,
      reason: model.reason,
      confidence: model.confidence,
      engine: 'model',
      hits: [],
      pendingReview: false,
      conflict: false,
    };
  }

  if (!model) {
    return {
      pass: true,
      category: 'ok',
      reason: 'AI 审核暂时不可用，已放行并标记待人工复核',
      confidence: 0,
      engine: 'fallback',
      hits: [],
      pendingReview: true,
      conflict: false,
    };
  }

  return {
    pass: true,
    category: 'ok',
    reason: model.reason,
    confidence: model.confidence,
    engine: 'model',
    hits: [],
    pendingReview: false,
    conflict: false,
  };
}

/**
 * 落库到 items.violation_reason 的一句话，管理员页直接展示。
 * 命中词不重复拼进来 —— 管理员页会用同一张词表对原文重新扫描（词表更新后信息也不会过期）。
 */
export function violationNote(
  decision: ModerationDecision,
  errorKind?: string | null,
): string | null {
  if (decision.pendingReview) {
    return `AI 审核不可用（${errorKind ?? 'unknown'}），已放行待人工复核`;
  }
  if (decision.pass) return null;
  return `${categoryText(decision.category)}｜${decision.reason}`;
}
