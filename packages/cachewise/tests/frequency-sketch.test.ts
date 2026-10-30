import { describe, expect, it } from 'vitest';
import { FrequencySketch } from '../src/statistics/frequency-sketch.js';

describe('FrequencySketch', () => {
  it('increments estimates and caps counters at 255', () => {
    const sketch = new FrequencySketch<string>(1_000, 0);

    for (let index = 0; index < 300; index += 1) sketch.record('hot', 0);

    expect(sketch.estimate('hot', 0)).toBe(255);
  });

  it('decays counts by one half-life and removes negligible counts', () => {
    const sketch = new FrequencySketch<string>(100, 0);

    sketch.record('hot', 0);
    sketch.record('hot', 0);
    sketch.record('cold', 0);

    expect(sketch.estimate('hot', 100)).toBe(1);
    expect(sketch.estimate('cold', 100)).toBe(0.5);
    expect(sketch.estimate('cold', 300)).toBe(0);
  });

  it('applies multiple elapsed decay periods in one step', () => {
    const sketch = new FrequencySketch<string>(10, 0);

    sketch.record('key', 0);

    expect(sketch.estimate('key', 20)).toBe(0.25);
    expect(sketch.estimate('key', 30)).toBe(0);
  });

  it('bounds tracked keys by evicting the oldest inserted key', () => {
    const sketch = new FrequencySketch<string>(1_000, 0, 2);

    sketch.record('first', 0);
    sketch.record('second', 0);
    sketch.record('third', 0);

    expect(sketch.estimate('first', 0)).toBe(0);
    expect(sketch.estimate('second', 0)).toBe(1);
    expect(sketch.estimate('third', 0)).toBe(1);
  });

  it('retains a key when it is incremented at capacity', () => {
    const sketch = new FrequencySketch<string>(1_000, 0, 2);

    sketch.record('first', 0);
    sketch.record('second', 0);
    sketch.record('first', 0);

    expect(sketch.estimate('first', 0)).toBe(2);
    expect(sketch.estimate('second', 0)).toBe(1);
  });

  it('supports deleting and clearing tracked keys', () => {
    const sketch = new FrequencySketch<string>(1_000, 0);

    sketch.record('a', 0);
    sketch.record('b', 0);
    sketch.delete('a');
    expect(sketch.estimate('a', 0)).toBe(0);

    sketch.clear();
    expect(sketch.estimate('b', 0)).toBe(0);
  });

  it('rejects invalid half-life and capacity values', () => {
    expect(() => new FrequencySketch(0, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(Number.NaN, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(1, 0, 0)).toThrow(RangeError);
    expect(() => new FrequencySketch(1, 0, 1.5)).toThrow(RangeError);
  });
});
