import type { Landmark, PoseFrame, RepLogic } from '@/types';

export const L = (x: number, y: number, visibility = 0.99): Landmark => ({ x, y, z: 0, visibility });

/** Angle series: rest → peak → rest, `reps` times, sampled at `fps`. */
export function cycleSeries(opts: {
  rest: number; peak: number; reps: number; cycleMs: number; fps?: number; noise?: number; t0?: number;
}) {
  const fps = opts.fps ?? 30;
  const out: { t: number; angle: number }[] = [];
  const total = opts.reps * opts.cycleMs + 500;
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let t = 0; t <= total; t += 1000 / fps) {
    const phase = (t % opts.cycleMs) / opts.cycleMs;
    const k = t >= opts.reps * opts.cycleMs ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    out.push({ t: (opts.t0 ?? 0) + t, angle: opts.rest + (opts.peak - opts.rest) * k + (opts.noise ?? 0) * rnd() });
  }
  return out;
}

export const KNEE_EXT_LOGIC: RepLogic = {
  direction: 'increase', startThreshold: 115, peakThreshold: 150, hysteresis: 6, minRepDurationMs: 700, cooldownMs: 300,
};

export function emptyFrame(t: number, numPoses = 0): PoseFrame {
  return { landmarks: null, numPoses, timestamp: t, aspectRatio: 4 / 3 };
}
