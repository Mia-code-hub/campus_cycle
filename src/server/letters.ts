import { getDb } from './db';
import { chat, hasModelKey } from '@/lib/ai/client';
import { withAiLog } from '@/lib/ai/withAiLog';
import { buildLetterLogText, buildLetterPrompt } from '@/lib/ai/prompts';
import {
  composeTemplateLetter,
  ensureSignature,
  letterDate,
  normalizeLetterText,
  retryHint,
  validateLetter,
  type LetterCheck,
  type LetterContext,
} from '@/lib/letter';
import { categoryLabel } from '@/lib/constants';

// 感谢信编排层。
// 隐私边界在这里收口：路由只传 donationId，其余信息（物品、捐赠人、受赠人署名偏好）
// 全部由服务端按 id 自查，前端没有机会塞进任何字段。

export type LetterSource = 'ai' | 'template';

export interface LetterRow {
  id: number;
  donation_id: number;
  content: string;
  receiver_anonymous: number;
  source: LetterSource;
  issued_at: string;
}

export interface LetterDetail extends LetterRow {
  item_id: number;
  item_title: string;
  category: string;
  donor_id: number;
  donor_nickname: string;
  receiver_id: number;
  donated_at: string;
}

export interface DonationLetterContext extends LetterContext {
  donationId: number;
  itemId: number;
  donorId: number;
  receiverId: number;
  anonymous: boolean;
  college: string | null;
  grade: string | null;
}

export function letterModel(): string {
  return process.env.LLM_MODEL ?? 'qwen-plus';
}

/** 按 donationId 自查上下文；捐赠记录不存在返回 null */
export function loadLetterContext(donationId: number): DonationLetterContext | null {
  const row = getDb()
    .prepare(
      `SELECT d.id AS donationId, d.donor_id AS donorId, d.receiver_id AS receiverId,
              d.green_weight_kg AS weightKg, d.donated_at AS donatedAt,
              i.id AS itemId, i.title AS itemTitle, i.category AS category,
              i.condition_level AS condition,
              donor.nickname AS donorNickname,
              recv.nickname AS receiverNickname,
              recv.college AS college, recv.grade AS grade,
              COALESCE(recv.letter_anonymous, 1) AS anonymous
       FROM donations d
       JOIN items i ON i.id = d.item_id
       JOIN users donor ON donor.id = d.donor_id
       JOIN users recv ON recv.id = d.receiver_id
       WHERE d.id = ?`,
    )
    .get(donationId) as
    | {
        donationId: number;
        donorId: number;
        receiverId: number;
        weightKg: number;
        donatedAt: string;
        itemId: number;
        itemTitle: string;
        category: string;
        condition: string | null;
        donorNickname: string;
        receiverNickname: string;
        college: string | null;
        grade: string | null;
        anonymous: number;
      }
    | undefined;
  if (!row) return null;

  return {
    donationId: row.donationId,
    itemId: row.itemId,
    donorId: row.donorId,
    receiverId: row.receiverId,
    anonymous: row.anonymous === 1,
    college: row.college,
    grade: row.grade,
    donorNickname: row.donorNickname,
    // 匿名时连模型都拿不到受赠人昵称，杜绝「提示词里带名字、模型顺手写出来」
    receiverName: row.anonymous === 1 ? null : row.receiverNickname,
    itemTitle: row.itemTitle,
    categoryText: categoryLabel(row.category),
    conditionText: row.condition ?? '未标注',
    donatedAt: letterDate(row.donatedAt.slice(0, 10)),
    weightKg: row.weightKg,
  };
}

export function getLetterByDonation(donationId: number): LetterRow | null {
  const row = getDb()
    .prepare(
      'SELECT id, donation_id, content, receiver_anonymous, source, issued_at FROM letters WHERE donation_id = ?',
    )
    .get(donationId) as LetterRow | undefined;
  return row ?? null;
}

export function getLetterDetail(id: number): LetterDetail | null {
  const row = getDb()
    .prepare(
      `SELECT l.id, l.donation_id, l.content, l.receiver_anonymous, l.source, l.issued_at,
              i.id AS item_id, i.title AS item_title, i.category,
              d.donor_id, d.receiver_id, d.donated_at,
              donor.nickname AS donor_nickname
       FROM letters l
       JOIN donations d ON d.id = l.donation_id
       JOIN items i ON i.id = d.item_id
       JOIN users donor ON donor.id = d.donor_id
       WHERE l.id = ?`,
    )
    .get(id) as LetterDetail | undefined;
  return row ?? null;
}

/** 谁能看这封信：捐赠人、受赠人、管理员。其余人连存在性都不告诉。 */
export function canViewLetter(
  user: { id: number; role: string } | null,
  letter: LetterDetail,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.id === letter.donor_id || user.id === letter.receiver_id;
}

function writeLetter(
  donationId: number,
  content: string,
  anonymous: boolean,
  source: LetterSource,
): LetterRow {
  const db = getDb();
  // donation_id 唯一 + INSERT OR IGNORE：并发两次请求也只有一封，后来的直接读已有那封
  db.prepare(
    'INSERT OR IGNORE INTO letters (donation_id, content, receiver_anonymous, source) VALUES (?, ?, ?, ?)',
  ).run(donationId, content, anonymous ? 1 : 0, source);
  const row = getLetterByDonation(donationId);
  if (!row) throw new Error('感谢信写入失败');
  return row;
}

