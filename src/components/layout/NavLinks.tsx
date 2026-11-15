'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeNavHref, type NavItem } from '@/lib/ui/nav';
import { cn } from '@/lib/ui/cn';
import LogoutButton from './LogoutButton';

const LINKS: NavItem[] = [
  { href: '/search', label: '找物' },
  { href: '/donate', label: '公益' },
  { href: '/me', label: '我的' },
];

const ADMIN_LINKS: NavItem[] = [
  { href: '/admin', label: '看板' },
  { href: '/admin/aid', label: '帮扶' },
  { href: '/admin/violations', label: '复核' },
  { href: '/admin/ai-logs', label: '留痕' },
  { href: '/admin/donations', label: '台账' },
];

/**
 * 桌面导航。高亮与 aria-current 用同一份判定（isNavActive），
 * 不会出现「看着是高亮的、读屏却说不是当前页」这种两套逻辑。
 */
export default function NavLinks({
  isAdmin,
  nickname,
}: {
  isAdmin: boolean;
  nickname: string;
}) {
  const pathname = usePathname();
  const items = isAdmin ? [...LINKS, ...ADMIN_LINKS] : LINKS;
  const active = activeNavHref(pathname, items);

  const cls = (href: string) =>
    cn(
      'rounded-card-sm px-3 py-1.5 transition',
      active === href
        ? 'bg-sunken font-medium text-ink'
        : 'text-ink-soft hover:bg-sunken hover:text-ink',
    );

  return (
    <nav aria-label="主导航" className="hidden flex-1 items-center justify-end gap-1 md:flex">
      <span className="hidden px-2 text-xs text-ink-soft lg:inline">你好，{nickname}</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cls(item.href)}
          aria-current={active === item.href ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
      <LogoutButton />
    </nav>
  );
}
