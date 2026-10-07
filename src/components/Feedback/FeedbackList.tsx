import type { FeedbackItem } from '@/types';

const ICON: Record<FeedbackItem['severity'], { glyph: string; cls: string; sr: string }> = {
  good: { glyph: '✓', cls: 'text-ok bg-ok/10', sr: 'Good' },
  warning: { glyph: '!', cls: 'text-signal bg-signal/15', sr: 'Adjust' },
  error: { glyph: '×', cls: 'text-alert bg-alert/10', sr: 'Problem' },
};

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (!items.length) return <p className="text-sm text-muted">Start moving when you’re ready.</p>;
  return (
    <ul className="space-y-2" aria-live="polite">
      {items.map((f) => {
        const i = ICON[f.severity];
        return (
          <li key={f.message} className="fade-in flex items-start gap-2.5 text-sm">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${i.cls}`} aria-hidden="true">{i.glyph}</span>
            <span><span className="sr-only">{i.sr}: </span>{f.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