function upgradeLetter(id: number, content: string): LetterRow | null {
  const db = getDb();
  db.prepare("UPDATE letters SET content = ?, source = 'ai' WHERE id = ? AND source = 'template'").run(
    content,
    id,
  );
  const row = db
    .prepare(
      'SELECT id, donation_id, content, receiver_anonymous, source, issued_at FROM letters WHERE id = ?',
    )
    .get(id) as LetterRow | undefined;
  return row ?? null;
}

export interface GenerateLetterResult {
  ok: boolean;
  code?: 'NOT_FOUND' | 'api_error' | 'timeout' | 'parse_error';
  letter?: LetterRow;
  /** 命中了已存在的 AI 版本，本次没有再调用模型 */
  reused?: boolean;
  /** 用了模板兜底（模型不可用或多次不合格） */
  degraded?: boolean;
  errorKind?: string | null;
  model?: string;
  logIds?: number[];
}

const MAX_ATTEMPTS = 2;

/**
 * 生成（或复用）一封感谢信。
 * 幂等规则：
 *   - 已有 source='ai' 的信 → 直接返回，不再调用模型；
 *   - 已有模板兜底的信 → 默认也直接返回；只有显式传 retryTemplate 才再试一次 AI，
 *     成功后原地升级（不新增行）。这样「重复请求」既不会新建信，也不会重复烧模型调用；
 *   - 每次真正调用都写 ai_call_logs，连重试也在案（R15 的 Prompt 历史要用）。
 */
export async function generateLetter(
  donationId: number,
  opts: { userId?: number | null; retryTemplate?: boolean } = {},
): Promise<GenerateLetterResult> {
  const existing = getLetterByDonation(donationId);
  if (existing && existing.source === 'ai') {
    return { ok: true, letter: existing, reused: true, degraded: false, errorKind: null };
  }
  if (existing && !opts.retryTemplate) {
    return {
      ok: true,
      letter: existing,
      reused: true,
      degraded: true,
      errorKind: null,
    };
  }

  const ctx = loadLetterContext(donationId);
  if (!ctx) return { ok: false, code: 'NOT_FOUND' };

  const model = letterModel();
  const logIds: number[] = [];
  let lastKind: string | null = null;
  let lastCheck: LetterCheck | null = null;

  if (hasModelKey(model)) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const prompt = buildLetterPrompt(
        {
          donorNickname: ctx.donorNickname,
          receiverName: ctx.receiverName,
          itemTitle: ctx.itemTitle,
          categoryText: ctx.categoryText,
          conditionText: ctx.conditionText,
          donatedAt: ctx.donatedAt,
          weightKg: ctx.weightKg,
        },
        attempt > 0 && lastCheck ? retryHint(lastCheck) : undefined,
      );

      const result = await withAiLog<{ content: string }>({
        feature: 'letter',
        model,
        userId: opts.userId ?? null,
        refItemId: ctx.itemId,
        buildPrompt: () => buildLetterLogText(prompt),
        run: () =>
          chat({
            model,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            temperature: 0.7,
            maxTokens: 900,
            // 感谢信有明确的字数与口吻约束（平视、不煽情），不需要长推理链
            thinking: false,
          }),
        parse: (raw) => {
          const text = ensureSignature(normalizeLetterText(raw), ctx.donatedAt);
          const check = validateLetter(text, {
            anonymous: ctx.anonymous,
            receiverName: ctx.receiverName,
            college: ctx.college,
            grade: ctx.grade,
          });
          lastCheck = check;
          return check.ok ? { content: text } : null;
        },
      });
      logIds.push(result.logId);

      if (result.ok) {
        const letter = existing
          ? (upgradeLetter(existing.id, result.parsed.content) ?? getLetterByDonation(donationId))
          : writeLetter(donationId, result.parsed.content, ctx.anonymous, 'ai');
        return {
          ok: true,
          letter: letter ?? undefined,
          reused: false,
          degraded: false,
          errorKind: null,
          model,
          logIds,
        };
      }
      lastKind = result.kind;
      // 只有「模型答了但不合格」才值得重写；通道报错/超时立刻重试也只是白烧一次调用
      if (result.kind !== 'parse_error') break;
    }
  } else {
    lastKind = 'api_error';
  }

  // 模型这条路过不去（没密钥 / 超时 / 两版都不合格）：用平台模板兜底，
  // 保证「捐完东西一定有一封信」，页面之后再点一次还能升级成 AI 版。
  if (existing) {
    return {
      ok: true,
      letter: existing,
      reused: true,
      degraded: true,
      errorKind: lastKind,
      model,
      logIds,
    };
  }
  const letter = writeLetter(donationId, composeTemplateLetter(ctx), ctx.anonymous, 'template');
  return { ok: true, letter, reused: false, degraded: true, errorKind: lastKind, model, logIds };
}

/** 捐赠完成时自动触发；任何异常都吞掉，绝不能因为写信失败回滚交割 */
export async function ensureLetterQuietly(donationId: number): Promise<void> {
  try {
    await generateLetter(donationId, {});
  } catch {
    // 忽略：台账页再次点击时会重试
  }
}
