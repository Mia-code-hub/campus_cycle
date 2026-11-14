import Link from 'next/link';

export default function EmptyState({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card-lg bg-panel py-16 text-center shadow-soft">
      <p className="text-ink-soft">{title}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="rounded-card bg-blush px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
