import type { SessionRecord } from '@/types';
import { shortDate } from '@/utils/format';
import { byDate, trendLabel } from './trends';

export function toSeries(sessions: SessionRecord[]) {
  const s = [...sessions].sort(byDate);
  return {
    rom: s.map((x) => ({ label: shortDate(x.startedAt), value: x.averageRom })),
    form: s.map((x) => ({ label: shortDate(x.startedAt), value: x.formScore })),
    reps: s.map((x) => ({ label: shortDate(x.startedAt), value: x.repetitions, target: x.targetReps })),
    pain: s.filter((x) => x.painAfter != null || x.painBefore != null)
      .map((x) => ({ label: shortDate(x.startedAt), value: (x.painAfter ?? x.painBefore) as number })),
    completion: s.map((x) => ({ label: shortDate(x.startedAt), value: Math.round((100 * Math.min(x.repetitions, x.targetReps)) / Math.max(1, x.targetReps)) })),
  };
}

export function trends(sessions: SessionRecord[]) {
  const s = [...sessions].sort(byDate).slice(-10);
  return {
    rom: trendLabel(s.map((x) => x.averageRom), 0.4),
    form: trendLabel(s.map((x) => x.formScore), 0.4),
  };
}

/** Most frequent exercise in the list (the "current" prescription in the MVP). */
export function currentExercise(sessions: SessionRecord[]): string | null {
  const last = [...sessions].sort(byDate).pop();
  return last?.exerciseId ?? null;
}
