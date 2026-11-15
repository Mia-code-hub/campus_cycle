/**
 * Toast 队列的纯逻辑：入队、去重、限长、移除。
 * 组件负责渲染与计时器，这里只管数组怎么变，因此可以直接被 node:test 断言。
 */

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger';

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** 同一时刻重复点击（连点两次「已复制」）只保留一条 */
  key?: string;
  duration?: number;
}

export interface ToastItem extends Required<Pick<ToastInput, 'title'>> {
  id: number;
  tone: ToastTone;
  description?: string;
  key?: string;
  duration: number;
}

export const TOAST_MAX = 3;
export const TOAST_DURATION_MS = 4200;

/** 新的在最上面：视线落在右下角时先看到刚发生的事 */
export function enqueue(
  list: readonly ToastItem[],
  input: ToastInput,
  nextId: number,
): { list: ToastItem[]; item: ToastItem } {
  const item: ToastItem = {
    id: nextId,
    title: input.title,
    tone: input.tone ?? 'info',
    duration: input.duration ?? TOAST_DURATION_MS,
    ...(input.description ? { description: input.description } : {}),
    ...(input.key ? { key: input.key } : {}),
  };
  const deduped = input.key ? list.filter((t) => t.key !== input.key) : list.slice();
  const next = [item, ...deduped].slice(0, TOAST_MAX);
  return { list: next, item };
}

export function dismiss(list: readonly ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}
