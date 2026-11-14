'use client';

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  return (
    <button
      onClick={logout}
      aria-label="退出登录"
      className="rounded-card-sm px-3 py-1.5 text-ink-soft transition hover:bg-cream hover:text-ink"
    >
      退出
    </button>
  );
}
