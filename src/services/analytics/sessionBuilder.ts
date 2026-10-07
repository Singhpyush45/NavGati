import type { EngineState, ExerciseConfig, SessionRecord, Side } from '@/types';
import { average } from '@/algorithms/romCalculation';
import { qualityLabel } from '@/algorithms/formAssessment';

export interface SessionMeta {
  id: string;
  patientId: string;
  startedAt: number; // epoch ms
  endedAt: number;
  targetReps: number;
  mode: 'camera' | 'demo';
}

/** Converts the engine's final state into a storable session summary (metrics only, no video). */
export function buildSessionRecord(state: EngineState, exercise: ExerciseConfig, meta: SessionMeta): SessionRecord {
  const reps = state.reps;
  const roms = reps.map((r) => r.rom);
  const form = reps.length ? Math.round(average(reps.map((r) => r.formScore))) : 0;

  const counts = new Map<string, number>();
  for (const r of reps) for (const d of r.deviations) counts.set(d, (counts.get(d) ?? 0) + 1);
  const partials = state.events.filter((e) => e.type === 'partial_rep').length;
  if (partials) counts.set('Partial movement (target not reached)', partials);

  return {
    id: meta.id,
    patientId: meta.patientId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    side: state.side as Side | null,
    startedAt: new Date(meta.startedAt).toISOString(),
    endedAt: new Date(meta.endedAt).toISOString(),
    durationSec: Math.max(0, Math.round((meta.endedAt - meta.startedAt) / 1000)),
    targetReps: meta.targetReps,
    repetitions: reps.length,
    averageRom: Math.round(average(roms) * 10) / 10,
    maxRom: roms.length ? Math.max(...roms) : 0,
    minAngle: state.sessionMin === null ? null : Math.round(state.sessionMin),
    maxAngle: state.sessionMax === null ? null : Math.round(state.sessionMax),
    formScore: form,
    movementQuality: reps.length ? qualityLabel(form) : 'Needs review',
    deviations: [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    status: reps.length >= meta.targetReps ? 'completed' : 'partial',
    mode: meta.mode,
    isDemoData: meta.mode === 'demo',
    reps,
    events: state.events,
  };
}
