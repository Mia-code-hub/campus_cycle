import { NextResponse } from 'next/server';
import { getCurrentUser, requireAdmin } from '@/server/auth';
import { getDb } from '@/server/db';
import { getPlatformStats, statsCaliber } from '@/server/stats';

// 平台统计聚合：总览 / 月度趋势 / 类别分布 / 转售与捐赠占比。
// 全部 SQL 在服务端算完，前端只负责画；返回值带上 caliber，谁问「这个数怎么来的」都能当场答。
// 读到 cookie 就已经是动态路由，本项目开了 cacheComponents，不能再写 export const dynamic。

const MIN_MONTHS = 1;
const MAX_MONTHS = 24;
const DEFAULT_MONTHS = 6;

function parseMonths(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_MONTHS;
  return Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.trunc(n)));
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    // 未登录 401、登录但非管理员 403：混成一个码会让前端没法区分「该去登录」还是「你没权限」
    const user = await getCurrentUser();
    return user
      ? NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '仅管理员可查看统计' }, { status: 403 })
      : NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  const months = parseMonths(new URL(req.url).searchParams.get('months'));
  const stats = getPlatformStats(getDb(), { months });

  return NextResponse.json({
    ok: true,
    ...stats,
    caliber: statsCaliber(months),
  });
}
