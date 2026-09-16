export type NormalizedRange =
  | { offset: number; length: number }
  | { suffix: number };

export type ResolvedByteRange = {
  start: number;
  end: number;
  length: number;
  total: number;
};

export function resolveByteRange(
  range: NormalizedRange,
  total: number,
): ResolvedByteRange {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error('invalid_total_size');
  }

  if ('suffix' in range) {
    if (!Number.isInteger(range.suffix) || range.suffix <= 0) {
      throw new Error('invalid_suffix_range');
    }
    const length = Math.min(range.suffix, total);
    const start = total - length;
    return {
      start,
      end: total - 1,
      length,
      total,
    };
  }

  if (
    !Number.isInteger(range.offset) ||
    range.offset < 0 ||
    !Number.isInteger(range.length) ||
    range.length <= 0 ||
    range.offset >= total
  ) {
    throw new Error('invalid_offset_range');
  }

  const length = Math.min(range.length, total - range.offset);
  return {
    start: range.offset,
    end: range.offset + length - 1,
    length,
    total,
  };
}

export function contentRangeHeader(
  range: NormalizedRange,
  total: number,
): string {
  const resolved = resolveByteRange(range, total);
  return `bytes ${resolved.start}-${resolved.end}/${resolved.total}`;
}
