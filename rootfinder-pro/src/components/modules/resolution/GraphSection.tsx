import { MathGraph } from '@/components/shared/MathGraph';

interface GraphSectionProps {
  f: string;
  root: number | null;
  onBackToResults?: () => void;
}

/**
 * Presenta la validación visual de la raíz usando el wrapper de gráficas compartido.
 */
export function GraphSection({ f, root, onBackToResults }: GraphSectionProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Validación visual
        </p>
        <h2 className="mt-3 text-3xl font-extrabold text-[var(--text-primary)]">
          Contrasta la raíz con la curva real
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
          La gráfica debe confirmar que el valor numérico coincide con un cruce real o con el comportamiento
          esperado de la función en el rango visible.
        </p>
        {onBackToResults ? (
          <button
            type="button"
            onClick={onBackToResults}
            className="mt-5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Volver a resultados
          </button>
        ) : null}
      </section>

      <MathGraph
        title="Gráfica de resolución"
        expressions={[f]}
        points={root !== null ? [{ x: root, y: 0, label: 'Raíz' }] : []}
      />
    </div>
  );
}
