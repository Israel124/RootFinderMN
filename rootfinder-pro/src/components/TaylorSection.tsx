import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { TAYLOR_HISTORY_KEY, TAYLOR_HISTORY_UPDATED_EVENT } from '@/lib/historyKeys';
import { Sigma, FunctionSquare, Calculator, LineChart, History, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildTaylorResult, TaylorResult } from '@/lib/taylor';

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
  const graphRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TAYLOR_HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
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

  useEffect(() => {
    const canvas = graphRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050807';
    ctx.fillRect(0, 0, width, height);

    const { xmin, xmax } = graphConfig;
    const step = (xmax - xmin) / 300;
    const samples: Array<{ x: number; fx: number; px: number }> = [];

    if (!fx.trim() || !MathEvaluator.isValid(fx)) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('Ingresa una función válida para graficar.', 28, 40);
      return;
    }

    for (let x = xmin; x <= xmax; x += step) {
      try {
        const exact = MathEvaluator.evaluate(fx, x);
        let poly = exact;
        if (result) {
          poly = result.terms.reduce((acc, term) => acc + term.coefficient * Math.pow(x - result.center, term.order), 0);
        }
        if (Number.isFinite(exact) && Number.isFinite(poly)) {
          samples.push({ x, fx: exact, px: poly });
        }
      } catch {
        // Ignore invalid samples.
      }
    }

    if (samples.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText('No se pudo dibujar la función en este rango.', 28, 40);
      return;
    }

    const values = samples.flatMap((sample) => result ? [sample.fx, sample.px] : [sample.fx]);
    const ymin = Math.min(...values);
    const ymax = Math.max(...values);
    const spanY = Math.max(ymax - ymin, 1);
    const padding = 42;
    const toPxX = (x: number) => padding + ((x - xmin) / (xmax - xmin)) * (width - padding * 2);
    const toPxY = (y: number) => height - padding - ((y - ymin) / spanY) * (height - padding * 2);

    ctx.strokeStyle = '#1e292b';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const xGuide = padding + (i / 4) * (width - padding * 2);
      const yGuide = padding + (i / 4) * (height - padding * 2);
      ctx.beginPath();
      ctx.moveTo(xGuide, padding);
      ctx.lineTo(xGuide, height - padding);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, yGuide);
      ctx.lineTo(width - padding, yGuide);
      ctx.stroke();
    }

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const px = toPxX(sample.x);
      const py = toPxY(sample.fx);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    if (result) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      samples.forEach((sample, index) => {
        const px = toPxX(sample.x);
        const py = toPxY(sample.px);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      const evalX = toPxX(result.evaluateAt);
      const evalY = toPxY(result.approximation);
      ctx.fillStyle = '#ecfdf5';
      ctx.beginPath();
      ctx.arc(evalX, evalY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#10b981';
    ctx.font = '12px sans-serif';
    ctx.fillText('f(x)', padding, 20);
    if (result) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`P${result.order}(x)`, padding + 56, 20);
    }
  }, [fx, result, graphConfig]);

  const previewResult = useMemo(() => {
    try {
      return buildTaylorResult(fx, center, order, evaluateAt);
    } catch {
      return null;
    }
  }, [fx, center, order, evaluateAt]);

  const handleCalculate = () => {
    try {
      const calculation = buildTaylorResult(fx, center, order, evaluateAt);
      setResult(calculation);
      setHistory((current) => [
        {
          ...calculation,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          fx,
          label: historyLabel.trim(),
        },
        ...current,
      ].slice(0, 20));
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

  const activeResult = result ?? previewResult;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
                <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{fx || 'Sin función'}</p>
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
          <div className="flex items-center gap-3">
            <LineChart className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-primary">Gráfica Comparativa</CardTitle>
              <CardDescription>Comparación visual entre la función original y el polinomio de Taylor.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black">
            <canvas ref={graphRef} width={1200} height={460} className="h-auto w-full min-h-[20rem] lg:min-h-[28rem]" />
          </div>
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
                  <TableHeader className="sticky top-0 bg-card z-10 border-b border-primary/10">
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
