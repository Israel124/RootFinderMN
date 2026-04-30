import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PolynomialMethods, PolynomialRootMethod, PolynomialRootResult } from '@/lib/polynomialMethods';

const methodLabel: Record<PolynomialRootMethod, string> = {
  muller: 'Müller',
  bairstow: 'Bairstow',
  horner: 'Horner',
};

const methodDescription: Record<PolynomialRootMethod, string> = {
  muller: 'Aproxima raíces mediante interpolación cuadrática local; robusto para raíces reales y complejas.',
  bairstow: 'Factoriza el polinomio en pares de raíces y extrae las soluciones una vez que converge.',
  horner: 'Evalúa el polinomio y su derivada simultáneamente para una raíz precisa con Newton.',
};

export function PolynomialSection() {
  const [coefficients, setCoefficients] = useState('1, -3, 2');
  const [method, setMethod] = useState<PolynomialRootMethod>('muller');
  const [x0, setX0] = useState('0');
  const [x1, setX1] = useState('1');
  const [x2, setX2] = useState('2');
  const [r0, setR0] = useState('1');
  const [s0, setS0] = useState('-1');
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('50');
  const [result, setResult] = useState<PolynomialRootResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedCoefficients = useMemo(() => {
    try {
      return PolynomialMethods.parseCoefficients(coefficients);
    } catch {
      return null;
    }
  }, [coefficients]);

  const handleCalculate = () => {
    try {
      const parsedTol = parseFloat(tol);
      const parsedMaxIter = parseInt(maxIter, 10);
      if (Number.isNaN(parsedTol) || parsedTol <= 0) {
        throw new Error('La tolerancia debe ser un número positivo.');
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
            throw new Error('Ingresa un valor numérico válido para x0.');
          }
          calculatedResult = PolynomialMethods.hornerRoot(coeffs, initial, parsedTol, parsedMaxIter);
          break;
        }
        case 'muller': {
          const initialX0 = parseFloat(x0);
          const initialX1 = parseFloat(x1);
          const initialX2 = parseFloat(x2);
          if ([initialX0, initialX1, initialX2].some(Number.isNaN)) {
            throw new Error('Ingresa valores numéricos válidos para x0, x1 y x2.');
          }
          calculatedResult = PolynomialMethods.mullerRoot(coeffs, initialX0, initialX1, initialX2, parsedTol, parsedMaxIter);
          break;
        }
        case 'bairstow': {
          const initialR = parseFloat(r0);
          const initialS = parseFloat(s0);
          if (Number.isNaN(initialR) || Number.isNaN(initialS)) {
            throw new Error('Ingresa valores numéricos válidos para r0 y s0.');
          }
          calculatedResult = PolynomialMethods.bairstowFullRoots(coeffs, initialR, initialS, parsedTol, parsedMaxIter);
          break;
        }
        default:
          throw new Error('Método desconocido');
      }

      setResult(calculatedResult);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Error desconocido al calcular las raíces');
      setResult(null);
    }
  };

  return (
    <section className="grid gap-6">
      <div className="rounded-[2rem] border border-primary/10 bg-linear-to-br from-primary/10 via-card/70 to-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/60">Raíces polinómicas</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Métodos de Müller, Bairstow y Horner</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Ingrese coeficientes de un polinomio y pruebe tres métodos distintos para obtener raíces con la máxima precisión posible.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Configuración</CardTitle>
            <CardDescription>Define el polinomio, el método y las condiciones iniciales.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-2">
              <Label htmlFor="coefficients">Coeficientes</Label>
              <textarea
                id="coefficients"
                value={coefficients}
                onChange={(event) => setCoefficients(event.target.value)}
                className="h-28 w-full rounded-xl border border-primary/10 bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                placeholder="Ej: 1, -6, 11, -6"
              />
              <p className="text-xs text-muted-foreground">
                Lista de coeficientes desde el término de mayor grado hasta el independiente.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="method">Método</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PolynomialRootMethod)}>
                <SelectTrigger className="h-12 bg-background/50 border-primary/20 focus:ring-primary text-lg">
                  <SelectValue placeholder="Selecciona un método" value={methodLabel[method]} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muller">Müller</SelectItem>
                  <SelectItem value="bairstow">Bairstow</SelectItem>
                  <SelectItem value="horner">Horner</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{methodDescription[method]}</p>
            </div>

            {method === 'horner' && (
              <div className="grid gap-2">
                <Label htmlFor="x0">Punto inicial x0</Label>
                <Input
                  id="x0"
                  value={x0}
                  onChange={(event) => setX0(event.target.value)}
                  placeholder="Ej: 0"
                  className="bg-background/70"
                />
              </div>
            )}

            {method === 'muller' && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="x0">x0</Label>
                  <Input id="x0" value={x0} onChange={(event) => setX0(event.target.value)} placeholder="0" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="x1">x1</Label>
                  <Input id="x1" value={x1} onChange={(event) => setX1(event.target.value)} placeholder="1" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="x2">x2</Label>
                  <Input id="x2" value={x2} onChange={(event) => setX2(event.target.value)} placeholder="2" className="bg-background/70" />
                </div>
              </div>
            )}

            {method === 'bairstow' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="r0">r0</Label>
                  <Input id="r0" value={r0} onChange={(event) => setR0(event.target.value)} placeholder="1" className="bg-background/70" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="s0">s0</Label>
                  <Input id="s0" value={s0} onChange={(event) => setS0(event.target.value)} placeholder="-1" className="bg-background/70" />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tol">Tolerancia</Label>
                <Input id="tol" value={tol} onChange={(event) => setTol(event.target.value)} placeholder="0.0001" className="bg-background/70" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxIter">Máximo de iteraciones</Label>
                <Input id="maxIter" value={maxIter} onChange={(event) => setMaxIter(event.target.value)} placeholder="50" className="bg-background/70" />
              </div>
            </div>

            <Button className="mt-2 w-full" onClick={handleCalculate}>
              Calcular raíces
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {parsedCoefficients && (
              <p className="text-sm text-muted-foreground">
                Polinomio de grado {parsedCoefficients.length - 1} con coeficientes [{parsedCoefficients.join(', ')}].
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Resultados</CardTitle>
            <CardDescription>Visualiza raíces y progreso de la iteración.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {!result && (
              <p className="text-sm text-muted-foreground">
                Ejecuta un cálculo para ver la raíz, si el método converge, se mostrará aquí.
              </p>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-primary">{result.message}</p>
                  <p className="text-sm text-muted-foreground">Método: {methodLabel[result.method]}</p>
                  <p className="text-sm text-muted-foreground">
                    Convergencia: {result.converged ? 'Sí' : 'No'}
                  </p>
                </div>

                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-background/70 p-4">
                  <p className="text-sm font-semibold">Raíces encontradas</p>
                  {result.roots.map((root, index) => (
                    <p key={index} className="text-sm text-foreground">
                      {`x${index + 1} = ${root}`}
                    </p>
                  ))}
                </div>

                <div className="grid gap-2 rounded-3xl border border-primary/10 bg-background/70 p-4">
                  <p className="text-sm font-semibold">Parámetros utilizados</p>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Coeficientes: [{parsedCoefficients?.join(', ')}]</p>
                    <p>Tolerancia: {tol}</p>
                    <p>Iteraciones máximas: {maxIter}</p>
                    {(method === 'horner' || method === 'muller') && <p>Valores iniciales: {method === 'horner' ? x0 : `${x0}, ${x1}, ${x2}`}</p>}
                    {method === 'bairstow' && <p>Valores iniciales: r0 = {r0}, s0 = {s0}</p>}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && result.iterations.length > 0 && (
        <Card className="rounded-[1.8rem] border border-primary/10 bg-card/60 shadow-xl shadow-primary/10">
          <CardHeader className="space-y-2 p-6">
            <CardTitle className="text-xl font-black">Iteraciones detalladas</CardTitle>
            <CardDescription>Seguimiento de cada paso y corrección numérica.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            {result.iterations.map((iteration) => (
              <div key={iteration.iteration} className="rounded-3xl border border-primary/10 bg-background/70 p-4">
                <p className="text-sm font-semibold">Iteración {iteration.iteration}</p>
                <p className="text-sm text-muted-foreground mb-2">{iteration.description}</p>
                <div className="grid gap-1 text-sm text-foreground">
                  {Object.entries(iteration.values).map(([key, value]) => (
                    <p key={key} className="break-words">
                      <span className="font-semibold">{key}:</span> {value}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
