import type { CarePlan, CarePlanItem, SessionRecord } from '@/types';
import { getExercise } from '@/services/exercise/exercises';

/**
 * Care-plan analytics (pure functions — no React, no storage).
 * Built on-site at ReThink Hackathon 2026.
 */

export const PLAN_LIMITS = { maxItems: 6, reps: [1, 50], perWeek: [1, 14], instructions: 160 } as const;

/** Monday 00:00 (local time) of the week that contains `now`. */
export function weekStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setDate(d.getDate() - dow);
  return d;
}

export type PlanItemStatus = 'done' | 'on_track' | 'behind';

export interface PlanItemProgress {
  item: CarePlanItem;
  name: string;
  /** Sessions of this exercise completed this week (capped at the target). */
  done: number;
  target: number;
  doneToday: boolean;
  status: PlanItemStatus;
  latestRom: number | null;
  /** latestRom as % of the therapist's ROM goal (null when no goal / no data). */
  romGoalPct: number | null;
}

export interface PlanProgress {
  items: PlanItemProgress[];
  /** Sessions done vs prescribed this week, 0–100. */
  weekAdherence: number;
  /** First exercise the patient should do next (not finished for the week and not done today). */
  nextUp: CarePlanItem | null;
  behind: string[];
}

/** A session counts towards the plan when at least 80% of the prescribed reps were done. */
export function countsTowardsPlan(s: SessionRecord, item: CarePlanItem): boolean {
  return s.exerciseId === item.exerciseId && s.repetitions >= Math.ceil(item.targetReps * 0.8);
}

export function planProgress(plan: CarePlan | null, sessions: SessionRecord[], now = new Date()): PlanProgress {
  if (!plan || !plan.items.length) return { items: [], weekAdherence: 0, nextUp: null, behind: [] };
  const start = weekStart(now);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  // Days elapsed in the week including today (1 on Monday … 7 on Sunday).
  const daysElapsed = Math.round((today.getTime() - start.getTime()) / 864e5) + 1;
  const thisWeek = sessions.filter((s) => new Date(s.startedAt) >= start && new Date(s.startedAt) <= now);

  const items = plan.items.map((item): PlanItemProgress => {
    const mine = thisWeek.filter((s) => countsTowardsPlan(s, item));
    const done = Math.min(mine.length, item.sessionsPerWeek);
    const expectedByToday = Math.floor((item.sessionsPerWeek * daysElapsed) / 7);
    const status: PlanItemStatus = done >= item.sessionsPerWeek ? 'done' : done >= expectedByToday ? 'on_track' : 'behind';
    const all = sessions.filter((s) => s.exerciseId === item.exerciseId).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const latestRom = all.length ? all[all.length - 1].averageRom : null;
    const romGoalPct = item.targetRom && latestRom != null ? Math.min(100, Math.round((latestRom / item.targetRom) * 100)) : null;
    return {
      item, name: getExercise(item.exerciseId)?.name ?? item.exerciseId,
      done, target: item.sessionsPerWeek,
      doneToday: mine.some((s) => new Date(s.startedAt) >= today),
      status, latestRom, romGoalPct,
    };
  });

  const target = items.reduce((n, i) => n + i.target, 0);
  const done = items.reduce((n, i) => n + i.done, 0);
  const next = items.find((i) => i.status !== 'done' && !i.doneToday) ?? null;
  return {
    items,
    weekAdherence: target ? Math.round((100 * done) / target) : 0,
    nextUp: next?.item ?? null,
    behind: items.filter((i) => i.status === 'behind').map((i) => i.name),
  };
}

/** Returns a list of human-readable problems; empty list = valid plan. */
export function validateCarePlan(items: CarePlanItem[]): string[] {
  const errors: string[] = [];
  if (items.length > PLAN_LIMITS.maxItems) errors.push(`A plan can have at most ${PLAN_LIMITS.maxItems} exercises.`);
  const seen = new Set<string>();
  items.forEach((it, i) => {
    const n = `Exercise ${i + 1}`;
    const ex = getExercise(it.exerciseId);
    if (!ex) errors.push(`${n}: unknown exercise.`);
    else if (!ex.supported) errors.push(`${n}: ${ex.name} is not supported by camera tracking yet.`);
    if (seen.has(it.exerciseId)) errors.push(`${n}: ${ex?.name ?? it.exerciseId} is already in the plan.`);
    seen.add(it.exerciseId);
    if (!Number.isInteger(it.targetReps) || it.targetReps < PLAN_LIMITS.reps[0] || it.targetReps > PLAN_LIMITS.reps[1]) errors.push(`${n}: reps must be between 1 and 50.`);
    if (!Number.isInteger(it.sessionsPerWeek) || it.sessionsPerWeek < PLAN_LIMITS.perWeek[0] || it.sessionsPerWeek > PLAN_LIMITS.perWeek[1]) errors.push(`${n}: sessions per week must be between 1 and 14.`);
    if (it.targetRom != null && (it.targetRom <= 0 || it.targetRom > 180)) errors.push(`${n}: ROM goal must be between 1° and 180°.`);
    if ((it.instructions ?? '').length > PLAN_LIMITS.instructions) errors.push(`${n}: instructions are too long.`);
  });
  return errors;
}

/** Link that opens camera setup pre-filled with the prescribed exercise. */
export function startLink(item: CarePlanItem): string {
  const q = new URLSearchParams({ exercise: item.exerciseId, reps: String(item.targetReps), side: item.side });
  return `/setup?${q.toString()}`;
}
