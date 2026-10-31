import { describe, expect, it } from 'vitest';
import { FrequencySketch } from '../src/statistics/frequency-sketch.js';

describe('FrequencySketch', () => {
  it('increments estimates and caps counters at 255', () => {
    const sketch = new FrequencySketch<string>(1_000, 0);

    for (let index = 0; index < 300; index += 1) sketch.record('hot', 0);

    expect(sketch.estimate('hot', 0)).toBe(255);
  });

  it('ages counters by one half-life', () => {
    const sketch = new FrequencySketch<string>(100, 0);

    sketch.record('hot', 0);
    sketch.record('hot', 0);
    sketch.record('cold', 0);

    expect(sketch.estimate('hot', 100)).toBe(1);
    expect(sketch.estimate('cold', 100)).toBe(0);
  });

  it('clears counters after enough elapsed half-lives', () => {
    const sketch = new FrequencySketch<string>(10, 0);

    sketch.record('key', 0);

    expect(sketch.estimate('key', 20)).toBe(0);
  });

  it('retains a frequently observed key through substantial unique-key churn', () => {
    const sketch = new FrequencySketch<string>(1_000_000, 0, 4_096);

    for (let index = 0; index < 100; index += 1) sketch.record('hot', 0);

    for (let index = 0; index < 20_000; index += 1) sketch.record(`cold:${index}`, 0);

    expect(sketch.estimate('hot', 0)).toBeGreaterThanOrEqual(100);
  });

  it('keeps object keys distinct by identity', () => {
    const sketch = new FrequencySketch<object>(1_000, 0, 16_384);
    const first = {};
    const second = {};

    sketch.record(first, 0);
    sketch.record(first, 0);

    expect(sketch.estimate(first, 0)).toBe(2);
    expect(sketch.estimate(second, 0)).toBe(0);
  });

  it('supports clearing all counters', () => {
    const sketch = new FrequencySketch<string>(1_000, 0);

    sketch.record('key', 0);
    sketch.clear();

    expect(sketch.estimate('key', 0)).toBe(0);
  });

  it('rejects invalid half-life and width values', () => {
    expect(() => new FrequencySketch(0, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(Number.NaN, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(1, 0, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(1, 0, 1.5)).toThrow(RangeError);
  });
});
