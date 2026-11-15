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
      <Card radius="lg" padding="xl" tone="raise">
        <h1 className="text-2xl font-semibold tracking-tight">注册</h1>
        <p className="mt-2 text-sm text-ink-soft">加入校园闲置循环，让好物在校内流动</p>

        <form onSubmit={onSubmit} aria-label="注册表单" className="mt-6 flex flex-col gap-4">
          <Input
            label="用户名"
            hint="4-20 位，登录时使用"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            label="昵称"
            hint="展示给同学看的名字"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            autoComplete="nickname"
          />
          <Input
            label="密码"
            type="password"
            hint="至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && <Alert tone="danger" title="注册失败">{error}</Alert>}

          <Button type="submit" size="lg" block loading={loading} loadingText="注册中…" className="mt-1">
            注册
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          已有账号？{' '}
          <Link href="/login" className="text-blush-deep underline-offset-2 hover:underline">
            去登录
          </Link>
        </p>
      </Card>
    </main>
  );
}
