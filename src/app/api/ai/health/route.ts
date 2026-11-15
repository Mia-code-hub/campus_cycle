import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { guardAi } from '@/server/rate-limit';
import { chat } from '@/lib/ai/client';
import { withAiLog } from '@/lib/ai/withAiLog';

// 健康检查：验证模型通道可用，并落一条 ai_call_logs 留痕。
//
// 只给管理员：这个接口会真打一次模型、写一行留痕，还会返回模型名与错误 kind。
// 对任意登录用户开放等于把通道拓扑送出去，也让谁都能把 ai_call_logs 灌大。
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权限' }, { status: 403 });
  }

  const limited = guardAi(req, { userId: user.id, scope: 'write' });
  if (limited) return limited;

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
