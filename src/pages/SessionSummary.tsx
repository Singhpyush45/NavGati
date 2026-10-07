import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { SessionRecord } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { formatDuration } from '@/services/analytics/trends';
import { Badge, DemoBadge, Disclaimer, EmptyState, ErrorBox, PageHeader, Panel, Spinner, Stat } from '@/components/UI/primitives';
import { TrendChart } from '@/components/Charts/TrendChart';
import { dateTime, deg, pct } from '@/utils/format';
import { SessionFeedbackForm } from '@/components/Feedback/SessionFeedbackForm';
import { Confetti } from '@/components/FX/motion';

interface NavState { justSaved?: boolean; record?: SessionRecord; saveError?: string }

export default function SessionSummary() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = (useLocation().state ?? {}) as NavState;
  const [saveState, setSaveState] = useState<'saved' | 'failed' | 'retrying' | null>(nav.justSaved ? 'saved' : nav.saveError ? 'failed' : null);
  const [saveError, setSaveError] = useState(nav.saveError ?? null);

  // If we arrived straight from a live session we already have the record; otherwise load it.
  const { data, error, loading, retry } = useAsync(
    () => (nav.record && nav.record.id === id ? Promise.resolve(nav.record) : backends.data.getSession(id!)),
    [id],
  );

  if (loading) return <Spinner label="Loading session…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  const s = data;
  if (!s) return <EmptyState title="Session not found" body="It may have been removed, or it belongs to another account." action={<Link className="btn-secondary" to="/">Go back</Link>} />;
  if (user?.role === 'PATIENT' && s.patientId !== user.id) {
    return <EmptyState title="Not available" body="You can only view your own sessions." />;
  }

  const retrySave = async () => {
    setSaveState('retrying');
    try {
      await backends.data.saveSession(s);
      setSaveState('saved');
      setSaveError(null);
    } catch (e) {
      setSaveState('failed');
      setSaveError((e as Error).message);
    }
  };

  const fresh = !!nav.record;
  const back = user?.role === 'PATIENT' ? '/app' : `/therapist/patients/${s.patientId}`;
  const repData = s.reps.map((r) => ({ label: `Rep ${r.index}`, value: Math.round(r.rom) }));
  const celebrate = fresh && s.status === 'completed';

  return (
    <div className="space-y-6">
      {celebrate && <Confetti fire={1} />}
      <PageHeader
        title={fresh ? 'Session complete' : 'Session details'}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{s.exerciseName}{s.side ? ` · ${s.side} side` : ''} · {dateTime(s.startedAt)} {s.isDemoData && <DemoBadge label="Demo · simulated data" />}</span>}
        actions={<>
          <Link to={back} className="btn-secondary">{user?.role === 'PATIENT' ? 'Dashboard' : 'Patient'}</Link>
          {user?.role === 'PATIENT' && <Link to={`/setup?exercise=${s.exerciseId}`} className="btn-primary">New session</Link>}
        </>}
      />

      {saveState === 'saved' && fresh && (
        <div role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">Session saved successfully.</div>
      )}
      {saveState === 'retrying' && <Spinner label="Saving session…" />}
      {saveState === 'failed' && (
        <ErrorBox message={`Session not saved: ${saveError ?? 'database unavailable'}. Your results are still shown below.`} onRetry={retrySave} />
      )}

      <Panel className="p-6">
        <div className="stagger grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Completed reps" value={`${s.repetitions} / ${s.targetReps}`} emphasis />
          <Stat label="Average ROM" value={deg(s.averageRom)} emphasis />
          <Stat label="Best ROM" value={deg(s.maxRom)} emphasis />
          <Stat label="Average form" value={pct(s.formScore)} emphasis />
          <Stat label="Duration" value={formatDuration(s.durationSec)} emphasis />
          <div>
            <div className="text-xs text-muted">Movement quality</div>
            <div className="mt-2"><Badge tone={s.movementQuality === 'Good' ? 'ok' : s.movementQuality === 'Fair' ? 'signal' : 'alert'}>{s.movementQuality}</Badge></div>
          </div>
        </div>
        <p className="mt-5 text-sm text-muted">
          Angle range observed this session: {deg(s.minAngle)} to {deg(s.maxAngle)}. {s.status === 'partial' ? 'Fewer repetitions than prescribed were recorded.' : 'All prescribed repetitions were recorded.'}
        </p>
      </Panel>

      {user?.role === 'PATIENT' ? (
        <Panel className="glow-border p-6">
          <h2 className="font-semibold">How did it feel?</h2>
          <p className="mb-5 text-xs text-muted">Your ratings are shared with your therapist and shown in your progress. RehabX doesn’t interpret pain — your therapist does.</p>
          <SessionFeedbackForm session={s} />
        </Panel>
      ) : (s.painAfter != null || s.difficulty != null || s.patientNote) ? (
        <Panel className="p-6">
          <h2 className="font-semibold">Patient-reported</h2>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Pain before</dt><dd className="tabular mt-1 text-xl font-semibold">{s.painBefore ?? '—'}<span className="text-sm text-muted">/10</span></dd></div>
            <div><dt className="text-xs text-muted">Pain after</dt><dd className={`tabular mt-1 text-xl font-semibold ${(s.painAfter ?? 0) >= 7 ? 'text-alert' : ''}`}>{s.painAfter ?? '—'}<span className="text-sm text-muted">/10</span></dd></div>
            <div><dt className="text-xs text-muted">Difficulty</dt><dd className="tabular mt-1 text-xl font-semibold">{s.difficulty ?? '—'}<span className="text-sm text-muted">/5</span></dd></div>
            {s.patientNote && <div className="col-span-2 sm:col-span-1"><dt className="text-xs text-muted">Note</dt><dd className="mt-1">{s.patientNote}</dd></div>}
          </dl>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="p-6">
          <h2 className="font-semibold">Range of motion per repetition</h2>
          {repData.length ? <div className="mt-4"><TrendChart data={repData} unit="°" /></div> : <p className="mt-3 text-sm text-muted">No complete repetitions were recorded.</p>}
        </Panel>
        <Panel className="p-6">
          <h2 className="font-semibold">Observed deviations</h2>
          {s.deviations.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {s.deviations.map((d) => (
                <li key={d.label} className="flex justify-between gap-3"><span>{d.label}</span><span className="tabular text-muted">{d.count}×</span></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">No deviations were observed against the configured form rules.</p>}
          <p className="mt-4 text-xs text-muted">Observed deviations are measurements for therapist review, not a diagnosis.</p>
        </Panel>
      </div>

      {s.reps.length > 0 && (
        <Panel className="p-6">
          <h2 className="font-semibold">Repetitions</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-4 font-medium">#</th><th className="py-2 pr-4 text-right font-medium">Peak angle</th>
                <th className="py-2 pr-4 text-right font-medium">ROM</th><th className="py-2 pr-4 text-right font-medium">Form</th>
                <th className="py-2 pr-4 text-right font-medium">Time</th><th className="py-2 font-medium">Notes</th>
              </tr></thead>
              <tbody className="tabular">
                {s.reps.map((r) => (
                  <tr key={r.index} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-4">{r.index}</td>
                    <td className="py-2 pr-4 text-right">{deg(r.peakAngle)}</td>
                    <td className="py-2 pr-4 text-right">{deg(r.rom)}</td>
                    <td className="py-2 pr-4 text-right">{pct(r.formScore)}</td>
                    <td className="py-2 pr-4 text-right">{((r.endedAt - r.startedAt) / 1000).toFixed(1)} s</td>
                    <td className="py-2 text-muted">{r.deviations.length ? r.deviations.join(', ') : r.reachedTarget ? 'Target reached' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <Disclaimer compact />
    </div>
  );
}
