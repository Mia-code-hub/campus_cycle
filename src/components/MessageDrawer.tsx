'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface Message {
  id: number;
  from_user_id: number;
  content: string;
  created_at: string;
  mine: boolean;
}

export default function MessageDrawer({ itemId }: { itemId: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/items/${itemId}/messages`);
        if (res.status === 401) {
          window.location.href = `/login?next=/items/${itemId}`;
          return;
        }
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.ok) setMessages(data.messages);
      } catch {
        // 网络异常时保持现状，下个周期再试
      }
    }
    poll();
    const timer = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, itemId]);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/items/${itemId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setInput('');
        setMessages((prev) => [...prev, data.message]);
      } else {
        setError(data?.message ?? '发送失败');
      }
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-card bg-panel py-3 text-sm font-medium text-ink transition hover:bg-cream"
      >
        联系 TA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex justify-end bg-black/20"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col bg-panel shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="font-medium text-ink">联系 TA</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="关闭"
                className="text-ink-soft transition hover:text-ink"
              >
                ×
              </button>
            </div>

            <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="py-10 text-center text-xs text-ink-soft">还没有消息，打个招呼吧</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`mb-3 flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-card-sm px-3 py-2 text-sm ${
                      m.mine ? 'bg-blush text-ink' : 'border border-black/10 bg-cream text-ink'
                    }`}
                  >
                    <p className="break-words">{m.content}</p>
                    <p className="mt-1 text-center text-[10px] text-ink-soft">
                      {m.created_at.slice(11, 16)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-t border-black/5 p-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="输入消息…"
                maxLength={500}
                className="flex-1 rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-card-sm bg-blush px-4 py-2 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
              >
                {sending ? '发送中…' : '发送'}
              </button>
            </div>
            {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
