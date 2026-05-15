import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Maximize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { detectZeroCrossings, estimateFunctionViewport, normalizeRange, PlotRange } from '@/lib/graphUtils';
import { GeoGebraGraph } from '@/components/GeoGebraGraph';

interface GraphSectionProps {
  f: string;
  root: number | null;
  onBackToResults?: () => void;
}

export function GraphSection({ f, root, onBackToResults }: GraphSectionProps) {
  const defaultRange = useMemo<PlotRange>(
    () => estimateFunctionViewport(f, { root, fallback: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 } }),
    [f, root],
  );
  const [range, setRange] = useState<PlotRange>(defaultRange);
  const [crossings, setCrossings] = useState<number[]>([]);

  useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange]);

  useEffect(() => {
    if (!f) {
      setCrossings([]);
      return;
    }

    const { xmin, xmax } = normalizeRange(range, defaultRange);
    const step = (xmax - xmin) / 600;
    const samples: Array<{ x: number; y: number }> = [];

    for (let x = xmin; x <= xmax; x += step) {
      try {
        samples.push({ x, y: MathEvaluator.evaluate(f, x) });
      } catch {
        // Ignore discontinuities and invalid samples.
      }
    }

    setCrossings(detectZeroCrossings(samples));
  }, [f, range]);

  const zoom = (factor: number) => {
    const dx = (range.xmax - range.xmin) * factor;
    const dy = (range.ymax - range.ymin) * factor;
    setRange({
      xmin: range.xmin + dx,
      xmax: range.xmax - dx,
      ymin: range.ymin + dy,
      ymax: range.ymax - dy
    });
  };

  const resetView = () => {
    setRange(defaultRange);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Card className="overflow-hidden border-primary/10 bg-linear-to-br from-primary/10 via-card/82 to-card/94 shadow-2xl backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary/65">Lectura visual</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-primary">Gráfica de validación</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Usa esta vista para contrastar el resultado numérico con la forma real de la función, revisar cruces por cero y ajustar el rango sin perder contexto.
              </p>
            </div>
            {onBackToResults && (
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={onBackToResults} className="border-primary/20 hover:bg-primary/10">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a resultados
                </Button>
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Función activa</p>
              <p className="mt-3 font-mono text-sm break-words [overflow-wrap:anywhere]">{f || 'Sin función cargada'}</p>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Raíz marcada</p>
              <p className="mt-3 font-mono text-lg text-primary">{root !== null ? root.toFixed(8) : 'N/D'}</p>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-background/35 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary/60">Cruces detectados</p>
              <p className="mt-3 text-2xl font-black">{crossings.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3 overflow-hidden shadow-2xl border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Visualización Completa</CardTitle>
            <CardDescription>Explora la función f(x) con herramientas de zoom y vista ampliada.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={() => zoom(0.1)} title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => zoom(-0.1)} title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={resetView} title="Reset View">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Dialog>
              <DialogTrigger>
                <Button 
                  variant="default" 
                  size="icon" 
                  className="bg-primary hover:bg-primary/80 text-primary-foreground"
                  aria-label="Abrir gráfica en vista ampliada"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-background border-primary/20">
                <DialogHeader className="p-4 border-b border-primary/10">
                  <DialogTitle className="flex items-center justify-between">
                    <span>Vista Ampliada: {f}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="relative w-full h-full bg-black">
                  <GeoGebraGraph
                    expressions={[f]}
                    points={root !== null ? [{ x: root, y: 0, label: 'Raíz' }] : []}
                    xMin={range.xmin}
                    xMax={range.xmax}
                    yMin={range.ymin}
                    yMax={range.ymax}
                    heightClassName="h-full"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <GeoGebraGraph
            expressions={[f]}
            points={root !== null ? [{ x: root, y: 0, label: 'Raíz' }] : []}
            xMin={range.xmin}
            xMax={range.xmax}
            yMin={range.ymin}
            yMax={range.ymax}
            heightClassName="h-[28rem] lg:h-[34rem]"
          />
        </CardContent>
      </Card>

        <div className="space-y-6">
          <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Control de Rango</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="xmin-range" className="text-xs text-muted-foreground">X Min</Label>
                <Input 
                  id="xmin-range"
                  type="number" 
                  value={range.xmin} 
                  onChange={e => setRange({...range, xmin: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="xmax-range" className="text-xs text-muted-foreground">X Max</Label>
                <Input 
                  id="xmax-range"
                  type="number" 
                  value={range.xmax} 
                  onChange={e => setRange({...range, xmax: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ymin-range" className="text-xs text-muted-foreground">Y Min</Label>
                <Input 
                  id="ymin-range"
                  type="number" 
                  value={range.ymin} 
                  onChange={e => setRange({...range, ymin: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ymax-range" className="text-xs text-muted-foreground">Y Max</Label>
                <Input 
                  id="ymax-range"
                  type="number" 
                  value={range.ymax} 
                  onChange={e => setRange({...range, ymax: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
            </div>
          </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Cruces Detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {crossings.length > 0 ? (
                crossings.slice(0, 8).map((c, i) => (
                  <Badge key={i} variant="secondary" className="font-mono bg-background/80 border-primary/20 text-primary">
                    x ≈ {c.toFixed(4)}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">No se detectaron cruces en este rango.</p>
              )}
            </div>
            {root !== null && (
              <div className="p-4 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                <p className="text-[10px] font-bold uppercase mb-1 opacity-80">Raíz del método</p>
                <p className="font-mono font-bold text-xl">{root.toFixed(8)}</p>
              </div>
            )}
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
