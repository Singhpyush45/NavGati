import type { ExerciseConfig, Landmark, PoseFrame } from '@/types';

/**
 * DEMO MODE ONLY.
 * Generates synthetic, clearly-labelled landmark frames that move like a patient
 * performing the selected exercise. Output frames carry `simulated: true` and
 * sessions recorded from them are stored with isDemoData = true.
 */
type V = { x: number; y: number };
const add = (a: V, b: V, k = 1): V => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const rad = (d: number) => (d * Math.PI) / 180;
/** Rotate a screen-space (y-down) vector clockwise by `deg`. */
const rot = (v: V, deg: number): V => {
  const a = rad(deg);
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};

export interface DemoOptions {
  aspectRatio?: number;
  noiseDeg?: number;
  /** Seconds per repetition cycle. */
  cycleSec?: number;
  /** Random body sway in height units. */
  sway?: number;
}

export class DemoSimulator {
  simulateLeaveFrame = false;
  simulateSecondPerson = false;
  readonly aspectRatio: number;
  private noiseDeg: number;
  private cycleMs: number;
  private swayAmount: number;
  private seed = 7;

  constructor(private exercise: ExerciseConfig, opts: DemoOptions = {}) {
    this.aspectRatio = opts.aspectRatio ?? 4 / 3;
    this.noiseDeg = opts.noiseDeg ?? 1.2;
    this.cycleMs = (opts.cycleSec ?? 3.4) * 1000;
    this.swayAmount = opts.sway ?? 0.003;
  }

  private rand(): number {
    // Deterministic pseudo-random (mulberry32) so demos are reproducible.
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  }

  /** Target joint angle at time t: rest → move → hold → return, with varied amplitude. */
  angleAt(tMs: number): number {
    const { repLogic, formRules } = this.exercise;
    const sign = repLogic.direction === 'increase' ? 1 : -1;
    const target = formRules.find((r) => r.type === 'targetReached');
    const peakGoal = target && target.type === 'targetReached' ? target.targetAngle : repLogic.peakThreshold;
    const rest = repLogic.startThreshold - sign * Math.max(12, repLogic.hysteresis * 3);
    const cycle = Math.floor(tMs / this.cycleMs);
    const phase = (tMs % this.cycleMs) / this.cycleMs;

    // Every 6th cycle is a partial rep; others alternate between full and slightly short.
    let peak: number;
    if (cycle % 6 === 5) peak = rest + (repLogic.peakThreshold - rest) * 0.6;
    else if (cycle % 3 === 1) peak = peakGoal - sign * 5;
    else peak = peakGoal + sign * 3;

    const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    let k: number;
    if (phase < 0.22) k = 0;
    else if (phase < 0.52) k = ease((phase - 0.22) / 0.3);
    else if (phase < 0.64) k = 1;
    else if (phase < 0.94) k = 1 - ease((phase - 0.64) / 0.3);
    else k = 0;
    const a = rest + (peak - rest) * k + this.rand() * this.noiseDeg;
    return Math.max(4, Math.min(179, a));
  }

  frameAt(tMs: number): PoseFrame {
    if (this.simulateLeaveFrame) {
      return { landmarks: null, numPoses: 0, timestamp: tMs, aspectRatio: this.aspectRatio, simulated: true };
    }
    const landmarks = this.buildSkeleton(this.angleAt(tMs));
    return {
      landmarks,
      numPoses: this.simulateSecondPerson ? 2 : 1,
      timestamp: tMs,
      aspectRatio: this.aspectRatio,
      simulated: true,
    };
  }

