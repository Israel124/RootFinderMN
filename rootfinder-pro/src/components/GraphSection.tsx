import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { detectZeroCrossings, normalizeRange, PlotRange } from '@/lib/graphUtils';
import { GeoGebraGraph } from '@/components/GeoGebraGraph';

interface GraphSectionProps {
  f: string;
  root: number | null;
}

function niceStep(range: number, ticks: number) {
  const safeRange = Math.abs(range) <= 1e-12 ? 1 : Math.abs(range);
  const rough = safeRange / Math.max(ticks, 1);
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / p;
  const step = (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  return step || 1;
}

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function GraphSection({ f, root }: GraphSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const defaultRange: PlotRange = {
    xmin: -10,
    xmax: 10,
    ymin: -10,
    ymax: 10
  };
  const [range, setRange] = useState<PlotRange>(defaultRange);
  const [crossings, setCrossings] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; mathX: number; mathY: number } | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const drawOnCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
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
    const drawWidth = rect.width;
    const drawHeight = rect.height;

    const { xmin, xmax, ymin, ymax } = normalizeRange(range, defaultRange);

    if (xmin >= xmax || ymin >= ymax) return;

    const primary = cssVar('--color-primary', '#10b981');
    const background = cssVar('--color-background', '#050807');
    const muted = cssVar('--color-muted-foreground', '#94a3b8');

    // Clear + fondo (evita transparencias y hace la gráfica más consistente).
    ctx.clearRect(0, 0, drawWidth, drawHeight);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    // Helpers to convert math coords to pixel coords
    const toPxX = (x: number) => ((x - xmin) / (xmax - xmin)) * drawWidth;
    const toPxY = (y: number) => drawHeight - ((y - ymin) / (ymax - ymin)) * drawHeight;

    // Rejilla (tipo "lab") con pasos bonitos para no saturar el canvas.
    const xStep = niceStep(xmax - xmin, 10);
    const yStep = niceStep(ymax - ymin, 8);
    ctx.strokeStyle = 'rgba(236, 253, 245, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) {
      const px = toPxX(gx);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, drawHeight);
    }
    for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) {
      const py = toPxY(gy);
      ctx.moveTo(0, py);
      ctx.lineTo(drawWidth, py);
    }
    ctx.stroke();

    // Draw Axes
    ctx.strokeStyle = 'rgba(236, 253, 245, 0.14)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // X-axis
    const py0 = toPxY(0);
    if (py0 >= 0 && py0 <= drawHeight) {
      ctx.moveTo(0, py0);
      ctx.lineTo(drawWidth, py0);
    }
    // Y-axis
    const px0 = toPxX(0);
    if (px0 >= 0 && px0 <= drawWidth) {
      ctx.moveTo(px0, 0);
      ctx.lineTo(px0, drawHeight);
    }
    ctx.stroke();

    // Etiquetas (sutiles) en ejes.
    ctx.fillStyle = muted;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let gx = Math.ceil(xmin / xStep) * xStep; gx <= xmax; gx += xStep) {
      if (Math.abs(gx) < 1e-10) continue;
      const cy = Math.max(14, Math.min(drawHeight - 6, toPxY(0) + 16));
      ctx.fillText(Number(gx.toFixed(4)).toString(), toPxX(gx), cy);
    }
    ctx.textAlign = 'right';
    for (let gy = Math.ceil(ymin / yStep) * yStep; gy <= ymax; gy += yStep) {
      if (Math.abs(gy) < 1e-10) continue;
      const cx = Math.max(40, Math.min(drawWidth - 6, toPxX(0) - 8));
      ctx.fillText(Number(gy.toFixed(4)).toString(), cx, toPxY(gy) + 4);
    }

    // Draw Function
    ctx.strokeStyle = primary;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    const step = (xmax - xmin) / drawWidth;
    let first = true;
    const samples: Array<{ x: number; y: number }> = [];

    for (let x = xmin; x <= xmax; x += step) {
      try {
        const y = MathEvaluator.evaluate(f, x);
        const px = toPxX(x);
        const py = toPxY(y);

        if (isFinite(py)) {
          if (first) {
            ctx.moveTo(px, py);
            first = false;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          first = true;
        }
        samples.push({ x, y });
      } catch (e) {
        first = true;
      }
    }
    ctx.stroke();
    if (canvas === canvasRef.current) {
      setCrossings(detectZeroCrossings(samples));
    }

    // Cruces por cero (marcadores)
    if (samples.length && ymin <= 0 && ymax >= 0) {
      const detected = detectZeroCrossings(samples);
      ctx.fillStyle = primary;
      detected.forEach((xCross) => {
        if (xCross < xmin || xCross > xmax) return;
        const cx = toPxX(xCross);
        const cy = toPxY(0);
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // Draw Root
    if (root !== null && root >= xmin && root <= xmax) {
      const px = toPxX(root);
      const py = toPxY(0);
      
      // Línea guía (dashed) para ubicar la raíz sin cambiar el "acercamiento".
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, drawHeight);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#050807';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ecfdf5';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Raíz: ${root.toFixed(4)}`, px, py - 15);
    }
  }, [f, root, range]);

  useEffect(() => {
    if (!f) return;

    const render = () => {
      drawOnCanvas(canvasRef.current);
      if (isDialogOpen) {
        drawOnCanvas(fullCanvasRef.current);
      }
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [drawOnCanvas, f, root, range, isDialogOpen]);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { xmin, xmax, ymin, ymax } = range;
    const mathX = xmin + (x / rect.width) * (xmax - xmin);
    const mathY = ymax - (y / rect.height) * (ymax - ymin);

    setMousePos({ x, y, mathX, mathY });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 max-w-7xl mx-auto">
      <Card className="lg:col-span-3 overflow-hidden shadow-2xl border-primary/10 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-primary">Visualización Completa</CardTitle>
            <CardDescription>Explora la función f(x) con herramientas de zoom y vista ampliada.</CardDescription>
          </div>
          <div className="flex gap-2">
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
                  aria-label="Abrir grafica en vista ampliada"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent 
                isOpen={isDialogOpen} 
                onClose={() => setIsDialogOpen(false)}
                className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-background border-primary/20"
              >
                <DialogHeader className="p-4 border-b border-primary/10">
                  <DialogTitle className="flex items-center justify-between">
                    <span>Vista Ampliada: {f}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="relative w-full h-full bg-black">
                  <canvas 
                    ref={fullCanvasRef} 
                    className="w-full h-full cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  />
                  {mousePos && (
                    <div 
                      className="graph-tooltip"
                      style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
                    >
                      <div className="font-mono font-bold text-primary-foreground/70 mb-0.5">Coordenadas</div>
                      <div className="font-mono text-primary">x: {mousePos.mathX.toFixed(4)}</div>
                      <div className="font-mono text-primary">y: {mousePos.mathY.toFixed(4)}</div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <GeoGebraGraph
            expressions={[f]}
            points={root !== null ? [{ x: root, y: 0, label: 'Raiz' }] : []}
            xMin={range.xmin}
            xMax={range.xmax}
            yMin={range.ymin}
            yMax={range.ymax}
            heightClassName="h-[28rem] lg:h-[34rem]"
            fallback={
              <div className="aspect-[16/9] bg-black rounded-2xl border border-primary/20 overflow-hidden relative group shadow-2xl">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
                {mousePos && (
                  <div
                    className="graph-tooltip"
                    style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
                  >
                    <div className="font-mono font-bold text-primary-foreground/70 mb-0.5">Coordenadas</div>
                    <div className="font-mono text-primary">x: {mousePos.mathX.toFixed(4)}</div>
                    <div className="font-mono text-primary">y: {mousePos.mathY.toFixed(4)}</div>
                  </div>
                )}
                {mousePos && (
                  <>
                    <div
                      className="absolute pointer-events-none border-l border-dashed border-primary/30 h-full"
                      style={{ left: mousePos.x }}
                    />
                    <div
                      className="absolute pointer-events-none border-t border-dashed border-primary/30 w-full"
                      style={{ top: mousePos.y }}
                    />
                  </>
                )}
              </div>
            }
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
  );
}
