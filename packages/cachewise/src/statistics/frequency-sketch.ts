export class FrequencySketch<K> {
  readonly #counts = new Map<K, number>();
  readonly #halfLife: number;
  readonly #maxEntries: number;
  #lastDecay: number;

  constructor(halfLife: number, now: number, maxEntries = 8_192) {
    if (!Number.isFinite(halfLife) || halfLife <= 0) {
      throw new RangeError('halfLife must be positive.');
    }

    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new RangeError('maxEntries must be a positive integer.');
    }

    this.#halfLife = halfLife;
    this.#maxEntries = maxEntries;
    this.#lastDecay = now;
  }

  record(key: K, now: number): number {
    this.#decay(now);

    if (!this.#counts.has(key) && this.#counts.size >= this.#maxEntries) {
      const oldest = this.#counts.keys().next().value;

      if (oldest !== undefined) this.#counts.delete(oldest);
    }

    const next = Math.min((this.#counts.get(key) ?? 0) + 1, 255);

    this.#counts.set(key, next);

    return next;
  }

  estimate(key: K, now: number): number {
    this.#decay(now);

    return this.#counts.get(key) ?? 0;
  }

  delete(key: K): void {
    this.#counts.delete(key);
  }

  clear(): void {
    this.#counts.clear();
  }

  #decay(now: number): void {
    const elapsed = now - this.#lastDecay;

    if (elapsed < this.#halfLife) return;

    const periods = Math.floor(elapsed / this.#halfLife);
    const factor = 0.5 ** periods;

    for (const [key, count] of this.#counts) {
      const decayed = count * factor;

      if (decayed < 0.25) this.#counts.delete(key);
      else this.#counts.set(key, decayed);
    }

    this.#lastDecay += periods * this.#halfLife;
  }
}
