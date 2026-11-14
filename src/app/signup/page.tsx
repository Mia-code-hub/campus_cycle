'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

function resolveNext(): string {
  if (typeof window === 'undefined') return '/';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') ? next : '/';
}

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, nickname, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '注册失败，请重试');
        return;
      }
      window.location.href = resolveNext();
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-card-lg bg-panel p-8 shadow-soft">
        <h1 className="text-2xl font-semibold tracking-tight">注册</h1>
        <p className="mt-2 text-sm text-ink-soft">加入校园闲置循环，让好物在校内流动</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">用户名（4-20 位）</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">昵称</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              className="rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">密码（至少 6 位）</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-card bg-blush py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-60"
          >
            {loading ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          已有账号？{' '}
          <Link href="/login" className="text-blush-deep underline-offset-2 hover:underline">
            去登录
          </Link>
        </p>
      </div>
    </main>
  );
}
