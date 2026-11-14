// 发布页 AI 回填的徽章判定：纯函数，保证「AI → 已修改」的口径只有一处。
// 与 items.ai_edited 的语义对应：0=没用 AI，1=AI 填且未改，2=AI 填后用户改过。

export type AiField = 'category' | 'condition' | 'title' | 'aiDesc' | 'tags';

export interface AiFill {
  category: string;
  condition: string;
  title: string;
  aiDesc: string;
  tags: string[];
}

export type BadgeState = 'AI' | '已修改' | null;

const FIELDS: AiField[] = ['category', 'condition', 'title', 'aiDesc', 'tags'];

// AI 是否为该字段给出过内容（没给过就不该有徽章）
function wasFilled(filled: AiFill, field: AiField): boolean {
  if (field === 'tags') return filled.tags.length > 0;
  return filled[field].trim().length > 0;
}

// 当前值与 AI 当时的值是否不同（标签按顺序比较，用户增删改都算改动）
function isChanged(filled: AiFill, current: AiFill, field: AiField): boolean {
  if (field === 'tags') return current.tags.join('\u0001') !== filled.tags.join('\u0001');
  return current[field].trim() !== filled[field].trim();
}

export function badgeFor(filled: AiFill | null, current: AiFill, field: AiField): BadgeState {
  if (!filled || !wasFilled(filled, field)) return null;
  return isChanged(filled, current, field) ? '已修改' : 'AI';
}

// 有任意一个 AI 填过的字段被改过 → ai_edited 记 2
export function anyFieldEdited(filled: AiFill | null, current: AiFill): boolean {
  if (!filled) return false;
  return FIELDS.some((f) => wasFilled(filled, f) && isChanged(filled, current, f));
}

// 用于提交时决定 ai_edited 取值
export function aiEditedCode(filled: AiFill | null, current: AiFill): 0 | 1 | 2 {
  if (!filled) return 0;
  return anyFieldEdited(filled, current) ? 2 : 1;
}
