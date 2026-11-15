import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { listDonationLedger } from '@/server/donations';
import {
  ledgerFileName,
  ledgerTotals,
  normalizeDateParam,
  toLedgerCsv,
} from '@/lib/donation-ledger';
import { CATEGORIES } from '@/lib/constants';

// GET /api/admin/donations/export?format=csv&from=2026-09-01&to=2027-01-31&category=textbook
// 捐赠台账导出：管理员限定。CSV 带 UTF-8 BOM，WPS / Excel 双击不乱码。

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权限' }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'csv').trim().toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { ok: false, code: 'INVALID_FORMAT', message: 'format 只能是 csv 或 json' },
      { status: 400 },
    );
  }

  const from = normalizeDateParam(url.searchParams.get('from'));
  const to = normalizeDateParam(url.searchParams.get('to'));
  const rawCategory = (url.searchParams.get('category') ?? '').trim();
  // 类别只接受枚举值，避免把任意字符串拼进 SQL 参数
  const category = CATEGORIES.some((c) => c.value === rawCategory) ? rawCategory : null;

  const rows = listDonationLedger({ from, to, category });
  const totals = ledgerTotals(rows);

  if (format === 'json') {
    return new NextResponse(
      JSON.stringify(
        { exportedAt: new Date().toISOString(), filter: { from, to, category }, totals, rows },
        null,
        2,
      ),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${ledgerFileName({ from, to, stamp: stamp() }).replace(/\.csv$/, '.json')}"`,
          'Cache-Control': 'no-store',
          'X-Row-Count': String(rows.length),
        },
      },
    );
  }

  return new NextResponse(`\ufeff${toLedgerCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${ledgerFileName({ from, to, stamp: stamp() })}"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(rows.length),
      'X-Total-Weight-Kg': String(totals.weightKg),
    },
  });
}
