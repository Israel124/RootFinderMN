import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MethodBadge } from '@/components/shared/MethodBadge';
import type { CalculationResult } from '@/types';

interface HistorySectionProps {
  history: CalculationResult[];
  onDelete: (id: string) => void;
  onClear: () => void;
  onLoad: (result: CalculationResult) => void;
  onUpdate: (id: string, label: string) => void;
}

/**
 * Lista compacta del historial de resolución con búsqueda e edición inline.
 */
export function HistorySection({ history, onDelete, onClear, onLoad, onUpdate }: HistorySectionProps) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return history;
    }

    return history.filter((item) => {
      const haystack = `${item.method} ${item.functionF} ${item.label ?? ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [history, query]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Historial
            </p>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--text-primary)]">
              Registros recientes en una sola lista
            </h2>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            Limpiar historial
          </button>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por método, función o etiqueta"
            className="h-11 rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)] pl-10"
          />
        </div>
      </section>

      <section className="space-y-3">
        {filteredHistory.length === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
            No hay coincidencias para la búsqueda actual.
          </div>
        ) : (
          filteredHistory.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <MethodBadge method={item.method} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {editingId === item.id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Input
                        value={editingLabel}
                        onChange={(event) => setEditingLabel(event.target.value)}
                        className="h-10 max-w-sm rounded-2xl border-[var(--border)] bg-[var(--bg-elevated)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdate(item.id, editingLabel);
                          setEditingId(null);
                          setEditingLabel('');
                        }}
                        className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)]"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <h3 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                      {item.label?.trim() || 'Sin etiqueta'}
                    </h3>
                  )}

                  <p className="mt-2 line-clamp-2 font-mono text-sm text-[var(--text-muted)]">{item.functionF}</p>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    Raíz: <span className="font-mono text-[var(--text-primary)]">{item.root ?? 'N/D'}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onLoad(item)}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg-base)]"
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditingLabel(item.label ?? '');
                    }}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
                  >
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--destructive)]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
