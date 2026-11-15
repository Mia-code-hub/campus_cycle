'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

export default function FavoriteButton({
  itemId,
  initialFavorited,
}: {
  itemId: number;
  initialFavorited: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/favorite`, { method: 'POST' });
      if (res.status === 401) {
        router.push(`/login?next=/items/${itemId}`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setFavorited(data.favorited);
        toast.push({
          tone: 'ok',
          title: data.favorited ? '已加入收藏' : '已取消收藏',
          key: `fav-${itemId}`,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label={favorited ? '取消收藏' : '收藏这件物品'}
      aria-pressed={favorited}
      className={`rounded-card px-5 py-3 transition disabled:opacity-60 ${
        favorited
          ? 'bg-blush/30 text-blush-deep ring-1 ring-blush-deep/40'
          : 'bg-panel text-ink-soft ring-1 ring-line-strong hover:text-blush-deep'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
