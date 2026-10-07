import type {
  AnalysisResult, EngineState, ExerciseConfig, MovementEvent, PoseFrame, RepRecord, SidePreference,
} from '@/types';
import { calculateAngle, ema } from '@/algorithms/angleCalculation';
import { getPoint } from '@/algorithms/landmarks';
import { checkConfidence, chooseSide } from '@/algorithms/landmarkConfidence';
import { stepRepMachine } from '@/algorithms/repetitionDetection';
import { updateRom, average } from '@/algorithms/romCalculation';
import {
  accumulateRuleStats, evaluateFrameRules, liveFormEstimate, scoreRepetition,
} from '@/algorithms/formAssessment';
import { computeJointAngles, validateExercise, VALIDATION_WINDOW_MS } from '@/algorithms/exerciseRecognition';
import { buildFeedback } from '@/algorithms/feedbackEngine';

/** Tunables for signal processing (not exercise specific). */
export const ENGINE_DEFAULTS = {
  angleSmoothing: 0.45, // EMA alpha for the joint angle
  velocitySmoothing: 0.3, // EMA alpha for angular velocity
  maxEvents: 300,
};

export function createEngineState(): EngineState {
  return {
    rep: { state: 'REST', movementStartedAt: null, peakReachedAt: null, lastRepEndedAt: null },
    repCount: 0,
    side: null,
    smoothedAngle: null,
    lastTimestamp: null,
    velocity: 0,
    sessionMin: null,
    sessionMax: null,
    current: null,
    reps: [],
    events: [],
    history: [],
    lowConfidenceFrames: 0,
    analyzedFrames: 0,
  };
}

export interface AnalyzeInput {
  exercise: ExerciseConfig;
  frame: PoseFrame;
  previousState: EngineState;
  sidePreference?: SidePreference;
  targetReps?: number;
}

const pushEvent = (events: MovementEvent[], e: MovementEvent) =>
  [...events, e].slice(-ENGINE_DEFAULTS.maxEvents);

/**
 * THE generic movement-analysis engine.
 * Pure function: (exercise config, one frame, previous state) → (result, next state).
 * It contains no exercise-specific code — everything comes from ExerciseConfig.
 */
