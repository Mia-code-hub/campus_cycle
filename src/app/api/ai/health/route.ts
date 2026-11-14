import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { chat } from '@/lib/ai/client';
import { withAiLog } from '@/lib/ai/withAiLog';

// 健康检查：验证 DASHSCOPE_API_KEY 是否可用，并落一条 ai_call_logs 留痕
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  const result = await withAiLog<string>({
    feature: 'health',
    model,
    userId: user.id,
    buildPrompt: () => '健康检查：请只回复 ok 两个字母，不要输出任何多余内容。',
    run: () =>
      chat({
        model,
        messages: [{ role: 'user', content: '请只回复 ok' }],
        maxTokens: 8,
      }),
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, model, latencyMs: result.latencyMs });
  }
  return NextResponse.json(
    { ok: false, kind: result.kind, model, latencyMs: result.latencyMs, message: result.message },
    { status: 502 },
  );
}
