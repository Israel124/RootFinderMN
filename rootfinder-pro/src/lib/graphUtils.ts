import { MathEvaluator } from './mathEvaluator';

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

interface EstimateViewportOptions {
  fallback?: PlotRange;
  root?: number | null;
  sampleCount?: number;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }

  const position = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)));
  return values[position] ?? values[values.length - 1] ?? 0;
}

export function estimateFunctionViewport(
  expression: string,
  options: EstimateViewportOptions = {},
): PlotRange {
  const fallback = options.fallback ?? { xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
  const sampleCount = Math.max(options.sampleCount ?? 240, 40);
  const root = typeof options.root === 'number' && Number.isFinite(options.root) ? options.root : null;
  const centeredXRange = root === null
    ? { xmin: fallback.xmin, xmax: fallback.xmax }
    : (() => {
        const halfSpan = Math.max(6, Math.abs(root) * 0.45 + 4);
        return {
          xmin: Math.min(fallback.xmin, root - halfSpan),
          xmax: Math.max(fallback.xmax, root + halfSpan),
        };
      })();

  if (!expression.trim() || !MathEvaluator.isValid(expression)) {
    return {
      ...fallback,
      ...centeredXRange,
    };
  }

  const step = (centeredXRange.xmax - centeredXRange.xmin) / sampleCount;
  const yValues: number[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const x = centeredXRange.xmin + step * index;

    try {
      const y = MathEvaluator.evaluate(expression, x);
      if (Number.isFinite(y)) {
        yValues.push(y);
      }
    } catch {
      // Ignora discontinuidades y puntos fuera del dominio.
    }
  }

  if (yValues.length < 2) {
    return {
      ...fallback,
      ...centeredXRange,
    };
  }

  const sorted = [...yValues].sort((a, b) => a - b);
  const trimmedMin = percentile(sorted, 0.08);
  const trimmedMax = percentile(sorted, 0.92);
  const visibleMin = Math.min(trimmedMin, 0);
  const visibleMax = Math.max(trimmedMax, 0);
  const span = Math.max(visibleMax - visibleMin, 1);
  const padding = span * 0.18;

  return normalizeRange(
    {
      xmin: centeredXRange.xmin,
      xmax: centeredXRange.xmax,
      ymin: visibleMin - padding,
      ymax: visibleMax + padding,
    },
    fallback,
  );
}
