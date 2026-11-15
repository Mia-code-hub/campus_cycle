/**
 * 导航高亮判定。
 * 抽成纯函数是为了能写测试：/me/donations 应该高亮「我的」，/admin 不该高亮任何学生端标签，
 * 这类规则散落在 JSX 里最容易一轮轮改歪。
 */

export interface NavItem {
  href: string;
  label: string;
  /** 除首页外都按前缀匹配，子路由仍算在父级标签下 */
  exact?: boolean;
}

/** 当前路径是否命中某个导航项 */
export function isNavActive(pathname: string, item: NavItem): boolean {
  const path = normalizePath(pathname);
  const href = normalizePath(item.href);
  if (item.exact || href === '/') return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/**
 * 从导航项里找出当前命中的那个（含子路由），用于 aria-current 与高亮。
 * 取「最长匹配」：/admin/donations 同时命中 /admin，但应该高亮更具体的台账。
 */
export function activeNavHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  for (const item of items) {
    if (!isNavActive(pathname, item)) continue;
    const href = normalizePath(item.href);
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}

/** 去掉查询串、hash 与结尾斜杠，/me/ 与 /me 视为同一个 */
export function normalizePath(input: string): string {
  const raw = (input || '/').split('#')[0].split('?')[0];
  if (!raw.startsWith('/')) return `/${raw}`.replace(/\/+$/, '') || '/';
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed || '/';
}
