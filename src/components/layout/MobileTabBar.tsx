'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavActive } from '@/lib/ui/nav';
import { cn } from '@/lib/ui/cn';
import { GiftIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from '@/components/ui/icons';

const TABS = [
  { href: '/', label: '首页', Icon: HomeIcon, exact: true },
  { href: '/search', label: '找物', Icon: SearchIcon },
  { href: '/publish', label: '发布', Icon: PlusIcon, primary: true },
  { href: '/donate', label: '公益', Icon: GiftIcon },
  { href: '/me', label: '我的', Icon: UserIcon },
];

/**
 * 移动端底部标签栏。桌面隐藏（md:hidden）。
 * 导航语义用 <nav aria-label> + aria-current="page"，读屏能说清「这是当前页」；
 * 触控区不小于 44px，底部留出 iOS 安全区，不然在全面屏上会被小白条压住。
 */
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="底部导航"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2">
        {TABS.map((tab) => {
          const active = isNavActive(pathname, tab);
          const Icon = tab.Icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition',
                  active ? 'font-medium text-ink' : 'text-ink-soft',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full transition',
                    tab.primary
                      ? '-mt-4 h-10 w-10 bg-blush text-ink shadow-lift'
                      : active
                        ? 'h-7 w-10 bg-sunken text-ink'
                        : 'h-7 w-10',
                  )}
                >
                  <Icon size={tab.primary ? 22 : 20} />
                </span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
