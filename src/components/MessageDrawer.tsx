'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';

interface Message {
  id: number;
  from_user_id: number;
  content: string;
  created_at: string;
  mine: boolean;
}

export default function MessageDrawer({ itemId }: { itemId: number }) {
  const router = useRouter();
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
          router.push(`/login?next=/items/${itemId}`);
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
  }, [open, itemId, router]);

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
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        联系 TA
      </Button>

      {/* 移动端整屏、桌面端右侧抽屉；Esc 关闭与焦点还原由原生 dialog 负责 */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="联系 TA"
        description="只在平台内沟通，别在私信里转账或留联系方式"
        size="drawer"
        footer={
          <div className="flex w-full flex-col gap-2">
            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
            <div className="flex w-full items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="输入消息内容"
                placeholder="输入消息…"
                maxLength={500}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={send}
                loading={sending}
                loadingText="发送中…"
                disabled={!input.trim()}
              >
                发送
              </Button>
            </div>
          </div>
        }
      >
        <div
          ref={bodyRef}
          role="log"
          aria-label="对话消息"
          aria-live="polite"
          className="flex min-h-full flex-col"
        >
          {messages.length === 0 && (
            <EmptyState
              compact
              art={null}
              title="还没有消息，打个招呼吧"
              description="问清楚成色、配件和自提地点，能省掉来回好几轮。"
            />
          )}
          {messages.map((m) => (
            <div key={m.id} className={`mb-3 flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-card-sm px-3 py-2 text-sm ${
                  m.mine ? 'bg-blush/60 text-ink' : 'bg-sunken text-ink ring-1 ring-line'
                }`}
              >
                <p className="break-words">{m.content}</p>
                <p className="mt-1 text-center text-[10px] text-ink-soft">
                  <span className="sr-only">{m.mine ? '我' : '对方'}在 </span>
                  {m.created_at.slice(11, 16)}
                  <span className="sr-only"> 发送</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
