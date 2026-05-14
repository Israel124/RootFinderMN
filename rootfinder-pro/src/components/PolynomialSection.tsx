import { useEffect, useMemo, useState } from 'react';
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
  RefreshCw,
  Sigma,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BairstowFirstIterationDetail,
  BairstowInitialStrategy,
  HornerSyntheticDivision,
  MullerFirstIterationDetail,
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
import { GeoGebraGraph } from '@/components/GeoGebraGraph';

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
    hornerDivisions: Array.isArray(raw.hornerDivisions) ? raw.hornerDivisions : [],
    mullerFirstIteration: raw.mullerFirstIteration && typeof raw.mullerFirstIteration === 'object' ? raw.mullerFirstIteration : undefined,
    bairstowFirstIteration: raw.bairstowFirstIteration && typeof raw.bairstowFirstIteration === 'object' ? raw.bairstowFirstIteration : undefined,
  };
}

const methodLabel: Record<PolynomialRootMethod, string> = {
  muller: 'Muller',
  bairstow: 'Bairstow',
  horner: 'Horner',
};

const methodDescription: Record<PolynomialRootMethod, string> = {
  muller: 'Usa interpolación cuadrática local con x0, x1 y x2 para producir una nueva aproximación x3.',
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

const bairstowStrategyLabel: Record<Exclude<BairstowInitialStrategy, 'auto'>, string> = {
  small: 'Variables pequenas',
  large: 'Variables grandes',
};

const bairstowStrategyFormula: Record<Exclude<BairstowInitialStrategy, 'auto'>, string> = {
  small: 'r0 = a_n / a_2, s0 = a_0 / a_2',
  large: 'r0 = a_(n-1) / a_n, s0 = a_(n-2) / a_n',
};

function formatHornerNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (!Number.isFinite(value)) return 'N/D';
  if (Math.abs(value) < 1e-10) return '0';
  const rounded = Number(value.toFixed(8));
  return rounded.toString();
}

function padHornerCell(value: string, width: number = 12): string {
  return value.padStart(width, ' ');
}

