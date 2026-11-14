import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { listAiLogsForExport, normalizeFeature } from '@/server/ai-logs';
import { buildExportPayload, toCsv } from '@/lib/ai-log-view';

// GET /api/admin/ai-logs/export?format=json|csv&feature=analyze
// 导出的是「原文」：prompt_text / response_text 不做截断，比赛材料要能逐字对照。

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function localIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
  const format = (url.searchParams.get('format') ?? 'json').trim().toLowerCase();
  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json(
      { ok: false, code: 'INVALID_FORMAT', message: 'format 只能是 json 或 csv' },
      { status: 400 },
    );
  }

  const feature = normalizeFeature(url.searchParams.get('feature'));
  const rows = listAiLogsForExport(feature);
  const suffix = feature ? `-${feature}` : '';

  if (format === 'csv') {
    // BOM：Excel / WPS 双击打开时中文表头才不乱码
    const body = `\ufeff${toCsv(rows)}`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-call-logs${suffix}-${stamp()}.csv"`,
        'Cache-Control': 'no-store',
        'X-Log-Count': String(rows.length),
      },
    });
  }

  const payload = buildExportPayload(rows, {
    feature,
    exportedAt: localIso(),
    source: process.env.DATABASE_PATH ?? './data/campus.db',
  });
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ai-call-logs${suffix}-${stamp()}.json"`,
      'Cache-Control': 'no-store',
      'X-Log-Count': String(rows.length),
    },
  });
}
