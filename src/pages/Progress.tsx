import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { adherence, byDate, consistency, milestones, painSummary } from '@/services/analytics/trends';
import { ActivityHeatmap } from '@/components/Dashboard/ActivityHeatmap';
import { currentExercise, toSeries, trends } from '@/services/analytics/series';
import { getExercise } from '@/services/exercise/exercises';
import { TrendChart, RepsChart } from '@/components/Charts/TrendChart';
import { DemoBadge, Disclaimer, EmptyState, ErrorBox, PageHeader, Panel, Spinner, Trend } from '@/components/UI/primitives';
import { usePrefs } from '@/utils/prefs';
import { deg } from '@/utils/format';

export default function Progress() {
  const { user } = useAuth();
  const prefs = usePrefs();
  const { data, error, loading, retry } = useAsync(() => backends.data.listSessions(user!.id), [user?.id]);
  const all = useMemo(() => [...(data ?? [])].sort(byDate), [data]);
  const exerciseIds = useMemo(() => [...new Set(all.map((s) => s.exerciseId))], [all]);
  const [picked, setPicked] = useState<string | null>(null);

  if (loading) return <Spinner label="Loading progress…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!all.length) {
    return (
      <>
        <PageHeader title="Progress" />
        <EmptyState title="No sessions yet" body="Trends appear after your first recorded sessions." action={<Link className="btn-primary" to="/exercises">Choose an exercise</Link>} />
      </>
    );
  }

  const exId = picked ?? currentExercise(all)!;
  const ex = getExercise(exId);
  const sessions = all.filter((s) => s.exerciseId === exId);
  const series = toSeries(sessions);
  const t = trends(sessions);
  const c = consistency(all);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const pain = painSummary(sessions);
  const ref = prefs.showReferenceValues && ex?.referenceRom ? { value: ex.referenceRom.value, label: 'Reference' } : undefined;

  // Neutral, measurement-only statement. Never a clinical conclusion.
  const statement = sessions.length < 3
    ? 'More sessions are needed before a trend can be measured.'
    : t.rom === 'Improving' || t.form === 'Improving'
      ? 'Measured movement performance improved across recorded sessions.'
      : t.rom === 'Declining' || t.form === 'Declining'
        ? 'Measured movement performance decreased across recent sessions. Your therapist can review this with you.'
        : 'Measured movement performance was stable across recorded sessions.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Measured trends, session by session {all.some((s) => s.isDemoData) && <DemoBadge label="Includes demo data" />}</span>}
        actions={<>
          <select aria-label="Exercise" className="field !w-auto" value={exId} onChange={(e) => setPicked(e.target.value)}>
            {exerciseIds.map((id) => <option key={id} value={id}>{getExercise(id)?.name ?? id}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => window.print()}>⎙ Report / PDF</button>
        </>}
      />

      <Panel className="p-6">
        <p className="font-display text-xl leading-snug">{statement}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div><dt className="text-xs text-muted">ROM trend</dt><dd className="mt-1"><Trend label={t.rom} /></dd></div>
          <div><dt className="text-xs text-muted">Form trend</dt><dd className="mt-1"><Trend label={t.form} /></dd></div>
          <div><dt className="text-xs text-muted">First → latest ROM</dt><dd className="tabular mt-1 font-medium">{deg(first.averageRom)} → {deg(last.averageRom)}</dd></div>
          <div><dt className="text-xs text-muted">Consistency (7 days)</dt><dd className="tabular mt-1 font-medium">{c.active}/{c.days} days</dd></div>
          <div><dt className="text-xs text-muted">Reps completed</dt><dd className="tabular mt-1 font-medium">{adherence(sessions)}%</dd></div>
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Reported pain</h2>
              <p className="text-xs text-muted">0–10 after each session (self-reported)</p>
            </div>
            <div className="text-right text-sm">
              <div className="tabular text-2xl font-semibold">{pain.latest ?? '—'}<span className="text-sm text-muted">/10</span></div>
              <Trend label={pain.trend} />
            </div>
          </div>
          {series.pain.length ? <div className="mt-4"><TrendChart data={series.pain} unit="" domain={[0, 10]} color="violet" /></div>
            : <p className="mt-4 text-sm text-muted">Rate your pain after a session to see it here.</p>}
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">Activity</h2>
          <p className="mb-4 text-xs text-muted">All exercises · last 12 weeks</p>
          <ActivityHeatmap sessions={all} />
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">ROM trend over sessions</h2>
          <p className="text-xs text-muted">Average range of motion · {ex?.name}{ref ? ' · dashed line is an illustrative reference value, not a personal target' : ''}</p>
          <div className="mt-4"><TrendChart data={series.rom} unit="°" reference={ref} /></div>
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">Form score over sessions</h2>
          <p className="text-xs text-muted">Share of configured form rules met, averaged per session</p>
          <div className="mt-4"><TrendChart data={series.form} unit="%" domain={[0, 100]} color="signal" /></div>
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">Repetition consistency</h2>
          <p className="text-xs text-muted">Completed vs prescribed repetitions</p>
          <div className="mt-4"><RepsChart data={series.reps} /></div>
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">Exercise completion</h2>
          <p className="text-xs text-muted">Percent of prescribed repetitions completed</p>
          <div className="mt-4"><TrendChart data={series.completion} unit="%" domain={[0, 100]} /></div>
        </Panel>
      </div>

      <Panel className="p-6">
        <h2 className="font-semibold">Milestones</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {milestones(sessions).map((m) => (
            <li key={m.label} className="flex items-start gap-3 text-sm">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${m.achieved ? 'bg-ok/15 text-ok' : 'bg-sunken text-muted'}`} aria-hidden="true">{m.achieved ? '✓' : '·'}</span>
              <span><span className="font-medium">{m.label}</span><span className="block text-muted">{m.detail}</span></span>
            </li>
          ))}
        </ul>
      </Panel>
      <Disclaimer compact />
    </div>
  );
}
