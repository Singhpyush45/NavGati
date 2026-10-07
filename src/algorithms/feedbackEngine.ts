import type { ConfidenceReport, ExerciseConfig, FeedbackItem, RepRecord } from '@/types';

export interface FeedbackContext {
  exercise: ExerciseConfig;
  confidence: ConfidenceReport;
  exerciseMatch: 'match' | 'mismatch' | 'unknown';
  moving: boolean;
  velocity: number;
  frameRules: Record<string, boolean>;
  lastRep: RepRecord | null;
  repJustCompleted: boolean;
  repCount: number;
  targetReps?: number;
  partialJustHappened: boolean;
}

const limbWord = (e: ExerciseConfig) => (e.joint === 'knee' || e.joint === 'ankle' ? 'leg' : 'arm');

/**
 * Turns measurements into short, safe, human-readable feedback.
 * Never suggests increasing intensity or diagnoses anything.
 * Ordered: errors → warnings → positives. Max 3 items.
 */
export function buildFeedback(ctx: FeedbackContext): FeedbackItem[] {
  const { exercise, confidence } = ctx;
  if (!confidence.ok) {
    switch (confidence.reason) {
      case 'multiple_people':
        return [{ severity: 'error', type: 'multiple_people', message: 'Please ensure only one person is visible.' }];
      case 'no_person':
        return [{ severity: 'error', type: 'visibility', message: 'Full body not detected. Please move into the camera frame.' }];
      case 'out_of_frame':
      case 'low_confidence':
        return [{ severity: 'error', type: 'visibility', message: `Move your ${limbWord(exercise)} fully into view.` }];
    }
  }

  const errors: FeedbackItem[] = [];
  const warnings: FeedbackItem[] = [];
  const goods: FeedbackItem[] = [];

  if (ctx.exerciseMatch === 'mismatch') {
    warnings.push({ severity: 'warning', type: 'mismatch', message: 'Please position yourself correctly or perform the selected exercise.' });
  }

  for (const rule of exercise.formRules) {
    const pass = ctx.frameRules[rule.id];
    if (pass === undefined) continue;
    if (rule.type === 'cameraView' && !pass) {
      warnings.push({ severity: 'warning', type: 'position', message: rule.message });
    }
    if ((rule.type === 'segmentOrientation' || rule.type === 'jointAngleRange') && ctx.moving) {
      if (pass) goods.push({ severity: 'good', type: 'form', message: rule.okMessage });
      else warnings.push({ severity: 'warning', type: 'form', message: rule.message });
    }
    if (rule.type === 'controlledSpeed' && ctx.moving) {
      if (pass) goods.push({ severity: 'good', type: 'speed', message: 'Controlled movement' });
      else warnings.push({ severity: 'warning', type: 'speed', message: rule.message });
    }
  }

  if (ctx.partialJustHappened) {
    warnings.push({ severity: 'warning', type: 'rom', message: 'Movement target not reached — rep not counted.' });
  }

  if (ctx.lastRep) {
    const targetRule = exercise.formRules.find((r) => r.type === 'targetReached');
    if (targetRule && !ctx.lastRep.reachedTarget) {
      warnings.push({ severity: 'warning', type: 'rom', message: targetRule.message });
    } else if (targetRule) {
      goods.push({ severity: 'good', type: 'rom', message: `Full ${exercise.peakWord} reached` });
    }
  }

  if (ctx.targetReps && ctx.repCount >= ctx.targetReps) {
    goods.unshift({ severity: 'good', type: 'rep', message: 'Prescribed reps completed. You can end the session.' });
  } else if (ctx.repJustCompleted) {
    goods.unshift({ severity: 'good', type: 'rep', message: `Rep ${ctx.repCount} counted` });
  }

  const dedupe = (items: FeedbackItem[]) =>
    items.filter((it, i) => items.findIndex((o) => o.message === it.message) === i);
  return dedupe([...errors, ...warnings, ...goods]).slice(0, 3);
}

/**
 * Keeps messages on screen long enough to read (prevents flicker at 30 fps).
 * A message stays for at least `holdMs` unless an error replaces it.
 */
export class FeedbackStabilizer {
  private shown: FeedbackItem[] = [];
  private shownAt = 0;
  constructor(private holdMs = 1200) {}

  update(next: FeedbackItem[], now: number): FeedbackItem[] {
    const key = (xs: FeedbackItem[]) => xs.map((x) => x.message).join('|');
    if (key(next) === key(this.shown)) return this.shown;
    const hasNewError = next.some((n) => n.severity === 'error') && !this.shown.some((s) => s.severity === 'error');
    if (hasNewError || now - this.shownAt >= this.holdMs || this.shown.length === 0) {
      this.shown = next;
      this.shownAt = now;
    }
    return this.shown;
  }
}
