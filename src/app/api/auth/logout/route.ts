import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentSessionToken, revokeSession, SESSION_COOKIE } from '@/server/auth';

export async function POST() {
  // 只删浏览器 cookie 是不够的：偷走的令牌在服务端仍然有效。
  // 先把 jti 标记为已吊销，再清 cookie。
  revokeSession(await currentSessionToken());

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
