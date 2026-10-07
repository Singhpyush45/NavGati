/**
 * Range of Motion (ROM) = maximum observed angle − minimum observed angle.
 * Example: min 80°, max 150° → ROM 70°.
 *
 * ROM is always computed from angles actually observed, never from targets.
 */
export interface RomSummary {
  min: number | null;
  max: number | null;
  rom: number;
}

export function computeRom(angles: number[]): RomSummary {
  const valid = angles.filter((a) => Number.isFinite(a));
  if (valid.length === 0) return { min: null, max: null, rom: 0 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return { min, max, rom: max - min };
}

/** Incremental version used by the live engine (O(1) per frame). */
export function updateRom(
  current: { min: number | null; max: number | null },
  angle: number,
): RomSummary {
  if (!Number.isFinite(angle)) {
    return { ...current, rom: current.min !== null && current.max !== null ? current.max - current.min : 0 };
  }
  const min = current.min === null ? angle : Math.min(current.min, angle);
  const max = current.max === null ? angle : Math.max(current.max, angle);
  return { min, max, rom: max - min };
}

export function average(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

/** Session-level ROM stats from completed reps. */
export function summarizeRepRom(reps: { rom: number }[]): { averageRom: number; bestRom: number } {
  if (reps.length === 0) return { averageRom: 0, bestRom: 0 };
  return {
    averageRom: average(reps.map((r) => r.rom)),
    bestRom: Math.max(...reps.map((r) => r.rom)),
  };
}
