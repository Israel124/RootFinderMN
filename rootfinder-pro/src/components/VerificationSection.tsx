import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface VerificationSectionProps {
  f: string;
  setF: (f: string) => void;
  a: string;
  setA: (a: string) => void;
  b: string;
  setB: (b: string) => void;
}

export function VerificationSection({ f, setF, a, setA, b, setB }: VerificationSectionProps) {
  const [results, setResults] = useState<{
    fa: number;
    fb: number;
    fm: number;
    df?: string;
    signChange: boolean;
    error?: string;
  } | null>(null);

  const handleVerify = () => {
    if (!f.trim()) return setResults({ fa: 0, fb: 0, fm: 0, signChange: false, error: 'La función no puede estar vacía' });
    
    const valA = parseFloat(a);
    const valB = parseFloat(b);

    if (isNaN(valA) || isNaN(valB)) {
      return setResults({ fa: 0, fb: 0, fm: 0, signChange: false, error: 'Los límites A y B deben ser valores numéricos válidos' });
    }

    if (valA >= valB) {
      return setResults({ fa: 0, fb: 0, fm: 0, signChange: false, error: 'El límite A debe ser estrictamente menor que el límite B' });
    }

    try {
      if (!MathEvaluator.isValid(f)) {
        throw new Error('La sintaxis de la función es inválida');
      }

      const fa = MathEvaluator.evaluate(f, valA);
      const fb = MathEvaluator.evaluate(f, valB);
      const fm = MathEvaluator.evaluate(f, (valA + valB) / 2);
      const df = MathEvaluator.getDerivativeExpression(f);
      const signChange = fa * fb < 0;

      setResults({ fa, fb, fm, df, signChange });
    } catch (e: any) {
      setResults({ fa: 0, fb: 0, fm: 0, signChange: false, error: 'Error matemático: ' + e.message });
    }
  };

  return (
    <div className="grid gap-6 max-w-4xl mx-auto">
      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Verificación de Función</CardTitle>
          <CardDescription>
            Ingresa la función f(x) y el intervalo para verificar si existe una raíz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fx" className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">f(x)</Label>
              <Input
                id="fx"
                placeholder="Ej: x^2 - 4, sin(x), exp(x) - 3"
                value={f}
                onChange={(e) => setF(e.target.value)}
                className="font-mono text-lg py-6 bg-background/50 border-primary/20 focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="a" className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Intervalo a</Label>
                <Input
                  id="a"
                  type="number"
                  placeholder="-10"
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b" className="text-primary/70 font-bold uppercase text-[10px] tracking-widest">Intervalo b</Label>
                <Input
                  id="b"
                  type="number"
                  placeholder="10"
                  value={b}
                  onChange={(e) => setB(e.target.value)}
                  className="bg-background/50 border-primary/20"
                />
              </div>
            </div>
          </div>
          <Button onClick={handleVerify} className="w-full py-6 text-lg font-bold bg-primary hover:bg-primary/80 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95">
            Verificar Función
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card className={results.error ? "border-destructive/50 bg-destructive/5" : "border-primary/20 bg-card/50 backdrop-blur-sm"}>
          <CardContent className="pt-6">
            {results.error ? (
              <div className="flex items-center gap-3 text-destructive p-4 rounded-xl bg-destructive/10">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{results.error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-background/50 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">f(a)</p>
                    <p className="text-xl font-mono font-bold text-primary">{results.fa.toFixed(6)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">f(b)</p>
                    <p className="text-xl font-mono font-bold text-primary">{results.fb.toFixed(6)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-widest">f((a+b)/2)</p>
                    <p className="text-xl font-mono font-bold text-primary">{results.fm.toFixed(6)}</p>
                  </div>
                </div>

                {results.df && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-[10px] text-primary uppercase font-bold mb-1 tracking-widest">Derivada f'(x)</p>
                    <p className="text-lg font-mono font-bold text-primary">{results.df}</p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-xl border border-primary/10 bg-background/30">
                  <div className="flex items-center gap-3">
                    <div className={results.signChange ? "bg-primary/20 p-2 rounded-full" : "bg-secondary/20 p-2 rounded-full"}>
                      {results.signChange ? (
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-secondary" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">
                        {results.signChange ? "Cambio de signo detectado" : "Sin cambio de signo"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {results.signChange 
                          ? "Existe al menos una raíz en el intervalo [a, b]." 
                          : "No se garantiza una raíz en este intervalo."}
                      </p>
                    </div>
                  </div>
                  <Badge variant={results.signChange ? "default" : "secondary"} className={results.signChange ? "bg-primary text-primary-foreground" : "bg-secondary/20 text-secondary"}>
                    {results.signChange ? "Válido" : "Advertencia"}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
