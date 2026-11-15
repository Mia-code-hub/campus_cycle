'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';

function resolveNext(): string {
  if (typeof window === 'undefined') return '/';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') ? next : '/';
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '登录失败，请重试');
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
      <Card radius="lg" padding="xl" tone="raise">
        <h1 className="text-2xl font-semibold tracking-tight">登录</h1>
        <p className="mt-2 text-sm text-ink-soft">登录后可发布闲置、申领与公益捐赠</p>

        <form onSubmit={onSubmit} aria-label="登录表单" className="mt-6 flex flex-col gap-4">
          <Input
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            placeholder="学号或自定义用户名"
          />
          <Input
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && <Alert tone="danger" title="登录失败">{error}</Alert>}

          <Button
            type="submit"
            size="lg"
            block
            loading={loading}
            loadingText="登录中…"
            className="mt-1"
          >
            登录
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          还没有账号？{' '}
          <Link href="/signup" className="text-blush-deep underline-offset-2 hover:underline">
            去注册
          </Link>
        </p>
      </Card>
    </main>
  );
}
