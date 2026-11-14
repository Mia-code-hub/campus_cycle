import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDb } from './db';
import { canUseVision, chat, hasModelKey, type ChatMessage } from '@/lib/ai/client';
import { safeParseJson } from '@/lib/ai/json';
import { withAiLog } from '@/lib/ai/withAiLog';
import { buildModerateLogText, buildModeratePrompt } from '@/lib/ai/prompts';
import {
  decideModeration,
  normalizeModerationOutput,
  type ModelVerdict,
  type ModerationDecision,
} from '@/lib/ai/moderate';
import { scanBannedTerms, type BannedHit } from '@/lib/banned-terms';

// 审核编排层：本地词表 + 模型判定，两条路都走完再合并（严格优先）。
// 放在 server 侧而不是路由里，是因为发布接口和 /api/ai/moderate 必须用同一套判定，
// 否则前端预检通过、提交却被拦，用户会以为是随机 bug。

// 图片超过这个体积就不送模型了（转 base64 会再涨 33%），改走纯文本判定并在结果里注明
const MAX_IMAGE_BYTES = 900_000;
const UPLOAD_RE = /^\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i;
const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function moderationModels(): { text: string; vision: string } {
  return {
    text: process.env.LLM_MODEL ?? 'qwen-plus',
    vision: process.env.VLM_MODEL ?? '',
  };
}

/** 把已上传的图片读成 dataURL 交给视觉模型；任何异常都返回空串（退回纯文本判定） */
export async function uploadToDataUrl(imagePath: string): Promise<string> {
  if (!imagePath || !UPLOAD_RE.test(imagePath)) return '';
  try {
    const abs = resolve(process.cwd(), 'public', imagePath.replace(/^\//, ''));
    const buf = await readFile(abs);
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return '';
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mime = MIME_BY_EXT[ext] ?? 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

export interface ModerateInput {
  title: string;
  desc: string;
  imageDataUrl?: string;
  userId?: number | null;
  refItemId?: number | null;
}

export interface ModerateRun {
  decision: ModerationDecision;
  /** 模型不可用或判词无法解析时为 null */
  verdict: ModelVerdict | null;
  model: string;
  logId: number | null;
  latencyMs: number;
  /** 模型失败的类型（api_error / timeout / parse_error），成功时为 null */
  errorKind: string | null;
  /** 图片太大或读取失败，本轮只按文本判 */
  imageSkipped: boolean;
}

function runModerate(p: {
  model: string;
  title: string;
  desc: string;
  imageDataUrl: string;
  userId?: number | null;
  refItemId?: number | null;
}) {
  const prompt = buildModeratePrompt(p.title, p.desc, p.imageDataUrl || undefined);
  const messages: ChatMessage[] = [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user as unknown as ChatMessage['content'] },
  ];
  return withAiLog<ModelVerdict>({
    feature: 'moderate',
    model: p.model,
    userId: p.userId ?? null,
    refItemId: p.refItemId ?? null,
    buildPrompt: () => buildModerateLogText(prompt),
    // 审核要稳定复现，温度压到 0
    run: () => chat({ model: p.model, messages, maxTokens: 300, temperature: 0 }),
    parse: (raw) => normalizeModerationOutput(safeParseJson(raw)),
  });
}

export async function moderateListing(input: ModerateInput): Promise<ModerateRun> {
  const { text: textModel, vision: visionModel } = moderationModels();
  const local: BannedHit[] = scanBannedTerms(`${input.title}\n${input.desc}`);
  const image = input.imageDataUrl ?? '';
  const useVision = !!image && canUseVision(visionModel);
  const primary = useVision ? visionModel : textModel;

  const started = Date.now();
  let result = await runModerate({
    model: primary,
    title: input.title,
    desc: input.desc,
    imageDataUrl: useVision ? image : '',
    userId: input.userId,
    refItemId: input.refItemId,
  });
  let model = primary;
  // 识图失败（超时 / 通道挂 / 返回乱码）→ 退回纯文本再判一次，
  // 文字描述往往已经足够定性，比直接进人工复核队列更省事。
  if (!result.ok && useVision && hasModelKey(textModel)) {
    result = await runModerate({
      model: textModel,
      title: input.title,
      desc: input.desc,
      imageDataUrl: '',
      userId: input.userId,
      refItemId: input.refItemId,
    });
    model = textModel;
  }

  const verdict = result.ok ? result.parsed : null;
  return {
    decision: decideModeration({ model: verdict, local }),
    verdict,
    model,
    logId: result.logId,
    latencyMs: Date.now() - started,
    errorKind: result.ok ? null : result.kind,
    imageSkipped: !!input.imageDataUrl && !useVision,
  };
}

// ——— 管理员复核队列 ———

export interface ViolationRow {
  id: number;
  title: string;
  raw_desc: string | null;
  ai_desc: string | null;
  category: string;
  mode: string;
  price: number;
  image_path: string | null;
  status: string;
  violation_flag: number;
  violation_reason: string | null;
  created_at: string;
  owner_nickname: string;
  owner_username: string;
}

// flag=2（模型故障待复核）排前面，让管理员先处理最不确定的那批
export function listViolationItems(): ViolationRow[] {
  return getDb()
    .prepare(
      `SELECT i.id, i.title, i.raw_desc, i.ai_desc, i.category, i.mode, i.price, i.image_path,
              i.status, i.violation_flag, i.violation_reason, i.created_at,
              u.nickname AS owner_nickname, u.username AS owner_username
       FROM items i
       JOIN users u ON u.id = i.owner_id
       WHERE i.violation_flag > 0
       ORDER BY i.violation_flag DESC, i.id DESC`,
    )
    .all() as ViolationRow[];
}

/**
 * 人工处置：
 *   remove  → 下架（status=removed, flag=1），保留审核依据便于追溯
 *   restore → 恢复上架（status=listed, flag=0），清空审核依据
 */
export function reviewViolation(itemId: number, action: 'remove' | 'restore'): boolean {
  const db = getDb();
  if (action === 'remove') {
    const info = db
      .prepare(
        `UPDATE items
            SET status = 'removed', violation_flag = 1,
                violation_reason = COALESCE(violation_reason, '管理员人工下架')
          WHERE id = ? AND status <> 'removed'`,
      )
      .run(itemId);
    return info.changes > 0;
  }
  if (action === 'restore') {
    const info = db
      .prepare(
        `UPDATE items
            SET status = 'listed', violation_flag = 0, violation_reason = NULL
          WHERE id = ? AND violation_flag > 0`,
      )
      .run(itemId);
    return info.changes > 0;
  }
  return false;
}

/** 管理员页每条记录实时重扫一遍词表，词表更新后旧记录也能显示最新命中 */
export function rescanItem(row: ViolationRow): BannedHit[] {
  return scanBannedTerms(`${row.title}\n${row.raw_desc ?? ''}\n${row.ai_desc ?? ''}`);
}
