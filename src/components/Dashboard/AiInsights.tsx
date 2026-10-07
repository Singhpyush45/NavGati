import type { SessionRecord } from '@/types';
import { detectAnomalies, forecastRom } from '@/services/analytics/predict';
import { Badge } from '@/components/UI/primitives';
import { deg, shortDate } from '@/utils/format';

/** Predictive + anomaly insights computed on-device from the patient's own history. */
export function AiInsights({ sessions, goal, exerciseName }: { sessions: SessionRecord[]; goal?: number | null; exerciseName?: string }) {
  const f = forecastRom(sessions, goal);
  const anomalies = detectAnomalies(sessions);
  const tone = f.confidence === 'High' ? 'ok' : f.confidence === 'Medium' ? 'tide' : 'neutral';
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line/60 bg-sunken/40 p-3">
          <div className="text-xs text-muted">ROM trend</div>
          <div className="tabular mt-0.5 text-2xl font-semibold">{f.n >= 4 ? `${f.perWeek > 0 ? '+' : ''}${f.perWeek}°` : '—'}<span className="text-sm font-normal text-muted"> / week</span></div>
        </div>
        <div className="rounded-xl border border-line/60 bg-sunken/40 p-3">
          <div className="text-xs text-muted">Predicted in 14 days</div>
          <div className="tabular mt-0.5 text-2xl font-semibold">{deg(f.in14Days)}</div>
        </div>
        <div className="rounded-xl border border-line/60 bg-sunken/40 p-3">
          <div className="text-xs text-muted">{goal ? `Goal ${deg(goal)}` : 'ROM goal'}</div>
          <div className="mt-0.5 text-lg font-semibold">
            {!goal ? <span className="text-muted">Set in care plan</span>
              : f.status === 'reached' ? 'Reached ✓'
              : f.goalDate ? <>~{shortDate(f.goalDate)} <span className="text-sm font-normal text-muted">({f.daysToGoal} days)</span></>
              : f.status === 'not_enough_data' ? <span className="text-muted">Need 4+ sessions</span>
              : <span className="text-signal">Not on course</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        Model: linear regression on the last {f.n} {exerciseName ?? ''} sessions · fit R² {f.r2} · <Badge tone={tone}>{f.confidence} confidence</Badge>
      </div>
      <div>
        <div className="text-sm font-medium">Anomaly check (latest session vs patient’s own baseline)</div>
        {anomalies.length ? (
          <ul className="mt-2 space-y-1.5 text-sm">{anomalies.map((a) => <li key={a.metric} className="rounded-lg bg-alert/10 px-3 py-1.5 text-alert">⚑ {a.message}</li>)}</ul>
        ) : <p className="mt-1 text-sm text-muted">{sessions.length >= 6 ? 'No unusual change detected.' : 'Needs at least 6 sessions.'}</p>}
      </div>
      <p className="text-xs text-muted">Statistical estimates to support the therapist — not a clinical prediction.</p>
    </div>
  );
}
