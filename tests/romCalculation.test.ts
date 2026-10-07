import { describe, expect, it } from 'vitest';
import { computeRom, summarizeRepRom, updateRom } from '@/algorithms/romCalculation';

describe('ROM', () => {
  it('ROM = max − min of observed angles', () => {
    expect(computeRom([80, 95, 150, 120])).toEqual({ min: 80, max: 150, rom: 70 });
  });
  it('no movement → ROM 0', () => {
    expect(computeRom([100, 100, 100]).rom).toBe(0);
  });
  it('empty or invalid input → null min/max', () => {
    expect(computeRom([])).toEqual({ min: null, max: null, rom: 0 });
    expect(computeRom([NaN])).toEqual({ min: null, max: null, rom: 0 });
  });
  it('incremental update matches batch computation', () => {
    const series = [100, 92, 140, 155, 101];
    let s = { min: null as number | null, max: null as number | null, rom: 0 };
    for (const a of series) s = updateRom(s, a);
    expect(s).toEqual(computeRom(series));
  });
  it('ignores NaN frames incrementally', () => {
    const s = updateRom({ min: 80, max: 150 }, NaN);
    expect(s.rom).toBe(70);
  });
  it('summarizes per-rep ROM', () => {
    expect(summarizeRepRom([{ rom: 60 }, { rom: 80 }])).toEqual({ averageRom: 70, bestRom: 80 });
    expect(summarizeRepRom([])).toEqual({ averageRom: 0, bestRom: 0 });
  });
});
