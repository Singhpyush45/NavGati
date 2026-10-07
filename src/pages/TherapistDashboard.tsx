import { Link } from 'react-router-dom';
import type { PatientSummary, SessionRecord } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { adherence, byDate, consistency, painSummary } from '@/services/analytics/trends';
import { currentExercise, trends } from '@/services/analytics/series';
import { getExercise } from '@/services/exercise/exercises';
import { planProgress } from '@/services/analytics/carePlan';
import { CATEGORY_LABEL, latest, unreadFor, urgency } from '@/services/analytics/messages';
import type { PatientMessage } from '@/types';
import { Badge, DemoBadge, Disclaimer, EmptyState, ErrorBox, PageHeader, Panel, Spinner, Stat, Trend } from '@/components/UI/primitives';
import { deg, pct, shortDate } from '@/utils/format';

interface Row {
  patient: PatientSummary;
  sessions: SessionRecord[];
  latest: SessionRecord | null;
  rom: string;
  form: string;
  adherence: number;
  activeDays: number;
  pain: number | null;
  review: string[];
  /** Care-plan sessions done vs prescribed this week (null = no plan). */
  plan: number | null;
  messages: PatientMessage[];
  unread: number;
}

/** Flags are measurement-based prompts for the therapist — never diagnoses. */
function reviewFlags(sessions: SessionRecord[], t: { rom: string; form: string }, adh: number, activeDays: number): string[] {
  const f: string[] = [];
  const p = painSummary(sessions);
  if (p.alert) f.push(p.alert);
  if (t.rom === 'Declining') f.push('ROM trend declining');
  if (t.form === 'Declining') f.push('Form trend declining');
  if (sessions.length && adh < 70) f.push('Low repetition completion');
  if (activeDays <= 2) f.push('Few sessions this week');
  return f;
}

async function load(user: NonNullable<ReturnType<typeof useAuth>['user']>): Promise<Row[]> {
  const patients = await backends.data.listPatients(user);
  return Promise.all(patients.map(async (patient) => {
    const all = (await backends.data.listSessions(patient.id)).sort(byDate);
    const exId = currentExercise(all);
    const current = all.filter((s) => s.exerciseId === exId);
    const t = trends(current);
    const adh = adherence(all.slice(-10));
    const activeDays = consistency(all).active;
    const plan = await backends.data.getCarePlan(patient.id).catch(() => null);
    const messages = await backends.data.listMessages(patient.id).catch(() => [] as PatientMessage[]);
    const unread = unreadFor(messages, 'THERAPIST');
    const pp = planProgress(plan, all);
    const review = reviewFlags(current, t, adh, activeDays);
    if (pp.behind.length) review.push(`Behind care plan: ${pp.behind.join(', ')}`);
    if (unread.some((m) => m.category === 'pain')) review.unshift('Patient reported pain in a message');
    return {
      patient, sessions: all, latest: all[all.length - 1] ?? null,
      rom: t.rom, form: t.form, adherence: adh, activeDays, pain: painSummary(current).latest,
      review, plan: pp.items.length ? pp.weekAdherence : null, messages, unread: unread.length,
    };
  }));
}

