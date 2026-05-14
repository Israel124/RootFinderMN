import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FunctionSquare, History, LineChart, Pencil, RefreshCw, Sigma, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LOAD_SYSTEM_HISTORY_EVENT, SYSTEM_HISTORY_KEY, SYSTEM_HISTORY_UPDATED_EVENT } from '@/lib/historyKeys';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { NumericalMethods } from '@/lib/numericalMethods';
import { GeoGebraGraph } from '@/components/GeoGebraGraph';
import { SystemCalculationResult } from '@/types';

type SystemHistoryItem = SystemCalculationResult & {
  id: string;
  timestamp: number;
  label?: string;
};

const variableName = (index: number) => {
  const names = ['x', 'y', 'z', 'w'];
  return names[index] ?? `x${index + 1}`;
};

const defaultFunction = (index: number, n: number) => {
  if (n === 2) return ['x^2 + y^2 - 4', 'x - y - 1'][index] ?? '';
  return `${variableName(index)} - ${index + 1}`;
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) return 'N/A';
  return Math.abs(value) >= 1e5 || (Math.abs(value) > 0 && Math.abs(value) < 1e-4)
    ? value.toExponential(6)
    : value.toFixed(6);
};

const solutionValues = (result: SystemCalculationResult | null) => result?.solution?.values ?? [];

