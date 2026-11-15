import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { canViewLetter, getLetterDetail } from '@/server/letters';
import { categoryLabel } from '@/lib/constants';
import { letterDate } from '@/lib/letter';
import LetterExportButton from '@/components/letters/LetterExportButton';
import LetterUpgradeButton from '@/components/letters/LetterUpgradeButton';

export const instant = false;

const SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/letters/${encodeURIComponent(id)}`);

  const letterId = Number(id);
  const letter =
    Number.isSafeInteger(letterId) && letterId > 0 ? getLetterDetail(letterId) : null;
  // 无权查看时返回 404，不用 403：不向无关用户暴露「这封信存在」
  if (!letter || !canViewLetter(user, letter)) notFound();

  const anonymous = letter.receiver_anonymous === 1;
  const isTemplate = letter.source === 'template';

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">捐赠感谢信</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {letter.item_title} · {categoryLabel(letter.category)} ·{' '}
            {letterDate(letter.donated_at.slice(0, 10))} 交割
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/me/donations"
            className="rounded-card px-3 py-2 text-sm text-ink-soft transition hover:bg-panel hover:text-ink"
          >
            返回捐赠台账
          </Link>
          <LetterExportButton content={letter.content} itemTitle={letter.item_title} />
        </div>
      </div>

      {isTemplate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-lilac/30 px-4 py-3 text-sm text-ink">
          <span>这封是按平台模板生成的（生成时 AI 不可用），事实来自捐赠记录。</span>
          <LetterUpgradeButton donationId={letter.donation_id} />
        </div>
      )}

      <article
        className="letter-paper relative w-full overflow-hidden px-6 py-10 sm:px-14 sm:py-14"
        style={{ fontFamily: SERIF }}
      >
        <header className="flex flex-col items-center gap-3">
          <span className="text-[11px] tracking-[0.32em] text-ink-soft">
            校园闲置物资循环平台 · 电子感谢信
          </span>
          <span className="h-px w-full bg-line-strong" />
        </header>

        <div className="mt-9 whitespace-pre-wrap text-[15.5px] leading-[2.15] tracking-[0.02em] text-ink sm:text-base">
          {letter.content}
        </div>

        <footer className="mt-10 flex items-end justify-between gap-4 border-t border-paper-line pt-4">
          <p className="text-[11px] leading-5 text-ink-soft">
            本信依据平台捐赠记录生成，{anonymous ? '不公开受赠人的任何身份信息。' : '不公开受赠人学院与年级。'}
          </p>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-blush-deep/40 text-lg text-blush-deep/70">
            谢
          </span>
        </footer>
      </article>

      <p className="text-center text-xs text-ink-soft">
        信件编号 #{letter.id} · 生成于 {letter.issued_at.slice(0, 16)}
        {isTemplate ? ' · 模板' : ' · AI'}
      </p>
    </main>
  );
}
