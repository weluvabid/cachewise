export function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'string') return value.length * 2;

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return 8;

  if (value instanceof ArrayBuffer) return value.byteLength;

  if (ArrayBuffer.isView(value)) return value.byteLength;

  if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;

  if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap) {
    return value.width * value.height * 4;
  }

  return 0;
}

export function validateSize(size: number): number {
  if (!Number.isFinite(size) || size < 0) {
    throw new RangeError('Cache entry size must be a finite, non-negative number.');
  }

  return Math.ceil(size);
}
