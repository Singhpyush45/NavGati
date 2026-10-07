import type { SessionRecord } from '@/types';

/** Least-squares slope of y over index (units per session). */
export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
  return den === 0 ? 0 : num / den;
}

export type TrendLabel = 'Improving' | 'Stable' | 'Declining' | 'Not enough data';

/** Describes measured movement trend. Deliberately not a clinical judgement. */
export function trendLabel(values: number[], threshold: number): TrendLabel {
  if (values.length < 3) return 'Not enough data';
  const s = slope(values);
  if (s > threshold) return 'Improving';
  if (s < -threshold) return 'Declining';
  return 'Stable';
}

export const byDate = (a: SessionRecord, b: SessionRecord) => a.startedAt.localeCompare(b.startedAt);

/** Distinct days with ≥1 session in the last `days` days (ending today). */
export function consistency(sessions: SessionRecord[], days = 7, now = new Date()): { active: number; days: number } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const set = new Set(
    sessions.filter((s) => new Date(s.startedAt) >= start).map((s) => s.startedAt.slice(0, 10)),
  );
  return { active: set.size, days };
}

export function adherence(sessions: SessionRecord[]): number {
  if (!sessions.length) return 0;
  const done = sessions.reduce((s, x) => s + Math.min(x.repetitions, x.targetReps), 0);
  const target = sessions.reduce((s, x) => s + x.targetReps, 0);
  return target ? Math.round((100 * done) / target) : 0;
}

export function aggregateDeviations(sessions: SessionRecord[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of sessions) for (const d of s.deviations) m.set(d.label, (m.get(d.label) ?? 0) + d.count);
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export interface Milestone { label: string; achieved: boolean; detail: string }

export function milestones(sessions: SessionRecord[]): Milestone[] {
  const sorted = [...sessions].sort(byDate);
  const first = sorted[0];
  const bestRom = Math.max(0, ...sorted.map((s) => s.maxRom));
  const romGain = first ? bestRom - first.averageRom : 0;
  const c = consistency(sessions);
  return [
    { label: 'First recorded session', achieved: sorted.length > 0, detail: first ? new Date(first.startedAt).toLocaleDateString() : 'Complete one session' },
    { label: '10 sessions recorded', achieved: sorted.length >= 10, detail: `${Math.min(sorted.length, 10)} of 10` },
    { label: 'ROM +10° vs first session', achieved: romGain >= 10, detail: `${Math.max(0, Math.round(romGain))}° measured change` },
    { label: '5 active days this week', achieved: c.active >= 5, detail: `${c.active} of 7 days` },
    { label: 'Session with form ≥ 90%', achieved: sorted.some((s) => s.formScore >= 90), detail: `Best ${Math.max(0, ...sorted.map((s) => s.formScore))}%` },
  ];
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Local-calendar day key (YYYY-MM-DD) so streaks follow the patient's own days. */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Consecutive active days ending today (or yesterday, so the streak isn't "lost" before today's session). */
export function streak(sessions: SessionRecord[], now = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(s.startedAt)));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Session counts per day for the last `weeks` weeks, oldest first, aligned to start on a Monday. */
export function activityCalendar(sessions: SessionRecord[], weeks = 12, now = new Date()): { key: string; count: number; future: boolean }[] {
  const counts = new Map<string, number>();
  sessions.forEach((s) => counts.set(dayKey(s.startedAt), (counts.get(dayKey(s.startedAt)) ?? 0) + 1));
  const end = new Date(now); end.setHours(0, 0, 0, 0);
  const offset = (end.getDay() + 6) % 7; // days since Monday
  const start = new Date(end); start.setDate(end.getDate() - offset - (weeks - 1) * 7);
  const out: { key: string; count: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dayKey(d);
    out.push({ key: k, count: counts.get(k) ?? 0, future: d > end });
  }
  return out;
}

export type PainTrend = 'Decreasing' | 'Stable' | 'Increasing' | 'Not enough data';

/** Summary of patient-reported pain (0–10). An alert is a prompt for therapist review, not a diagnosis. */
export function painSummary(sessions: SessionRecord[]): { latest: number | null; average: number | null; trend: PainTrend; alert: string | null } {
  const vals = [...sessions].sort(byDate)
    .map((s) => s.painAfter ?? s.painBefore)
    .filter((v): v is number => typeof v === 'number');
  if (!vals.length) return { latest: null, average: null, trend: 'Not enough data', alert: null };
  const recent = vals.slice(-8);
  const t = trendLabel(recent, 0.15);
  const trend: PainTrend = t === 'Improving' ? 'Increasing' : t === 'Declining' ? 'Decreasing' : t;
  const latest = vals[vals.length - 1];
  const average = Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10;
  let alert: string | null = null;
  if (latest >= 7) alert = 'High reported pain';
  else if (trend === 'Increasing') alert = 'Reported pain increasing';
  return { latest, average, trend, alert };
}
