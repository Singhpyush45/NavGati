import type { BodyPoint, Landmark, Side } from '@/types';

/** MediaPipe Pose (33-point) indices for the points RehabX uses. */
export const LANDMARK_INDEX: Record<Side, Record<Exclude<BodyPoint, 'nose'>, number>> = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, heel: 29, foot: 31 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28, heel: 30, foot: 32 },
};
export const NOSE_INDEX = 0;

export function indexOf(point: BodyPoint, side: Side): number {
  return point === 'nose' ? NOSE_INDEX : LANDMARK_INDEX[side][point];
}

export function getPoint(landmarks: Landmark[], point: BodyPoint, side: Side): Landmark | undefined {
  return landmarks[indexOf(point, side)];
}

/** Skeleton edges for drawing (MediaPipe indices). */
export const SKELETON_EDGES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];
