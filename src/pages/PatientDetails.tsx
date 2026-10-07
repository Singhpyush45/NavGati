import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { adherence, aggregateDeviations, byDate, consistency, painSummary } from '@/services/analytics/trends';
import { TherapistNotes } from '@/components/Dashboard/TherapistNotes';
import { CarePlanEditor } from '@/components/CarePlan/CarePlanEditor';
import { PatientProfileCard } from '@/components/Dashboard/PatientProfileCard';
import { AiInsights } from '@/components/Dashboard/AiInsights';
import { MessageThread } from '@/components/Messages/MessageThread';
import { unreadFor } from '@/services/analytics/messages';
import { CarePlanProgress } from '@/components/CarePlan/CarePlanProgress';
import { planProgress } from '@/services/analytics/carePlan';
import type { CarePlan } from '@/types';
import { ActivityHeatmap } from '@/components/Dashboard/ActivityHeatmap';
import { currentExercise, toSeries, trends } from '@/services/analytics/series';
import { getExercise } from '@/services/exercise/exercises';
import { TrendChart, RepsChart } from '@/components/Charts/TrendChart';
import { SessionTable } from '@/components/Dashboard/SessionTable';
import { DemoBadge, Disclaimer, EmptyState, ErrorBox, PageHeader, Panel, Spinner, Stat, Trend } from '@/components/UI/primitives';
import { deg, pct } from '@/utils/format';

