import type { CarePlan, PatientMessage, PatientSummary, SessionRecord } from '@/types';
import type { GeminiRequest } from './geminiHandler';
import { planProgress } from '@/services/analytics/carePlan';
import { detectAnomalies, forecastRom } from '@/services/analytics/predict';
import { painSummary } from '@/services/analytics/trends';
import { trends } from '@/services/analytics/series';

/** Client: calls our own /api/gemini endpoint (never Google directly — the key stays on the server). */
export async function askGemini(req: GeminiRequest): Promise<{ text: string; model: string }> {
  let res: Response;
  try {
    res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
  } catch {
    throw new Error('Could not reach the server.');
  }
  const json = (await res.json().catch(() => ({}))) as { text?: string; model?: string; error?: string };
  if (!res.ok || !json.text) {
    if (res.status === 404) throw new Error('Gemini endpoint not available here. Run with `npm run dev` (with GEMINI_API_KEY in .env) or deploy to Netlify.');
    throw new Error(json.error ?? 'Gemini request failed.');
  }
  return { text: json.text, model: json.model ?? 'gemini' };
}

const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);

/** Anonymised payload for the therapist summary (patient code, no name / phone). */
export function therapistPayload(p: PatientSummary, exerciseSessions: SessionRecord[], allSessions: SessionRecord[], plan: CarePlan | null, messages: PatientMessage[], goal: number | null) {
  const recent = exerciseSessions.slice(-8);
  const pp = planProgress(plan, allSessions);
  return {
    patient: { code: p.patientCode, age: p.profile?.age, diagnosis: p.profile?.diagnosis ?? p.condition, affectedSide: p.profile?.affectedSide, goal: p.profile?.goal },
    exercise: recent[recent.length - 1]?.exerciseName,
    recentSessions: recent.map((s) => ({ date: s.startedAt.slice(0, 10), reps: `${s.repetitions}/${s.targetReps}`, avgRomDeg: r1(s.averageRom), formPct: s.formScore, painAfter: s.painAfter ?? null, deviations: s.deviations.map((d) => d.label) })),
    trends: trends(exerciseSessions),
    pain: painSummary(exerciseSessions),
    romForecast: forecastRom(exerciseSessions, goal),
    anomalies: detectAnomalies(exerciseSessions).map((a) => a.message),
    carePlanThisWeek: pp.items.map((i) => ({ exercise: i.name, done: i.done, target: i.target, status: i.status })),
    recentPatientMessages: messages.filter((m) => m.senderRole === 'PATIENT').slice(-3).map((m) => ({ category: m.category, text: m.body || '(voice note)' })),
  };
}

/** Payload for the patient coach: one session. */
export function coachPayload(s: SessionRecord) {
  return {
    exercise: s.exerciseName, side: s.side, reps: `${s.repetitions}/${s.targetReps}`, avgRomDeg: r1(s.averageRom), maxRomDeg: r1(s.maxRom),
    formPct: s.formScore, quality: s.movementQuality, deviations: s.deviations, durationSec: s.durationSec,
    painBefore: s.painBefore ?? null, painAfter: s.painAfter ?? null,
  };
}
