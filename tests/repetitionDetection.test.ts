import { describe, expect, it } from 'vitest';
import { countReps, initialRepMachine, stepRepMachine } from '@/algorithms/repetitionDetection';
import type { RepLogic } from '@/types';
import { cycleSeries, KNEE_EXT_LOGIC } from './helpers';

describe('repetition state machine', () => {
  it('counts complete reps', () => {
    const s = cycleSeries({ rest: 95, peak: 165, reps: 5, cycleMs: 2500 });
    expect(countReps(s, KNEE_EXT_LOGIC).reps).toBe(5);
  });

  it('goes through REST → MOVING → PEAK → RETURNING → REST', () => {
    const angles = [95, 125, 155, 160, 140, 100];
    let m = initialRepMachine();
    const states: string[] = [];
    angles.forEach((a, i) => { m = stepRepMachine(m, a, i * 400, KNEE_EXT_LOGIC).machine; states.push(m.state); });
    expect(states).toEqual(['REST', 'MOVING', 'PEAK', 'PEAK', 'RETURNING', 'REST']);
  });

  it('does not double count with jitter around thresholds', () => {
    // Heavy noise (±6°) on top of 3 real reps
    const s = cycleSeries({ rest: 95, peak: 165, reps: 3, cycleMs: 3000, noise: 12 });
    expect(countReps(s, KNEE_EXT_LOGIC).reps).toBe(3);
  });

  it('jitter at rest never counts a rep', () => {
    const s = Array.from({ length: 300 }, (_, i) => ({ t: i * 33, angle: 115 + (i % 2 ? 5 : -5) }));
    expect(countReps(s, KNEE_EXT_LOGIC).reps).toBe(0);
  });

  it('partial movement is reported and not counted', () => {
    const s = cycleSeries({ rest: 95, peak: 140, reps: 3, cycleMs: 2500 });
    const r = countReps(s, KNEE_EXT_LOGIC);
    expect(r.reps).toBe(0);
    expect(r.events.filter((e) => e.event === 'partial')).toHaveLength(3);
  });

  it('very fast movement is rejected', () => {
    const s = cycleSeries({ rest: 95, peak: 165, reps: 4, cycleMs: 500, fps: 60 });
    const r = countReps(s, KNEE_EXT_LOGIC);
    expect(r.reps).toBe(0);
    expect(r.events.some((e) => e.event === 'too_fast')).toBe(true);
  });

  it('no movement → no reps', () => {
    const s = Array.from({ length: 200 }, (_, i) => ({ t: i * 33, angle: 98 }));
    expect(countReps(s, KNEE_EXT_LOGIC)).toMatchObject({ reps: 0, finalState: 'REST' });
  });

  it('supports decreasing-angle exercises (elbow flexion)', () => {
    const logic: RepLogic = { direction: 'decrease', startThreshold: 140, peakThreshold: 75, hysteresis: 6, minRepDurationMs: 600, cooldownMs: 300 };
    const s = cycleSeries({ rest: 170, peak: 45, reps: 4, cycleMs: 2400 });
    expect(countReps(s, logic).reps).toBe(4);
  });

  it('ignores NaN angles (missing landmark)', () => {
    const m = initialRepMachine();
    expect(stepRepMachine(m, NaN, 0, KNEE_EXT_LOGIC)).toEqual({ machine: m, event: 'none' });
  });
});
