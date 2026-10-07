import type { BodyPoint, ConfidenceReport, Landmark, PoseFrame, Side } from '@/types';
import { getPoint } from './landmarks';

export const DEFAULT_VISIBILITY_THRESHOLD = 0.55;

const inFrame = (l: Landmark, margin = 0.02) =>
  l.x >= -margin && l.x <= 1 + margin && l.y >= -margin && l.y <= 1 + margin;

/** Picks the body side whose required landmarks are most visible. */
export function chooseSide(landmarks: Landmark[], points: BodyPoint[]): Side {
  const score = (side: Side) =>
    points.reduce((s, p) => s + (getPoint(landmarks, p, side)?.visibility ?? 0), 0);
  return score('left') >= score('right') ? 'left' : 'right';
}

/**
 * Decides whether a frame is trustworthy enough to analyze.
 * Movement is NOT analyzed when this returns ok = false.
 */
export function checkConfidence(
  frame: PoseFrame,
  points: BodyPoint[],
  side: Side,
  threshold = DEFAULT_VISIBILITY_THRESHOLD,
): ConfidenceReport {
  if (frame.numPoses > 1) {
    return { ok: false, score: 0, missing: [], reason: 'multiple_people' };
  }
  if (!frame.landmarks || frame.numPoses === 0) {
    return { ok: false, score: 0, missing: points, reason: 'no_person' };
  }
  const missing: BodyPoint[] = [];
  let outOfFrame = false;
  let sum = 0;
  for (const p of points) {
    const l = getPoint(frame.landmarks, p, side);
    const vis = l?.visibility ?? 0;
    sum += vis;
    if (!l || vis < threshold) missing.push(p);
    else if (!inFrame(l)) {
      missing.push(p);
      outOfFrame = true;
    }
  }
  const score = points.length ? sum / points.length : 0;
  if (missing.length === 0) return { ok: true, score, missing, reason: 'ok' };
  return { ok: false, score, missing, reason: outOfFrame ? 'out_of_frame' : 'low_confidence' };
}

/** Setup-screen helpers ------------------------------------------------ */

const FULL_BODY_POINTS: BodyPoint[] = ['shoulder', 'hip', 'knee', 'ankle'];

export function fullBodyVisible(landmarks: Landmark[] | null, threshold = 0.5): boolean {
  if (!landmarks) return false;
  return (['left', 'right'] as Side[]).some((side) =>
    FULL_BODY_POINTS.every((p) => {
      const l = getPoint(landmarks, p, side);
      return !!l && (l.visibility ?? 0) >= threshold && inFrame(l);
    }),
  );
}

/**
 * Distance guidance from how much of the image height the body fills.
 * Ideal: nose→ankle spans roughly 55–90% of the frame.
 */
export function distanceGuidance(landmarks: Landmark[] | null): 'too_close' | 'too_far' | 'good' | 'unknown' {
  if (!landmarks) return 'unknown';
  const ys = [0, 27, 28].map((i) => landmarks[i]).filter((l) => l && (l.visibility ?? 0) > 0.4).map((l) => l.y);
  if (ys.length < 2) return 'too_close';
  const span = Math.max(...ys) - Math.min(...ys);
  if (span > 0.92) return 'too_close';
  if (span < 0.45) return 'too_far';
  return 'good';
}
