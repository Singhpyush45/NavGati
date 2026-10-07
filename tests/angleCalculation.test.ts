import { describe, expect, it } from 'vitest';
import { calculateAngle, segmentDeviation, ema } from '@/algorithms/angleCalculation';
import { L } from './helpers';

describe('calculateAngle', () => {
  it('returns 90° for a right angle', () => {
    expect(calculateAngle(L(0, 0), L(0, 1), L(1, 1))).toBeCloseTo(90, 5);
  });
  it('returns 180° for a straight limb', () => {
    expect(calculateAngle(L(0, 0), L(0.5, 0.5), L(1, 1))).toBeCloseTo(180, 5);
  });
  it('returns ~0° when folded completely', () => {
    expect(calculateAngle(L(1, 0), L(0, 0), L(1, 0.0001))).toBeLessThan(0.1);
  });
  it('corrects for image aspect ratio', () => {
    // In normalized coords this looks like 45°, but on a 2:1 image x units are twice as long.
    const a = L(1, 0), b = L(0, 0), c = L(1, 1);
    expect(calculateAngle(a, b, c, 1)).toBeCloseTo(45, 5);
    expect(calculateAngle(a, b, c, 2)).toBeCloseTo(Math.atan2(1, 2) * 180 / Math.PI, 5);
  });
  it('is symmetric in A and C', () => {
    const a = L(0.2, 0.3), b = L(0.5, 0.5), c = L(0.9, 0.2);
    expect(calculateAngle(a, b, c)).toBeCloseTo(calculateAngle(c, b, a), 9);
  });
  it('returns NaN for a missing segment (duplicate points)', () => {
    expect(Number.isNaN(calculateAngle(L(0.5, 0.5), L(0.5, 0.5), L(1, 1)))).toBe(true);
  });
});

describe('segmentDeviation', () => {
  it('measures deviation from vertical/horizontal', () => {
    expect(segmentDeviation(L(0, 0), L(0, 1), 'vertical')).toBeCloseTo(0, 5);
    expect(segmentDeviation(L(0, 0), L(1, 0), 'horizontal')).toBeCloseTo(0, 5);
    expect(segmentDeviation(L(0, 0), L(1, 1), 'vertical')).toBeCloseTo(45, 5);
  });
});

describe('ema', () => {
  it('starts at the first value and moves toward new values', () => {
    expect(ema(null, 100, 0.5)).toBe(100);
    expect(ema(100, 120, 0.5)).toBe(110);
  });
});
