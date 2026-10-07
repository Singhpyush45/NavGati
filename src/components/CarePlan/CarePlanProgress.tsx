import { Link } from 'react-router-dom';
import type { PlanItemProgress, PlanProgress } from '@/services/analytics/carePlan';
import { startLink } from '@/services/analytics/carePlan';
import { Badge } from '@/components/UI/primitives';
import { deg } from '@/utils/format';

const STATUS: Record<PlanItemProgress['status'], { label: string; tone: 'ok' | 'tide' | 'signal' }> = {
  done: { label: 'Done for the week', tone: 'ok' },
  on_track: { label: 'On track', tone: 'tide' },
  behind: { label: 'Behind this week', tone: 'signal' },
};

/** Weekly care-plan progress. Patients get "Start" buttons; therapists get a read-only view. */
export function CarePlanProgress({ progress, mode }: { progress: PlanProgress; mode: 'patient' | 'therapist' }) {
  if (!progress.items.length) {
    return <p className="text-sm text-muted">{mode === 'patient' ? 'Your therapist hasn’t set a care plan yet.' : 'No care plan yet. Add exercises below.'}</p>;
  }
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={progress.weekAdherence} aria-valuemin={0} aria-valuemax={100} aria-label="Care plan completed this week">
          <div className="h-full rounded-full bg-gradient-to-r from-tide to-tide2 transition-all" style={{ width: `${progress.weekAdherence}%` }} />
        </div>
        <span className="tabular text-sm font-semibold">{progress.weekAdherence}%</span>
        <span className="text-xs text-muted">this week</span>
      </div>
      <ul className="space-y-3">
        {progress.items.map((p) => {
          const st = STATUS[p.status];
          return (
            <li key={p.item.exerciseId} className="rounded-xl border border-line/60 bg-sunken/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted">
                    {p.item.targetReps} reps · {p.item.sessionsPerWeek}×/week{p.item.side !== 'auto' ? ` · ${p.item.side} side` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.doneToday && <Badge tone="ok">✓ Today</Badge>}
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5" aria-label={`${p.done} of ${p.target} sessions this week`}>
                {Array.from({ length: p.target }, (_, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${i < p.done ? 'bg-tide' : 'bg-line/70'}`} />
                ))}
                <span className="tabular ml-2 text-xs text-muted">{p.done}/{p.target}</span>
              </div>
              {p.item.targetRom ? (
                <div className="mt-2 text-xs text-muted">
                  ROM goal {deg(p.item.targetRom)} · latest {deg(p.latestRom)}{p.romGoalPct != null ? ` (${p.romGoalPct}% of goal)` : ''}
                </div>
              ) : null}
              {p.item.instructions && <p className="mt-2 text-sm">“{p.item.instructions}”</p>}
              {mode === 'patient' && p.status !== 'done' && (
                <Link to={startLink(p.item)} className="btn-primary mt-3 !py-2 text-sm">{p.doneToday ? 'Do another session' : 'Start'}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
