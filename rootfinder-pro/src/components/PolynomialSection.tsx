import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  BarChart3,
  Check,
  History,
  LineChart,
  Pencil,
  Sigma,
  Trash2,
  X,
} from 'lucide-react';
import {
  PolynomialGraphMarker,
  PolynomialMethods,
  PolynomialRootMethod,
  PolynomialRootResult,
} from '@/lib/polynomialMethods';
import {
  LOAD_POLYNOMIAL_HISTORY_EVENT,
  POLYNOMIAL_HISTORY_KEY,
  POLYNOMIAL_HISTORY_UPDATED_EVENT,
} from '@/lib/historyKeys';

type PolynomialHistoryItem = PolynomialRootResult & {
  id: string;
  timestamp: number;
  label?: string;
  coefficientsText: string;
};

function normalizePolynomialHistoryItem(raw: any): PolynomialHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string') return null;

  return {
    id: raw.id,
    timestamp: Number.isFinite(Number(raw.timestamp)) ? Number(raw.timestamp) : Date.now(),
    label: typeof raw.label === 'string' ? raw.label : '',
    coefficientsText: typeof raw.coefficientsText === 'string' ? raw.coefficientsText : '',
    method: raw.method === 'muller' || raw.method === 'bairstow' || raw.method === 'horner' ? raw.method : 'muller',
    converged: Boolean(raw.converged),
    message: typeof raw.message === 'string' ? raw.message : 'Registro recuperado',
    roots: Array.isArray(raw.roots) ? raw.roots.map((item: unknown) => String(item)) : [],
    realRoots: Array.isArray(raw.realRoots)
      ? raw.realRoots.map((item: unknown) => Number(item)).filter((item: number) => Number.isFinite(item))
      : [],
    hiddenComplexRoots: Array.isArray(raw.hiddenComplexRoots)
      ? raw.hiddenComplexRoots.map((item: unknown) => String(item))
      : [],
    iterations: Array.isArray(raw.iterations) ? raw.iterations : [],
    graphMarkers: Array.isArray(raw.graphMarkers) ? raw.graphMarkers : [],
    polynomialExpression: typeof raw.polynomialExpression === 'string' ? raw.polynomialExpression : '',
    params: raw.params && typeof raw.params === 'object' ? raw.params : {},
  };
}

const methodLabel: Record<PolynomialRootMethod, string> = {
  muller: 'Muller',
  bairstow: 'Bairstow',
  horner: 'Horner',
};

const methodDescription: Record<PolynomialRootMethod, string> = {
  muller: 'Usa interpolacion cuadratica local con x0, x1 y x2 para producir una nueva aproximacion x3.',
  bairstow: 'Ajusta el factor x^2 + r*x + s con coeficientes b y c hasta factorizar el polinomio.',
  horner: 'Aplica el esquema de Horner junto con Newton para evaluar P(x), P\'(x) y corregir la raiz.',
};

const methodFormula: Record<PolynomialRootMethod, string[]> = {
  muller: [
    'h0 = x1 - x0, h1 = x2 - x1',
    'delta0 = (f(x1)-f(x0))/h0, delta1 = (f(x2)-f(x1))/h1',
    'a = (delta1-delta0)/(h1+h0), b = a*h1 + delta1, c = f(x2)',
    'x3 = x2 - 2c / (b +/- sqrt(b^2 - 4ac))',
  ],
  bairstow: [
    'Factor buscado: x^2 + r*x + s',
    'b_n = a_n, b_(n-1) = a_(n-1) + r*b_n',
    'b_i = a_i + r*b_(i+1) + s*b_(i+2)',
    'c_i y los ajustes Delta r, Delta s corrigen el factor',
  ],
  horner: [
    'b_n = a_n y b_i = a_i + x*b_(i+1)',
    'El ultimo b entrega P(x)',
    'Una segunda pasada entrega P\'(x)',
    'Newton: x_(k+1) = x_k - P(x_k)/P\'(x_k)',
  ],
};

function computeGraphDomain(markers: PolynomialGraphMarker[], realRoots: number[]) {
  const realValues = [...realRoots, ...markers.map((marker) => marker.x)].filter(
    (value) => Number.isFinite(value),
  );

  if (realValues.length === 0) {
    return { xmin: -10, xmax: 10 };
  }

  const min = Math.min(...realValues);
  const max = Math.max(...realValues);
  const span = Math.max(max - min, 4);
  return {
    xmin: min - span * 0.35 - 1,
    xmax: max + span * 0.35 + 1,
  };
}

