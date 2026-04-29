import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { NumericalMethods } from '@/lib/numericalMethods';
import { SYSTEM_HISTORY_KEY, SYSTEM_HISTORY_UPDATED_EVENT } from '@/lib/historyKeys';
import { SystemCalculationResult } from '@/types';
import { AlertCircle, CheckCircle2, FunctionSquare, Sigma, History, LineChart, Pencil, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

type SystemHistoryItem = SystemCalculationResult & {
  id: string;
  timestamp: number;
  label?: string;
};

export function NewtonSystemSection() {
  const [f1, setF1] = useState('x^2 + y^2 - 4');
  const [f2, setF2] = useState('x - y - 1');
  const [x0, setX0] = useState('1.5');
  const [y0, setY0] = useState('0.5');
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('25');
  const [result, setResult] = useState<SystemCalculationResult | null>(null);
  const [history, setHistory] = useState<SystemHistoryItem[]>([]);
  const [historyLabel, setHistoryLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const graphRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SYSTEM_HISTORY_KEY);
      if (raw) {
        setHistory(JSON.parse(raw));
      }
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SYSTEM_HISTORY_KEY, JSON.stringify(history.slice(0, 15)));
      window.dispatchEvent(new Event(SYSTEM_HISTORY_UPDATED_EVENT));
    } catch {
      // Ignore local storage failures.
    }
  }, [history]);

  const preview = useMemo(() => {
    const x = parseFloat(x0);
    const y = parseFloat(y0);

    if (!f1.trim() || !f2.trim() || Number.isNaN(x) || Number.isNaN(y)) {
      return null;
    }

    try {
      return {
        f1Value: MathEvaluator.evaluateWithScope(f1, { x, y }),
        f2Value: MathEvaluator.evaluateWithScope(f2, { x, y }),
        df1dxExpr: MathEvaluator.getPartialDerivativeExpression(f1, 'x'),
        df1dyExpr: MathEvaluator.getPartialDerivativeExpression(f1, 'y'),
        df2dxExpr: MathEvaluator.getPartialDerivativeExpression(f2, 'x'),
        df2dyExpr: MathEvaluator.getPartialDerivativeExpression(f2, 'y'),
        j11: MathEvaluator.partialDerivative(f1, 'x', { x, y }),
        j12: MathEvaluator.partialDerivative(f1, 'y', { x, y }),
        j21: MathEvaluator.partialDerivative(f2, 'x', { x, y }),
        j22: MathEvaluator.partialDerivative(f2, 'y', { x, y }),
      };
    } catch {
      return null;
    }
  }, [f1, f2, x0, y0]);

  const handleCalculate = () => {
    if (!f1.trim() || !f2.trim()) return toast.error('Debes ingresar las dos ecuaciones del sistema');

    const x = parseFloat(x0);
    const y = parseFloat(y0);
    const tolerance = parseFloat(tol);
    const iterations = parseInt(maxIter);

    if (Number.isNaN(x) || Number.isNaN(y)) return toast.error('Los valores iniciales x0 y y0 deben ser numéricos');
    if (Number.isNaN(tolerance) || tolerance <= 0) return toast.error('La tolerancia debe ser positiva');
    if (Number.isNaN(iterations) || iterations <= 0) return toast.error('Las iteraciones máximas deben ser un entero positivo');

    try {
      MathEvaluator.evaluateWithScope(f1, { x, y });
      MathEvaluator.evaluateWithScope(f2, { x, y });
      const calculation = NumericalMethods.newtonRaphsonSystem2x2(f1, f2, x, y, tolerance, iterations);
      setResult(calculation);
      setHistory((current) => [
        {
          ...calculation,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          label: historyLabel.trim(),
        },
        ...current,
      ].slice(0, 15));
      setHistoryLabel('');

      if (calculation.converged) {
        toast.success('Sistema resuelto con Newton-Raphson');
      } else {
        toast.warning(calculation.message);
      }
    } catch (error: any) {
      toast.error('Error matemático: ' + error.message);
    }
  };

  const columns = result?.iterations.length ? Object.keys(result.iterations[0]) : [];

  useEffect(() => {
    const canvas = graphRef.current;
    if (!canvas) return;

    const drawGraph = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = '#050807';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const points = result?.iterations.map((item) => ({ x: item.x, y: item.y })) ?? [];
      if (result?.solution) {
        points.push({ x: result.solution.x, y: result.solution.y });
      }

      if (points.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('Calcula el sistema para ver la trayectoria iterativa.', 28, 40);
        return;
      }

      const padding = 42;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      let minX = Math.min(...xs);
      let maxX = Math.max(...xs);
      let minY = Math.min(...ys);
      let maxY = Math.max(...ys);
      const spanX = Math.max(maxX - minX, 0.5);
      const spanY = Math.max(maxY - minY, 0.5);
      const marginX = Math.max(spanX * 0.18, 0.5);
      const marginY = Math.max(spanY * 0.18, 0.5);
      minX -= marginX;
      maxX += marginX;
      minY -= marginY;
      maxY += marginY;
      const spanXWithMargin = Math.max(maxX - minX, 0.5);
      const spanYWithMargin = Math.max(maxY - minY, 0.5);

      const toPxX = (value: number) => padding + ((value - minX) / spanXWithMargin) * (rect.width - padding * 2);
      const toPxY = (value: number) => rect.height - padding - ((value - minY) / spanYWithMargin) * (rect.height - padding * 2);

      ctx.strokeStyle = '#1e292b';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      for (let i = 0; i < 5; i++) {
        const xGuide = padding + (i / 4) * (rect.width - padding * 2);
        const yGuide = padding + (i / 4) * (rect.height - padding * 2);
        ctx.beginPath();
        ctx.moveTo(xGuide, padding);
        ctx.lineTo(xGuide, rect.height - padding);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padding, yGuide);
        ctx.lineTo(rect.width - padding, yGuide);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const xAxisY = 0 >= minY && 0 <= maxY ? toPxY(0) : rect.height - padding;
      const yAxisX = 0 >= minX && 0 <= maxX ? toPxX(0) : padding;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, xAxisY);
      ctx.lineTo(rect.width - padding, xAxisY);
      ctx.moveTo(yAxisX, padding);
      ctx.lineTo(yAxisX, rect.height - padding);
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach((point, index) => {
        const px = toPxX(point.x);
        const py = toPxY(point.y);
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();

      points.forEach((point, index) => {
        const px = toPxX(point.x);
        const py = toPxY(point.y);
        ctx.fillStyle = index === points.length - 1 ? '#f59e0b' : '#ecfdf5';
        ctx.beginPath();
        ctx.arc(px, py, index === points.length - 1 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        const label = index === points.length - 1 ? 'sol' : `i${index + 1}`;
        ctx.fillText(label, px + 10, py - 10);
      });

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(`x: [${minX.toFixed(3)}, ${maxX.toFixed(3)}]`, padding, rect.height - 16);
      ctx.fillText(`y: [${minY.toFixed(3)}, ${maxY.toFixed(3)}]`, rect.width - 180, rect.height - 16);
    };

    drawGraph();
    window.addEventListener('resize', drawGraph);
    return () => window.removeEventListener('resize', drawGraph);
  }, [result]);

  const handleLoadHistory = (item: SystemHistoryItem) => {
    setF1(item.functionF1);
    setF2(item.functionF2);
    setX0(item.params.x0?.toString() ?? '');
    setY0(item.params.y0?.toString() ?? '');
    setTol(item.params.tol?.toString() ?? '');
    setMaxIter(item.params.maxIter?.toString() ?? '');
    setResult(item);
    toast.success('Cálculo del sistema cargado del historial');
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(SYSTEM_HISTORY_KEY);
    window.dispatchEvent(new Event(SYSTEM_HISTORY_UPDATED_EVENT));
    toast.success('Historial del sistema limpiado');
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingValue('');
    }
    toast.success('Registro eliminado');
  };

  const handleStartEdit = (item: SystemHistoryItem) => {
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

  const handleExportHistory = () => {
    if (history.length === 0) {
      toast.error('No hay historial del sistema para exportar');
      return;
    }

    const headers = ['Fecha', 'Etiqueta', 'F1', 'F2', 'x0', 'y0', 'x', 'y', 'Iteraciones', 'Convergencia'];
    const rows = history.map((item) => [
      new Date(item.timestamp).toLocaleString(),
      `"${item.label ?? ''}"`,
      `"${item.functionF1}"`,
      `"${item.functionF2}"`,
      item.params.x0 ?? '',
      item.params.y0 ?? '',
      item.solution?.x ?? '',
      item.solution?.y ?? '',
      item.iterations.length,
      item.converged ? 'Si' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'historial_sistema_newton.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Historial exportado');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="border-primary/10 bg-card/60 backdrop-blur-sm shadow-2xl">
          <CardHeader className="border-b border-primary/10 bg-linear-to-r from-primary/10 via-transparent to-transparent">
            <CardTitle className="text-3xl font-black tracking-tight text-primary">
              Newton-Raphson para Sistemas
            </CardTitle>
            <CardDescription className="max-w-3xl text-base">
              Resuelve un sistema no lineal de dos ecuaciones con dos incógnitas y revisa el flujo iterativo:
              evaluación del sistema, Jacobiana, corrección y actualización del vector.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="f1-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                  Ecuación F1(x, y)
                </Label>
                <Input
                  id="f1-system"
                  value={f1}
                  onChange={(e) => setF1(e.target.value)}
                  className="h-12 bg-background/50 border-primary/20 font-mono text-base"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="f2-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                  Ecuación F2(x, y)
                </Label>
                <Input
                  id="f2-system"
                  value={f2}
                  onChange={(e) => setF2(e.target.value)}
                  className="h-12 bg-background/50 border-primary/20 font-mono text-base"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-3">
                <Label htmlFor="x0-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">x0</Label>
                <Input id="x0-system" type="number" step="any" value={x0} onChange={(e) => setX0(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="y0-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">y0</Label>
                <Input id="y0-system" type="number" step="any" value={y0} onChange={(e) => setY0(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="tol-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Tolerancia</Label>
                <Input id="tol-system" type="number" step="any" value={tol} onChange={(e) => setTol(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="iter-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Iteraciones Máx</Label>
                <Input id="iter-system" type="number" value={maxIter} onChange={(e) => setMaxIter(e.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="label-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Etiqueta del registro</Label>
              <Input
                id="label-system"
                value={historyLabel}
                onChange={(e) => setHistoryLabel(e.target.value)}
                placeholder="Ej: sistema prueba 1"
                className="h-12 bg-background/50 border-primary/20"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 1</p>
                <p className="mt-3 text-lg font-bold">Evalúa F(Xk)</p>
                <p className="mt-2 text-sm text-muted-foreground">Se calcula el vector residual con las dos ecuaciones en el punto actual.</p>
              </div>
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 2</p>
                <p className="mt-3 text-lg font-bold">Construye J(Xk)</p>
                <p className="mt-2 text-sm text-muted-foreground">La Jacobiana se evalúa con derivadas parciales respecto a x y y.</p>
              </div>
              <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 3</p>
                <p className="mt-3 text-lg font-bold">Actualiza Xk+1</p>
                <p className="mt-2 text-sm text-muted-foreground">Se resuelve J(Xk)Δ = -F(Xk) y luego se aplica Xk+1 = Xk + Δ.</p>
              </div>
            </div>

            <Button
              onClick={handleCalculate}
              className="w-full py-8 text-xl font-bold shadow-xl hover:scale-[1.01] transition-transform bg-primary hover:bg-primary/85 text-primary-foreground"
            >
              Calcular Sistema
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Vista Inicial</CardTitle>
              <CardDescription>Estado del sistema en el punto de arranque.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                <p className="text-[10px] uppercase font-bold tracking-[0.25em] text-primary/60">Vector Inicial</p>
                <p className="mt-2 font-mono text-sm">X0 = ({x0 || 'N/D'}, {y0 || 'N/D'})</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FunctionSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Sistema</p>
                </div>
                <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">F1(x, y) = {f1 || 'N/D'}</p>
                <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">F2(x, y) = {f2 || 'N/D'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Jacobiana en el Arranque</CardTitle>
              <CardDescription>Matriz evaluada con el punto inicial actual y derivadas simbólicas usadas.</CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">∂F1/∂x</p>
                      <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{preview.df1dxExpr}</p>
                    </div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">∂F1/∂y</p>
                      <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{preview.df1dyExpr}</p>
                    </div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">∂F2/∂x</p>
                      <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{preview.df2dxExpr}</p>
                    </div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">∂F2/∂y</p>
                      <p className="mt-2 font-mono text-sm break-words [overflow-wrap:anywhere]">{preview.df2dyExpr}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 font-mono text-sm">{preview.j11.toFixed(6)}</div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 font-mono text-sm">{preview.j12.toFixed(6)}</div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 font-mono text-sm">{preview.j21.toFixed(6)}</div>
                    <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 font-mono text-sm">{preview.j22.toFixed(6)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">F1(X0)</p>
                      <p className="mt-2 font-mono text-sm">{preview.f1Value.toFixed(6)}</p>
                    </div>
                    <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">F2(X0)</p>
                      <p className="mt-2 font-mono text-sm">{preview.f2Value.toFixed(6)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-primary/15 bg-background/30 p-4 text-sm text-muted-foreground">
                  Ajusta ecuaciones y valores iniciales para mostrar la Jacobiana.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm xl:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <LineChart className="h-4 w-4 text-primary" />
                <div>
                  <CardTitle className="text-lg text-primary">Gráfica de Iteración</CardTitle>
                  <CardDescription>Trayectoria del vector `(x, y)` hasta la solución, en un panel más amplio.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black">
                <canvas ref={graphRef} className="w-full min-h-[28rem] lg:min-h-[36rem]" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {result && (
        <>
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-primary">Resultado del Sistema</CardTitle>
                  <CardDescription>Resumen del vector aproximado y del estado de convergencia.</CardDescription>
                </div>
                <Badge variant={result.converged ? 'default' : 'destructive'} className="text-sm px-3 py-1 bg-primary text-primary-foreground">
                  {result.converged ? 'Convergente' : 'No convergente'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">x*</p>
                  <p className="mt-2 font-mono text-xl font-bold text-primary">
                    {result.solution ? result.solution.x.toFixed(8) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">y*</p>
                  <p className="mt-2 font-mono text-xl font-bold text-primary">
                    {result.solution ? result.solution.y.toFixed(8) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error Final</p>
                  <p className="mt-2 font-mono text-xl font-bold text-secondary">
                    {result.error !== null ? result.error.toExponential(4) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Estado</p>
                  <div className="mt-2 flex items-center gap-2">
                    {result.converged ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="text-xs font-medium leading-tight">{result.message}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sigma className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-primary">Flujo de Iteraciones</CardTitle>
                  <CardDescription>Secuencia completa de Newton-Raphson para el sistema.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] rounded-xl border border-primary/10 bg-background/30">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10 border-b border-primary/10">
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column} className="uppercase text-[10px] font-bold tracking-widest text-primary/70">
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.iterations.map((iteration, index) => (
                      <TableRow key={index} className="hover:bg-primary/5 transition-colors">
                        {columns.map((column) => (
                          <TableCell key={column} className="font-mono text-xs py-3">
                            {typeof iteration[column as keyof typeof iteration] === 'number'
                              ? column === 'iteration'
                                ? String(iteration[column as keyof typeof iteration] as number)
                                : (iteration[column as keyof typeof iteration] as number).toFixed(6)
                              : iteration[column as keyof typeof iteration]}
                          </TableCell>
                        ))}
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
                <CardTitle className="text-primary">Historial del Sistema</CardTitle>
                <CardDescription>Últimos cálculos guardados localmente en este navegador.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportHistory} className="border-primary/20 hover:bg-primary/10">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearHistory} className="border-primary/20 hover:bg-primary/10">
                Limpiar historial
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/15 bg-background/30 p-4 text-sm text-muted-foreground">
              Todavía no hay ejecuciones del sistema almacenadas.
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
                            {item.label?.trim() || `x0 = ${item.params.x0}, y0 = ${item.params.y0}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            x0 = {item.params.x0}, y0 = {item.params.y0}
                          </p>
                        </>
                      )}
                    </div>
                    <Badge variant={item.converged ? 'default' : 'secondary'} className={item.converged ? 'bg-primary text-primary-foreground' : ''}>
                      {item.converged ? 'Convergente' : 'Sin convergencia'}
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">F1 = {item.functionF1}</p>
                    <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">F2 = {item.functionF2}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solución: {item.solution ? `(${item.solution.x.toFixed(6)}, ${item.solution.y.toFixed(6)})` : 'N/D'} · Iteraciones: {item.iterations.length}
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