  /** Builds 33 landmarks in "height units", then converts x to normalized image coords. */
  buildSkeleton(angle: number): Landmark[] {
    const ex = this.exercise;
    const A = this.aspectRatio;
    const cx = A * 0.45;
    const P: Record<number, V> = {};
    const front = ex.cameraView === 'front';
    const seated = ex.position === 'seated';
    const sway = () => this.rand() * this.swayAmount;

    if (front) {
      // Facing camera — wide shoulders. Left side (index 11…) on image right.
      const mid = A * 0.5;
      P[0] = { x: mid, y: 0.14 };
      P[11] = { x: mid + 0.09, y: 0.26 }; P[12] = { x: mid - 0.09, y: 0.26 };
      P[23] = { x: mid + 0.06, y: 0.52 }; P[24] = { x: mid - 0.06, y: 0.52 };
      P[25] = { x: mid + 0.065, y: 0.71 }; P[26] = { x: mid - 0.065, y: 0.71 };
      P[27] = { x: mid + 0.065, y: 0.9 }; P[28] = { x: mid - 0.065, y: 0.9 };
      const dirL = { x: Math.sin(rad(angle)), y: Math.cos(rad(angle)) };
      P[13] = add(P[11], dirL, 0.16); P[15] = add(P[13], dirL, 0.15);
      P[14] = add(P[12], { x: -0.12, y: 1 }, 0.16); P[16] = add(P[14], { x: -0.05, y: 1 }, 0.15);
    } else {
      // Side view, facing +x. Both shoulders/hips almost overlap → detected as side view.
      const hip: V = seated ? { x: cx, y: 0.56 } : { x: cx, y: 0.52 };
      const sh: V = seated ? { x: cx - 0.01, y: 0.29 } : { x: cx, y: 0.25 };
      P[0] = { x: sh.x + 0.05, y: sh.y - 0.11 };
      P[11] = sh; P[12] = { x: sh.x + 0.012, y: sh.y + 0.004 };
      P[23] = hip; P[24] = { x: hip.x + 0.012, y: hip.y + 0.004 };

      // Arms
      let armDir: V = { x: 0.08, y: 1 };
      let foreDir: V = { x: 0.08, y: 1 };
      if (ex.joint === 'shoulder') {
        const s = ex.movement === 'Extension' ? -1 : 1;
        armDir = { x: s * Math.sin(rad(angle)), y: Math.cos(rad(angle)) };
        foreDir = armDir;
      } else if (ex.joint === 'elbow') {
        armDir = { x: 0, y: 1 };
        foreDir = { x: Math.sin(rad(angle)), y: -Math.cos(rad(angle)) };
      }
      P[13] = add(sh, armDir, 0.16); P[15] = add(P[13], foreDir, 0.15);
      P[14] = add(P[12], { x: -0.05, y: 1 }, 0.16); P[16] = add(P[14], { x: 0.1, y: 1 }, 0.15);

      // Legs
      let knee: V, ankle: V;
      if (seated) {
        knee = { x: hip.x + 0.2, y: hip.y };
        const kneeAngle = ex.joint === 'knee' ? angle : 90;
        const shank = { x: -Math.cos(rad(kneeAngle)), y: Math.sin(rad(kneeAngle)) };
        ankle = add(knee, shank, 0.2);
      } else {
        knee = { x: hip.x, y: hip.y + 0.19 };
        const kneeAngle = ex.joint === 'knee' ? angle : 178;
        const shank = { x: -Math.sin(rad(kneeAngle)), y: -Math.cos(rad(kneeAngle)) };
        ankle = add(knee, shank, 0.19);
      }
      P[25] = knee; P[27] = ankle;
      P[26] = { x: knee.x + 0.012, y: knee.y + 0.005 }; P[28] = { x: ankle.x + 0.012, y: ankle.y + 0.005 };
    }

    // Feet from the ankle angle (knee → ankle → toe).
    for (const [k, a, heel, toe] of [[25, 27, 29, 31], [26, 28, 30, 32]] as const) {
      const up = { x: P[k].x - P[a].x, y: P[k].y - P[a].y };
      const len = Math.hypot(up.x, up.y) || 1;
      const u = { x: up.x / len, y: up.y / len };
      const ankleAngle = ex.joint === 'ankle' && k === 25 ? angle : 112;
      P[toe] = add(P[a], rot(u, front ? 180 : ankleAngle), 0.085);
      P[heel] = add(P[a], rot(u, front ? 180 : 205), 0.035);
    }

    const out: Landmark[] = [];
    for (let i = 0; i < 33; i++) {
      const p = P[i] ?? P[0];
      const isLeftOrCenter = i === 0 || [11, 13, 15, 23, 25, 27, 29, 31].includes(i);
      out.push({
        x: (p.x + sway()) / A,
        y: p.y + sway(),
        z: 0,
        visibility: P[i] ? (front || isLeftOrCenter ? 0.98 : 0.86) : 0.1,
      });
    }
    return out;
  }
}
