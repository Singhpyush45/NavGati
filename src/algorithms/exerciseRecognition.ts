import type { BodyPoint, ExerciseConfig, JointName, Landmark, Side } from '@/types';
import { calculateAngle } from './angleCalculation';
import { getPoint } from './landmarks';

/** The three points that define each joint's angle (vertex in the middle). */
export const JOINT_TRIPLETS: Record<JointName, [BodyPoint, BodyPoint, BodyPoint]> = {
  knee: ['hip', 'knee', 'ankle'],
  elbow: ['shoulder', 'elbow', 'wrist'],
  shoulder: ['hip', 'shoulder', 'elbow'],
  ankle: ['knee', 'ankle', 'foot'],
};

export function computeJointAngles(landmarks: Landmark[], side: Side, aspectRatio: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [joint, [a, b, c]] of Object.entries(JOINT_TRIPLETS)) {
    const pa = getPoint(landmarks, a, side), pb = getPoint(landmarks, b, side), pc = getPoint(landmarks, c, side);
    if (!pa || !pb || !pc) continue;
    if (Math.min(pa.visibility ?? 1, pb.visibility ?? 1, pc.visibility ?? 1) < 0.4) continue;
    const ang = calculateAngle(pa, pb, pc, aspectRatio);
    if (Number.isFinite(ang)) out[joint] = ang;
  }
  return out;
}

function rangeOf(history: { angles: Record<string, number> }[], joint: string): number {
  const v = history.map((h) => h.angles[joint]).filter((x) => Number.isFinite(x));
  return v.length < 3 ? 0 : Math.max(...v) - Math.min(...v);
}

export const VALIDATION_WINDOW_MS = 3000;

/**
 * Checks whether the observed movement matches the selected exercise.
 *  - "match":    the target joint is clearly moving.
 *  - "mismatch": the target joint is still, while another joint moves a lot.
 *  - "unknown":  not enough data, or the patient is simply still.
 */
export function validateExercise(
  history: { t: number; angles: Record<string, number> }[],
  exercise: ExerciseConfig,
  now: number,
  windowMs = VALIDATION_WINDOW_MS,
): 'match' | 'mismatch' | 'unknown' {
  const recent = history.filter((h) => now - h.t <= windowMs);
  if (recent.length < 5 || now - recent[0].t < windowMs * 0.5) return 'unknown';
  const targetRange = rangeOf(recent, exercise.joint);
  if (targetRange >= 12) return 'match';
  const others = (Object.keys(JOINT_TRIPLETS) as JointName[]).filter((j) => j !== exercise.joint);
  const maxOther = Math.max(0, ...others.map((j) => rangeOf(recent, j)));
  return maxOther > 30 ? 'mismatch' : 'unknown';
}

/**
 * Rule-based automatic recognition hook: which joint is moving most?
 * A future ML classifier can replace this through the ExerciseClassifier interface.
 */
export function recognizeActiveJoint(history: { angles: Record<string, number> }[]): { joint: JointName; range: number } | null {
  let best: { joint: JointName; range: number } | null = null;
  for (const j of Object.keys(JOINT_TRIPLETS) as JointName[]) {
    const r = rangeOf(history, j);
    if (!best || r > best.range) best = { joint: j, range: r };
  }
  return best && best.range >= 15 ? best : null;
}

/** Plug-in point for a trained model (e.g. a temporal CNN over landmark sequences). */
export interface ExerciseClassifier {
  name: string;
  classify(sequence: Landmark[][]): Promise<{ exerciseId: string; confidence: number } | null>;
}
