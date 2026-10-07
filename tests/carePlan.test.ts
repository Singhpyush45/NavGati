import { describe, expect, it } from 'vitest';
import type { CarePlan, SessionRecord } from '@/types';
import { planProgress, startLink, validateCarePlan, weekStart } from '@/services/analytics/carePlan';
import { LocalDataService, MemoryStore } from '@/services/database/localDataService';

const session = (exerciseId: string, iso: string, repetitions = 12): SessionRecord => ({
  id: iso + exerciseId, patientId: 'p1', exerciseId, exerciseName: exerciseId, side: 'right', startedAt: iso, endedAt: iso,
  durationSec: 200, targetReps: 12, repetitions, averageRom: 70, maxRom: 75, minAngle: 90, maxAngle: 160, formScore: 85,
  movementQuality: 'Good', deviations: [], status: 'completed', mode: 'camera', isDemoData: false, reps: [], events: [],
});

const plan: CarePlan = {
  patientId: 'p1', updatedAt: '', updatedById: 't1', updatedByName: 'T',
  items: [
    { exerciseId: 'knee_extension', side: 'right', targetReps: 12, sessionsPerWeek: 4, targetRom: 100 },
    { exerciseId: 'elbow_flexion', side: 'auto', targetReps: 10, sessionsPerWeek: 2 },
  ],
};

// Thursday 2026-10-08, 18:00 local → week starts Monday 2026-10-05.
const now = new Date(2026, 9, 8, 18, 0);
const at = (day: number, h = 10) => new Date(2026, 9, day, h).toISOString();

describe('care plan', () => {
  it('week starts on Monday', () => {
    const w = weekStart(now);
    expect(w.getDay()).toBe(1);
    expect(w.getDate()).toBe(5);
  });

  it('counts only this week, only sessions with ≥80% of prescribed reps', () => {
    const p = planProgress(plan, [
      session('knee_extension', at(1)),            // last week → ignored
      session('knee_extension', at(5)),
      session('knee_extension', at(6, 9), 5),      // too few reps → ignored
      session('knee_extension', at(7)),
      session('elbow_flexion', at(8, 9), 10),
    ], now);
    const knee = p.items[0];
    expect(knee.done).toBe(2);
    expect(knee.status).toBe('on_track'); // 4/week × 4 days / 7 = 2 expected by Thursday
    expect(knee.romGoalPct).toBe(70);
    expect(p.items[1].doneToday).toBe(true);
    expect(p.weekAdherence).toBe(50); // 3 of 6 sessions
    expect(p.nextUp?.exerciseId).toBe('knee_extension');
  });

  it('flags exercises that fall behind', () => {
    const p = planProgress(plan, [], now);
    expect(p.behind).toEqual(['Knee Extension', 'Elbow Flexion']);
    expect(p.weekAdherence).toBe(0);
  });

  it('handles a missing plan', () => {
    expect(planProgress(null, [], now)).toEqual({ items: [], weekAdherence: 0, nextUp: null, behind: [] });
  });

  it('validates therapist input', () => {
    expect(validateCarePlan(plan.items)).toEqual([]);
    const errs = validateCarePlan([
      { exerciseId: 'knee_extension', side: 'auto', targetReps: 0, sessionsPerWeek: 3 },
      { exerciseId: 'knee_extension', side: 'auto', targetReps: 10, sessionsPerWeek: 30, targetRom: 200 },
      { exerciseId: 'shoulder_adduction', side: 'auto', targetReps: 10, sessionsPerWeek: 3 },
    ]);
    expect(errs.join(' ')).toMatch(/reps must be/);
    expect(errs.join(' ')).toMatch(/already in the plan/);
    expect(errs.join(' ')).toMatch(/sessions per week/);
    expect(errs.join(' ')).toMatch(/ROM goal/);
    expect(errs.join(' ')).toMatch(/not supported/);
  });

  it('builds a pre-filled start link', () => {
    expect(startLink(plan.items[0])).toBe('/setup?exercise=knee_extension&reps=12&side=right');
  });

  it('local backend stores plans and only therapists can write them', async () => {
    const db = new LocalDataService(new MemoryStore());
    expect((await db.getCarePlan('p001'))?.items.length).toBeGreaterThan(0); // demo plan seeded
    const saved = await db.saveCarePlan({ patientId: 'p002', items: plan.items, updatedById: 't1', updatedByName: 'T' }, 'THERAPIST');
    expect(saved.updatedAt).toBeTruthy();
    expect((await db.getCarePlan('p002'))?.items).toHaveLength(2);
    await expect(db.saveCarePlan({ patientId: 'p002', items: [], updatedById: 'p002', updatedByName: 'P' }, 'PATIENT')).rejects.toThrow(/therapist/i);
    await expect(db.saveCarePlan({ patientId: 'p002', items: [{ ...plan.items[0], targetReps: 99 }], updatedById: 't1', updatedByName: 'T' }, 'THERAPIST')).rejects.toThrow(/reps/);
  });
});
