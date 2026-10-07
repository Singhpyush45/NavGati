import { describe, expect, it } from 'vitest';
import { detectCameraView, reachedTarget, scoreRepetition, qualityLabel } from '@/algorithms/formAssessment';
import { validateExercise, recognizeActiveJoint } from '@/algorithms/exerciseRecognition';
import { checkConfidence, fullBodyVisible } from '@/algorithms/landmarkConfidence';
import { buildFeedback, FeedbackStabilizer } from '@/algorithms/feedbackEngine';
import { getExercise } from '@/services/exercise/exercises';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { KNEE_EXT_LOGIC } from './helpers';

const knee = getExercise('knee_extension')!;

describe('form scoring', () => {
  it('perfect rep scores 100', () => {
    const stats = { controlled_speed: { pass: 30, total: 30 }, thigh_supported: { pass: 30, total: 30 }, trunk_upright: { pass: 30, total: 30 }, side_view: { pass: 30, total: 30 } };
    expect(scoreRepetition(knee, stats, 165)).toMatchObject({ score: 100, reachedTarget: true, deviations: [] });
  });
  it('missing the target lowers score and reports a deviation', () => {
    const r = scoreRepetition(knee, {}, 152);
    expect(r.reachedTarget).toBe(false);
    expect(r.score).toBe(Math.round(100 * (9 - 3) / 9));
    expect(r.deviations).toContain('Reduced extension');
  });
  it('fast movement for most frames is flagged', () => {
    const r = scoreRepetition(knee, { controlled_speed: { pass: 5, total: 30 } }, 165);
    expect(r.deviations).toContain('Uncontrolled movement speed');
    expect(r.score).toBeLessThan(100);
  });
  it('target works for decreasing exercises', () => {
    const logic = { ...KNEE_EXT_LOGIC, direction: 'decrease' as const };
    expect(reachedTarget(50, 55, logic)).toBe(true);
    expect(reachedTarget(60, 55, logic)).toBe(false);
  });
  it('quality labels', () => {
    expect(qualityLabel(91)).toBe('Good');
    expect(qualityLabel(70)).toBe('Fair');
    expect(qualityLabel(40)).toBe('Needs review');
  });
  it('detects side vs front camera view', () => {
    const side = new DemoSimulator(knee).buildSkeleton(100);
    const front = new DemoSimulator(getExercise('shoulder_abduction')!).buildSkeleton(20);
    expect(detectCameraView(side, 4 / 3)).toBe('side');
    expect(detectCameraView(front, 4 / 3)).toBe('front');
  });
});

describe('exercise validation', () => {
  const hist = (fn: (i: number) => Record<string, number>) =>
    Array.from({ length: 90 }, (_, i) => ({ t: i * 33, angles: fn(i) }));
  it('matches when the target joint moves', () => {
    const h = hist((i) => ({ knee: 100 + i * 0.6, elbow: 170 }));
    expect(validateExercise(h, knee, 90 * 33)).toBe('match');
  });
  it('mismatch when another joint moves instead', () => {
    const h = hist((i) => ({ knee: 100, elbow: 170 - i * 1.2 }));
    expect(validateExercise(h, knee, 90 * 33)).toBe('mismatch');
  });
  it('unknown when still or not enough data', () => {
    expect(validateExercise(hist(() => ({ knee: 100, elbow: 170 })), knee, 90 * 33)).toBe('unknown');
    expect(validateExercise([], knee, 0)).toBe('unknown');
  });
  it('recognizes the most active joint', () => {
    expect(recognizeActiveJoint(hist((i) => ({ knee: 100, shoulder: 20 + i })))?.joint).toBe('shoulder');
  });
});

describe('landmark confidence', () => {
  const sim = new DemoSimulator(knee);
  it('accepts a clearly visible body', () => {
    const f = sim.frameAt(0);
    expect(checkConfidence(f, ['hip', 'knee', 'ankle'], 'left').ok).toBe(true);
    expect(fullBodyVisible(f.landmarks)).toBe(true);
  });
  it('flags out-of-frame landmarks', () => {
    const f = sim.frameAt(0);
    f.landmarks![27] = { ...f.landmarks![27], y: 1.3 };
    expect(checkConfidence(f, ['hip', 'knee', 'ankle'], 'left')).toMatchObject({ ok: false, reason: 'out_of_frame' });
  });
});

describe('feedback', () => {
  it('never exceeds 3 items and puts errors first', () => {
    const items = buildFeedback({
      exercise: knee, confidence: { ok: true, score: 1, missing: [], reason: 'ok' }, exerciseMatch: 'mismatch',
      moving: true, velocity: 400, frameRules: { controlled_speed: false, thigh_supported: false, side_view: false },
      lastRep: null, repJustCompleted: false, repCount: 0, partialJustHappened: true,
    });
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items[0].severity).toBe('warning');
  });
  it('stabilizer holds messages to prevent flicker', () => {
    const s = new FeedbackStabilizer(1000);
    const a = [{ message: 'A', severity: 'good' as const, type: 'info' as const }];
    const b = [{ message: 'B', severity: 'good' as const, type: 'info' as const }];
    expect(s.update(a, 0)).toBe(a);
    expect(s.update(b, 200)).toBe(a);
    expect(s.update(b, 1200)).toBe(b);
  });
});
