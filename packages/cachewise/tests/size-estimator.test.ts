import { describe, expect, it } from 'vitest';
import { estimateSize, validateSize } from '../src/accounting/size-estimator.js';

describe('estimateSize', () => {
  it('returns zero for nullish values and unsupported object types', () => {
    expect(estimateSize(null)).toBe(0);
    expect(estimateSize(undefined)).toBe(0);
    expect(estimateSize({ answer: 42 })).toBe(0);
    expect(estimateSize(() => 42)).toBe(0);
  });

  it('estimates primitive values', () => {
    expect(estimateSize('cache')).toBe(10);
    expect(estimateSize(42)).toBe(8);
    expect(estimateSize(true)).toBe(8);
    expect(estimateSize(42n)).toBe(8);
  });

  it('uses byte lengths for buffers and typed-array views', () => {
    expect(estimateSize(new ArrayBuffer(24))).toBe(24);
    expect(estimateSize(new Uint8Array(12))).toBe(12);
    expect(estimateSize(new Uint32Array(3))).toBe(12);
    expect(estimateSize(new DataView(new ArrayBuffer(7)))).toBe(7);
  });

  it('uses Blob size when Blob is available', () => {
    if (typeof Blob === 'undefined') return;

    expect(estimateSize(new Blob(['cachewise']))).toBe(9);
  });
});

describe('validateSize', () => {
  it('rounds fractional sizes up to preserve the byte budget', () => {
    expect(validateSize(1.01)).toBe(2);
    expect(validateSize(1)).toBe(1);
    expect(validateSize(0)).toBe(0);
  });

  it('rejects negative and non-finite sizes', () => {
    expect(() => validateSize(-1)).toThrow(RangeError);
    expect(() => validateSize(Number.NaN)).toThrow(RangeError);
    expect(() => validateSize(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
