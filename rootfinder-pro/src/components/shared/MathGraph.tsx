import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GeoGebraGraph } from '@/components/GeoGebraGraph';
import { cn } from '@/lib/utils';
import { estimateFunctionViewport, normalizeRange } from '@/lib/graphUtils';

interface MathGraphPoint {
  x: number;
  y: number;
  label: string;
}

interface MathGraphProps {
  expressions: string[];
  points?: MathGraphPoint[];
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  className?: string;
  title?: string;
}

/**
 * Wrapper unificado para GeoGebra con fallback visual, skeleton y reintento manual.
 */
export function MathGraph({
  expressions,
  points = [],
  xMin,
  xMax,
  yMin,
  yMax,
  className,
  title = 'Visualización matemática',
}: MathGraphProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [failed, setFailed] = useState(false);

  const normalizedExpressions = useMemo(
    () => expressions.map((expression) => expression.trim()).filter(Boolean),
    [expressions],
  );
  const primaryExpression = normalizedExpressions[0] ?? '';
  const highlightedRoot = points.find((point) => Number.isFinite(point.x) && Math.abs(point.y) < 1e-9)?.x ?? null;
  const fallbackRange = useMemo(
    () => ({
      xmin: xMin ?? -10,
      xmax: xMax ?? 10,
      ymin: yMin ?? -10,
      ymax: yMax ?? 10,
    }),
    [xMax, xMin, yMax, yMin],
  );
  const autoRange = useMemo(
    () => estimateFunctionViewport(primaryExpression, { root: highlightedRoot, fallback: fallbackRange }),
    [fallbackRange, highlightedRoot, primaryExpression],
  );
  const effectiveRange = useMemo(
    () =>
      normalizeRange(
        {
          xmin: xMin ?? autoRange.xmin,
          xmax: xMax ?? autoRange.xmax,
          ymin: yMin ?? autoRange.ymin,
          ymax: yMax ?? autoRange.ymax,
        },
        autoRange,
      ),
    [autoRange, xMax, xMin, yMax, yMin],
  );

  return (
    <section className={cn('rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
          <p className="text-xs text-[var(--text-muted)]">
            GeoGebra interactivo
          </p>
        </div>
        {failed ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFailed(false);
              setRetryKey((current) => current + 1);
            }}
            className="rounded-full"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        ) : null}
      </div>

      <div key={retryKey}>
        <GeoGebraGraph
          expressions={normalizedExpressions}
          points={points}
          xMin={effectiveRange.xmin}
          xMax={effectiveRange.xmax}
          yMin={effectiveRange.ymin}
          yMax={effectiveRange.ymax}
          heightClassName="h-[25rem] lg:h-[32rem]"
          fallback={
            <div className="flex h-full min-h-[25rem] items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(15,21,18,0.96),rgba(8,12,10,0.98))]">
              <div className="w-full max-w-sm animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
                <div className="h-4 w-28 rounded bg-white/8" />
                <div className="mt-4 h-48 rounded-2xl bg-white/6" />
                <div className="mt-4 h-3 w-40 rounded bg-white/6" />
                <div className="mt-2 h-3 w-24 rounded bg-white/6" />
              </div>
            </div>
          }
        />
      </div>

      {normalizedExpressions.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-muted)]">
          <AlertTriangle className="h-4 w-4 text-[var(--accent-amber)]" />
          No hay expresiones válidas para renderizar.
        </div>
      ) : null}
    </section>
  );
}