export function PolynomialSection() {
  const [coefficients, setCoefficients] = useState('1, 3, -1, -3');
  const [method, setMethod] = useState<PolynomialRootMethod>('muller');
  const [x0, setX0] = useState('-1.5');
  const [x1, setX1] = useState('-1.45');
  const [x2, setX2] = useState('-1.40');
  const [r0, setR0] = useState('-0.3333333333');
  const [s0, setS0] = useState('-1');
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('50');
  const [historyLabel, setHistoryLabel] = useState('');
  const [result, setResult] = useState<PolynomialRootResult | null>(null);
  const [history, setHistory] = useState<PolynomialHistoryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<HTMLCanvasElement | null>(null);

  const parsedCoefficients = useMemo(() => {
    try {
      return PolynomialMethods.parseCoefficients(coefficients);
    } catch {
      return null;
    }
  }, [coefficients]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POLYNOMIAL_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const normalized = Array.isArray(parsed)
          ? parsed.map((item) => normalizePolynomialHistoryItem(item)).filter(Boolean) as PolynomialHistoryItem[]
          : [];
        setHistory(normalized);
      }
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const handleExternalLoad = (event: Event) => {
      const detail = (event as CustomEvent<PolynomialHistoryItem>).detail;
      if (!detail) return;
      setCoefficients(detail.coefficientsText);
      setMethod(detail.method);
      setTol(detail.params.tol?.toString() ?? '0.0001');
      setMaxIter(detail.params.maxIter?.toString() ?? '50');
      setX0(detail.params.x0?.toString() ?? detail.params.seedX0?.toString() ?? '');
      setX1(detail.params.x1?.toString() ?? '');
      setX2(detail.params.x2?.toString() ?? '');
      setR0(detail.params.r0?.toString() ?? '');
      setS0(detail.params.s0?.toString() ?? '');
      setResult(detail);
    };

    window.addEventListener(LOAD_POLYNOMIAL_HISTORY_EVENT, handleExternalLoad as EventListener);
    return () => window.removeEventListener(LOAD_POLYNOMIAL_HISTORY_EVENT, handleExternalLoad as EventListener);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(POLYNOMIAL_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
      window.dispatchEvent(new Event(POLYNOMIAL_HISTORY_UPDATED_EVENT));
    } catch {
      // Ignore local storage failures.
    }
  }, [history]);

  const activeGraphData = useMemo(() => {
    if (!parsedCoefficients) return null;

    const markers = result?.graphMarkers ?? [];
    const realRoots = result?.realRoots ?? [];
    return {
      coeffs: parsedCoefficients,
      markers,
      realRoots,
      polynomialExpression: result?.polynomialExpression ?? PolynomialMethods.polynomialToExpression(parsedCoefficients),
      hiddenComplexRoots: result?.hiddenComplexRoots ?? [],
    };
  }, [parsedCoefficients, result]);

  useEffect(() => {
    const canvas = graphRef.current;
    if (!canvas || !activeGraphData) return;

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

      const { coeffs, markers, realRoots } = activeGraphData;
      const { xmin, xmax } = computeGraphDomain(markers, realRoots);
      const padding = 42;
      const step = (xmax - xmin) / 500;
      const samples: Array<{ x: number; y: number }> = [];

      for (let x = xmin; x <= xmax; x += step) {
        const y = PolynomialMethods.evaluatePolynomial(coeffs, x);
        if (Number.isFinite(y)) {
          samples.push({ x, y });
        }
      }

      if (samples.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('No se pudo dibujar el polinomio en este rango.', 28, 40);
        return;
      }

      const markerYValues = markers.map((marker) => marker.y).filter((value) => Number.isFinite(value));
      const values = [...samples.map((sample) => sample.y), ...markerYValues, 0];
      let ymin = Math.min(...values);
      let ymax = Math.max(...values);
      const spanY = Math.max(ymax - ymin, 1);
      ymin -= spanY * 0.18;
      ymax += spanY * 0.18;
      const finalSpanY = Math.max(ymax - ymin, 1);

      const toPxX = (value: number) => padding + ((value - xmin) / (xmax - xmin)) * (rect.width - padding * 2);
      const toPxY = (value: number) => rect.height - padding - ((value - ymin) / finalSpanY) * (rect.height - padding * 2);

      ctx.strokeStyle = '#1e292b';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      for (let i = 0; i < 5; i += 1) {
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

      const yAxisX = 0 >= xmin && 0 <= xmax ? toPxX(0) : padding;
      const xAxisY = 0 >= ymin && 0 <= ymax ? toPxY(0) : rect.height - padding;
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
      samples.forEach((sample, index) => {
        const px = toPxX(sample.x);
        const py = toPxY(sample.y);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      for (const marker of markers) {
        const px = toPxX(marker.x);
        const py = toPxY(marker.y);
        ctx.fillStyle =
          marker.tone === 'root' ? '#f59e0b' : marker.tone === 'seed' ? '#22d3ee' : '#ecfdf5';
        ctx.beginPath();
        ctx.arc(px, py, marker.tone === 'root' ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '12px sans-serif';
        ctx.fillText(marker.label, px + 8, py - 8);
      }

      ctx.fillStyle = '#10b981';
      ctx.font = '12px sans-serif';
      ctx.fillText('P(x)', padding, 20);
    };

    drawGraph();
    window.addEventListener('resize', drawGraph);
    return () => window.removeEventListener('resize', drawGraph);
  }, [activeGraphData]);

  const handleCalculate = () => {
    try {
      const parsedTol = parseFloat(tol);
      const parsedMaxIter = parseInt(maxIter, 10);
      if (Number.isNaN(parsedTol) || parsedTol <= 0) {
        throw new Error('La tolerancia debe ser un numero positivo.');
      }
      if (Number.isNaN(parsedMaxIter) || parsedMaxIter <= 0) {
        throw new Error('El numero maximo de iteraciones debe ser un entero positivo.');
      }

      const coeffs = PolynomialMethods.parseCoefficients(coefficients);
      let calculatedResult: PolynomialRootResult;

      switch (method) {
        case 'horner': {
          const initial = parseFloat(x0);
          if (Number.isNaN(initial)) {
            throw new Error('Ingresa un valor numerico valido para x0.');
          }
          calculatedResult = PolynomialMethods.hornerRoot(coeffs, initial, parsedTol, parsedMaxIter);
          break;
        }
        case 'muller': {
          const initialX0 = parseFloat(x0);
          const initialX1 = parseFloat(x1);
          const initialX2 = parseFloat(x2);
          if ([initialX0, initialX1, initialX2].some(Number.isNaN)) {
            throw new Error('Ingresa valores numericos validos para x0, x1 y x2.');
          }
          calculatedResult = PolynomialMethods.mullerRoot(coeffs, initialX0, initialX1, initialX2, parsedTol, parsedMaxIter);
          break;
        }
        case 'bairstow': {
          const initialR = parseFloat(r0);
          const initialS = parseFloat(s0);
          if (Number.isNaN(initialR) || Number.isNaN(initialS)) {
            throw new Error('Ingresa valores numericos validos para r0 y s0.');
          }
          calculatedResult = PolynomialMethods.bairstowFullRoots(coeffs, initialR, initialS, parsedTol, parsedMaxIter);
          break;
        }
        default:
          throw new Error('Metodo desconocido');
      }

      setResult(calculatedResult);
      setError(null);

      setHistory((current) => [
        {
          ...calculatedResult,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          label: historyLabel.trim(),
          coefficientsText: coefficients,
        },
        ...current,
      ].slice(0, 20));
      setHistoryLabel('');

      if (calculatedResult.converged) {
        toast.success(`${methodLabel[method]} calculado correctamente`);
      } else {
        toast.warning(calculatedResult.message);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error desconocido al calcular las raices');
      setResult(null);
      toast.error(err?.message ?? 'Error desconocido al calcular las raices');
    }
  };

  const handleLoadHistory = (item: PolynomialHistoryItem) => {
    setCoefficients(item.coefficientsText);
    setMethod(item.method);
    setTol(item.params.tol?.toString() ?? tol);
    setMaxIter(item.params.maxIter?.toString() ?? maxIter);
    setX0(item.params.x0?.toString() ?? x0);
    setX1(item.params.x1?.toString() ?? x1);
    setX2(item.params.x2?.toString() ?? x2);
    setR0(item.params.r0?.toString() ?? r0);
    setS0(item.params.s0?.toString() ?? s0);
    setResult(item);
    toast.success('Registro polinomico cargado');
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingValue('');
    }
    toast.success('Registro eliminado');
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(POLYNOMIAL_HISTORY_KEY);
    window.dispatchEvent(new Event(POLYNOMIAL_HISTORY_UPDATED_EVENT));
    toast.success('Historial polinomico limpiado');
  };

  const handleStartEdit = (item: PolynomialHistoryItem) => {
    setEditingId(item.id);
    setEditingValue(item.label ?? '');
  };

  const handleSaveEdit = (id: string) => {
    setHistory((current) =>
      current.map((item) => (item.id === id ? { ...item, label: editingValue.trim() } : item)),
    );
    setEditingId(null);
    setEditingValue('');
    toast.success('Etiqueta actualizada');
  };

  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-primary/10 bg-linear-to-br from-primary/10 via-card/70 to-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="max-w-4xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/60">Raices polinomicas</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Muller, Bairstow y Horner con grafica e historial</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Cada metodo usa su esquema clasico, muestra sus iteraciones, dibuja el polinomio y guarda el resultado con CRUD local para recargarlo despues.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Configuracion polinomica</CardTitle>
            <CardDescription>Define el polinomio, el metodo y sus datos iniciales.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-6">
            <div className="grid gap-2">
              <Label htmlFor="coefficients">Coeficientes</Label>
              <textarea
                id="coefficients"
                value={coefficients}
                onChange={(event) => setCoefficients(event.target.value)}
                className="h-28 w-full rounded-xl border border-primary/10 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Ej: 1, 3, -1, -3"
              />
              <p className="text-xs text-muted-foreground">
                Desde el termino de mayor grado hasta el independiente.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="method">Metodo</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PolynomialRootMethod)}>
                <SelectTrigger className="h-12 bg-background/50 border-primary/20 focus:ring-primary text-lg">
                  <SelectValue placeholder="Selecciona un metodo" value={methodLabel[method]} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muller">Muller</SelectItem>
                  <SelectItem value="bairstow">Bairstow</SelectItem>
                  <SelectItem value="horner">Horner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{methodDescription[method]}</p>
            </div>

            <div className="rounded-3xl border border-primary/10 bg-background/35 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/70">Esquema usado</p>
              <div className="mt-3 space-y-2">
                {methodFormula[method].map((line) => (
                  <p key={line} className="font-mono text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {method === 'horner' && (
              <div className="grid gap-2">
                <Label htmlFor="x0">Punto inicial x0</Label>
                <Input
                  id="x0"
                  value={x0}
                  onChange={(event) => setX0(event.target.value)}
                  placeholder="Ej: 0.8"
                  className="bg-background/70"
                />
              </div>
            )}

            {method === 'muller' && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="x0">x0</Label>
                  <Input id="x0" value={x0} onChange={(event) => setX0(event.target.value)} placeholder="-1.5" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="x1">x1</Label>
                  <Input id="x1" value={x1} onChange={(event) => setX1(event.target.value)} placeholder="-1.45" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="x2">x2</Label>
                  <Input id="x2" value={x2} onChange={(event) => setX2(event.target.value)} placeholder="-1.40" className="bg-background/70" />
                </div>
              </div>
            )}

            {method === 'bairstow' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="r0">r0</Label>
                  <Input id="r0" value={r0} onChange={(event) => setR0(event.target.value)} placeholder="-0.3333333333" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="s0">s0</Label>
                  <Input id="s0" value={s0} onChange={(event) => setS0(event.target.value)} placeholder="-1" className="bg-background/70" />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="tol">Tolerancia</Label>
                <Input id="tol" value={tol} onChange={(event) => setTol(event.target.value)} placeholder="0.0001" className="bg-background/70" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxIter">Maximo de iteraciones</Label>
                <Input id="maxIter" value={maxIter} onChange={(event) => setMaxIter(event.target.value)} placeholder="50" className="bg-background/70" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="poly-label">Etiqueta del registro</Label>
                <Input id="poly-label" value={historyLabel} onChange={(event) => setHistoryLabel(event.target.value)} placeholder="Ej: cubic prueba" className="bg-background/70" />
              </div>
            </div>

            <Button className="mt-2 w-full" onClick={handleCalculate}>
              Calcular raices
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {parsedCoefficients && (
              <p className="text-sm text-muted-foreground">
                Polinomio de grado {parsedCoefficients.length - 1}: {PolynomialMethods.polynomialToExpression(parsedCoefficients)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Resumen del metodo</CardTitle>
            <CardDescription>Estado del calculo y parametros usados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {!result && (
              <p className="text-sm text-muted-foreground">
                Ejecuta un calculo para ver raices, convergencia y rastros de iteracion.
              </p>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-primary">{result.message}</p>
                  <p className="text-sm text-muted-foreground">Metodo: {methodLabel[result.method]}</p>
                  <p className="text-sm text-muted-foreground">Convergencia: {result.converged ? 'Si' : 'No'}</p>
                </div>

                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-background/70 p-4">
                  <p className="text-sm font-semibold">Raices encontradas</p>
                  {result.roots.map((root, index) => (
                    <p key={`${root}-${index}`} className="text-sm text-foreground">
                      x{index + 1} = {root}
                    </p>
                  ))}
                  {result.hiddenComplexRoots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      La grafica solo proyecta las raices reales. Complejas ocultas: {result.hiddenComplexRoots.join(', ')}
                    </p>
                  )}
                </div>

                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-background/70 p-4">
                  <p className="text-sm font-semibold">Parametros utilizados</p>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Coeficientes: [{parsedCoefficients?.join(', ')}]</p>
                    <p>Tolerancia: {tol}</p>
                    <p>Iteraciones maximas: {maxIter}</p>
                    {(method === 'horner' || method === 'muller') && <p>Valores iniciales: {method === 'horner' ? x0 : `${x0}, ${x1}, ${x2}`}</p>}
                    {method === 'bairstow' && <p>Valores iniciales: r0 = {r0}, s0 = {s0}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
        <CardHeader className="space-y-2 p-6">
          <div className="flex items-center gap-3">
            <LineChart className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-xl font-black">Grafica del polinomio</CardTitle>
              <CardDescription>Curva P(x), semillas, iteraciones y raices reales del metodo activo.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black">
            <canvas ref={graphRef} width={1200} height={460} className="h-auto w-full min-h-[20rem] lg:min-h-[28rem]" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="bg-primary text-primary-foreground">P(x)</Badge>
            <Badge variant="outline">Semillas</Badge>
            <Badge variant="outline">Iteraciones</Badge>
            <Badge className="bg-amber-500 text-black">Raices reales</Badge>
          </div>
          {activeGraphData?.polynomialExpression && (
            <p className="font-mono text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
              {activeGraphData.polynomialExpression}
            </p>
          )}
        </CardContent>
      </Card>

      {result && result.iterations.length > 0 && (
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <div className="flex items-center gap-3">
              <Sigma className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-black">Iteraciones detalladas</CardTitle>
                <CardDescription>Seguimiento de cada paso con las variables del metodo seleccionado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[520px] rounded-xl border border-primary/10 bg-background/30">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 border-b border-primary/10">
                  <TableRow>
                    <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">Iteracion</TableHead>
                    <TableHead className="uppercase text-[10px] font-bold tracking-widest text-primary/70">Descripcion</TableHead>
                    {Object.keys(result.iterations[0].values).map((column) => (
                      <TableHead key={column} className="uppercase text-[10px] font-bold tracking-widest text-primary/70">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.iterations.map((iteration) => (
                    <TableRow key={iteration.iteration} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-mono text-xs py-3">{iteration.iteration}</TableCell>
                      <TableCell className="text-xs py-3 min-w-[220px]">{iteration.description}</TableCell>
                      {Object.keys(result.iterations[0].values).map((column) => (
                        <TableCell key={`${iteration.iteration}-${column}`} className="font-mono text-xs py-3 break-words [overflow-wrap:anywhere]">
                          {iteration.values[column]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
        <CardHeader className="space-y-2 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-black">Historial polinomico</CardTitle>
                <CardDescription>CRUD local para Muller, Bairstow y Horner.</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleClearHistory}>
              Limpiar historial
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/15 bg-background/30 p-4 text-sm text-muted-foreground">
              Todavia no hay calculos polinomicos almacenados.
            </div>
          ) : (
            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-2xl border border-primary/10 bg-background/35 p-4 transition-all hover:border-primary/30 hover:bg-primary/5"
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
                            <Button size="sm" onClick={() => handleSaveEdit(item.id)}>
                              <Check className="mr-2 h-4 w-4" />
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingValue(''); }}>
                              <X className="mr-2 h-4 w-4" />
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="mt-1 text-sm font-semibold">
                              {item.label?.trim() || `${methodLabel[item.method]} - ${item.coefficientsText}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Metodo: {methodLabel[item.method]}</p>
                          </>
                        )}
                      </div>
                      <Badge variant={item.converged ? 'default' : 'secondary'} className={item.converged ? 'bg-primary text-primary-foreground' : ''}>
                        {item.converged ? 'Convergente' : 'Sin convergencia'}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">Coeficientes: {item.coefficientsText}</p>
                    <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                      Raices: {Array.isArray(item.roots) && item.roots.length > 0 ? item.roots.join(', ') : 'Sin datos'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleLoadHistory(item)}>Cargar</Button>
                      <Button size="sm" variant="outline" onClick={() => handleStartEdit(item)}>
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
