import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { LOAD_TAYLOR_HISTORY_EVENT, TAYLOR_HISTORY_KEY, TAYLOR_HISTORY_UPDATED_EVENT } from '@/lib/historyKeys';
import { Sigma, FunctionSquare, Calculator, LineChart, History, Pencil, RefreshCw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { buildTaylorResult, TaylorResult } from '@/lib/taylor';
import { GeoGebraGraph } from '@/components/GeoGebraGraph';

type TaylorHistoryItem = TaylorResult & {
  id: string;
  timestamp: number;
  fx: string;
  label?: string;
};

export function TaylorSection() {
  const [fx, setFx] = useState('exp(x)');
  const [center, setCenter] = useState('0');
  const [order, setOrder] = useState('4');
  const [evaluateAt, setEvaluateAt] = useState('1');
  const [result, setResult] = useState<TaylorResult | null>(null);
  const [history, setHistory] = useState<TaylorHistoryItem[]>([]);
  const [historyLabel, setHistoryLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [graphZoom, setGraphZoom] = useState(1);
  const [lastCalculatedFx, setLastCalculatedFx] = useState('exp(x)');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TAYLOR_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const handleExternalLoad = (event: Event) => {
      const detail = (event as CustomEvent<TaylorHistoryItem>).detail;
      if (!detail) return;
      setFx(detail.fx);
      setCenter(detail.center.toString());
      setOrder(detail.order.toString());
      setEvaluateAt(detail.evaluateAt.toString());
      setResult(detail);
      setLastCalculatedFx(detail.fx);
    };

    window.addEventListener(LOAD_TAYLOR_HISTORY_EVENT, handleExternalLoad as EventListener);
    return () => window.removeEventListener(LOAD_TAYLOR_HISTORY_EVENT, handleExternalLoad as EventListener);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TAYLOR_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      window.dispatchEvent(new Event(TAYLOR_HISTORY_UPDATED_EVENT));
    } catch {
      // Ignore local storage failures.
    }
  }, [history]);

  const graphConfig = useMemo(() => {
    const xEval = parseFloat(evaluateAt);
    const centerValue = parseFloat(center);
    const spanCenter = Number.isNaN(centerValue) ? 0 : centerValue;
    const spanEval = Number.isNaN(xEval) ? 1 : xEval;
    const min = Math.min(spanCenter, spanEval) - 3;
    const max = Math.max(spanCenter, spanEval) + 3;
    return { xmin: min, xmax: max };
  }, [center, evaluateAt]);

  const zoomedGraphConfig = useMemo(() => {
    const centerX = (graphConfig.xmin + graphConfig.xmax) / 2;
    const spanX = Math.max((graphConfig.xmax - graphConfig.xmin) / graphZoom, 0.05);
    return {
      xmin: centerX - spanX / 2,
      xmax: centerX + spanX / 2,
    };
  }, [graphConfig, graphZoom]);

  const zoomTaylorGraph = (direction: 'in' | 'out') => {
    setGraphZoom((current) => {
      const next = direction === 'in' ? current * 1.25 : current / 1.25;
      return Math.min(Math.max(next, 0.2), 80);
    });
  };

  const handleCalculate = () => {
    try {
      const calculation = buildTaylorResult(fx, center, order, evaluateAt);
      const historyItem = {
        ...calculation,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fx,
        label: historyLabel.trim(),
      };
      setResult(calculation);
      setLastCalculatedFx(fx);
      setHistory((current) => {
        const next = [historyItem, ...current].slice(0, 20);
        try {
          window.localStorage.setItem(TAYLOR_HISTORY_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event(TAYLOR_HISTORY_UPDATED_EVENT));
        } catch {
          // Ignore local storage failures.
        }
        return next;
      });
      setHistoryLabel('');
      toast.success('Polinomio de Taylor calculado');
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleLoadHistory = (item: TaylorHistoryItem) => {
    setFx(item.fx);
    setCenter(item.center.toString());
    setOrder(item.order.toString());
    setEvaluateAt(item.evaluateAt.toString());
    setResult(item);
    setLastCalculatedFx(item.fx);
    toast.success('Registro de Taylor cargado');
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(TAYLOR_HISTORY_KEY);
    window.dispatchEvent(new Event(TAYLOR_HISTORY_UPDATED_EVENT));
    toast.success('Historial de Taylor limpiado');
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingValue('');
    }
    toast.success('Registro eliminado');
  };

  const handleStartEdit = (item: TaylorHistoryItem) => {
    setEditingId(item.id);
    setEditingValue(item.label ?? '');
  };

  const handleSaveEdit = (id: string) => {
    setHistory((current) =>
      current.map((item) => (item.id === id ? { ...item, label: editingValue.trim() } : item))
    );
    setEditingId(null);
    setEditingValue('');
    toast.success('Etiqueta actualizada');
  };

  const activeResult = result;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Card className="overflow-hidden border-primary/10 bg-linear-to-br from-primary/10 via-card/82 to-card/94 shadow-2xl backdrop-blur-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/65">Aproximación analítica</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-primary sm:text-4xl">Taylor con lectura numérica y visual</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                Define la función, fija el centro y compara el polinomio contra el valor real sin salir del mismo flujo. La idea es que la configuración, el error y la gráfica se lean como una sola historia.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-primary/15 bg-background/35 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Estado actual</p>
              <p className="mt-3 text-lg font-black text-primary">{activeResult ? `P${activeResult.order}(x) listo` : 'Pendiente de cálculo'}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeResult ? `Error relativo: ${activeResult.relativeError.toFixed(6)}%` : 'Termina la entrada y usa calcular para generar resultados y gráfica.'}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 1</p>
              <p className="mt-3 text-lg font-bold">Modela la serie</p>
              <p className="mt-2 text-sm text-muted-foreground">Define `f(x)`, el centro `a` y el orden de truncamiento que quieres estudiar.</p>
            </div>
            <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 2</p>
              <p className="mt-3 text-lg font-bold">Mide el error</p>
              <p className="mt-2 text-sm text-muted-foreground">Compara `P_n(x)` contra `f(x)` para ver si el orden elegido ya es suficiente.</p>
            </div>
            <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 3</p>
              <p className="mt-3 text-lg font-bold">Valida visualmente</p>
              <p className="mt-2 text-sm text-muted-foreground">Usa la gráfica comparativa para ver dónde la aproximación sigue a la función real.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="border-primary/10 bg-card/60 backdrop-blur-sm shadow-2xl">
          <CardHeader className="border-b border-primary/10 bg-linear-to-r from-primary/10 via-transparent to-transparent">
            <CardTitle className="text-3xl font-black tracking-tight text-primary">
              Aproximaciones con Taylor
            </CardTitle>
            <CardDescription className="max-w-3xl text-base">
              Construye el polinomio de Taylor alrededor de un punto `a`, aproxima `f(x)` y compara la aproximación
              contra el valor real para medir el error.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="taylor-fx" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                  Función f(x)
                </Label>
                <Input
                  id="taylor-fx"
                  value={fx}
                  onChange={(e) => setFx(e.target.value)}
                  placeholder="Ej: exp(x), sin(x), ln(1+x)"
                  className="h-12 bg-background/50 border-primary/20 font-mono text-base"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="taylor-center" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Centro a</Label>
                <Input id="taylor-center" type="number" step="any" value={center} onChange={(e) => setCenter(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="taylor-order" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Orden n</Label>
                <Input id="taylor-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="taylor-x" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Evaluar en x</Label>
                <Input id="taylor-x" type="number" step="any" value={evaluateAt} onChange={(e) => setEvaluateAt(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="taylor-label" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Etiqueta del registro</Label>
                <Input id="taylor-label" value={historyLabel} onChange={(e) => setHistoryLabel(e.target.value)} placeholder="Ej: taylor exp alrededor de 0" className="h-12 bg-background/50 border-primary/20" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 1</p>
                <p className="mt-3 text-lg font-bold">Deriva f(x)</p>
                <p className="mt-2 text-sm text-muted-foreground">Se obtienen las derivadas sucesivas hasta el orden `n`.</p>
              </div>
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 2</p>
                <p className="mt-3 text-lg font-bold">Evalúa en a</p>
                <p className="mt-2 text-sm text-muted-foreground">Cada derivada se evalúa en el centro para formar los coeficientes.</p>
              </div>
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 3</p>
                <p className="mt-3 text-lg font-bold">Aproxima y compara</p>
                <p className="mt-2 text-sm text-muted-foreground">Se calcula `Pn(x)` y se compara con `f(x)` para medir error.</p>
              </div>
            </div>

            <Button
              onClick={handleCalculate}
              className="w-full py-8 text-xl font-bold shadow-xl hover:scale-[1.01] transition-transform bg-primary hover:bg-primary/85 text-primary-foreground"
            >
              Calcular Polinomio de Taylor
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <FunctionSquare className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg text-primary">Configuración</CardTitle>
              </div>
              <CardDescription>Resumen del problema de aproximación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-primary/60">Función</p>
                <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{activeResult ? lastCalculatedFx : 'Sin función calculada'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Centro</p>
                  <p className="mt-2 font-mono text-sm">a = {center}</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Orden</p>
                  <p className="mt-2 font-mono text-sm">n = {order}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {activeResult && (
            <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calculator className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg text-primary">Resumen Numérico</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">P{activeResult.order}({activeResult.evaluateAt})</p>
                  <p className="mt-2 font-mono text-lg text-primary">{activeResult.approximation.toFixed(8)}</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Valor real</p>
                  <p className="mt-2 font-mono text-lg">{activeResult.exactValue.toFixed(8)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error absoluto</p>
                    <p className="mt-2 font-mono text-sm">{activeResult.absoluteError.toExponential(4)}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error relativo</p>
                    <p className="mt-2 font-mono text-sm">{activeResult.relativeError.toFixed(6)}%</p>
                  </div>
                </div>
                <Badge className="bg-primary text-primary-foreground">
                  Aproximación alrededor de a = {activeResult.center}
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
            <LineChart className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-primary">Gráfica Comparativa</CardTitle>
              <CardDescription>Comparación visual entre la función original y el polinomio de Taylor.</CardDescription>
            </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => zoomTaylorGraph('in')} title="Acercar gráfica" aria-label="Acercar gráfica">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => zoomTaylorGraph('out')} title="Alejar gráfica" aria-label="Alejar gráfica">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setGraphZoom(1)} title="Restablecer vista" aria-label="Restablecer vista">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeResult && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Comparación activa</p>
                <p className="mt-3 font-mono text-sm break-words [overflow-wrap:anywhere]">{lastCalculatedFx}</p>
                <p className="mt-2 font-mono text-sm text-amber-400 break-words [overflow-wrap:anywhere]">{activeResult.polynomial}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Punto evaluado</p>
                <p className="mt-3 text-2xl font-black">{activeResult.evaluateAt.toFixed(4)}</p>
                <p className="mt-2 text-sm text-muted-foreground">Centro: a = {activeResult.center.toFixed(4)}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Lectura rápida</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {activeResult.relativeError < 1
                    ? 'La aproximación ya es bastante cercana en el punto evaluado.'
                    : 'Todavía hay una diferencia visible; conviene probar un orden mayor o moverse más cerca del centro.'}
                </p>
              </div>
            </div>
          )}
          <GeoGebraGraph
            expressions={activeResult ? [lastCalculatedFx, activeResult.polynomial] : []}
            points={activeResult ? [{ x: activeResult.evaluateAt, y: activeResult.approximation, label: 'P_n(x)' }] : []}
            xMin={zoomedGraphConfig.xmin}
            xMax={zoomedGraphConfig.xmax}
            heightClassName="h-[28rem] lg:h-[34rem]"
          />
        </CardContent>
      </Card>

      {activeResult && (
        <>
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sigma className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-primary">Polinomio de Taylor</CardTitle>
                  <CardDescription>Expresión construida con los términos hasta el orden seleccionado.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-3xl border border-primary/15 bg-primary/6 p-5">
                <p className="font-mono text-sm break-words [overflow-wrap:anywhere]">{activeResult.polynomial}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-primary">Tabla de Términos</CardTitle>
              <CardDescription>Derivadas, coeficientes y contribución de cada término del polinomio.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] rounded-xl border border-primary/10 bg-background/30">
                <Table>
                  <TableHeader className="sticky top-0 bg-white/95 z-10 border-b border-primary/20 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">k</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">f^(k)(x)</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">f^(k)(a)</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">k!</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">Coeficiente</TableHead>
                      <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">Término</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeResult.terms.map((term) => (
                      <TableRow key={term.order} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="font-mono text-xs py-3">{term.order}</TableCell>
                        <TableCell className="font-mono text-xs py-3 break-words [overflow-wrap:anywhere]">{term.derivativeExpression}</TableCell>
                        <TableCell className="font-mono text-xs py-3">{term.derivativeValue.toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs py-3">{term.factorial}</TableCell>
                        <TableCell className="font-mono text-xs py-3">{term.coefficient.toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs py-3 break-words [overflow-wrap:anywhere]">{term.termExpression}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-primary">Historial de Taylor</CardTitle>
                <CardDescription>Registros guardados localmente con carga, edición y eliminación.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleClearHistory} className="border-primary/20 hover:bg-primary/10">
              Limpiar historial
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/15 bg-background/30 p-4 text-sm text-muted-foreground">
              Todavía no hay aproximaciones de Taylor almacenadas.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="grid w-full gap-3 rounded-2xl border border-primary/10 bg-background/35 p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary/60">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                      {editingId === item.id ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-9 w-[220px] bg-background/50 border-primary/20"
                            placeholder="Etiqueta del registro"
                          />
                          <Button size="sm" onClick={() => handleSaveEdit(item.id)}>Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingValue(''); }}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold">
                            {item.label?.trim() || `${item.fx} alrededor de a=${item.center}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            x = {item.evaluateAt}, orden = {item.order}
                          </p>
                        </>
                      )}
                    </div>
                    <Badge className="bg-primary text-primary-foreground">
                      Error {item.relativeError.toFixed(4)}%
                    </Badge>
                  </div>
                  <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">f(x) = {item.fx}</p>
                  <p className="text-xs text-muted-foreground">
                    Aproximación: {item.approximation.toFixed(6)} · Valor real: {item.exactValue.toFixed(6)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleLoadHistory(item)}>Cargar</Button>
                    <Button size="sm" variant="outline" onClick={() => handleStartEdit(item)} className="border-primary/20 hover:bg-primary/10">
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteHistoryItem(item.id)} className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
