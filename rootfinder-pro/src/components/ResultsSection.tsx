import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalculationResult } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, ArrowRight, CheckCircle2, Info, LineChart, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResultsSectionProps {
  result: CalculationResult | null;
  onViewGraph: () => void;
  onBackToMethods: () => void;
}

const methodLabels: Record<CalculationResult['method'], string> = {
  'bisection': 'Bisección',
  'false-position': 'Regla falsa',
  'newton-raphson': 'Newton-Raphson',
  'secant': 'Secante',
  'fixed-point': 'Punto fijo',
};

export function ResultsSection({ result, onViewGraph, onBackToMethods }: ResultsSectionProps) {
  if (!result) {
    return (
      <Card className="max-w-4xl mx-auto border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-muted-foreground">
          <Info className="h-12 w-12 opacity-20" />
          <p>No hay resultados para mostrar. Realiza un cálculo primero.</p>
          <Button type="button" variant="outline" onClick={onBackToMethods}>
            <RotateCcw className="h-4 w-4" />
            Ir a métodos
          </Button>
        </CardContent>
      </Card>
    );
  }

  const columns = result.iterations.length > 0 ? Object.keys(result.iterations[0]) : [];
  const quickRead = result.converged
    ? 'El método alcanzó convergencia. Lo siguiente es validar visualmente si la raíz coincide con el comportamiento de la función.'
    : 'El método no cerró convergencia en el límite definido. Conviene revisar semillas, intervalo o cambiar de estrategia antes de repetir.';
  const statusTone = result.converged
    ? 'border-primary/20 bg-primary/8 text-primary'
    : 'border-destructive/20 bg-destructive/8 text-destructive';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Card className="overflow-hidden border-primary/10 bg-linear-to-br from-primary/12 via-card/88 to-card/96 shadow-2xl backdrop-blur-sm">
        <CardHeader className="border-b border-primary/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/65">Salida numérica</p>
              <CardTitle className="mt-3 text-3xl font-black tracking-tight text-primary">Resumen de Resultados</CardTitle>
              <CardDescription className="mt-3 max-w-2xl text-base">
                Resultado obtenido con <span className="font-semibold text-foreground">{methodLabels[result.method]}</span> sobre la función
                <span className="ml-2 font-mono text-foreground">{result.functionF}</span>.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={result.converged ? 'default' : 'destructive'} className="bg-primary px-3 py-1 text-sm text-primary-foreground">
                {result.converged ? 'Convergente' : 'No convergente'}
              </Badge>
              <Button type="button" variant="outline" onClick={onBackToMethods} className="border-primary/20 hover:bg-primary/10">
                <RotateCcw className="h-4 w-4" />
                Ajustar método
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Raíz Aproximada</p>
              <p className="text-xl font-mono font-bold text-primary">
                {result.root !== null ? result.root.toFixed(8) : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Error Final (Ea)</p>
              <p className="text-xl font-mono font-bold text-secondary">
                {result.error !== null ? result.error.toExponential(4) : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Iteraciones</p>
              <p className="text-xl font-mono font-bold">{result.iterations.length}</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</p>
              <div className="mt-1 flex items-center gap-2">
                {result.converged ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-xs leading-tight font-medium">{result.message}</span>
              </div>
            </div>
          </div>

          <div className={`rounded-[1.6rem] border p-5 ${statusTone}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]">Lectura rápida</p>
            <p className="mt-3 text-sm leading-7 text-foreground/90">{quickRead}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={onViewGraph} className="rounded-2xl">
                <LineChart className="h-4 w-4" />
                Ver gráfica
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onBackToMethods}
                className="rounded-2xl border-current/20 bg-transparent"
              >
                <ArrowRight className="h-4 w-4" />
                Reconfigurar parámetros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-primary">Tabla de Iteraciones</CardTitle>
          <CardDescription>
            Seguimiento paso a paso del proceso de convergencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px] rounded-xl border border-primary/10 bg-background/30">
            <Table>
              <TableHeader className="sticky top-0 z-10 border-b border-primary/20 bg-white/95 backdrop-blur-sm">
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col} className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.iterations.map((iter, idx) => (
                  <TableRow key={idx} className="transition-colors hover:bg-primary/5">
                    {columns.map((col) => (
                      <TableCell key={col} className="py-3 font-mono text-xs">
                        {typeof iter[col] === 'number'
                          ? col === 'iteration'
                            ? (iter[col] as number).toString()
                            : (iter[col] as number).toFixed(6)
                          : iter[col]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              onClick={onViewGraph}
              className="rounded-2xl px-5"
            >
              <LineChart className="h-4 w-4" />
              Ver gráfica
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
