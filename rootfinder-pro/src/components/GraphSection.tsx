import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface GraphSectionProps {
  f: string;
  root: number | null;
}

export function GraphSection({ f, root }: GraphSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const [range, setRange] = useState({
    xmin: -10,
    xmax: 10,
    ymin: -10,
    ymax: 10
  });
  const [crossings, setCrossings] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; mathX: number; mathY: number } | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const drawOnCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { xmin, xmax, ymin, ymax } = range;

    if (xmin >= xmax || ymin >= ymax) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Helpers to convert math coords to pixel coords
    const toPxX = (x: number) => ((x - xmin) / (xmax - xmin)) * width;
    const toPxY = (y: number) => height - ((y - ymin) / (ymax - ymin)) * height;

    // Draw Grid
    ctx.strokeStyle = '#131c19';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(xmin); x <= xmax; x++) {
      const px = toPxX(x);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = Math.ceil(ymin); y <= ymax; y++) {
      const py = toPxY(y);
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();

    // Draw Axes
    ctx.strokeStyle = '#1e292b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // X-axis
    const py0 = toPxY(0);
    if (py0 >= 0 && py0 <= height) {
      ctx.moveTo(0, py0);
      ctx.lineTo(width, py0);
    }
    // Y-axis
    const px0 = toPxX(0);
    if (px0 >= 0 && px0 <= width) {
      ctx.moveTo(px0, 0);
      ctx.lineTo(px0, height);
    }
    ctx.stroke();

    // Draw Function
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    const step = (xmax - xmin) / width;
    let first = true;
    const detectedCrossings: number[] = [];
    let prevY: number | null = null;

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

        // Detect crossing
        if (prevY !== null && prevY * y <= 0) {
          detectedCrossings.push(x);
        }
        prevY = y;
      } catch (e) {
        first = true;
      }
    }
    ctx.stroke();
    if (canvas === canvasRef.current) {
      setCrossings(detectedCrossings);
    }

    // Draw Root
    if (root !== null && root >= xmin && root <= xmax) {
      const px = toPxX(root);
      const py = toPxY(0);
      
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
    drawOnCanvas(canvasRef.current);
    if (isDialogOpen) {
      setTimeout(() => drawOnCanvas(fullCanvasRef.current), 50);
    }
  }, [drawOnCanvas, f, root, range, isDialogOpen]);

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
    setRange({ xmin: -10, xmax: 10, ymin: -10, ymax: 10 });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
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
                    width={1600} 
                    height={900} 
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
          <div className="aspect-[16/9] bg-black rounded-2xl border border-primary/20 overflow-hidden relative group shadow-2xl">
            <canvas 
              ref={canvasRef} 
              width={1200} 
              height={675} 
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
                <Label className="text-xs text-muted-foreground">X Min</Label>
                <Input 
                  type="number" 
                  value={range.xmin} 
                  onChange={e => setRange({...range, xmin: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">X Max</Label>
                <Input 
                  type="number" 
                  value={range.xmax} 
                  onChange={e => setRange({...range, xmax: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">Y Min</Label>
                <Input 
                  type="number" 
                  value={range.ymin} 
                  onChange={e => setRange({...range, ymin: parseFloat(e.target.value)})} 
                  className="h-8 text-xs bg-background/50 border-primary/10"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">Y Max</Label>
                <Input 
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