function HornerDivisionView({ division, index }: { division: HornerSyntheticDivision; index: number }) {
  const columns = division.coefficients.map((coefficient, coefficientIndex) => ({
    key: `${division.evaluationPoint}-${coefficientIndex}`,
    power: division.powers[coefficientIndex],
    coefficient,
    product: division.products[coefficientIndex],
    result: division.results[coefficientIndex],
  }));
  const coefficientRow = columns.map((column) => padHornerCell(formatHornerNumber(column.coefficient))).join('   ');
  const productRow = columns
    .map((column, columnIndex) => padHornerCell(columnIndex === 0 ? '' : formatHornerNumber(column.product)))
    .join('   ');
  const resultRow = columns.map((column) => padHornerCell(formatHornerNumber(column.result))).join('   ');
  const lineWidth = Math.max(coefficientRow.length, productRow.length, resultRow.length);

  return (
    <div className="max-w-full overflow-hidden rounded-[1.5rem] border border-primary/10 bg-background/45 p-5 lg:p-7">
      <div className="space-y-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">
          Division sintetica {index + 1}
        </p>
        <p className="font-mono text-lg font-semibold text-foreground">
          Evaluando P({formatHornerNumber(division.evaluationPoint)}) donde:
        </p>
        <p className="font-mono text-base text-foreground break-words [overflow-wrap:anywhere]">
          P(x) = {division.polynomialExpression}
        </p>
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-primary/10 bg-[#191c24] px-4 py-5 text-foreground">
        <p className="font-mono text-lg font-semibold">Division sintetica (x = {formatHornerNumber(division.evaluationPoint)}):</p>
        <div className="mt-4 max-w-full overflow-x-auto">
          <pre className="min-w-[720px] whitespace-pre font-mono text-[1.05rem] leading-10 text-foreground">
{`${coefficientRow}
${productRow}
${' '.repeat(2)}${'-'.repeat(lineWidth)}
${resultRow}`}
          </pre>
        </div>
      </div>

      <div className="mt-6 max-w-full overflow-x-auto rounded-[1.25rem] border border-primary/10 bg-background/55">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-white/95">
            <TableRow>
              <TableHead className="h-14 min-w-[220px] uppercase text-[10px] font-bold tracking-[0.2em] text-primary/70">Paso</TableHead>
              {columns.map((column) => (
                <TableHead key={`step-head-${column.key}`} className="h-14 min-w-[96px] text-center uppercase text-[10px] font-bold tracking-[0.2em] text-primary/70">
                  x^{column.power}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="hover:bg-primary/5">
              <TableCell className="py-6 text-xs font-bold uppercase tracking-[0.16em] text-primary/80">Coeficientes</TableCell>
              {columns.map((column) => (
                <TableCell key={`coef-cell-${column.key}`} className="py-6 text-center font-mono text-lg">
                  {formatHornerNumber(column.coefficient)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-primary/5">
              <TableCell className="py-6 text-xs font-bold uppercase tracking-[0.16em] text-primary/80">
                Multiplicar por {formatHornerNumber(division.evaluationPoint)}
              </TableCell>
              {columns.map((column, columnIndex) => (
                <TableCell key={`prod-cell-${column.key}`} className="py-6 text-center font-mono text-lg">
                  {columnIndex === 0 ? '' : formatHornerNumber(column.product)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="hover:bg-primary/5">
              <TableCell className="py-6 text-xs font-bold uppercase tracking-[0.16em] text-primary">Resultados (b)</TableCell>
              {columns.map((column) => (
                <TableCell key={`result-cell-${column.key}`} className="py-6 text-center font-mono text-lg font-semibold">
                  {formatHornerNumber(column.result)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="mt-5 space-y-1 text-base text-foreground">
        <p><span className="font-bold">Cociente:</span> {division.quotient.map(formatHornerNumber).join(', ')}</p>
        <p><span className="font-bold">Residuo:</span> {formatHornerNumber(division.remainder)}</p>
        <p><span className="font-bold">P({formatHornerNumber(division.evaluationPoint)}) =</span> {formatHornerNumber(division.remainder)}</p>
      </div>
    </div>
  );
}

function MullerFirstIterationView({ detail }: { detail: MullerFirstIterationDetail }) {
  return (
    <div className="rounded-[1.5rem] border border-amber-400/20 bg-linear-to-br from-amber-500/12 to-background/65 p-6 lg:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-amber-500 text-black">Primera iteracion detallada</Badge>
        <p className="text-sm text-muted-foreground">Solo este paso se despliega completo; el resto se resume en la tabla.</p>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4 font-mono text-sm text-foreground">
          Valores iniciales: [x₀, x₁, x₂] = [{detail.x0}, {detail.x1}, {detail.x2}]
        </div>
        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4 font-mono text-sm leading-7 text-foreground">
          <p>h₀ = x₁ - x₀ = {detail.x1} - {detail.x0} = <span className="font-semibold text-primary">{detail.h0}</span></p>
          <p>h₁ = x₂ - x₁ = {detail.x2} - {detail.x1} = <span className="font-semibold text-primary">{detail.h1}</span></p>
          <p>δ₀ = (f(x₁) - f(x₀)) / h₀ = ({detail.f1} - {detail.f0}) / {detail.h0} = <span className="font-semibold text-primary">{detail.delta0}</span></p>
          <p>δ₁ = (f(x₂) - f(x₁)) / h₁ = ({detail.f2} - {detail.f1}) / {detail.h1} = <span className="font-semibold text-primary">{detail.delta1}</span></p>
          <p>a = (δ₁ - δ₀) / (h₁ + h₀) = <span className="font-semibold text-primary">{detail.a}</span></p>
          <p>b = a·h₁ + δ₁ = <span className="font-semibold text-primary">{detail.b}</span></p>
          <p>c = f(x₂) = <span className="font-semibold text-primary">{detail.c}</span></p>
          <p>Discriminante = b² - 4ac = <span className="font-semibold text-primary">{detail.discriminant}</span></p>
          <p>√(discriminante) = <span className="font-semibold text-primary">{detail.sqrtDiscriminant}</span></p>
          <p>Denominador elegido: b {detail.denominatorBranch} √(discriminante) = <span className="font-semibold text-primary">{detail.denominator}</span></p>
          <p>x₃ = x₂ - 2c / denominador = <span className="font-semibold text-primary">{detail.x3}</span></p>
          <p>Error = |x₃ - x₂| = <span className="font-semibold text-primary">{detail.error}</span></p>
        </div>
      </div>
    </div>
  );
}

function MullerIterationsTable({ iterations }: { iterations: PolynomialRootResult['iterations'] }) {
  if (iterations.length === 0) return null;

  const orderedColumns = ['x0', 'x1', 'x2', 'h0', 'h1', 'delta0', 'delta1', 'a', 'b', 'c', 'D', 'x3', 'error'];
  const visibleColumns = orderedColumns.filter((column) => column in iterations[0].values);
  const columnLabels: Record<string, string> = {
    x0: 'x₀',
    x1: 'x₁',
    x2: 'x₂',
    h0: 'h₀',
    h1: 'h₁',
    delta0: 'δ₀',
    delta1: 'δ₁',
    a: 'a',
    b: 'b',
    c: 'c',
    D: '√Δ',
    x3: 'x₃',
    error: 'Error',
  };

  return (
    <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
      <CardHeader className="space-y-2 p-6">
        <div className="flex items-center gap-3">
          <Sigma className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-black">Tabla de iteraciones de Muller</CardTitle>
            <CardDescription>Resumen completo de cada iteracion con el diseno de tablas de la app.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-5">
        <div className="w-full rounded-xl border border-primary/10 bg-background/30">
          <div className="max-h-[min(68vh,40rem)] overflow-auto">
          <Table className="min-w-[940px] bg-white shadow-sm ring-1 ring-primary/10">
            <TableHeader className="sticky top-0 z-10 bg-white/95 border-b border-primary/20 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-[52px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Iter.</TableHead>
                <TableHead className="w-[136px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Descripcion</TableHead>
                {visibleColumns.map((column) => (
                  <TableHead key={column} className="min-w-[64px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">
                    {columnLabels[column] ?? column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {iterations.map((iteration) => (
                <TableRow key={iteration.iteration} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="px-1.5 py-2 font-mono text-[10px]">{iteration.iteration}</TableCell>
                  <TableCell className="px-1.5 py-2 text-[10px] leading-5 break-words [overflow-wrap:anywhere]">{iteration.description}</TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={`${iteration.iteration}-${column}`} className="px-1.5 py-2 font-mono text-[10px] whitespace-nowrap">
                      {iteration.values[column]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BairstowFirstIterationView({ detail }: { detail: BairstowFirstIterationDetail }) {
  const degree = detail.degree;
  const topIndex = degree;
  const nextIndex = Math.max(degree - 1, 0);

  return (
    <div className="rounded-[1.5rem] border border-amber-400/20 bg-linear-to-br from-amber-500/12 to-background/65 p-6 lg:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className="bg-amber-500 text-black">Primera iteracion detallada</Badge>
        <p className="text-sm text-muted-foreground">Replica el paso a paso del ejemplo, pero integrado al tema visual de la app.</p>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4 font-mono text-sm text-foreground">
          Estrategia: {detail.strategyLabel} | {detail.strategyFormula}
        </div>
        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4 font-mono text-sm text-foreground">
          Valores iniciales: r0 = <span className="font-semibold text-primary">{detail.r0}</span>, s0 = <span className="font-semibold text-primary">{detail.s0}</span>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-background/70 p-4 font-mono text-sm leading-7 text-foreground">
          <p>Polinomio de grado n = {detail.degree} con coeficientes [{detail.coefficients.join(', ')}]</p>
          <p>b{topIndex} = a{topIndex} = <span className="font-semibold text-primary">{detail.b[topIndex]}</span></p>
          <p>b{nextIndex} = a{nextIndex} + r·b{topIndex} = <span className="font-semibold text-primary">{detail.b[nextIndex]}</span></p>
          <p>Coeficientes b = [{detail.b.slice().reverse().join(', ')}]</p>
          <p>Coeficientes c = [{detail.c.slice().reverse().join(', ')}]</p>
          <p>c2·Δr + c3·Δs = -b1 → {detail.c2}·Δr + {detail.c3}·Δs = -({detail.b1})</p>
          <p>c1·Δr + c2·Δs = -b0 → {detail.c1}·Δr + {detail.c2}·Δs = -({detail.b0})</p>
          <p>Determinante = c2^2 - c1·c3 = <span className="font-semibold text-primary">{detail.denominator}</span></p>
          <p>Δr = <span className="font-semibold text-primary">{detail.deltaR}</span></p>
          <p>Δs = <span className="font-semibold text-primary">{detail.deltaS}</span></p>
          <p>r1 = r0 + Δr = <span className="font-semibold text-primary">{detail.nextR}</span></p>
          <p>s1 = s0 + Δs = <span className="font-semibold text-primary">{detail.nextS}</span></p>
          <p>Error = max(|Δr|, |Δs|) = <span className="font-semibold text-primary">{detail.error}</span></p>
        </div>
      </div>
    </div>
  );
}

function BairstowIterationsTable({ iterations }: { iterations: PolynomialRootResult['iterations'] }) {
  if (iterations.length === 0) return null;

  const orderedColumns = ['r', 's', 'residuo0', 'residuo1', 'c1', 'c2', 'c3', 'Delta r', 'Delta s', 'denominador', 'error'];
  const visibleColumns = orderedColumns.filter((column) => column in iterations[0].values);
  const columnLabels: Record<string, string> = {
    r: 'r',
    s: 's',
    residuo0: 'b0',
    residuo1: 'b1',
    c1: 'c1',
    c2: 'c2',
    c3: 'c3',
    'Delta r': 'Δr',
    'Delta s': 'Δs',
    denominador: 'D',
    error: 'Error',
  };

  return (
    <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
      <CardHeader className="space-y-2 p-6">
        <div className="flex items-center gap-3">
          <Sigma className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-xl font-black">Tabla de iteraciones de Bairstow</CardTitle>
            <CardDescription>Seguimiento de r, s, residuos y correcciones en el formato del ejemplo.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-5">
        <div className="w-full rounded-xl border border-primary/10 bg-background/30">
          <div className="max-h-[min(68vh,40rem)] overflow-auto">
            <Table className="min-w-[940px] bg-white shadow-sm ring-1 ring-primary/10">
              <TableHeader className="sticky top-0 z-10 bg-white/95 border-b border-primary/20 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-[52px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Iter.</TableHead>
                  <TableHead className="w-[136px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Descripcion</TableHead>
                  {visibleColumns.map((column) => (
                    <TableHead key={column} className="min-w-[64px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">
                      {columnLabels[column] ?? column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {iterations.map((iteration) => (
                  <TableRow key={iteration.iteration} className="hover:bg-primary/5 transition-colors">
                    <TableCell className="px-1.5 py-2 font-mono text-[10px]">{iteration.iteration}</TableCell>
                    <TableCell className="px-1.5 py-2 text-[10px] leading-5 break-words [overflow-wrap:anywhere]">{iteration.description}</TableCell>
                    {visibleColumns.map((column) => (
                      <TableCell key={`${iteration.iteration}-${column}`} className="px-1.5 py-2 font-mono text-[10px] whitespace-nowrap">
                        {iteration.values[column]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [bairstowStrategy, setBairstowStrategy] = useState<Exclude<BairstowInitialStrategy, 'auto'>>('small');
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
  const [graphZoom, setGraphZoom] = useState(1);
  const [lastCalculatedCoefficients, setLastCalculatedCoefficients] = useState<number[] | null>(null);
  const isHornerView = method === 'horner' || result?.method === 'horner';
  const isMullerView = method === 'muller' || result?.method === 'muller';

  const parsedCoefficients = useMemo(() => {
    try {
      return PolynomialMethods.parseCoefficients(coefficients);
    } catch {
      return null;
    }
  }, [coefficients]);

  const autoBairstowInitial = useMemo(() => {
    if (!parsedCoefficients) return null;
    return PolynomialMethods.estimateBairstowInitialValues(parsedCoefficients, bairstowStrategy);
  }, [bairstowStrategy, parsedCoefficients]);

  const bairstowDegree = parsedCoefficients ? Math.max(parsedCoefficients.length - 1, 2) : 3;

  const syncBairstowDegree = (nextDegree: number) => {
    const safeDegree = Math.min(Math.max(Math.round(nextDegree), 2), 10);
    const current = parsedCoefficients ?? [1, 3, -1, -3];
    const nextLength = safeDegree + 1;
    const next = Array.from({ length: nextLength }, (_, index) => {
      if (current.length === nextLength && current[index] !== undefined) {
        return current[index];
      }
      if (safeDegree === 3) {
        return [1, 3, -1, -3][index] ?? 0;
      }
      if (index === 0) {
        return 1;
      }
      return current[index + Math.max(current.length - nextLength, 0)] ?? 0;
    });
    setCoefficients(next.join(', '));
  };

  const handleBairstowCoefficientChange = (index: number, value: string) => {
    const current = parsedCoefficients ?? new Array(bairstowDegree + 1).fill(0);
    const next = current.slice();
    const numeric = Number(value);
    next[index] = Number.isFinite(numeric) ? numeric : 0;
    setCoefficients(next.join(', '));
  };

  useEffect(() => {
    if (method !== 'bairstow' || !autoBairstowInitial) return;
    setR0(autoBairstowInitial.r0.toString());
    setS0(autoBairstowInitial.s0.toString());
  }, [autoBairstowInitial, method]);

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
      setBairstowStrategy(detail.params.strategy === 'large' ? 'large' : 'small');
      setResult(detail);
      try {
        setLastCalculatedCoefficients(PolynomialMethods.parseCoefficients(detail.coefficientsText));
      } catch {
        setLastCalculatedCoefficients(null);
      }
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
    if (!result || !lastCalculatedCoefficients) return null;

    const markers = result.graphMarkers ?? [];
    const realRoots = result.realRoots ?? [];
    return {
      coeffs: lastCalculatedCoefficients,
      markers,
      realRoots,
      polynomialExpression: result.polynomialExpression,
      hiddenComplexRoots: result.hiddenComplexRoots ?? [],
    };
  }, [lastCalculatedCoefficients, result]);

  const polynomialGraphRange = useMemo(() => {
    if (!activeGraphData) return null;
    const { coeffs, markers, realRoots } = activeGraphData;
    const { xmin, xmax } = computeGraphDomain(markers, realRoots);
    const step = (xmax - xmin) / 400;
    const values: number[] = [0, ...markers.map((marker) => marker.y).filter(Number.isFinite)];

    for (let x = xmin; x <= xmax; x += step) {
      const y = PolynomialMethods.evaluatePolynomial(coeffs, x);
      if (Number.isFinite(y)) values.push(y);
    }

    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const spanY = Math.max(maxY - minY, 1);

    return {
      xmin,
      xmax,
      ymin: minY - spanY * 0.18,
      ymax: maxY + spanY * 0.18,
    };
  }, [activeGraphData]);

  const zoomedPolynomialGraphRange = useMemo(() => {
    if (!polynomialGraphRange) return null;

    const centerX = (polynomialGraphRange.xmin + polynomialGraphRange.xmax) / 2;
    const centerY = (polynomialGraphRange.ymin + polynomialGraphRange.ymax) / 2;
    const spanX = Math.max((polynomialGraphRange.xmax - polynomialGraphRange.xmin) / graphZoom, 0.05);
    const spanY = Math.max((polynomialGraphRange.ymax - polynomialGraphRange.ymin) / graphZoom, 0.05);

    return {
      xmin: centerX - spanX / 2,
      xmax: centerX + spanX / 2,
      ymin: centerY - spanY / 2,
      ymax: centerY + spanY / 2,
    };
  }, [polynomialGraphRange, graphZoom]);

  const zoomPolynomialGraph = (direction: 'in' | 'out') => {
    setGraphZoom((current) => {
      const next = direction === 'in' ? current * 1.25 : current / 1.25;
      return Math.min(Math.max(next, 0.2), 80);
    });
  };

  const handleCalculate = () => {
    try {
      const parsedTol = parseFloat(tol);
      const parsedMaxIter = parseInt(maxIter, 10);
      if (Number.isNaN(parsedTol) || parsedTol <= 0) {
        throw new Error('La tolerancia debe ser un numero positivo.');
      }
      if (Number.isNaN(parsedMaxIter) || parsedMaxIter <= 0) {
        throw new Error('El número máximo de iteraciones debe ser un entero positivo.');
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
          if (!autoBairstowInitial) {
            throw new Error('No se pudieron calcular r0 y s0 automaticamente.');
          }
          const initialR = autoBairstowInitial.r0;
          const initialS = autoBairstowInitial.s0;
          calculatedResult = PolynomialMethods.bairstowFullRoots(coeffs, initialR, initialS, parsedTol, parsedMaxIter, bairstowStrategy);
          setR0(initialR.toString());
          setS0(initialS.toString());
          break;
        }
        default:
          throw new Error('Método desconocido');
      }

      setResult(calculatedResult);
      setLastCalculatedCoefficients(coeffs);
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
      setError(err?.message ?? 'Error desconocido al calcular las raíces');
      setResult(null);
      toast.error(err?.message ?? 'Error desconocido al calcular las raíces');
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
    setBairstowStrategy(item.params.strategy === 'large' ? 'large' : 'small');
    setResult(item);
    try {
      setLastCalculatedCoefficients(PolynomialMethods.parseCoefficients(item.coefficientsText));
    } catch {
      setLastCalculatedCoefficients(null);
    }
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
    <section className="grid min-w-0 max-w-full gap-6 overflow-x-hidden">
      <div className="rounded-[2rem] border border-primary/10 bg-linear-to-br from-primary/10 via-card/70 to-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/60">Raíces polinómicas</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Müller, Bairstow y Horner con gráfica e historial</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              Cada método usa su esquema clásico, muestra sus iteraciones, dibuja el polinomio y guarda el resultado con CRUD local para recargarlo después.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-primary/15 bg-background/35 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Ruta actual</p>
            <p className="mt-3 text-lg font-black text-primary">{methodLabel[method]}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {result ? `${result.roots.length} raíz${result.roots.length === 1 ? '' : 'ces'} registradas` : 'Configura el polinomio y ejecuta el método.'}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 1</p>
            <p className="mt-3 text-lg font-bold">Define el polinomio</p>
            <p className="mt-2 text-sm text-muted-foreground">Carga coeficientes y elige el método según el tipo de raíz o estrategia que buscas.</p>
          </div>
          <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 2</p>
            <p className="mt-3 text-lg font-bold">Observa la convergencia</p>
            <p className="mt-2 text-sm text-muted-foreground">Revisa las iteraciones para entender cómo corrige cada método sus aproximaciones.</p>
          </div>
          <div className="rounded-[1.5rem] border border-primary/10 bg-background/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Paso 3</p>
            <p className="mt-3 text-lg font-bold">Valida en la gráfica</p>
            <p className="mt-2 text-sm text-muted-foreground">Confirma si las raíces reales y semillas están ubicadas donde la curva realmente cambia.</p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-4">
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10 overflow-hidden">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Configuracion polinomica</CardTitle>
            <CardDescription>Define el polinomio, el método y sus datos iniciales.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 p-6">
            {method !== 'bairstow' && (
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
            )}

            <div className="grid gap-2">
              <Label htmlFor="method">Método</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PolynomialRootMethod)}>
                <SelectTrigger className="h-12 bg-background/50 border-primary/20 focus:ring-primary text-lg">
                  <SelectValue placeholder="Selecciona un método" value={methodLabel[method]} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muller">Muller</SelectItem>
                  <SelectItem value="bairstow">Bairstow</SelectItem>
                  <SelectItem value="horner">Horner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{methodDescription[method]}</p>
            </div>

            {method === 'bairstow' && (
              <div className="grid gap-4 rounded-[1.6rem] border border-primary/10 bg-background/35 p-5">
                <div className="grid gap-4 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bairstow-degree">Grado del polinomio (n)</Label>
                    <Input
                      id="bairstow-degree"
                      type="number"
                      min={2}
                      max={10}
                      step={1}
                      value={bairstowDegree}
                      onChange={(event) => syncBairstowDegree(Number(event.target.value))}
                      className="bg-background/70"
                    />
                  </div>
                  <div className="grid gap-2 xl:col-span-2">
                    <Label htmlFor="bairstow-strategy">Metodo de estimacion inicial</Label>
                    <Select value={bairstowStrategy} onValueChange={(value) => setBairstowStrategy(value as 'small' | 'large')}>
                      <SelectTrigger id="bairstow-strategy" className="h-12 bg-background/50 border-primary/20 focus:ring-primary text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Variables pequenas</SelectItem>
                        <SelectItem value="large">Variables grandes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="coefficients">Coeficientes en texto</Label>
                    <Input
                      id="coefficients"
                      value={coefficients}
                      onChange={(event) => setCoefficients(event.target.value)}
                      placeholder="1, 3, -1, -3"
                      className="bg-background/70 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-primary/10 bg-card/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70">Coeficientes del polinomio</p>
                  <p className="mt-2 text-xs text-muted-foreground">P(x) = a_n x^n + a_(n-1) x^(n-1) + ... + a_0</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    {Array.from({ length: bairstowDegree + 1 }, (_, index) => {
                      const exponent = bairstowDegree - index;
                      const value = parsedCoefficients?.[index] ?? 0;
                      return (
                        <div key={`bairstow-coef-${exponent}`} className="rounded-2xl border border-primary/10 bg-background/70 p-3">
                          <Label htmlFor={`bairstow-coef-${index}`} className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/70">
                            a{exponent}
                          </Label>
                          <Input
                            id={`bairstow-coef-${index}`}
                            type="number"
                            step="any"
                            value={value}
                            onChange={(event) => handleBairstowCoefficientChange(index, event.target.value)}
                            className="mt-2 bg-background/80 font-mono"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[1.3rem] border border-primary/10 bg-primary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary/70">Valores iniciales calculados</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {bairstowStrategyLabel[bairstowStrategy]}: {bairstowStrategyFormula[bairstowStrategy]}
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">r0</p>
                      <p className="mt-2 font-mono text-lg">{autoBairstowInitial?.r0.toFixed(8) ?? 'N/D'}</p>
                    </div>
                    <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">s0</p>
                      <p className="mt-2 font-mono text-lg">{autoBairstowInitial?.s0.toFixed(8) ?? 'N/D'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCoefficients('1, 3, -1, -3');
                      setBairstowStrategy('small');
                      setTol('0.00001');
                      setMaxIter('15');
                      setHistoryLabel('');
                    }}
                  >
                    Cargar ejemplo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Limpiar resultados
                  </Button>
                </div>
              </div>
            )}

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

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Grado</p>
                <p className="mt-3 text-2xl font-black">{parsedCoefficients ? parsedCoefficients.length - 1 : 'N/D'}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Tolerancia</p>
                <p className="mt-3 font-mono text-lg">{tol || 'N/D'}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/30 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Máx. iteraciones</p>
                <p className="mt-3 font-mono text-lg">{maxIter || 'N/D'}</p>
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
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
                  <Label htmlFor="r0">r0 automatico</Label>
                  <Input id="r0" value={autoBairstowInitial?.r0.toString() ?? r0} readOnly placeholder="-0.3333333333" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="s0">s0 automatico</Label>
                  <Input id="s0" value={autoBairstowInitial?.s0.toString() ?? s0} readOnly placeholder="-1" className="bg-background/70" />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
              Calcular raíces
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {parsedCoefficients && (
              <p className="text-sm text-muted-foreground">
                Polinomio de grado {parsedCoefficients.length - 1}: {PolynomialMethods.polynomialToExpression(parsedCoefficients)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10 overflow-hidden">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Resumen del método</CardTitle>
            <CardDescription>Estado del cálculo y parámetros usados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {!result && (
              <div className="rounded-3xl border border-dashed border-primary/15 bg-background/30 p-5">
                <p className="text-sm text-muted-foreground">
                  Ejecuta un cálculo para ver raíces, convergencia y rastros de iteración.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-primary">{result.message}</p>
                  <p className="text-sm text-muted-foreground">Método: {methodLabel[result.method]}</p>
                  <p className="text-sm text-muted-foreground">Convergencia: {result.converged ? 'Si' : 'No'}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Raíces listadas</p>
                    <p className="mt-3 text-2xl font-black">{result.roots.length}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Iteraciones</p>
                    <p className="mt-3 text-2xl font-black">{result.iterations.length}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Lectura rápida</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {result.converged
                        ? 'El método cerró convergencia; la gráfica sirve para validar la lectura real.'
                        : 'No cerró convergencia; revisa semillas o cambia de método antes de insistir.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-background/70 p-4">
                  <p className="text-sm font-semibold">Raíces encontradas</p>
                  {result.roots.map((root, index) => (
                    <p key={`${root}-${index}`} className="text-sm text-foreground">
                      x{index + 1} = {root}
                    </p>
                  ))}
                  {result.hiddenComplexRoots.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      La gráfica solo proyecta las raíces reales. Complejas ocultas: {result.hiddenComplexRoots.join(', ')}
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
                    {method === 'bairstow' && (
                      <p>
                        Valores iniciales: r0 = {r0}, s0 = {s0} ({bairstowStrategyLabel[(result.params.strategy === 'large' ? 'large' : 'small')]})
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result?.method === 'horner' && result.hornerDivisions && result.hornerDivisions.length > 0 && (
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <div className="flex items-center gap-3">
              <Sigma className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-black">Division sintetica de Horner</CardTitle>
                <CardDescription>Coeficientes, productos intermedios y resultados b del proceso de deflacion.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            {result.hornerDivisions.map((division, index) => (
              <div key={`${division.evaluationPoint}-${division.polynomialExpression}-${index}`}>
                <HornerDivisionView division={division} index={index} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result?.method === 'muller' && (
        <div className="grid gap-4">
          {result.mullerFirstIteration ? (
            <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
              <CardHeader className="space-y-2 p-6">
                <div className="flex items-center gap-3">
                  <Sigma className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-xl font-black">Metodo de Muller paso a paso</CardTitle>
                    <CardDescription>La primera iteracion se explica completa y el resto queda resumido debajo.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <MullerFirstIterationView detail={result.mullerFirstIteration} />
              </CardContent>
            </Card>
          ) : null}
          <MullerIterationsTable iterations={result.iterations} />
        </div>
      )}

      {result?.method === 'bairstow' && (
        <div className="grid gap-4">
          {result.bairstowFirstIteration ? (
            <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
              <CardHeader className="space-y-2 p-6">
                <div className="flex items-center gap-3">
                  <Sigma className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-xl font-black">Metodo de Bairstow paso a paso</CardTitle>
                    <CardDescription>La primera iteracion se despliega completa y el resto queda resumido en la tabla.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <BairstowFirstIterationView detail={result.bairstowFirstIteration} />
              </CardContent>
            </Card>
          ) : null}
          <BairstowIterationsTable iterations={result.iterations} />
        </div>
      )}

      {!isHornerView && !isMullerView && (
      <Card className="min-w-0 overflow-hidden rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
        <CardHeader className="space-y-2 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <LineChart className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-black">Gráfica del polinomio</CardTitle>
                <CardDescription>Curva P(x), semillas, iteraciones y raíces reales del método activo.</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => zoomPolynomialGraph('in')} title="Acercar gráfica" aria-label="Acercar gráfica">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => zoomPolynomialGraph('out')} title="Alejar gráfica" aria-label="Alejar gráfica">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setGraphZoom(1)} title="Restablecer vista" aria-label="Restablecer vista">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 overflow-hidden p-6">
          {result && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Curva activa</p>
                <p className="mt-3 font-mono text-sm break-words [overflow-wrap:anywhere]">
                  {activeGraphData?.polynomialExpression ?? 'Sin polinomio disponible'}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Raíces reales visibles</p>
                <p className="mt-3 text-2xl font-black">{result.realRoots.length}</p>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Marcadores</p>
                <p className="mt-3 text-2xl font-black">{activeGraphData?.markers.length ?? 0}</p>
              </div>
            </div>
          )}
          <GeoGebraGraph
            expressions={activeGraphData?.polynomialExpression ? [activeGraphData.polynomialExpression] : []}
            points={(activeGraphData?.markers ?? []).map((marker) => ({
              x: marker.x,
              y: marker.y,
              label: marker.label,
            }))}
            xMin={zoomedPolynomialGraphRange?.xmin}
            xMax={zoomedPolynomialGraphRange?.xmax}
            yMin={zoomedPolynomialGraphRange?.ymin}
            yMax={zoomedPolynomialGraphRange?.ymax}
            heightClassName="h-[28rem] lg:h-[34rem]"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="bg-primary text-primary-foreground">P(x)</Badge>
            <Badge variant="outline">Semillas</Badge>
            <Badge variant="outline">Iteraciones</Badge>
            <Badge className="bg-amber-500 text-black">Raíces reales</Badge>
          </div>
          {activeGraphData?.polynomialExpression && (
            <p className="font-mono text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
              {activeGraphData.polynomialExpression}
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {!isHornerView && !isMullerView && result && result.method !== 'bairstow' && result.iterations.length > 0 && (
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <div className="flex items-center gap-3">
              <Sigma className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl font-black">Iteraciones detalladas</CardTitle>
                <CardDescription>Seguimiento de cada paso con las variables del método seleccionado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 lg:p-5">
            <div className="w-full rounded-xl border border-primary/10 bg-background/30">
              <div className="max-h-[min(66vh,38rem)] overflow-auto">
              <Table className="min-w-[920px] bg-white shadow-sm ring-1 ring-primary/10">
                <TableHeader className="sticky top-0 bg-white/95 z-10 border-b border-primary/20 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[52px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Iter.</TableHead>
                    <TableHead className="w-[136px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">Descripcion</TableHead>
                    {Object.keys(result.iterations[0].values).map((column) => (
                      <TableHead key={column} className="min-w-[64px] px-1.5 py-2 uppercase text-[8px] font-bold tracking-[0.12em] text-primary/70">
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.iterations.map((iteration) => (
                    <TableRow key={iteration.iteration} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="px-1.5 py-2 font-mono text-[10px]">{iteration.iteration}</TableCell>
                      <TableCell className="px-1.5 py-2 text-[10px] leading-5 break-words [overflow-wrap:anywhere]">{iteration.description}</TableCell>
                      {Object.keys(result.iterations[0].values).map((column) => (
                        <TableCell key={`${iteration.iteration}-${column}`} className="px-1.5 py-2 font-mono text-[10px] whitespace-nowrap">
                          {iteration.values[column]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
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
              Todavía no hay cálculos polinómicos almacenados.
            </div>
          ) : (
            <ScrollArea className="h-[min(66vh,38rem)] pr-4">
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
                            <p className="mt-1 text-xs text-muted-foreground">Método: {methodLabel[item.method]}</p>
                          </>
                        )}
                      </div>
                      <Badge variant={item.converged ? 'default' : 'secondary'} className={item.converged ? 'bg-primary text-primary-foreground' : ''}>
                        {item.converged ? 'Convergente' : 'Sin convergencia'}
                      </Badge>
                    </div>
                    <p className="font-mono text-xs break-words [overflow-wrap:anywhere]">Coeficientes: {item.coefficientsText}</p>
                    <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                      Raíces: {Array.isArray(item.roots) && item.roots.length > 0 ? item.roots.join(', ') : 'Sin datos'}
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
