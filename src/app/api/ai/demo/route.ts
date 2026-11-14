import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { chat } from '@/lib/ai/client';
import { safeParseJson } from '@/lib/ai/json';
import { withAiLog } from '@/lib/ai/withAiLog';
import { getRecentCalls } from '@/lib/ai/log';

// 演示路由：走通 prompt → chat → safeParseJson → withAiLog 留痕 的完整链路，
// 验证 ai_call_logs 写入。比赛交付前可删除。
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  const result = await withAiLog<{ ping: string }>({
    feature: 'report',
    model,
    userId: user.id,
    buildPrompt: () => '请严格返回一个 JSON 对象：{"ping":"pong"}，不要任何多余文字。',
    run: () =>
      chat({
        model,
        messages: [{ role: 'user', content: '请返回 {"ping":"pong"}' }],
        maxTokens: 64,
      }),
    parse: (raw) => safeParseJson<{ ping: string }>(raw),
  });

  const recent = getRecentCalls('report', 1);
  return NextResponse.json({
    ok: result.ok,
    model,
    ...(result.ok ? { parsed: result.parsed, raw: result.raw } : { kind: result.kind, message: result.message }),
    latencyMs: result.latencyMs,
    logId: result.logId,
    logged: recent.length > 0,
  });
}
