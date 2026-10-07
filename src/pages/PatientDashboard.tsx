import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { DemoBadge, Disclaimer, EmptyState, ErrorBox, PageHeader, Panel, Spinner, Stat, Trend } from '@/components/UI/primitives';
import { TrendChart, RepsChart } from '@/components/Charts/TrendChart';
import { SessionTable } from '@/components/Dashboard/SessionTable';
import { ActivityHeatmap } from '@/components/Dashboard/ActivityHeatmap';
import { ExercisePreview } from '@/components/Exercise/ExercisePreview';
import { CountUp, ProgressRing } from '@/components/FX/motion';
import { byDate, consistency, dayKey, formatDuration, milestones, streak } from '@/services/analytics/trends';
import { currentExercise, toSeries, trends } from '@/services/analytics/series';
import { getExercise } from '@/services/exercise/exercises';
import { getPrefs } from '@/utils/prefs';
import { deg, pct, shortDate } from '@/utils/format';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function PatientDashboard() {
  const { user } = useAuth();
  const { data, error, loading, retry } = useAsync(async () => {
    const [sessions, notes] = await Promise.all([backends.data.listSessions(user!.id), backends.data.listNotes(user!.id).catch(() => [])]);
    return { sessions, notes };
  }, [user?.id]);

  if (loading) return <Spinner label="Loading your sessions…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  const all = [...(data?.sessions ?? [])].sort(byDate);
  const note = data?.notes[0];
  const todayKey = dayKey(new Date());
  const todays = all.filter((s) => dayKey(s.startedAt) === todayKey);
  const latest = todays[todays.length - 1] ?? null;
  const exId = currentExercise(all) ?? 'knee_extension';
  const exSessions = all.filter((s) => s.exerciseId === exId);
  const series = toSeries(exSessions);
  const t = trends(exSessions);
  const c = consistency(all);
  const st = streak(all);
  const ex = getExercise(exId)!;
  const hasDemo = all.some((s) => s.isDemoData);
  const firstName = user?.name.split(' ')[0] ?? '';
  const target = getPrefs().defaultTargetReps;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Here’s your recovery at a glance {hasDemo && <DemoBadge label="Includes demo data" />}</span>}
      />

      {/* Today's plan — hero card */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="relative overflow-hidden rounded-panel bg-gradient-to-br from-tide via-[rgb(var(--tide-2))] to-violet p-6 text-white shadow-xl shadow-tide/25 sm:p-7">
          <div className="spin-slow absolute -right-20 -top-20 h-56 w-56 rounded-full border-[22px] border-white/10" aria-hidden="true" />
          <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_210px]">
            <div>
              <p className="text-sm text-white/80">Today’s exercise</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">{ex.name}</h2>
              <p className="mt-2 text-sm text-white/85">{target} repetitions · {ex.position === 'seated' ? 'seated' : 'standing'} · about 4 minutes</p>
              {latest ? (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur"><span>✓</span> Done today — {latest.repetitions} reps, {deg(latest.averageRom)} ROM</p>
              ) : (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Not done yet today</p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to={`/setup?exercise=${exId}`} className="btn !bg-white !px-5 !py-3 font-semibold !text-[#0b3b3d] shadow-lg hover:!-translate-y-0.5">
                  {latest ? 'Do another session' : 'Start today’s exercise'}
                </Link>
                {latest && <Link to={`/sessions/${latest.id}`} className="btn border border-white/40 text-white hover:bg-white/10">View result</Link>}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl shadow-2xl shadow-black/30 ring-1 ring-white/20"><ExercisePreview exercise={ex} /></div>
          </div>
        </section>

        <Panel className="flex items-center gap-6 p-6">
          <ProgressRing value={c.active} max={c.days} size={128} stroke={11}>
            <div><div className="text-3xl font-semibold"><CountUp value={c.active} /></div><div className="text-[11px] text-muted">of {c.days} days</div></div>
          </ProgressRing>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted">Current streak</div>
              <div className="flex items-baseline gap-1.5 text-3xl font-semibold"><span className={st > 0 ? 'float inline-block' : ''} aria-hidden="true">🔥</span><CountUp value={st} /><span className="text-sm font-normal text-muted">day{st === 1 ? '' : 's'}</span></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs"><span className="text-muted">ROM</span><Trend label={t.rom} /><span className="text-muted">Form</span><Trend label={t.form} /></div>
          </div>
        </Panel>
      </div>

      {note && (
        <Panel className="glow-border flex gap-4 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-tide2 text-white" aria-hidden="true">✎</span>
          <div className="min-w-0">
            <div className="text-xs text-muted">Note from {note.authorName} · {shortDate(note.createdAt)}</div>
            <p className="mt-1 text-[15px] leading-relaxed">{note.body}</p>
          </div>
        </Panel>
      )}

      {all.length === 0 ? (
        <EmptyState title="Your progress will appear here" body="Complete your first session and RehabX will start charting range of motion and form over time." action={<Link to="/exercises" className="btn-primary">Choose an exercise</Link>} />
      ) : (
        <>
          <Panel className="stagger grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
            <Stat label="Sessions recorded" value={all.length} emphasis />
            <Stat label="Latest ROM" value={deg(exSessions[exSessions.length - 1]?.averageRom)} emphasis />
            <Stat label="Latest form" value={pct(exSessions[exSessions.length - 1]?.formScore)} emphasis />
            <Stat label="Last session" value={formatDuration(all[all.length - 1].durationSec)} sub={shortDate(all[all.length - 1].startedAt)} emphasis />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Panel className="p-6">
              <h2 className="font-semibold">Activity</h2>
              <p className="mb-4 text-xs text-muted">Every square is a day. Consistency matters more than intensity.</p>
              <ActivityHeatmap sessions={all} />
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">ROM over sessions</h2>
              <p className="text-xs text-muted">{ex.name} · average range of motion per session</p>
              <div className="mt-4"><TrendChart data={series.rom} unit="°" /></div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="p-6">
              <h2 className="font-semibold">Form score</h2>
              <div className="mt-4"><TrendChart data={series.form} unit="%" color="signal" domain={[0, 100]} height={180} /></div>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Repetitions</h2>
              <div className="mt-4"><RepsChart data={series.reps} height={180} /></div>
            </Panel>
            <Panel className="p-6">
              <h2 className="font-semibold">Milestones</h2>
              <ul className="stagger mt-4 space-y-3">
                {milestones(all).map((m) => (
                  <li key={m.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2.5">
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${m.achieved ? 'bg-gradient-to-br from-tide to-tide2 text-white shadow-md shadow-tide/30 dark:text-[#04181b]' : 'border border-line text-muted'}`} aria-hidden="true">{m.achieved ? '✓' : ''}</span>
                      {m.label}
                    </span>
                    <span className="tabular text-xs text-muted">{m.detail}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Recent sessions</h2>
              <Link to="/history" className="text-sm text-tide hover:underline">All sessions →</Link>
            </div>
            <SessionTable sessions={[...all].reverse().slice(0, 5)} />
          </Panel>
        </>
      )}
      <p className="text-xs text-muted">Stop and consult your therapist if you experience pain.</p>
      <Disclaimer compact />
    </div>
  );
}
