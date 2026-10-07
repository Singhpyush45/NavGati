import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '@/types';
import { detectAnomalies, forecastRom, linearRegression } from '@/services/analytics/predict';

const now = new Date('2026-10-07T12:00:00Z');
const mk = (daysAgo: number, rom: number, form = 85, painAfter: number | null = 2): SessionRecord => {
  const t = new Date(now.getTime() - daysAgo * 864e5).toISOString();
  return { id: t, patientId: 'p', exerciseId: 'knee_extension', exerciseName: 'K', side: 'right', startedAt: t, endedAt: t, durationSec: 200,
    targetReps: 12, repetitions: 12, averageRom: rom, maxRom: rom, minAngle: 90, maxAngle: 160, formScore: form, movementQuality: 'Good',
    deviations: [], status: 'completed', mode: 'camera', isDemoData: false, reps: [], events: [], painAfter };
};

describe('predictive analytics', () => {
  it('linear regression recovers a perfect line', () => {
    const r = linearRegression([0, 1, 2, 3], [10, 12, 14, 16]);
    expect(r.slope).toBeCloseTo(2);
    expect(r.intercept).toBeCloseTo(10);
    expect(r.r2).toBeCloseTo(1);
  });

  it('forecasts when the ROM goal will be reached', () => {
    // +1°/day over 10 sessions, currently ~70°, goal 90° → ~20 days.
    const s = Array.from({ length: 10 }, (_, i) => mk(18 - i * 2, 52 + i * 2));
    const f = forecastRom(s, 90, now);
    expect(f.status).toBe('on_course');
    expect(f.perWeek).toBeCloseTo(7, 0);
    expect(f.daysToGoal).toBeGreaterThan(15);
    expect(f.daysToGoal).toBeLessThan(25);
    expect(f.confidence).toBe('High');
  });

  it('handles reached goals, flat trends and too little data', () => {
    expect(forecastRom([mk(3, 60), mk(2, 61)], 90, now).status).toBe('not_enough_data');
    const flat = Array.from({ length: 8 }, (_, i) => mk(16 - i * 2, 70 + (i % 2)));
    expect(forecastRom(flat, 90, now).status).toBe('not_improving');
    expect(forecastRom(flat, 60, now).status).toBe('reached');
  });

  it('detects an unusual drop against the patient’s own baseline', () => {
    const s = [...Array.from({ length: 8 }, (_, i) => mk(20 - i * 2, 70 + (i % 3), 88)), mk(1, 55, 60, 7)];
    const a = detectAnomalies(s);
    expect(a.map((x) => x.metric)).toEqual(['ROM', 'Form', 'Pain']);
    expect(detectAnomalies(s.slice(0, 8))).toEqual([]);
  });
});
