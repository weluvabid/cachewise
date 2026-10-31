const ROWS = 4;
const MAX_COUNTER = 255;

/**
 * A bounded Count-Min frequency sketch with periodic aging.
 *
 * `width` is the number of counters per row, not a tracked-key limit. Keys are
 * hashed into fixed-size typed arrays, so churn cannot grow metadata without
 * bound. Object keys receive weakly-held identities; symbols with identical
 * descriptions may collide, which is an accepted sketch false-positive.
 */
export class FrequencySketch<K> {
  readonly #counters: Uint8Array;
  readonly #width: number;
  readonly #halfLife: number;
  readonly #objectIds = new Map<object, number>();
  #nextObjectId = 1;
  #lastDecay: number;

  constructor(halfLife: number, now: number, width = 8_192) {
    if (!Number.isFinite(halfLife) || halfLife <= 0) {
      throw new RangeError('halfLife must be positive.');
    }

    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError('width must be a positive integer.');
    }

    this.#halfLife = halfLife;
    this.#width = width;
    this.#counters = new Uint8Array(width * ROWS);
    this.#lastDecay = now;
  }

  record(key: K, now: number): number {
    this.#decay(now);
    const hash = this.#hashKey(key);
    const index0 = this.#mix(hash ^ 0x9e3779b9) % this.#width;
    const index1 = this.#width + (this.#mix(hash ^ 0x85ebca6b) % this.#width);
    const index2 = this.#width * 2 + (this.#mix(hash ^ 0xc2b2ae35) % this.#width);
    const index3 = this.#width * 3 + (this.#mix(hash ^ 0x27d4eb2f) % this.#width);
    const next0 = Math.min(MAX_COUNTER, this.#counters[index0]! + 1);
    const next1 = Math.min(MAX_COUNTER, this.#counters[index1]! + 1);
    const next2 = Math.min(MAX_COUNTER, this.#counters[index2]! + 1);
    const next3 = Math.min(MAX_COUNTER, this.#counters[index3]! + 1);

    this.#counters[index0] = next0;
    this.#counters[index1] = next1;
    this.#counters[index2] = next2;
    this.#counters[index3] = next3;

    return Math.min(next0, next1, next2, next3);
  }

  estimate(key: K, now: number): number {
    this.#decay(now);
    const hash = this.#hashKey(key);
    const index0 = this.#mix(hash ^ 0x9e3779b9) % this.#width;
    const index1 = this.#width + (this.#mix(hash ^ 0x85ebca6b) % this.#width);
    const index2 = this.#width * 2 + (this.#mix(hash ^ 0xc2b2ae35) % this.#width);
    const index3 = this.#width * 3 + (this.#mix(hash ^ 0x27d4eb2f) % this.#width);

    return Math.min(
      this.#counters[index0]!,
      this.#counters[index1]!,
      this.#counters[index2]!,
      this.#counters[index3]!,
    );
  }

  clear(): void {
    this.#counters.fill(0);
    this.#objectIds.clear();
    this.#nextObjectId = 1;
  }

  #hashKey(key: K): number {
    let value: string;

    if (typeof key === 'string') {
      value = `s:${key}`;
    } else if (typeof key === 'number') {
      value = `n:${key}`;
    } else if (typeof key === 'bigint') {
      value = `b:${key}`;
    } else if (typeof key === 'boolean') {
      value = `B:${key}`;
    } else if (typeof key === 'symbol') {
      value = `y:${Symbol.keyFor(key) ?? key.description ?? ''}`;
    } else if (key === null) {
      value = 'null';
    } else {
      const objectKey = key as object;
      let id = this.#objectIds.get(objectKey);

      if (id !== undefined) {
        this.#objectIds.delete(objectKey);
        this.#objectIds.set(objectKey, id);
      } else {
        if (this.#objectIds.size >= this.#width) {
          const oldest = this.#objectIds.keys().next().value;

          if (oldest !== undefined) this.#objectIds.delete(oldest);
        }

        id = this.#nextObjectId;
        this.#nextObjectId += 1;
        this.#objectIds.set(objectKey, id);
      }

      value = `o:${id}`;
    }

    return this.#hashString(value);
  }

  #hashString(value: string): number {
    let hash = 0x811c9dc5;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
  }

  #mix(value: number): number {
    let hash = value;

    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);

    return (hash ^ (hash >>> 16)) >>> 0;
  }

  #decay(now: number): void {
    const elapsed = now - this.#lastDecay;

    if (elapsed < this.#halfLife) return;

    const periods = Math.floor(elapsed / this.#halfLife);
    const shift = Math.min(periods, 8);

    if (shift >= 8) {
      this.#counters.fill(0);
    } else {
      for (let index = 0; index < this.#counters.length; index += 1) {
        this.#counters[index] = this.#counters[index]! >>> shift;
      }
    }

    this.#lastDecay += periods * this.#halfLife;
  }
}
