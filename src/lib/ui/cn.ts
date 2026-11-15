/**
 * 拼 className 的最小实现。
 * 不引 clsx / tailwind-merge：我们的组件只做「有则拼上、无则跳过」，
 * 没有同属性冲突需要后者去猜，多一个依赖不值得。
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const trimmed = v.trim();
    if (trimmed) out.push(trimmed);
  }
  return out.join(' ');
}
