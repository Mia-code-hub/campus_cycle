import { chat, hasModelKey } from '@/lib/ai/client';
import { withAiLog } from '@/lib/ai/withAiLog';
import { buildSearchGuidePrompt, buildSearchLogText } from '@/lib/ai/prompts';
import { embedTexts } from '@/lib/ai/embed';
import { categoryLabel, modeLabel } from '@/lib/constants';
import { keywordSearch, searchItems, type RankedItem } from './retrieval';

// 语义搜索编排：query 向量化 → 检索（含业务加权）→ Top-8 交给 qwen-plus 写导购语。
// 任何一步失败都不报错给用户：向量挂了走关键词兜底，导购语挂了就不显示导购卡片。

export const SEARCH_TOP_K = 8;

export type SearchEngine = 'vector' | 'keyword';

export interface SearchOutcome {
  items: RankedItem[];
  guide: string;
  engine: SearchEngine;
  degraded: boolean;
  reason?: string;
}

// 模型偶尔会带 markdown、引号、换行，这里清成一段纯文本并兜住长度（要求 60-100 字）
const MAX_GUIDE = 100;

function normalizeGuide(raw: string): string | null {
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*#>`_]/g, '')
    .replace(/\s+/g, '')
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .trim();
  if (!text) return null;
  if (text.length <= MAX_GUIDE) return text;

  // 超长时优先在句号处截断，避免半句结尾
  const cut = text.slice(0, MAX_GUIDE);
  const lastStop = cut.lastIndexOf('。');
  if (lastStop >= 50) return cut.slice(0, lastStop + 1);
  return `${cut.replace(/[，、；：,]$/, '')}。`;
}

async function generateGuide(
  query: string,
  items: RankedItem[],
  viewerId: number | null,
): Promise<string> {
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (items.length === 0 || !hasModelKey(model)) return '';

  const prompt = buildSearchGuidePrompt(
    query,
    items.map((it) => ({
      title: it.title,
      categoryText: categoryLabel(it.category),
      condition: it.condition_level,
      modeText: modeLabel(it.mode),
      priceText: it.mode === 'donate' ? '免费' : `¥${it.price}`,
    })),
  );

  const res = await withAiLog<string>({
    feature: 'search',
    model,
    userId: viewerId,
    buildPrompt: () => buildSearchLogText(prompt),
    run: () =>
      chat({
        model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        maxTokens: 300,
        temperature: 0.4,
      }),
    parse: (raw) => normalizeGuide(raw),
  });

  return res.ok ? res.parsed : '';
}

export async function runSemanticSearch(
  query: string,
  viewerId: number | null,
): Promise<SearchOutcome> {
  const q = query.trim().slice(0, 100);
  if (!q) return { items: [], guide: '', engine: 'vector', degraded: false };

  const embedded = await embedTexts([q], { userId: viewerId });

  let items: RankedItem[];
  let engine: SearchEngine = 'vector';
  let degraded = false;
  let reason: string | undefined;

  if (embedded.ok) {
    items = searchItems(embedded.vectors[0], { topK: SEARCH_TOP_K, viewerId });
  } else {
    // 向量服务不可用：退回 2-gram 关键词召回，页面不空着
    items = keywordSearch(q, { topK: SEARCH_TOP_K, viewerId });
    engine = 'keyword';
    degraded = true;
    reason = '语义检索暂不可用，已按关键词召回';
  }

  const guide = await generateGuide(q, items, viewerId);
  return { items, guide, engine, degraded, reason };
}
