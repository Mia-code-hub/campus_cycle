import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { listAidApplications } from '@/server/aid';

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权限' }, { status: 403 });
  }

  const applications = listAidApplications();
  return NextResponse.json({ ok: true, applications });
}
