import Link from 'next/link';
import { getCurrentUser } from '@/server/auth';
import NavLinks from './NavLinks';

/**
 * 顶部导航（服务端组件，直接读 cookie 解析当前用户，不调 /api）。
 * 移动端只留品牌与登录入口，功能入口全部交给底部标签栏——两个导航同时出现会挤成两行。
 */
export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 rounded-card-sm text-base font-semibold tracking-tight"
        >
          校园闲置循环
        </Link>

        {user ? (
          <NavLinks isAdmin={user.role === 'admin'} nickname={user.nickname} />
        ) : (
          <nav
            aria-label="主导航"
            className="hidden flex-1 items-center justify-end gap-1 text-sm md:flex"
          >
            <Link
              href="/login"
              className="rounded-card-sm px-3 py-1.5 text-ink-soft transition hover:bg-sunken hover:text-ink"
            >
              登录
            </Link>
            <Link
              href="/signup"
              className="rounded-card-sm bg-blush px-3 py-1.5 font-medium text-ink transition hover:bg-blush-deep"
            >
              注册
            </Link>
          </nav>
        )}

        {/* 移动端右侧：登录后显示昵称（入口在底部标签栏的「我的」） */}
        <div className="flex min-w-0 flex-1 items-center justify-end md:hidden">
          {user ? (
            <span className="truncate text-xs text-ink-soft">{user.nickname}</span>
          ) : (
            <Link
              href="/login"
              className="rounded-card-sm bg-blush px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-blush-deep"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
