// 捐赠台账的导出格式：纯函数、零运行时依赖，node:test 直接断言。
// 台账是给老师、公益合作方、财务对账用的表，所以：
//   - 表头用中文，单位写在表头里，双击就能看懂；
//   - 全部字段加引号，物品名里有逗号也不会把表格撑坏；
//   - 以 = + - @ 开头的单元格加前缀，防止 Excel 把用户昵称当公式执行；
//   - 受赠人姓名导出时脱敏（屏幕上看全名，导出的文件里只有首字）；
//   - 末尾追加一行汇总，打印出来不用再自己按计算器。

export interface LedgerRow {
  id: number;
  donatedAt: string;
  applicationId: number | null;
  itemId: number;
  itemTitle: string;
  category: string;
  categoryLabel: string;
  conditionLevel: string | null;
  donorId: number;
  donorNickname: string;
  donorCollege: string | null;
  receiverId: number;
  receiverNickname: string;
  receiverCollege: string | null;
  weightKg: number;
  letterId: number | null;
  letterSource: 'ai' | 'template' | null;
}

export const LEDGER_COLUMNS = [
  '捐赠编号',
  '交割时间',
  '物品编号',
  '物品名称',
  '类别',
  '成色',
  '折算重量(kg)',
  '捐赠人',
  '捐赠人学院',
  '受赠人',
  '受赠人学院',
  '感谢信',
  '来源申请',
] as const;

const LETTER_TEXT: Record<string, string> = {
  ai: 'AI 生成',
  template: '模板兜底',
};

/** Excel / WPS 会把 = + - @ 开头的单元格当公式；前面垫一个单引号让它老老实实当文本 */
export function escapeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: unknown): string {
  if (value == null || value === '') return '""';
  const raw = typeof value === 'number' ? String(value) : escapeFormula(String(value));
  return `"${raw.replace(/"/g, '""')}"`;
}

/** 重量统一两位小数：台账要能直接求和，不能一会儿 2.5 一会儿 2.50 */
export function formatWeight(kg: number): string {
  return Number(kg ?? 0).toFixed(2);
}

/**
 * 受赠人姓名脱敏：保留首字，其余用 * 代替（张三 → 张*，欧阳小明 → 欧***）。
 * 导出件会离开系统（发给老师、合作方），屏幕上是管理员内部对账，不受影响；
 * 捐赠人保留原名——他们的贡献需要被署名，这也是台账存在的意义之一。
 */
export function maskName(name: string | null | undefined): string {
  const text = (name ?? '').trim();
  if (!text) return '未填写';
  const chars = [...text];
  if (chars.length === 1) return chars[0];
  return `${chars[0]}${'*'.repeat(chars.length - 1)}`;
}

export interface LedgerTotals {
  count: number;
  weightKg: number;
  donors: number;
  receivers: number;
  aiLetters: number;
  templateLetters: number;
  noLetter: number;
}

export function ledgerTotals(rows: LedgerRow[]): LedgerTotals {
  const donors = new Set<number>();
  const receivers = new Set<number>();
  let weightKg = 0;
  let aiLetters = 0;
  let templateLetters = 0;
  let noLetter = 0;
  for (const r of rows) {
    donors.add(r.donorId);
    receivers.add(r.receiverId);
    weightKg += Number(r.weightKg) || 0;
    if (r.letterSource === 'ai') aiLetters += 1;
    else if (r.letterSource === 'template') templateLetters += 1;
    else noLetter += 1;
  }
  return {
    count: rows.length,
    // 汇总行与明细行用同一套舍入，避免「明细加起来 7.15、合计写 7.149999」这种尴尬
    weightKg: Math.round(weightKg * 100) / 100,
    donors: donors.size,
    receivers: receivers.size,
    aiLetters,
    templateLetters,
    noLetter,
  };
}

export function toLedgerCsv(rows: LedgerRow[]): string {
  const lines = [LEDGER_COLUMNS.join(',')];

  for (const r of rows.slice().sort((a, b) => a.donatedAt.localeCompare(b.donatedAt) || a.id - b.id)) {
    lines.push(
      [
        r.id,
        r.donatedAt,
        r.itemId,
        r.itemTitle,
        r.categoryLabel,
        r.conditionLevel ?? '未标注',
        formatWeight(r.weightKg),
        r.donorNickname,
        r.donorCollege ?? '未填写',
        maskName(r.receiverNickname),
        r.receiverCollege ?? '未填写',
        r.letterSource ? (LETTER_TEXT[r.letterSource] ?? r.letterSource) : '未生成',
        r.applicationId ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const t = ledgerTotals(rows);
  // 汇总行：前两格放可读文案，后面把关键合计填进对应列位置，方便公式区直接引
  lines.push(
    [
      '合计',
      `${t.count} 条`,
      '',
      '',
      '',
      '',
      formatWeight(t.weightKg),
      `捐赠人 ${t.donors} 人`,
      '',
      `受赠人 ${t.receivers} 人`,
      '',
      `AI ${t.aiLetters} · 模板 ${t.templateLetters} · 未生成 ${t.noLetter}`,
      '',
    ]
      .map(csvCell)
      .join(','),
  );

  // CRLF：Excel 与 WPS 双击直接打开
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * 导出文件名：带上时间范围与导出时刻，一堆台账放在一起也分得清。
 * 文件名必须是纯 ASCII —— HTTP 头按 ByteString 处理，塞中文会让响应直接 500
 * （实测 `TypeError: Cannot convert argument to a ByteString`）。
 * 中文说明放在页面与 CSV 表头里，文件名保持英文本分。
 */
export function ledgerFileName(opts: { from?: string | null; to?: string | null; stamp: string }): string {
  const range = opts.from || opts.to ? `${opts.from ?? 'start'}_${opts.to ?? 'now'}` : 'all';
  return `donation-ledger-${range}-${opts.stamp}.csv`;
}

/** 只接受 YYYY-MM-DD，其余当没传：日期会拼进 SQL 参数，先卡形状再卡范围 */
export function normalizeDateParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : v;
}
