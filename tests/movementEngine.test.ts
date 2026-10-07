import { describe, expect, it } from 'vitest';
import { analyzeMovement, createEngineState, MovementEngine } from '@/services/movement/movementEngine';
import { DemoSimulator } from '@/services/pose/demoSimulator';
import { getExercise, EXERCISES } from '@/services/exercise/exercises';
import { calculateAngle } from '@/algorithms/angleCalculation';
import { emptyFrame } from './helpers';

const knee = getExercise('knee_extension')!;

function run(exId: string, seconds: number, fps = 30) {
  const ex = getExercise(exId)!;
  const sim = new DemoSimulator(ex);
  const engine = new MovementEngine(ex, 'auto', 12);
  let last;
  for (let t = 0; t <= seconds * 1000; t += 1000 / fps) last = engine.analyze(sim.frameAt(t));
  return { engine, last: last!, sim };
}

describe('generic movement engine', () => {
  it('knee extension: counts reps, measures ROM and form from simulated landmarks', () => {
    // 3.4 s cycles; every 6th cycle is a partial rep in the simulator
    const { last, engine } = run('knee_extension', 3.4 * 12);
    const st = engine.getState();
    expect(last.repCount).toBeGreaterThanOrEqual(9);
    expect(last.repCount).toBeLessThanOrEqual(11);
    expect(st.events.some((e) => e.type === 'partial_rep')).toBe(true);
    expect(last.rom).toBeGreaterThan(50);
    expect(last.formScore).not.toBeNull();
    expect(last.confidence.ok).toBe(true);
    expect(last.side).toBe('left');
  });

  it('every supported exercise counts reps with the same engine', () => {
    for (const ex of EXERCISES.filter((e) => e.supported)) {
      const { last } = run(ex.id, 3.4 * 5 + 0.5);
      expect(last.repCount, ex.id).toBeGreaterThanOrEqual(4);
      expect(last.repCount, ex.id).toBeLessThanOrEqual(5);
    }
  });

  it('simulator skeleton reproduces the requested angle', () => {
    const sim = new DemoSimulator(knee, { noiseDeg: 0, sway: 0 });
    const lm = sim.buildSkeleton(137);
    // left hip 23, knee 25, ankle 27 — tolerance for tiny sway noise
    expect(calculateAngle(lm[23], lm[25], lm[27], sim.aspectRatio)).toBeCloseTo(137, 0);
  });

  it('does not analyze when nobody is detected (person left frame)', () => {
    const { result, state } = analyzeMovement({ exercise: knee, frame: emptyFrame(0), previousState: createEngineState() });
    expect(result.confidence.reason).toBe('no_person');
    expect(result.jointAngle).toBeNull();
    expect(result.feedback[0].message).toMatch(/Full body not detected/);
    expect(state.analyzedFrames).toBe(0);
  });

  it('warns and pauses analysis when multiple people are detected', () => {
    const sim = new DemoSimulator(knee);
    sim.simulateSecondPerson = true;
    const { result } = analyzeMovement({ exercise: knee, frame: sim.frameAt(0), previousState: createEngineState() });
    expect(result.confidence.reason).toBe('multiple_people');
    expect(result.feedback[0].message).toBe('Please ensure only one person is visible.');
  });

  it('low landmark confidence blocks analysis with a clear message', () => {
    const sim = new DemoSimulator(knee);
    const frame = sim.frameAt(0);
    frame.landmarks![25] = { ...frame.landmarks![25], visibility: 0.1 }; // left knee
    const { result } = analyzeMovement({ exercise: knee, frame, previousState: createEngineState(), sidePreference: 'left' });
    expect(result.confidence.ok).toBe(false);
    expect(result.confidence.missing).toContain('knee');
    expect(result.feedback[0].message).toBe('Move your leg fully into view.');
  });

  it('keeps rep count through a temporary loss of tracking', () => {
    const sim = new DemoSimulator(knee);
    const engine = new MovementEngine(knee);
    for (let t = 0; t < 7000; t += 33) engine.analyze(sim.frameAt(t));
    const before = engine.getState().repCount;
    sim.simulateLeaveFrame = true;
    for (let t = 7000; t < 8000; t += 33) engine.analyze(sim.frameAt(t));
    expect(engine.getState().repCount).toBe(before);
  });

  it('reports unsupported exercises honestly', () => {
    const ex = getExercise('shoulder_adduction')!;
    const { result } = analyzeMovement({ exercise: ex, frame: emptyFrame(0, 1), previousState: createEngineState() });
    expect(result.feedback[0].message).toBe('Exercise not supported yet.');
  });

  it('no movement → no reps and zero-ish ROM', () => {
    const sim = new DemoSimulator(knee, { noiseDeg: 0 });
    const engine = new MovementEngine(knee);
    for (let t = 0; t < 5000; t += 33) {
      engine.analyze({ landmarks: sim.buildSkeleton(95), numPoses: 1, timestamp: t, aspectRatio: sim.aspectRatio });
    }
    const st = engine.getState();
    expect(st.repCount).toBe(0);
    expect((st.sessionMax ?? 0) - (st.sessionMin ?? 0)).toBeLessThan(3);
  });
});
