export interface PlotRange {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export function normalizeRange(range: PlotRange, fallback: PlotRange): PlotRange {
  const safeRange = {
    xmin: Number.isFinite(range.xmin) ? range.xmin : fallback.xmin,
    xmax: Number.isFinite(range.xmax) ? range.xmax : fallback.xmax,
    ymin: Number.isFinite(range.ymin) ? range.ymin : fallback.ymin,
    ymax: Number.isFinite(range.ymax) ? range.ymax : fallback.ymax,
  };

  if (safeRange.xmin >= safeRange.xmax || safeRange.ymin >= safeRange.ymax) {
    return fallback;
  }

  return safeRange;
}

export function detectZeroCrossings(samples: Array<{ x: number; y: number }>) {
  const crossings: number[] = [];

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];

    if (!Number.isFinite(previous.y) || !Number.isFinite(current.y)) {
      continue;
    }

    if (previous.y === 0) {
      crossings.push(previous.x);
      continue;
    }

    if (previous.y * current.y < 0) {
      const ratio = Math.abs(previous.y) / (Math.abs(previous.y) + Math.abs(current.y));
      crossings.push(previous.x + (current.x - previous.x) * ratio);
    }
  }

  return crossings.filter((value, index, items) => index === 0 || Math.abs(value - items[index - 1]) > 1e-3);
}
