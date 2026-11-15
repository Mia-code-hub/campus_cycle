import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { guardAi } from '@/server/rate-limit';
import { canUseVision, chat, hasModelKey, VISION_TIMEOUT_MS, type ChatMessage } from '@/lib/ai/client';
import { safeParseJson } from '@/lib/ai/json';
import { withAiLog, type AiResult } from '@/lib/ai/withAiLog';
import { buildAnalyzeLogText, buildAnalyzePrompt } from '@/lib/ai/prompts';
import { normalizeAnalyzeOutput, type AnalyzeOutput } from '@/lib/ai/analyze';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import { getAllPriceStats } from '@/server/price-stats';
import { prepareVisionDataUrl } from '@/server/vision-image';
import { REF_PRICE, buildPriceContext } from '@/lib/ref-price';

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);
const CONDITION_VALUES = [...CONDITIONS];

// dataURL 上限：压缩后通常 100-300KB，这里只是兜底，防止把 5MB 原图直接塞进请求
const MAX_IMAGE_DATA_URL = 6_000_000;
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

type RunResult = AiResult<AnalyzeOutput>;

// 一次完整的「组 prompt → 调用 → 解析 → 留痕」
function runAnalyze(p: {
  model: string;
  desc: string;
  mode: string;
  imageDataUrl: string;
  priceContext?: string;
  userId: number;
}): Promise<RunResult> {
  const prompt = buildAnalyzePrompt(p.desc, p.mode, p.imageDataUrl || undefined, p.priceContext);
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user as unknown as ChatMessage['content'] },
  ];
  return withAiLog<AnalyzeOutput>({
    feature: 'analyze',
    model: p.model,
    userId: p.userId,
    buildPrompt: () => buildAnalyzeLogText(prompt),
    // 带图的请求走视觉模型，通常 15–40s，用放宽的超时；纯文本 30s 够用
    run: () =>
      chat({
        model: p.model,
        messages,
        maxTokens: 800,
        temperature: 0.3,
        thinking: false,
        timeoutMs: p.imageDataUrl ? VISION_TIMEOUT_MS : undefined,
      }),
    parse: (raw) =>
      normalizeAnalyzeOutput(safeParseJson(raw), CATEGORY_VALUES, CONDITION_VALUES),
  });
}

// AI 辅助发布：图片 + 一句话描述 → 类别/成色/标题/文案/标签
// 任何失败都返回 502 + degraded，前端继续手填，发布流程不受影响。
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  // 一次发布最多会打 2 次（视觉失败退文本），额度按用户全局算
  const limited = guardAi(req, { userId: user.id, scope: 'write' });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请求体格式错误' },
      { status: 400 },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';
  // 捐赠不估价，只生成公益标签；缺省按转售处理
  const mode = body.mode === 'donate' ? 'donate' : 'sale';

  if (!desc) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_DESC', message: '请先写一句话描述，AI 才有依据' },
      { status: 400 },
    );
  }
  if (desc.length > 200) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_DESC', message: '描述过长（最多 200 字）' },
      { status: 400 },
    );
  }

  let image = '';
  if (imageDataUrl) {
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL || !DATA_URL_RE.test(imageDataUrl)) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_IMAGE', message: '图片数据格式不正确' },
        { status: 400 },
      );
    }
    image = await prepareVisionDataUrl(imageDataUrl);
  }

  const textModel = process.env.LLM_MODEL ?? 'deepseek-chat';
  const visionModel = process.env.VLM_MODEL ?? '';
  const useVision = !!image && canUseVision(visionModel);
  const primaryModel = useVision ? visionModel : textModel;

  // 连当前通道都没配密钥：不发起请求，直接让前端手填
  if (!hasModelKey(primaryModel)) {
    return NextResponse.json(
      {
        ok: false,
        code: 'AI_NOT_CONFIGURED',
        degraded: true,
        fallbackFields: [],
        reason: 'not_configured',
        message: 'AI 暂不可用，请手动填写',
      },
      { status: 502 },
    );
  }

  // 定价参考：同类目已成交均价（样本够）+ 内置经验区间（样本不足），一次查询带全部类目
  const priceContext =
    mode === 'donate' ? undefined : buildPriceContext({ stats: getAllPriceStats(), refPrice: REF_PRICE });

  let result = await runAnalyze({
    model: primaryModel,
    desc,
    mode,
    imageDataUrl: useVision ? image : '',
    priceContext,
    userId: user.id,
  });
  // 图片理解失败（超时 / 通道不可用 / 返回乱码）→ 退回纯文本再试一次，
  // 用户至少能拿到标题和文案，界面标记 degraded 提示核对。
  let degraded = !useVision;
  if (!result.ok && useVision && hasModelKey(textModel)) {
    result = await runAnalyze({
      model: textModel,
      desc,
      mode,
      imageDataUrl: '',
      priceContext,
      userId: user.id,
    });
    degraded = true;
  }

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      data: result.parsed,
      mode,
      degraded,
      modelUsed: useVision && !degraded ? visionModel : textModel,
      latencyMs: result.latencyMs,
      logId: result.logId,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      kind: result.kind,
      degraded: true,
      fallbackFields: [],
      message: 'AI 暂不可用，请手动填写',
    },
    { status: 502 },
  );
}
