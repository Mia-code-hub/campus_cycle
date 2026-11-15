import Link from 'next/link';
import { getCurrentUser } from '@/server/auth';
import LogoutButton from './LogoutButton';

// 服务端组件：直接读 cookie 解析当前用户，不调用 /api（避免客户端拿用户信息）
export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="sticky top-0 z-10 border-b border-black/5 bg-panel/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="shrink-0 text-base font-semibold tracking-tight">
          校园闲置循环
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto text-sm whitespace-nowrap">
          <Link
            href="/search"
            className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
          >
            找物
          </Link>
          <Link
            href="/donate"
            className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
          >
            公益
          </Link>
          {user ? (
            <>
              <span className="hidden px-2 text-ink-soft sm:inline">你好，{user.nickname}</span>
              {user.role === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
                  >
                    看板
                  </Link>
                  <Link
                    href="/admin/violations"
                    className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
                  >
                    复核
                  </Link>
                  <Link
                    href="/admin/ai-logs"
                    className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
                  >
                    留痕
                  </Link>
                </>
              )}
              <Link
                href="/me"
                className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
              >
                我的
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
              >
                登录
              </Link>
              <Link
                href="/signup"
                className="rounded-card-sm bg-blush px-3 py-1.5 font-medium text-ink transition hover:bg-blush-deep"
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