export default function PatientDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);
  const [plan, setPlan] = useState<CarePlan | null | undefined>(undefined);
  const { data, error, loading, retry } = useAsync(async () => {
    // Access check: a therapist only sees patients assigned to them (also enforced by Supabase RLS).
    const assigned = await backends.data.listPatients(user!);
    const patient = assigned.find((p) => p.id === id) ?? null;
    const sessions = patient ? (await backends.data.listSessions(patient.id)).sort(byDate) : [];
    const notes = patient ? await backends.data.listNotes(patient.id).catch(() => []) : [];
    const carePlan = patient ? await backends.data.getCarePlan(patient.id).catch(() => null) : null;
    const messages = patient ? await backends.data.listMessages(patient.id).catch(() => []) : [];
    return { patient, sessions, notes, carePlan, messages };
  }, [id, user?.id]);

  if (loading) return <Spinner label="Loading patient…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!data?.patient) return <EmptyState title="Patient not available" body="This patient doesn’t exist or isn’t assigned to you." action={<Link to="/therapist" className="btn-secondary">Back to patients</Link>} />;

  const { patient, sessions } = data;
  const exIds = [...new Set(sessions.map((s) => s.exerciseId))];
  const exId = picked ?? currentExercise(sessions);
  const ex = getExercise(exId);
  const current = sessions.filter((s) => s.exerciseId === exId);
  const latest = current[current.length - 1];
  const series = toSeries(current);
  const t = trends(current);
  const devs = aggregateDeviations(current.slice(-5));
  const c = consistency(sessions);
  const pain = painSummary(current);
  const activePlan = plan === undefined ? data.carePlan : plan;
  const progress = planProgress(activePlan, sessions);

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient.name}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{patient.patientCode}{patient.condition ? ` · ${patient.condition}` : ''} {patient.isDemo && <DemoBadge label="Synthetic demo patient" />}</span>}
        actions={<>
          {exIds.length > 1 && (
            <select aria-label="Exercise" className="field !w-auto" value={exId ?? ''} onChange={(e) => setPicked(e.target.value)}>
              {exIds.map((x) => <option key={x} value={x}>{getExercise(x)?.name ?? x}</option>)}
            </select>
          )}
          <button className="btn-secondary" onClick={() => window.print()}>⎙ Report / PDF</button>
          <Link to="/therapist" className="btn-secondary">All patients</Link>
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <Panel className="p-6">
          <h2 className="mb-4 font-semibold">Patient details</h2>
          <PatientProfileCard patient={patient} />
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div><div className="text-xs text-muted">Sessions</div><div className="tabular text-xl font-semibold">{sessions.length}</div></div>
            <div><div className="text-xs text-muted">Pain (latest)</div><div className="tabular text-xl font-semibold">{pain.latest ?? '—'}<span className="text-xs text-muted">/10</span></div></div>
            <div><div className="text-xs text-muted">Care plan</div><div className="tabular text-xl font-semibold">{progress.items.length ? `${progress.weekAdherence}%` : '—'}</div></div>
          </div>
        </Panel>
        <Panel className="p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Messages with {patient.name.split(' ')[0]}</h2>
            <span className="text-xs text-muted">{unreadFor(data.messages, 'THERAPIST').length ? `${unreadFor(data.messages, 'THERAPIST').length} new` : 'Text + voice notes'}</span>
          </div>
          <MessageThread patientId={patient.id} me={user!} initial={data.messages} height={340} />
        </Panel>
      </div>

      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly care plan</h2>
            <p className="text-xs text-muted">Prescribe exercises, reps and sessions per week. The patient sees this on their home screen.</p>
          </div>
          {progress.behind.length > 0 && <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-xs font-medium text-signal">Behind: {progress.behind.join(', ')}</span>}
        </div>
        <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <div><h3 className="mb-3 text-sm font-medium text-muted">This week</h3><CarePlanProgress progress={progress} mode="therapist" /></div>
          <div><h3 className="mb-3 text-sm font-medium text-muted">Edit plan</h3><CarePlanEditor patientId={patient.id} author={user!} initial={activePlan} onSaved={setPlan} /></div>
        </div>
      </Panel>

      {sessions.length > 0 && (
        <Panel className="p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">AI insights · {ex?.name ?? 'current exercise'}</h2>
            <span className="text-xs text-muted">Recovery forecast + anomaly detection, computed on-device</span>
          </div>
          <AiInsights sessions={current} goal={activePlan?.items.find((i) => i.exerciseId === exId)?.targetRom ?? null} exerciseName={ex?.name} />
        </Panel>
      )}

      {!sessions.length ? (
        <EmptyState title="No sessions recorded" body="Sessions will appear once this patient completes an exercise." />
      ) : (
        <>
          <Panel className="p-6">
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Current exercise" value={<span className="text-lg">{ex?.name ?? '—'}</span>} />
              <Stat label="Latest ROM" value={deg(latest?.averageRom)} />
              <Stat label="Latest form" value={pct(latest?.formScore)} />
              <Stat label="Completed reps" value={latest ? `${latest.repetitions}/${latest.targetReps}` : '—'} />
              <Stat label="Recent sessions" value={current.length} sub={`${c.active}/${c.days} days active this week`} />
              <Stat label="Adherence" value={`${adherence(current)}%`} sub="reps completed vs prescribed" />
            </div>
            <div className="mt-5 flex flex-wrap gap-6 border-t border-line pt-4 text-sm">
              <span className="inline-flex items-center gap-2 text-muted">ROM trend <Trend label={t.rom} /></span>
              <span className="inline-flex items-center gap-2 text-muted">Form trend <Trend label={t.form} /></span>
              <span className="inline-flex items-center gap-2 text-muted">Reported pain <Trend label={pain.trend} /></span>
              {pain.alert && <span className="inline-flex items-center gap-2 rounded-full bg-alert/10 px-2.5 py-0.5 text-xs font-medium text-alert">⚑ {pain.alert} — requires therapist review</span>}
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-6">
              <h2 className="font-semibold">ROM trend</h2>
              <div className="mt-4"><TrendChart data={series.rom} unit="°" /></div>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Form trend</h2>
              <div className="mt-4"><TrendChart data={series.form} unit="%" domain={[0, 100]} color="signal" /></div>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Repetition consistency</h2>
              <div className="mt-4"><RepsChart data={series.reps} /></div>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Movement deviations</h2>
              <p className="text-xs text-muted">Observed across the last {Math.min(5, current.length)} sessions</p>
              {devs.length ? (
                <ul className="mt-4 space-y-2.5 text-sm">
                  {devs.map((d) => (
                    <li key={d.label} className="flex items-center justify-between gap-3">
                      <span>Observed deviation: {d.label.charAt(0).toLowerCase() + d.label.slice(1)}</span>
                      <span className="tabular text-muted">{d.count}×</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-4 text-sm text-muted">No deviations observed against the configured form rules.</p>}
              {devs.length > 0 && <p className="mt-4 text-xs text-muted">Requires therapist review. These are measurements from 2D video, not a diagnosis.</p>}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold">Reported pain</h2><p className="text-xs text-muted">Self-reported after each session, 0–10</p></div>
                <div className="text-right"><div className="tabular text-2xl font-semibold">{pain.latest ?? '—'}<span className="text-sm text-muted">/10</span></div><div className="text-xs text-muted">avg {pain.average ?? '—'}</div></div>
              </div>
              {series.pain.length ? <div className="mt-4"><TrendChart data={series.pain} unit="" domain={[0, 10]} color="violet" /></div> : <p className="mt-4 text-sm text-muted">No pain ratings reported yet.</p>}
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Notes to patient</h2>
              <p className="mb-4 text-xs text-muted">The latest note appears on the patient’s home screen.</p>
              <TherapistNotes patientId={patient.id} author={user!} initial={data.notes} />
            </Panel>
          </div>

          <Panel className="p-6">
            <h2 className="font-semibold">Activity</h2>
            <p className="mb-4 text-xs text-muted">All exercises · last 12 weeks</p>
            <ActivityHeatmap sessions={sessions} />
          </Panel>

          <Panel className="p-4 sm:p-6">
            <h2 className="mb-3 font-semibold">Session history</h2>
            <SessionTable sessions={[...sessions].reverse()} />
          </Panel>
        </>
      )}
      <Disclaimer compact />
    </div>
  );
}
