import type { MovementState, RepLogic } from '@/types';

/**
 * Repetition state machine.
 *
 *   REST ──(passes start + h)──▶ MOVING ──(passes peak)──▶ PEAK
 *     ▲                            │                          │
 *     │                     (falls back: partial)   (leaves peak − h)
 *     │                            ▼                          ▼
 *     └──────(back below start − h: rep counted)────── RETURNING
 *
 * "h" is hysteresis: a dead-band so an angle wobbling around a threshold
 * (landmark jitter) cannot flip states back and forth and double count.
 *
 * To support both "angle goes up" (extension) and "angle goes down" (flexion)
 * with one implementation, we convert the angle into "progress":
 *   progress = angle        when direction = 'increase'
 *   progress = −angle       when direction = 'decrease'
 * so the working phase always means "progress increases".
 */
export interface RepMachine {
  state: MovementState;
  movementStartedAt: number | null;
  peakReachedAt: number | null;
  lastRepEndedAt: number | null;
}

export type RepEvent = 'none' | 'started' | 'peak' | 'completed' | 'partial' | 'too_fast' | 'debounced';

export const initialRepMachine = (): RepMachine => ({
  state: 'REST',
  movementStartedAt: null,
  peakReachedAt: null,
  lastRepEndedAt: null,
});

export function toProgress(angle: number, logic: RepLogic): number {
  return logic.direction === 'increase' ? angle : -angle;
}

export function stepRepMachine(
  machine: RepMachine,
  angle: number,
  t: number,
  logic: RepLogic,
): { machine: RepMachine; event: RepEvent } {
  if (!Number.isFinite(angle)) return { machine, event: 'none' };

  const p = toProgress(angle, logic);
  const start = toProgress(logic.startThreshold, logic);
  const peak = toProgress(logic.peakThreshold, logic);
  const h = logic.hysteresis;

  switch (machine.state) {
    case 'REST':
      if (p >= start + h) {
        return { machine: { ...machine, state: 'MOVING', movementStartedAt: t, peakReachedAt: null }, event: 'started' };
      }
      return { machine, event: 'none' };

    case 'MOVING':
      if (p >= peak) {
        return { machine: { ...machine, state: 'PEAK', peakReachedAt: t }, event: 'peak' };
      }
      if (p <= start - h) {
        // Went back to rest without reaching the peak → partial repetition, not counted.
        return { machine: { ...machine, state: 'REST', movementStartedAt: null }, event: 'partial' };
      }
      return { machine, event: 'none' };

    case 'PEAK':
      if (p <= peak - h) return { machine: { ...machine, state: 'RETURNING' }, event: 'none' };
      return { machine, event: 'none' };

    case 'RETURNING':
      if (p >= peak) return { machine: { ...machine, state: 'PEAK' }, event: 'none' };
      if (p <= start - h) {
        const started = machine.movementStartedAt ?? t;
        const duration = t - started;
        const sinceLast = machine.lastRepEndedAt === null ? Infinity : t - machine.lastRepEndedAt;
        const reset: RepMachine = { ...machine, state: 'REST', movementStartedAt: null, peakReachedAt: null };
        if (duration < logic.minRepDurationMs) return { machine: reset, event: 'too_fast' };
        if (sinceLast < logic.cooldownMs) return { machine: reset, event: 'debounced' };
        return { machine: { ...reset, lastRepEndedAt: t }, event: 'completed' };
      }
      return { machine, event: 'none' };
  }
}

/** Convenience for tests / offline analysis: run a whole angle series. */
export function countReps(samples: { t: number; angle: number }[], logic: RepLogic) {
  let m = initialRepMachine();
  const events: { t: number; event: RepEvent }[] = [];
  let reps = 0;
  for (const s of samples) {
    const r = stepRepMachine(m, s.angle, s.t, logic);
    m = r.machine;
    if (r.event !== 'none') events.push({ t: s.t, event: r.event });
    if (r.event === 'completed') reps++;
  }
  return { reps, events, finalState: m.state };
}
