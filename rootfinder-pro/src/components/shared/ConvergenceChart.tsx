import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { IterationData } from '@/types';

interface ConvergenceChartProps {
  iterations: IterationData[];
  className?: string;
}

function readErrorValue(iteration: IterationData): number | null {
  const directError = iteration.ea;
  if (typeof directError === 'number' && Number.isFinite(directError)) {
    return Math.max(directError, Number.EPSILON);
  }

  return null;
}

/**
 * Dibuja una curva simple de convergencia usando SVG sin dependencias externas.
 */
export function ConvergenceChart({ iterations, className }: ConvergenceChartProps) {
  const points = useMemo(() => {
    const values = iterations
      .map((iteration) => readErrorValue(iteration))
      .filter((value): value is number => value !== null);

    if (values.length < 2) {
      return null;
    }

    const width = 360;
    const height = 144;
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const span = Math.max(maxValue - minValue, Number.EPSILON);

    const path = values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * width;
        const y = height - ((value - minValue) / span) * (height - 12) - 6;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    return {
      width,
      height,
      path,
      latest: values[values.length - 1],
      best: minValue,
    };
  }, [iterations]);

  if (!points) {
    return (
      <div
        className={cn(
          'flex h-36 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 text-sm text-[var(--text-muted)]',
          className,
        )}
      >
        Se necesitan al menos dos iteraciones para graficar convergencia.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Convergencia
          </p>
          <p className="text-sm text-[var(--text-primary)]">Error absoluto por iteración</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Último</p>
          <p className="font-mono text-sm text-[var(--text-primary)]">{points.latest.toExponential(3)}</p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${points.width} ${points.height}`}
        className="h-36 w-full overflow-visible"
        role="img"
        aria-label="Curva de convergencia del error absoluto"
      >
        <defs>
          <linearGradient id="convergence-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d={points.path}
          fill="none"
          stroke="url(#convergence-line)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <span>Iteración 1</span>
        <span className="font-mono">mejor: {points.best.toExponential(3)}</span>
        <span>Iteración {iterations.length}</span>
      </div>
    </div>
  );
}
