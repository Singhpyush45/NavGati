import type { ExerciseConfig, FormRule, Landmark, RepLogic, RuleStats, Side } from '@/types';
import { calculateAngle, distance, segmentDeviation } from './angleCalculation';
import { getPoint } from './landmarks';
import { toProgress } from './repetitionDetection';

/**
 * Estimates whether the camera sees the patient from the side or the front.
 * Facing the camera → shoulders look wide compared with the torso length.
 * Side-on → the two shoulders overlap and look narrow.
 */
export function detectCameraView(landmarks: Landmark[], aspectRatio = 1): 'front' | 'side' | 'uncertain' {
  const ls = landmarks[11], rs = landmarks[12], lh = landmarks[23], rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return 'uncertain';
  const shoulderWidth = distance(ls, rs, aspectRatio);
  const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const torso = distance(midS, midH, aspectRatio);
  if (torso < 1e-6) return 'uncertain';
  const ratio = shoulderWidth / torso;
  if (ratio > 0.5) return 'front';
  if (ratio < 0.38) return 'side';
  return 'uncertain';
}

/** Frame-level rules: evaluated on every analyzed frame during a repetition. */
export function evaluateFrameRules(
  rules: FormRule[],
  landmarks: Landmark[],
  side: Side,
  aspectRatio: number,
  velocity: number,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const pt = (p: Parameters<typeof getPoint>[1]) => getPoint(landmarks, p, side);
  for (const rule of rules) {
    switch (rule.type) {
      case 'controlledSpeed':
        out[rule.id] = Math.abs(velocity) <= rule.maxVelocity;
        break;
      case 'segmentOrientation': {
        const a = pt(rule.from), b = pt(rule.to);
        if (!a || !b) break;
        const dev = segmentDeviation(a, b, rule.reference, aspectRatio);
        if (Number.isFinite(dev)) out[rule.id] = dev <= rule.maxDeviation;
        break;
      }
      case 'jointAngleRange': {
        const [p1, p2, p3] = rule.points.map(pt);
        if (!p1 || !p2 || !p3) break;
        const ang = calculateAngle(p1, p2, p3, aspectRatio);
        if (Number.isFinite(ang)) out[rule.id] = ang >= rule.min && ang <= rule.max;
        break;
      }
      case 'cameraView': {
        const view = detectCameraView(landmarks, aspectRatio);
        if (view !== 'uncertain') out[rule.id] = view === rule.view;
        break;
      }
      case 'targetReached':
        break; // rep-level, see scoreRepetition
    }
  }
  return out;
}

export function accumulateRuleStats(stats: RuleStats, results: Record<string, boolean>): RuleStats {
  const next: RuleStats = { ...stats };
  for (const [id, pass] of Object.entries(results)) {
    const prev = next[id] ?? { pass: 0, total: 0 };
    next[id] = { pass: prev.pass + (pass ? 1 : 0), total: prev.total + 1 };
  }
  return next;
}

/** Did the repetition's extreme angle reach the configured target? */
export function reachedTarget(extremeAngle: number, targetAngle: number, logic: RepLogic): boolean {
  return toProgress(extremeAngle, logic) >= toProgress(targetAngle, logic);
}

/** Minimum pass rate for a frame rule before it is reported as a deviation. */
export const DEVIATION_PASS_RATE = 0.7;

/**
 * Scores one repetition 0–100.
 *   score = 100 × Σ(weight × passRate) / Σ(weight)
 * Frame rules use the fraction of frames that passed; targetReached is 0 or 1.
 */
export function scoreRepetition(
  exercise: ExerciseConfig,
  stats: RuleStats,
  extremeAngle: number,
): { score: number; reachedTarget: boolean; deviations: string[] } {
  let weighted = 0;
  let weights = 0;
  let target = true;
  const deviations: string[] = [];
  for (const rule of exercise.formRules) {
    let rate: number;
    if (rule.type === 'targetReached') {
      target = reachedTarget(extremeAngle, rule.targetAngle, exercise.repLogic);
      rate = target ? 1 : 0;
    } else {
      const s = stats[rule.id];
      rate = s && s.total > 0 ? s.pass / s.total : 1; // not observed → no penalty
    }
    if (rate < DEVIATION_PASS_RATE) deviations.push(deviationLabel(rule, exercise));
    weighted += rule.weight * rate;
    weights += rule.weight;
  }
  const score = weights > 0 ? Math.round((100 * weighted) / weights) : 100;
  return { score, reachedTarget: target, deviations };
}

/**
 * Neutral, clinician-facing name for a failed rule ("Reduced extension"),
 * separate from the patient-facing coaching message ("Try slightly greater extension").
 * These describe what was measured — never a diagnosis.
 */
const SEGMENT_LABELS: Record<string, string> = {
  thigh_supported: 'Thigh lifted from support',
  thigh_vertical: 'Thigh movement during knee bend',
  upper_arm_still: 'Upper-arm compensation',
  elbow_straight: 'Elbow bent during arm movement',
  shin_still: 'Lower-leg movement',
  trunk_upright: 'Trunk lean (compensation)',
};
export function deviationLabel(rule: FormRule, exercise: ExerciseConfig): string {
  if (rule.deviation) return rule.deviation;
  switch (rule.type) {
    case 'targetReached': return `Reduced ${exercise.peakWord}`;
    case 'controlledSpeed': return 'Uncontrolled movement speed';
    case 'cameraView': return 'Suboptimal camera view (lower measurement reliability)';
    default: return SEGMENT_LABELS[rule.id] ?? `Observed deviation: ${rule.id.replace(/_/g, ' ')}`;
  }
}

/** Rough live estimate (before the first rep finishes) from frame rules only. */
export function liveFormEstimate(exercise: ExerciseConfig, stats: RuleStats): number | null {
  let weighted = 0, weights = 0;
  for (const rule of exercise.formRules) {
    if (rule.type === 'targetReached') continue;
    const s = stats[rule.id];
    if (!s || s.total === 0) continue;
    weighted += rule.weight * (s.pass / s.total);
    weights += rule.weight;
  }
  return weights > 0 ? Math.round((100 * weighted) / weights) : null;
}

export function qualityLabel(score: number): 'Good' | 'Fair' | 'Needs review' {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs review';
}
