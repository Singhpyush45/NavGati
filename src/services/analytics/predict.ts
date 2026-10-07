import type { SessionRecord } from '@/types';
import { byDate } from './trends';

/**
 * Predictive analytics on a patient's own session history (pure functions, run on-device).
 * Built on-site at ReThink Hackathon 2026 (AI/ML vertical).
 *  - forecastRom: least-squares linear regression of ROM over time → when the ROM goal is likely reached.
 *  - detectAnomalies: z-score of the latest session against the patient's own baseline.
 * These are statistical estimates for the therapist, not clinical predictions.
 */

const DAY = 864e5;

export interface Regression { slope: number; intercept: number; r2: number; n: number }

/** Ordinary least squares y = intercept + slope·x, with coefficient of determination R². */
export function linearRegression(xs: number[], ys: number[]): Regression {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0, n };
  const xm = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const ym = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - xm) * (ys[i] - ym); sxx += (xs[i] - xm) ** 2; syy += (ys[i] - ym) ** 2; }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ym - slope * xm;
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

export type Confidence = 'High' | 'Medium' | 'Low';

export interface RomForecast {
  status: 'not_enough_data' | 'reached' | 'on_course' | 'not_improving';
  /** Degrees gained per week (trend). */
  perWeek: number;
  current: number | null;
  /** Predicted ROM 14 days from now (clamped 0–180). */
  in14Days: number | null;
  /** Estimated date the goal is reached (only when on_course and within 180 days). */
  goalDate: string | null;
  daysToGoal: number | null;
  confidence: Confidence;
  r2: number;
  n: number;
}

export function forecastRom(sessions: SessionRecord[], goal: number | null | undefined, now = new Date()): RomForecast {
  const s = [...sessions].sort(byDate).slice(-15);
  const base: RomForecast = { status: 'not_enough_data', perWeek: 0, current: s.length ? s[s.length - 1].averageRom : null, in14Days: null, goalDate: null, daysToGoal: null, confidence: 'Low', r2: 0, n: s.length };
  if (s.length < 4) return base;
  const t0 = Date.parse(s[0].startedAt);
  const xs = s.map((x) => (Date.parse(x.startedAt) - t0) / DAY);
  const ys = s.map((x) => x.averageRom);
  const reg = linearRegression(xs, ys);
  const today = (now.getTime() - t0) / DAY;
  const fitNow = reg.intercept + reg.slope * today;
  const confidence: Confidence = reg.r2 >= 0.7 && reg.n >= 8 ? 'High' : reg.r2 >= 0.4 && reg.n >= 5 ? 'Medium' : 'Low';
  const out: RomForecast = {
    ...base, perWeek: Math.round(reg.slope * 7 * 10) / 10, r2: Math.round(reg.r2 * 100) / 100,
    in14Days: Math.round(Math.max(0, Math.min(180, reg.intercept + reg.slope * (today + 14)))), confidence,
    status: reg.slope > 0.05 ? 'on_course' : 'not_improving',
  };
  if (goal) {
    if ((base.current ?? 0) >= goal || fitNow >= goal) return { ...out, status: 'reached' };
    if (reg.slope > 0.05) {
      const days = Math.ceil((goal - fitNow) / reg.slope);
      if (days <= 180) {
        const d = new Date(now.getTime() + days * DAY);
        return { ...out, daysToGoal: days, goalDate: d.toISOString().slice(0, 10) };
      }
    }
  }
  return out;
}

export interface Anomaly { metric: 'ROM' | 'Form' | 'Pain'; z: number; message: string }

function stats(v: number[]) {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return { m, sd };
}

/** Flags the latest session if it is unusual compared with the patient's previous (up to) 10 sessions. */
export function detectAnomalies(sessions: SessionRecord[]): Anomaly[] {
  const s = [...sessions].sort(byDate);
  if (s.length < 6) return [];
  const last = s[s.length - 1];
  const prev = s.slice(-11, -1);
  const out: Anomaly[] = [];
  const check = (metric: 'ROM' | 'Form', value: number, history: number[], floor: number, unit: string) => {
    const { m, sd } = stats(history);
    const z = (value - m) / Math.max(sd, floor);
    if (z <= -2) out.push({ metric, z: Math.round(z * 10) / 10, message: `Unusual drop in ${metric}: ${Math.round(value)}${unit} vs usual ~${Math.round(m)}${unit} (${Math.abs(Math.round(z * 10) / 10)}σ below)` });
  };
  check('ROM', last.averageRom, prev.map((x) => x.averageRom), 2, '°');
  check('Form', last.formScore, prev.map((x) => x.formScore), 3, '%');
  const pains = prev.map((x) => x.painAfter).filter((x): x is number => x != null);
  if (last.painAfter != null && pains.length >= 3) {
    const { m } = stats(pains);
    if (last.painAfter - m >= 3) out.push({ metric: 'Pain', z: 0, message: `Pain spike: ${last.painAfter}/10 vs usual ~${Math.round(m)}/10` });
  }
  return out;
}
