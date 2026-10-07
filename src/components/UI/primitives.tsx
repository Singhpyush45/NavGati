import type { ReactNode } from 'react';
import { CountUp } from '@/components/FX/motion';

export function Panel({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`panel ${className}`}>{children}</As>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-enter mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">{title}</h1>
        <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-tide via-tide2 to-violet" aria-hidden="true" />
        {subtitle && <div className="mt-3 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'tide' | 'signal' | 'alert' | 'ok';
const toneCls: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  tide: 'bg-tideSoft text-tide',
  signal: 'bg-signal/15 text-signal',
  alert: 'bg-alert/10 text-alert',
  ok: 'bg-ok/10 text-ok',
};
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneCls[tone]}`}>{children}</span>;
}

export function DemoBadge({ label = 'Demo data' }: { label?: string }) {
  return (
    <Badge tone="signal">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.5" /></svg>
      {label}
    </Badge>
  );
}

export function Stat({ label, value, sub, emphasis = false }: { label: string; value: ReactNode; sub?: ReactNode; emphasis?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular mt-1 font-semibold tracking-tight ${emphasis ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Spinner({ label, compact = false }: { label?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm" role="status">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        {label ?? 'Loading…'}
      </div>
    );
  }
  return (
    <div className="space-y-3" role="status" aria-label={label ?? 'Loading'}>
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-tide2" />
        {label ?? 'Loading…'}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="shimmer h-24 rounded-panel" />)}
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-alert/30 bg-alert/10 px-4 py-3 text-sm text-alert">
      <span>{message}</span>
      {onRetry && <button className="btn-secondary !py-1.5" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel page-enter border-dashed px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-tide/20 to-tide2/20 text-tide float" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 18l5-6 4 3 7-9" /></svg>
      </div>
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`text-muted ${compact ? 'text-xs' : 'text-sm'}`}>
      NavGati is a rehabilitation monitoring and decision-support prototype. It does not replace professional medical diagnosis or clinical judgment.
    </p>
  );
}

export function Trend({ label }: { label: string }) {
  const map: Record<string, { tone: Tone; arrow: string }> = {
    Improving: { tone: 'ok', arrow: '↗' },
    Stable: { tone: 'tide', arrow: '→' },
    Declining: { tone: 'alert', arrow: '↘' },
    Decreasing: { tone: 'ok', arrow: '↘' },
    Increasing: { tone: 'alert', arrow: '↗' },
  };
  const m = map[label] ?? { tone: 'neutral' as Tone, arrow: '·' };
  return <Badge tone={m.tone}><span aria-hidden="true">{m.arrow}</span>{label}</Badge>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${value === o.value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
