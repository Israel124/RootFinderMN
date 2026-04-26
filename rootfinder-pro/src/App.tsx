/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { VerificationSection } from './components/VerificationSection';
import { MethodsSection } from './components/MethodsSection';
import { ResultsSection } from './components/ResultsSection';
import { HistorySection } from './components/HistorySection';
import { GraphSection } from './components/GraphSection';
import { NewtonSystemSection } from './components/NewtonSystemSection';
import { TaylorSection } from './components/TaylorSection';
import {
  SYSTEM_HISTORY_KEY,
  SYSTEM_HISTORY_UPDATED_EVENT,
  TAYLOR_HISTORY_KEY,
  TAYLOR_HISTORY_UPDATED_EVENT,
} from './lib/historyKeys';
import { CalculationResult, MethodType } from './types';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Calculator, Save, Sigma, Sparkles, Trash2, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function App() {
  const [activeTab, setActiveTab] = useState('verification');
  
  // Input States
  const [f, setF] = useState('x^2 - 4');
  const [a, setA] = useState('-5');
  const [b, setB] = useState('5');
  
  // Method States
  const [method, setMethod] = useState<MethodType>('bisection');
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('100');
  const [x0, setX0] = useState('-5');
  const [x1, setX1] = useState('5');
  const [gx, setGx] = useState('');
  const [g1, setG1] = useState('');

  const [currentResult, setCurrentResult] = useState<CalculationResult | null>(null);
  const [history, setHistory] = useState<CalculationResult[]>([]);
  const [systemHistoryCount, setSystemHistoryCount] = useState(0);
  const [taylorHistoryCount, setTaylorHistoryCount] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  const loadSystemHistoryCount = () => {
    try {
      const raw = window.localStorage.getItem(SYSTEM_HISTORY_KEY);
      const items = raw ? JSON.parse(raw) : [];
      setSystemHistoryCount(Array.isArray(items) ? items.length : 0);
    } catch {
      setSystemHistoryCount(0);
    }
  };

  const loadTaylorHistoryCount = () => {
    try {
      const raw = window.localStorage.getItem(TAYLOR_HISTORY_KEY);
      const items = raw ? JSON.parse(raw) : [];
      setTaylorHistoryCount(Array.isArray(items) ? items.length : 0);
    } catch {
      setTaylorHistoryCount(0);
    }
  };

  const handleClearFields = () => {
    setF('');
    setA('');
    setB('');
    setMethod('bisection');
    setTol('0.0001');
    setMaxIter('100');
    setX0('');
    setX1('');
    setGx('');
    setG1('');
    setCurrentResult(null);
    setHasChanges(false);
    toast.success('Campos limpiados correctamente');
  };

  // Detect changes between current inputs and loaded result
  useEffect(() => {
    if (!currentResult) {
      setHasChanges(false);
      return;
    }

    const isDifferent = 
      f !== currentResult.functionF ||
      method !== currentResult.method ||
      gx !== (currentResult.functionG || '') ||
      tol !== (currentResult.params.tol?.toString() || '') ||
      maxIter !== (currentResult.params.maxIter?.toString() || '') ||
      a !== (currentResult.params.a?.toString() || '') ||
      b !== (currentResult.params.b?.toString() || '') ||
      x0 !== (currentResult.params.x0?.toString() || '') ||
      x1 !== (currentResult.params.x1?.toString() || '') ||
      g1 !== (currentResult.params.g1Value?.toString() || '');

    setHasChanges(isDifferent);
  }, [f, a, b, method, tol, maxIter, x0, x1, gx, g1, currentResult]);

  // Load history from API
  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(err => console.error('Error loading history:', err));
  }, []);

  useEffect(() => {
    loadSystemHistoryCount();
    loadTaylorHistoryCount();

    const refreshSystem = () => loadSystemHistoryCount();
    const refreshTaylor = () => loadTaylorHistoryCount();
    const refreshAll = () => {
      loadSystemHistoryCount();
      loadTaylorHistoryCount();
    };
    window.addEventListener(SYSTEM_HISTORY_UPDATED_EVENT, refreshSystem);
    window.addEventListener(TAYLOR_HISTORY_UPDATED_EVENT, refreshTaylor);
    window.addEventListener('storage', refreshAll);

    return () => {
      window.removeEventListener(SYSTEM_HISTORY_UPDATED_EVENT, refreshSystem);
      window.removeEventListener(TAYLOR_HISTORY_UPDATED_EVENT, refreshTaylor);
      window.removeEventListener('storage', refreshAll);
    };
  }, []);

  const handleNewResult = async (result: CalculationResult) => {
    // Si estamos editando un resultado existente, conservar su ID para el UPSERT
    const finalResult = currentResult && hasChanges 
      ? { ...result, id: currentResult.id, label: currentResult.label } 
      : result;

    setCurrentResult(finalResult);
    setGx(finalResult.functionG || '');
    
    // Actualizar historial local
    setHistory(prev => {
      const filtered = prev.filter(item => item.id !== finalResult.id);
      return [finalResult, ...filtered].slice(0, 50);
    });
    
    setActiveTab('results');
    setHasChanges(false);
    
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalResult)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error desconocido al guardar');
      }

      toast.success(currentResult && hasChanges ? 'Cálculo actualizado' : 'Nuevo cálculo guardado');
    } catch (err: any) {
      console.error('Error saving to DB:', err);
      toast.error('No se pudo guardar en la base de datos: ' + err.message);
    }
  };

  const handleSaveChanges = async () => {
    setActiveTab('methods');
    setTimeout(() => {
      const calcBtn = document.querySelector('button.w-full.py-8');
      calcBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.info('Haz clic en "Calcular Raíz" para actualizar el registro con los nuevos valores.');
    }, 100);
  };

  const handleDeleteHistory = async (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (currentResult?.id === id) setCurrentResult(null);
    try {
      await fetch(`/api/history/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Error deleting from DB:', err);
    }
  };

  const handleClearHistory = async () => {
    setHistory([]);
    setCurrentResult(null);
    try {
      await fetch('/api/history', { method: 'DELETE' });
    } catch (err) {
      console.error('Error clearing DB:', err);
    }
  };

  const handleUpdateHistory = async (id: string, label: string) => {
    setHistory(prev => prev.map(item => item.id === id ? { ...item, label } : item));
    try {
      await fetch(`/api/history/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });
    } catch (err) {
      console.error('Error updating DB:', err);
    }
  };

  const handleLoadHistory = (result: CalculationResult) => {
    setCurrentResult(result);
    setF(result.functionF);
    setMethod(result.method);
    setGx(result.functionG || '');
    
    // Load params
    const p = result.params;
    if (p.a !== undefined) setA(p.a.toString());
    if (p.b !== undefined) setB(p.b.toString());
    if (p.tol !== undefined) setTol(p.tol.toString());
    if (p.maxIter !== undefined) setMaxIter(p.maxIter.toString());
    if (p.x0 !== undefined) setX0(p.x0.toString());
    if (p.x1 !== undefined) setX1(p.x1.toString());
    if (p.g1Value !== undefined) setG1(p.g1Value.toString());
    
    setActiveTab('results');
    toast.success('Datos cargados del historial');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-card/65 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
              <Calculator className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">RootFinder <span className="text-primary">Pro</span></h1>
              <p className="text-sm text-muted-foreground">Análisis visual y validación paso a paso de métodos numéricos</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-2xl border border-primary/10 bg-background/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/60">Función activa</p>
              <p className="mt-1 font-mono text-sm truncate max-w-[14rem]">{f}</p>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-background/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/60">Método</p>
              <p className="mt-1 text-sm font-medium">{method}</p>
            </div>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleClearFields}
              className="h-auto rounded-2xl border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all flex flex-col items-center justify-center gap-1 group"
            >
              <Eraser className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Limpiar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        <section className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_0.9fr_0.9fr]">
          <div className="rounded-[2rem] border border-primary/10 bg-linear-to-br from-primary/12 via-card/70 to-card/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60">Panel Principal</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Resuelve, compara y valida</h2>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  El programa ahora prioriza la lectura académica del proceso: verificación inicial, selección del método,
                  control de convergencia y revisión de resultados sin perder contexto.
                </p>
              </div>
              <Sparkles className="hidden h-10 w-10 text-primary/70 lg:block" />
            </div>
          </div>
          <div className="rounded-[2rem] border border-primary/10 bg-card/55 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Sigma className="h-5 w-5 text-primary" />
              <p className="text-sm font-bold">Punto Fijo Mejorado</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Ahora puedes comparar transformadas automáticas y despejes manuales con el criterio `|g'(x)| &lt; 1`.
            </p>
          </div>
          <div className="rounded-[2rem] border border-primary/10 bg-card/55 p-6 shadow-xl backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/60">Estado</p>
            <p className="mt-3 text-3xl font-black">{history.length + systemHistoryCount + taylorHistoryCount}</p>
            <p className="mt-2 text-sm text-muted-foreground">registros totales en historial listos para recarga y comparación.</p>
          </div>
        </section>

        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        <div className="relative min-h-[600px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'verification' && (
                <VerificationSection f={f} setF={setF} a={a} setA={setA} b={b} setB={setB} />
              )}
              {activeTab === 'taylor' && (
                <TaylorSection />
              )}
              {activeTab === 'methods' && (
                <MethodsSection 
                  f={f} a={a} b={b} 
                  method={method} setMethod={setMethod}
                  tol={tol} setTol={setTol}
                  maxIter={maxIter} setMaxIter={setMaxIter}
                  x0={x0} setX0={setX0}
                  x1={x1} setX1={setX1}
                  gx={gx} setGx={setGx}
                  g1={g1} setG1={setG1}
                  onResult={handleNewResult} 
                />
              )}
              {activeTab === 'results' && (
                <ResultsSection result={currentResult} />
              )}
              {activeTab === 'history' && (
                <HistorySection 
                  history={history} 
                  onDelete={handleDeleteHistory} 
                  onClear={handleClearHistory}
                  onLoad={handleLoadHistory}
                  onUpdate={handleUpdateHistory}
                />
              )}
              {activeTab === 'graph' && (
                <GraphSection f={f} root={currentResult?.root || null} />
              )}
              {activeTab === 'systems' && (
                <NewtonSystemSection />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Save Button */}
        <AnimatePresence>
          {hasChanges && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="fixed bottom-8 right-8 z-[60]"
            >
              <Button 
                onClick={handleSaveChanges}
                className="shadow-2xl h-14 px-6 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold flex gap-2 items-center group"
              >
                <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Guardar Cambios</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-primary/10 bg-card/50 py-12 mt-12 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary/60">
              Proyecto Desarrollado Por
            </p>
            <p className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Israel Espinoza <span className="text-primary">|</span> Luis Pérez <span className="text-primary">|</span> Randall Arguello
            </p>
          </div>
          <p className="text-xs text-muted-foreground pt-4 border-t border-primary/5 max-w-md mx-auto">
            &copy; {new Date().getFullYear()} RootFinder Pro. Herramienta educativa para análisis numérico.
          </p>
        </div>
      </footer>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}
