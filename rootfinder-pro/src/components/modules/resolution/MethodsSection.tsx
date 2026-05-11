import { useMemo } from 'react';
import { Activity, FunctionSquare, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MethodsSection as LegacyMethodsSection } from '@/components/MethodsSection';
import { useMathEval } from '@/hooks/useMathEval';
import type { CalculationResult, MethodType } from '@/types';

interface MethodsSectionProps {
  f: string;
  setF: (f: string) => void;
  a: string;
  setA: (a: string) => void;
  b: string;
  setB: (b: string) => void;
  method: MethodType;
  setMethod: (m: MethodType) => void;
  tol: string;
  setTol: (t: string) => void;
  maxIter: string;
  setMaxIter: (m: string) => void;
  x0: string;
  setX0: (x: string) => void;
  x1: string;
  setX1: (x: string) => void;
  gx: string;
  setGx: (g: string) => void;
  g1: string;
  setG1: (g: string) => void;
  onResult: (result: CalculationResult) => void;
}

/**
 * Presenta el módulo de resolución con cabecera compacta y el formulario heredado encapsulado.
 */
export function MethodsSection(props: MethodsSectionProps) {
  const parsedX0 = Number.parseFloat(props.x0);
  const mathPreview = useMathEval(props.f, Number.isFinite(parsedX0) ? parsedX0 : undefined);

  const stateSummary = useMemo(() => {
    if (!props.f.trim()) {
      return 'Define una función para iniciar el flujo de cálculo.';
    }

    if (!mathPreview.isValid) {
      return mathPreview.error || 'La expresión todavía no es válida.';
    }

    return 'La función está lista para evaluarse y el módulo puede iterar.';
  }, [mathPreview.error, mathPreview.isValid, props.f]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[var(--border)] bg-[linear-gradient(180deg,rgba(6,182,212,0.12),rgba(15,21,18,0.96))]">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Resolución numérica
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--text-primary)]">
              Configura y calcula sin cambiar de pantalla
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
              La entrada base, la validación previa y la ejecución del método viven en un mismo bloque para
              reducir fricción y mantener el contexto matemático visible.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Activity className="h-4 w-4 text-[var(--accent-cyan)]" />
                <span className="text-sm font-semibold">Estado de entrada</span>
              </div>
              <p className="mt-3 text-sm text-[var(--text-muted)]">{stateSummary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2">
                  <FunctionSquare className="h-4 w-4 text-[var(--accent-cyan)]" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">f(x0)</span>
                </div>
                <p className="mt-3 font-mono text-sm text-[var(--text-primary)]">
                  {mathPreview.value !== null ? mathPreview.value.toFixed(6) : 'N/D'}
                </p>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--accent-cyan)]" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--text-muted)]">f'(x0)</span>
                </div>
                <p className="mt-3 font-mono text-sm text-[var(--text-primary)]">
                  {mathPreview.derivative !== null ? mathPreview.derivative.toFixed(6) : 'N/D'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <LegacyMethodsSection {...props} />
    </div>
  );
}
