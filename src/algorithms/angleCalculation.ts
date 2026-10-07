import type { Landmark } from '@/types';

/**
 * Angle (degrees, 0..180) at vertex B formed by points A–B–C.
 *
 * Landmarks are normalized (x is 0..1 across width, y 0..1 across height),
 * so on a 16:9 image one unit of x is longer than one unit of y.
 * We multiply x by the aspect ratio to get true (pixel-proportional) geometry.
 *
 * Math: θ = atan2(|BA × BC|, BA · BC)  — numerically stable for all angles.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark, aspectRatio = 1): number {
  const bax = (a.x - b.x) * aspectRatio;
  const bay = a.y - b.y;
  const bcx = (c.x - b.x) * aspectRatio;
  const bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const cross = bax * bcy - bay * bcx;
  if (Math.hypot(bax, bay) < 1e-9 || Math.hypot(bcx, bcy) < 1e-9) return NaN;
  return (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
}

/**
 * Deviation (deg, 0..90) of segment from→to relative to the vertical or horizontal axis.
 * Used by form rules such as "thigh stays horizontal" or "trunk stays upright".
 */
export function segmentDeviation(
  from: Landmark,
  to: Landmark,
  reference: 'vertical' | 'horizontal',
  aspectRatio = 1,
): number {
  const dx = Math.abs((to.x - from.x) * aspectRatio);
  const dy = Math.abs(to.y - from.y);
  if (dx < 1e-9 && dy < 1e-9) return NaN;
  const fromHorizontal = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = horizontal, 90 = vertical
  return reference === 'horizontal' ? fromHorizontal : 90 - fromHorizontal;
}

/** Exponential moving average — smooths landmark jitter without much lag. */
export function ema(previous: number | null, next: number, alpha: number): number {
  return previous === null || Number.isNaN(previous) ? next : previous + alpha * (next - previous);
}

export function distance(a: Landmark, b: Landmark, aspectRatio = 1): number {
  return Math.hypot((a.x - b.x) * aspectRatio, a.y - b.y);
}