export function analyzeMovement({
  exercise, frame, previousState, sidePreference = 'auto', targetReps,
}: AnalyzeInput): { result: AnalysisResult; state: EngineState } {
  const prev = previousState;

  if (!exercise.supported) {
    const confidence = { ok: false, score: 0, missing: [], reason: 'low_confidence' as const };
    return {
      state: prev,
      result: baseResult(prev, confidence, [{ severity: 'error', type: 'info', message: 'Exercise not supported yet.' }]),
    };
  }

  // 1. Which side of the body? (locked once chosen so it can't flip mid-session)
  let side = prev.side ?? (sidePreference !== 'auto' ? sidePreference : null);
  if (!side && frame.landmarks) side = chooseSide(frame.landmarks, exercise.landmarks);
  const effectiveSide = side ?? 'left';

  // 2. Landmark confidence gate — never analyze untrustworthy frames.
  const confidence = checkConfidence(frame, exercise.landmarks, effectiveSide);
  if (!confidence.ok || !frame.landmarks) {
    const lowConfidenceFrames = prev.lowConfidenceFrames + 1;
    const events = lowConfidenceFrames === 1
      ? pushEvent(prev.events, { t: frame.timestamp, type: 'low_confidence', detail: confidence.reason })
      : prev.events;
    const state: EngineState = { ...prev, lowConfidenceFrames, events, lastTimestamp: null };
    const feedback = buildFeedback({
      exercise, confidence, exerciseMatch: 'unknown', moving: false, velocity: 0, frameRules: {},
      lastRep: null, repJustCompleted: false, repCount: prev.repCount, targetReps, partialJustHappened: false,
    });
    return { state, result: baseResult(state, confidence, feedback) };
  }

  const lm = frame.landmarks;
  if (!prev.side) side = effectiveSide; // lock side on first confident frame

  // 3. Joint angle at the target joint, smoothed against jitter.
  const [pa, pb, pc] = exercise.landmarks.map((p) => getPoint(lm, p, effectiveSide)!);
  const raw = calculateAngle(pa, pb, pc, frame.aspectRatio);
  const angle = ema(prev.smoothedAngle, raw, ENGINE_DEFAULTS.angleSmoothing);

  // 4. Angular velocity (deg/s).
  let velocity = prev.velocity;
  if (prev.lastTimestamp !== null && prev.smoothedAngle !== null) {
    const dt = (frame.timestamp - prev.lastTimestamp) / 1000;
    if (dt > 0 && dt < 0.5) {
      velocity = ema(prev.velocity, (angle - prev.smoothedAngle) / dt, ENGINE_DEFAULTS.velocitySmoothing);
    }
  }

  // 5. Repetition state machine.
  const { machine, event } = stepRepMachine(prev.rep, angle, frame.timestamp, exercise.repLogic);
  const moving = machine.state !== 'REST';

  // 6. Per-rep window (includes the rest position before the movement).
  let current = prev.current ?? { minAngle: angle, maxAngle: angle, ruleStats: {} };
  current = { ...current, minAngle: Math.min(current.minAngle, angle), maxAngle: Math.max(current.maxAngle, angle) };

  // 7. Form rules evaluated on frames during the movement.
  const frameRules = evaluateFrameRules(exercise.formRules, lm, effectiveSide, frame.aspectRatio, velocity);
  if (moving || event === 'completed') current = { ...current, ruleStats: accumulateRuleStats(current.ruleStats, frameRules) };

  let events = prev.events;
  let reps = prev.reps;
  let repCount = prev.repCount;
  let repetitionCompleted = false;

  if (event === 'completed') {
    const extreme = exercise.repLogic.direction === 'increase' ? current.maxAngle : current.minAngle;
    const scored = scoreRepetition(exercise, current.ruleStats, extreme);
    const rep: RepRecord = {
      index: repCount + 1,
      startedAt: prev.rep.movementStartedAt ?? frame.timestamp,
      endedAt: frame.timestamp,
      minAngle: round1(current.minAngle),
      maxAngle: round1(current.maxAngle),
      rom: round1(current.maxAngle - current.minAngle),
      peakAngle: round1(extreme),
      formScore: scored.score,
      reachedTarget: scored.reachedTarget,
      deviations: scored.deviations,
    };
    reps = [...reps, rep];
    repCount += 1;
    repetitionCompleted = true;
    events = pushEvent(events, { t: frame.timestamp, type: 'rep_completed', detail: `Rep ${rep.index}: ROM ${rep.rom}°, form ${rep.formScore}%` });
    for (const d of scored.deviations) events = pushEvent(events, { t: frame.timestamp, type: 'deviation', detail: d });
    current = { minAngle: angle, maxAngle: angle, ruleStats: {} };
  } else if (event === 'partial') {
    events = pushEvent(events, { t: frame.timestamp, type: 'partial_rep', detail: 'Movement target not reached' });
    current = { ...current, ruleStats: {} };
  } else if (event === 'too_fast' || event === 'debounced') {
    events = pushEvent(events, { t: frame.timestamp, type: 'rep_too_fast', detail: 'Cycle too fast to count' });
    current = { minAngle: angle, maxAngle: angle, ruleStats: {} };
  }

  // 8. Session-level observed range.
  const rom = updateRom({ min: prev.sessionMin, max: prev.sessionMax }, angle);

  // 9. Exercise validation over a short sliding window.
  const jointAngles = computeJointAngles(lm, effectiveSide, frame.aspectRatio);
  const history = [...prev.history, { t: frame.timestamp, angles: jointAngles }]
    .filter((h) => frame.timestamp - h.t <= VALIDATION_WINDOW_MS + 500);
  const exerciseMatch = validateExercise(history, exercise, frame.timestamp);
  if (exerciseMatch === 'mismatch' && validateExercise(prev.history, exercise, prev.lastTimestamp ?? 0) !== 'mismatch') {
    events = pushEvent(events, { t: frame.timestamp, type: 'mismatch', detail: 'Movement did not match selected exercise' });
  }

  const state: EngineState = {
    rep: machine,
    repCount,
    side,
    smoothedAngle: angle,
    lastTimestamp: frame.timestamp,
    velocity,
    sessionMin: rom.min,
    sessionMax: rom.max,
    current,
    reps,
    events,
    history,
    lowConfidenceFrames: 0,
    analyzedFrames: prev.analyzedFrames + 1,
  };

  const formScore = reps.length
    ? Math.round(average(reps.map((r) => r.formScore)))
    : liveFormEstimate(exercise, current.ruleStats);

  const feedback = buildFeedback({
    exercise, confidence, exerciseMatch, moving, velocity, frameRules,
    lastRep: reps[reps.length - 1] ?? null, repJustCompleted: repetitionCompleted, repCount, targetReps,
    partialJustHappened: event === 'partial',
  });

  return {
    state,
    result: {
      jointAngle: round1(angle),
      rom: round1(rom.rom),
      minAngle: rom.min === null ? null : round1(rom.min),
      maxAngle: rom.max === null ? null : round1(rom.max),
      movementState: machine.state,
      repetitionCompleted,
      repCount,
      formScore,
      feedback,
      confidence,
      velocity: round1(velocity),
      side,
      exerciseMatch,
    },
  };
}

function baseResult(state: EngineState, confidence: AnalysisResult['confidence'], feedback: AnalysisResult['feedback']): AnalysisResult {
  const formScore = state.reps.length ? Math.round(average(state.reps.map((r) => r.formScore))) : null;
  return {
    jointAngle: null,
    rom: state.sessionMin !== null && state.sessionMax !== null ? round1(state.sessionMax - state.sessionMin) : 0,
    minAngle: state.sessionMin,
    maxAngle: state.sessionMax,
    movementState: state.rep.state,
    repetitionCompleted: false,
    repCount: state.repCount,
    formScore,
    feedback,
    confidence,
    velocity: 0,
    side: state.side,
    exerciseMatch: 'unknown',
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Small stateful wrapper for UI code. */
export class MovementEngine {
  private state = createEngineState();
  constructor(
    public readonly exercise: ExerciseConfig,
    private sidePreference: SidePreference = 'auto',
    private targetReps?: number,
  ) {}
  analyze(frame: PoseFrame): AnalysisResult {
    const { result, state } = analyzeMovement({
      exercise: this.exercise, frame, previousState: this.state,
      sidePreference: this.sidePreference, targetReps: this.targetReps,
    });
    this.state = state;
    return result;
  }
  getState(): EngineState { return this.state; }
  reset() { this.state = createEngineState(); }
}
