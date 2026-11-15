'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // replace 而非 push：退出后不该还能「后退」回到已登录的页面
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} aria-label="退出登录">
      退出
    </Button>
  );
}