export function NewtonSystemSection() {
  const [dimensionText, setDimensionText] = useState('2');
  const [dimension, setDimension] = useState(2);
  const [variables, setVariables] = useState(['x', 'y']);
  const [functions, setFunctions] = useState(['x^2 + y^2 - 4', 'x - y - 1']);
  const [initialValues, setInitialValues] = useState(['1.5', '0.5']);
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('25');
  const [result, setResult] = useState<SystemCalculationResult | null>(null);
  const [history, setHistory] = useState<SystemHistoryItem[]>([]);
  const [historyLabel, setHistoryLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [graphZoom, setGraphZoom] = useState(1);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SYSTEM_HISTORY_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const handleExternalLoad = (event: Event) => {
      const detail = (event as CustomEvent<SystemHistoryItem>).detail;
      if (!detail) return;
      loadCalculation(detail);
    };

    window.addEventListener(LOAD_SYSTEM_HISTORY_EVENT, handleExternalLoad as EventListener);
    return () => window.removeEventListener(LOAD_SYSTEM_HISTORY_EVENT, handleExternalLoad as EventListener);
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
    const parsedValues = initialValues.map((value) => parseFloat(value));
    if (functions.some((fn) => !fn.trim()) || parsedValues.some(Number.isNaN)) return null;

    try {
      const scope = variables.reduce<Record<string, number>>((acc, variable, index) => {
        acc[variable] = parsedValues[index];
        return acc;
      }, {});

      return {
        fValues: functions.map((fn) => MathEvaluator.evaluateWithScope(fn, scope)),
        derivatives: functions.map((fn) =>
          variables.map((variable) => MathEvaluator.getPartialDerivativeExpression(fn, variable))
        ),
        jacobian: functions.map((fn) =>
          variables.map((variable) => MathEvaluator.partialDerivative(fn, variable, scope))
        ),
      };
    } catch {
      return null;
    }
  }, [functions, initialValues, variables]);

  const tableColumns = useMemo(() => {
    if (!result?.iterations.length) return [];
    return [
      'iteration',
      ...result.variables,
      ...result.variables.map((variable) => `d${variable}`),
      ...result.variables.map((variable) => `${variable}Next`),
      'ea',
      'er',
    ];
  }, [result]);

  const systemGraph = useMemo(() => {
    const points = result?.iterations
      .map((item) => item.vector ?? [])
      .filter((item) => item.length >= 2)
      .map((item, index) => ({ x: item[0], y: item[1], label: `I${index + 1}` })) ?? [];
    const solution = solutionValues(result);

    if (solution.length >= 2) {
      points.push({ x: solution[0], y: solution[1], label: 'Sol' });
    }

    if (points.length === 0) {
      return null;
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const marginX = Math.max((maxX - minX) * 0.18, 0.5);
    const marginY = Math.max((maxY - minY) * 0.18, 0.5);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spanX = Math.max((maxX - minX + marginX * 2) / graphZoom, 0.05);
    const spanY = Math.max((maxY - minY + marginY * 2) / graphZoom, 0.05);
    const pointList = points.map((point) => `(${point.x},${point.y})`).join(',');

    return {
      points,
      commands: [
        `sysPts={${pointList}}`,
        'sysPath=Polyline(sysPts)',
        'SetColor(sysPath,16,185,129)',
        'SetLineThickness(sysPath,6)',
      ],
      xMin: centerX - spanX / 2,
      xMax: centerX + spanX / 2,
      yMin: centerY - spanY / 2,
      yMax: centerY + spanY / 2,
    };
  }, [graphZoom, result]);

  const zoomSystemGraph = (direction: 'in' | 'out') => {
    setGraphZoom((current) => {
      const next = direction === 'in' ? current * 1.25 : current / 1.25;
      return Math.min(Math.max(next, 0.2), 80);
    });
  };

  const applyDimension = () => {
    const nextDimension = Number(dimensionText);
    if (!Number.isInteger(nextDimension) || nextDimension < 2) {
      toast.error('El tamano del sistema debe ser un entero mayor o igual a 2');
      return;
    }

    const nextVariables = Array.from({ length: nextDimension }, (_, index) => variables[index] ?? variableName(index));
    setDimension(nextDimension);
    setVariables(nextVariables);
    setFunctions(Array.from({ length: nextDimension }, (_, index) => functions[index] ?? defaultFunction(index, nextDimension)));
    setInitialValues(Array.from({ length: nextDimension }, (_, index) => initialValues[index] ?? '1'));
    setResult(null);
  };

  const updateFunction = (index: number, value: string) => {
    setFunctions((current) => current.map((item, currentIndex) => (currentIndex === index ? value : item)));
  };

  const updateInitialValue = (index: number, value: string) => {
    setInitialValues((current) => current.map((item, currentIndex) => (currentIndex === index ? value : item)));
  };

  const handleCalculate = () => {
    if (functions.some((fn) => !fn.trim())) return toast.error('Debes ingresar todas las ecuaciones del sistema');

    const parsedValues = initialValues.map((value) => parseFloat(value));
    const tolerance = parseFloat(tol);
    const iterations = parseInt(maxIter, 10);

    if (parsedValues.some(Number.isNaN)) return toast.error('Todos los valores iniciales deben ser numericos');
    if (Number.isNaN(tolerance) || tolerance <= 0) return toast.error('La tolerancia debe ser positiva');
    if (!Number.isInteger(iterations) || iterations <= 0) return toast.error('Las iteraciones maximas deben ser un entero positivo');

    try {
      const calculation = NumericalMethods.newtonRaphsonSystem(functions, variables, parsedValues, tolerance, iterations);
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
      calculation.converged ? toast.success('Sistema resuelto con Newton-Raphson') : toast.warning(calculation.message);
    } catch (error: any) {
      toast.error('Error matematico: ' + error.message);
    }
  };

  const loadCalculation = (item: SystemHistoryItem) => {
    const loadedFunctions = item.functions ?? [item.functionF1, item.functionF2].filter(Boolean);
    const loadedVariables = item.variables ?? ['x', 'y'];
    const loadedInitialValues = item.params.initialValues ?? [item.params.x0, item.params.y0].filter((value: unknown) => value !== undefined);
    const nextDimension = Math.max(loadedFunctions.length, loadedVariables.length, loadedInitialValues.length, 2);

    setDimension(nextDimension);
    setDimensionText(String(nextDimension));
    setVariables(Array.from({ length: nextDimension }, (_, index) => loadedVariables[index] ?? variableName(index)));
    setFunctions(Array.from({ length: nextDimension }, (_, index) => loadedFunctions[index] ?? defaultFunction(index, nextDimension)));
    setInitialValues(Array.from({ length: nextDimension }, (_, index) => loadedInitialValues[index]?.toString() ?? '1'));
    setTol(item.params.tol?.toString() ?? '');
    setMaxIter(item.params.maxIter?.toString() ?? '');
    setResult(item);
    toast.success('Calculo del sistema cargado del historial');
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(SYSTEM_HISTORY_KEY);
    window.dispatchEvent(new Event(SYSTEM_HISTORY_UPDATED_EVENT));
    toast.success('Historial del sistema limpiado');
  };

  const handleExportHistory = () => {
    if (history.length === 0) return toast.error('No hay historial del sistema para exportar');

    const headers = ['Fecha', 'Etiqueta', 'Dimension', 'Ecuaciones', 'Vector inicial', 'Solucion', 'Iteraciones', 'Convergencia'];
    const rows = history.map((item) => [
      new Date(item.timestamp).toLocaleString(),
      `"${item.label ?? ''}"`,
      item.variables?.length ?? 2,
      `"${(item.functions ?? [item.functionF1, item.functionF2]).join(' | ')}"`,
      `"${(item.params.initialValues ?? [item.params.x0, item.params.y0]).join(' | ')}"`,
      `"${solutionValues(item).map(formatNumber).join(' | ')}"`,
      item.iterations.length,
      item.converged ? 'Si' : 'No',
    ]);

    const blob = new Blob([[headers, ...rows].map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
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

  const solution = solutionValues(result);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="border-primary/10 bg-card/60 backdrop-blur-sm shadow-2xl">
          <CardHeader className="border-b border-primary/10 bg-linear-to-r from-primary/10 via-transparent to-transparent">
            <CardTitle className="text-3xl font-black tracking-tight text-primary">
              Newton-Raphson para Sistemas
            </CardTitle>
            <CardDescription className="max-w-3xl text-base">
              Resuelve sistemas no lineales cuadrados n x n con Jacobiana dinamica y pivoteo parcial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <Label htmlFor="dimension-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                  Numero de ecuaciones y variables
                </Label>
                <Input
                  id="dimension-system"
                  type="number"
                  min={2}
                  step={1}
                  value={dimensionText}
                  onChange={(event) => setDimensionText(event.target.value)}
                  className="h-12 bg-background/50 border-primary/20"
                />
              </div>
              <Button type="button" onClick={applyDimension} className="self-end h-12 px-6">
                Aplicar tamano
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {functions.map((fn, index) => (
                <div className="space-y-3" key={index}>
                  <Label htmlFor={`f-system-${index}`} className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                    {`Ecuacion F${index + 1}(${variables.join(', ')})`}
                  </Label>
                  <Input
                    id={`f-system-${index}`}
                    value={fn}
                    onChange={(event) => updateFunction(index, event.target.value)}
                    className="h-12 bg-background/50 border-primary/20 font-mono text-base"
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {variables.map((variable, index) => (
                <div className="space-y-3" key={variable}>
                  <Label htmlFor={`initial-system-${variable}`} className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">
                    {`${variable}0`}
                  </Label>
                  <Input
                    id={`initial-system-${variable}`}
                    type="number"
                    step="any"
                    value={initialValues[index]}
                    onChange={(event) => updateInitialValue(index, event.target.value)}
                    className="h-12 bg-background/50 border-primary/20"
                  />
                </div>
              ))}
              <div className="space-y-3">
                <Label htmlFor="tol-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Tolerancia</Label>
                <Input id="tol-system" type="number" step="any" value={tol} onChange={(event) => setTol(event.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="iter-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Iteraciones max</Label>
                <Input id="iter-system" type="number" value={maxIter} onChange={(event) => setMaxIter(event.target.value)} className="h-12 bg-background/50 border-primary/20" />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="label-system" className="text-primary/70 font-bold uppercase text-[12px] tracking-widest">Etiqueta del registro</Label>
              <Input id="label-system" value={historyLabel} onChange={(event) => setHistoryLabel(event.target.value)} placeholder="Ej: sistema 5x5" className="h-12 bg-background/50 border-primary/20" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 1</p>
                <p className="mt-3 text-lg font-bold">Evalua F(Xk)</p>
                <p className="mt-2 text-sm text-muted-foreground">Calcula el vector residual de las {dimension} ecuaciones.</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 2</p>
                <p className="mt-3 text-lg font-bold">Construye J(Xk)</p>
                <p className="mt-2 text-sm text-muted-foreground">Evalua todas las derivadas parciales para la matriz {dimension} x {dimension}.</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Paso 3</p>
                <p className="mt-3 text-lg font-bold">Resuelve la correccion</p>
                <p className="mt-2 text-sm text-muted-foreground">Usa eliminacion gaussiana con pivoteo para validar Jacobiana invertible.</p>
              </div>
            </div>

            <Button onClick={handleCalculate} className="w-full py-8 text-xl font-bold shadow-xl hover:scale-[1.01] transition-transform bg-primary hover:bg-primary/85 text-primary-foreground">
              Calcular Sistema {dimension}x{dimension}
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
                <p className="mt-2 font-mono text-sm">X0 = ({initialValues.join(', ')})</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FunctionSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Sistema</p>
                </div>
                {functions.map((fn, index) => (
                  <p className="font-mono text-xs break-words [overflow-wrap:anywhere]" key={index}>
                    F{index + 1} = {fn || 'N/D'}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-primary">Jacobiana en el Arranque</CardTitle>
              <CardDescription>Matriz evaluada con el punto inicial actual.</CardDescription>
            </CardHeader>
            <CardContent>
              {preview ? (
                <div className="space-y-4">
                  <ScrollArea className="max-h-[360px] rounded-xl border border-primary/10 bg-background/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead></TableHead>
                          {variables.map((variable) => <TableHead key={variable}>d/d{variable}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.jacobian.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            <TableCell className="font-mono text-xs">F{rowIndex + 1}</TableCell>
                            {row.map((value, colIndex) => (
                              <TableCell className="font-mono text-xs" key={colIndex}>{formatNumber(value)}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {preview.fValues.map((value, index) => (
                      <div className="rounded-xl border border-primary/10 bg-primary/5 p-4" key={index}>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">F{index + 1}(X0)</p>
                        <p className="mt-2 font-mono text-sm">{formatNumber(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-primary/15 bg-background/30 p-4 text-sm text-muted-foreground">
                  Ajusta ecuaciones y valores iniciales para mostrar la Jacobiana.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 bg-card/55 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <LineChart className="h-4 w-4 text-primary" />
                  <div>
                    <CardTitle className="text-lg text-primary">Grafica de Iteracion</CardTitle>
                    <CardDescription>Proyeccion sobre las dos primeras variables.</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => zoomSystemGraph('in')} title="Acercar grafica" aria-label="Acercar grafica">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => zoomSystemGraph('out')} title="Alejar grafica" aria-label="Alejar grafica">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setGraphZoom(1)} title="Restablecer vista" aria-label="Restablecer vista">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {systemGraph ? (
                <GeoGebraGraph
                  expressions={[]}
                  commands={systemGraph.commands}
                  points={systemGraph.points}
                  xMin={systemGraph.xMin}
                  xMax={systemGraph.xMax}
                  yMin={systemGraph.yMin}
                  yMax={systemGraph.yMax}
                  heightClassName="h-[28rem] lg:h-[36rem]"
                  showAlgebraInput={false}
                  fallback={
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                      Cargando proyección del sistema en GeoGebra...
                    </div>
                  }
                />
              ) : (
                <div className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-primary/20 bg-black px-6 text-center text-sm text-muted-foreground lg:min-h-[36rem]">
                  Calcula el sistema para ver la proyección en las dos primeras variables.
                </div>
              )}
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
                {result.variables.map((variable, index) => (
                  <div className="rounded-xl border border-primary/10 bg-background/50 p-4" key={variable}>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{variable}*</p>
                    <p className="mt-2 font-mono text-xl font-bold text-primary">{solution[index] !== undefined ? formatNumber(solution[index]) : 'N/A'}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Error Final</p>
                  <p className="mt-2 font-mono text-xl font-bold text-secondary">{result.error !== null ? result.error.toExponential(4) : 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-primary/10 bg-background/50 p-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Estado</p>
                  <div className="mt-2 flex items-center gap-2">
                    {result.converged ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
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
                  <TableHeader className="sticky top-0 bg-white/95 z-10 border-b border-primary/20 backdrop-blur-sm">
                    <TableRow>
                      {tableColumns.map((column) => (
                        <TableHead key={column} className="uppercase text-[10px] font-bold tracking-widest text-primary/70">{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.iterations.map((iteration, index) => (
                      <TableRow key={index} className="hover:bg-primary/5 transition-colors">
                        {tableColumns.map((column) => {
                          const value = iteration[column];
                          return (
                            <TableCell key={column} className="font-mono text-xs py-3">
                              {typeof value === 'number' ? (column === 'iteration' ? String(value) : formatNumber(value)) : String(value ?? '')}
                            </TableCell>
                          );
                        })}
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
                <CardDescription>Ultimos calculos guardados localmente en este navegador.</CardDescription>
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
              Todavia no hay ejecuciones del sistema almacenadas.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="grid w-full gap-3 rounded-2xl border border-primary/10 bg-background/35 p-4 text-left transition-all hover:border-primary/30 hover:bg-primary/5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-primary/60">{new Date(item.timestamp).toLocaleString()}</p>
                      {editingId === item.id ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input value={editingValue} onChange={(event) => setEditingValue(event.target.value)} className="h-9 w-[220px] bg-background/50 border-primary/20" placeholder="Etiqueta del registro" />
                          <Button size="sm" onClick={() => {
                            setHistory((current) => current.map((entry) => (entry.id === item.id ? { ...entry, label: editingValue.trim() } : entry)));
                            setEditingId(null);
                            setEditingValue('');
                          }}>Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingValue(''); }}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 text-sm font-semibold">{item.label?.trim() || `Sistema ${item.variables?.length ?? 2}x${item.variables?.length ?? 2}`}</p>
                          <p className="mt-1 text-xs text-muted-foreground">X0 = ({(item.params.initialValues ?? [item.params.x0, item.params.y0]).join(', ')})</p>
                        </>
                      )}
                    </div>
                    <Badge variant={item.converged ? 'default' : 'secondary'} className={item.converged ? 'bg-primary text-primary-foreground' : ''}>
                      {item.converged ? 'Convergente' : 'Sin convergencia'}
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {(item.functions ?? [item.functionF1, item.functionF2]).map((fn, index) => (
                      <p className="font-mono text-xs break-words [overflow-wrap:anywhere]" key={index}>F{index + 1} = {fn}</p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solucion: {solutionValues(item).length ? `(${solutionValues(item).map(formatNumber).join(', ')})` : 'N/D'} · Iteraciones: {item.iterations.length}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => loadCalculation(item)}>Cargar</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditingValue(item.label ?? ''); }} className="border-primary/20 hover:bg-primary/10">
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setHistory((current) => current.filter((entry) => entry.id !== item.id));
                      toast.success('Registro eliminado');
                    }} className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive">
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