export default function TherapistDashboard() {
  const { user } = useAuth();
  const { data, error, loading, retry } = useAsync(() => load(user!), [user?.id]);

  if (loading) return <Spinner label="Loading patients…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  // Patients with unread pain messages first, then unread messages, then needs-review.
  const rows = [...(data ?? [])].sort((a, b) => urgency(b.messages) - urgency(a.messages) || b.review.length - a.review.length);
  const unreadTotal = rows.reduce((n, r) => n + r.unread, 0);
  const totalSessions = rows.reduce((s, r) => s + r.sessions.length, 0);
  const week = rows.reduce((s, r) => s + r.sessions.filter((x) => Date.now() - Date.parse(x.startedAt) < 7 * 864e5).length, 0);
  const needReview = rows.filter((r) => r.review.length).length;
  const avgAdh = rows.length ? Math.round(rows.reduce((s, r) => s + r.adherence, 0) / rows.length) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Assigned to {user?.name} {rows.some((r) => r.patient.isDemo) && <DemoBadge label="Synthetic demo patients" />}</span>}
      />

      <Panel className="stagger grid grid-cols-2 gap-6 p-6 sm:grid-cols-4">
        <Stat label="Assigned patients" value={rows.length} />
        <Stat label="Sessions this week" value={week} sub={`${totalSessions} total`} />
        <Stat label="Average rep completion" value={`${avgAdh}%`} sub="last 10 sessions each" />
        <Stat label="Requires therapist review" value={needReview} />
      </Panel>

      {unreadTotal > 0 && (
        <Panel className="p-6">
          <h2 className="font-semibold">New messages from patients <span className="ml-1 rounded-full bg-alert/10 px-2 py-0.5 text-xs text-alert">{unreadTotal}</span></h2>
          <ul className="mt-4 divide-y divide-line/70">
            {rows.filter((r) => r.unread).map((r) => {
              const m = latest(unreadFor(r.messages, 'THERAPIST'))!;
              return (
                <li key={r.patient.id}>
                  <Link to={`/therapist/patients/${r.patient.id}`} className="flex items-start gap-3 py-3 hover:bg-sunken/50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-tide to-violet text-xs font-semibold text-white" aria-hidden="true">{r.patient.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{r.patient.name}</span>
                        <Badge tone={m.category === 'pain' ? 'alert' : m.category === 'problem' ? 'signal' : 'tide'}>{CATEGORY_LABEL[m.category]}</Badge>
                        <span className="text-xs text-muted">{shortDate(m.createdAt)}</span></div>
                      <p className="mt-0.5 truncate text-sm text-muted">{m.audio ? '🎙 Voice note' + (m.body ? ' · ' : '') : ''}{m.body}</p>
                    </div>
                    <span className="tabular text-xs text-muted">{r.unread} new →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No assigned patients" body="Patients assigned to you will appear here with their measured trends." />
      ) : (
        <>
        {/* Phones: one card per patient */}
        <ul className="stagger space-y-3 md:hidden">
          {rows.map((r) => (
            <li key={r.patient.id}>
              <Link to={`/therapist/patients/${r.patient.id}`} className="panel panel-hover block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-tide">{r.patient.name}{r.unread > 0 && <span className="ml-2 rounded-full bg-alert/10 px-1.5 py-0.5 text-[10px] text-alert">{r.unread} msg</span>}</div>
                    <div className="text-xs text-muted">{r.patient.patientCode} · {getExercise(r.latest?.exerciseId)?.name ?? '—'}</div>
                  </div>
                  {r.review.length ? <Badge tone="signal">Review</Badge> : <Badge tone="ok">On track</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[['ROM', deg(r.latest?.averageRom)], ['Form', pct(r.latest?.formScore)], ['Pain', r.pain != null ? `${r.pain}/10` : '—'], ['Plan', r.plan != null ? `${r.plan}%` : '—']].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-sunken/60 py-1.5"><div className="text-[10px] text-muted">{k}</div><div className="tabular text-sm font-semibold">{v}</div></div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="text-muted">ROM</span><Trend label={r.rom} /><span className="text-muted">Form</span><Trend label={r.form} />{r.review.map((x) => <span key={x} className="text-muted">· {x}</span>)}</div>
              </Link>
            </li>
          ))}
        </ul>
        <Panel className="hidden p-4 sm:p-6 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2.5 pr-4 font-medium">Patient (click for details)</th>
                  <th className="py-2.5 pr-4 font-medium">Current exercise</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Latest ROM</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Latest form</th>
                  <th className="py-2.5 pr-4 font-medium">ROM trend</th>
                  <th className="py-2.5 pr-4 font-medium">Form trend</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Pain</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Adherence</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Care plan (week)</th>
                  <th className="py-2.5 pr-4 font-medium">Last session</th>
                  <th className="py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.patient.id} className="border-b border-line/70 last:border-0 hover:bg-sunken/60">
                    <td className="py-3 pr-4">
                      <Link to={`/therapist/patients/${r.patient.id}`} className="font-medium text-tide hover:underline">{r.patient.name}</Link>
                      {r.unread > 0 && <span className="ml-2 rounded-full bg-alert/10 px-1.5 py-0.5 text-[10px] font-semibold text-alert">{r.unread} msg</span>}
                      <div className="text-xs text-muted">{r.patient.patientCode}{r.patient.profile?.age ? ` · ${r.patient.profile.age} yrs` : ''}{r.patient.condition ? ` · ${r.patient.condition}` : ''}</div>
                    </td>
                    <td className="py-3 pr-4">{getExercise(r.latest?.exerciseId)?.name ?? '—'}</td>
                    <td className="py-3 pr-4 text-right">{deg(r.latest?.averageRom)}</td>
                    <td className="py-3 pr-4 text-right">{pct(r.latest?.formScore)}</td>
                    <td className="py-3 pr-4"><Trend label={r.rom} /></td>
                    <td className="py-3 pr-4"><Trend label={r.form} /></td>
                    <td className={`py-3 pr-4 text-right ${(r.pain ?? 0) >= 6 ? 'font-semibold text-alert' : ''}`}>{r.pain ?? '—'}{r.pain != null && <span className="text-xs text-muted">/10</span>}</td>
                    <td className="py-3 pr-4 text-right">{r.adherence}%</td>
                    <td className="py-3 pr-4 text-right">{r.plan != null ? `${r.plan}%` : <span className="text-muted">No plan</span>}</td>
                    <td className="py-3 pr-4">{r.latest ? shortDate(r.latest.startedAt) : '—'}</td>
                    <td className="py-3">
                      {r.review.length
                        ? <span title={r.review.join(', ')}><Badge tone="signal">Requires therapist review</Badge></span>
                        : <Badge tone="ok">On track</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted">“Requires therapist review” is triggered by measured trends, reported pain, completion and session frequency. It is a prompt to look closer, not a clinical finding.</p>
        </Panel>
        </>
      )}
      <Disclaimer compact />
    </div>
  );
}
