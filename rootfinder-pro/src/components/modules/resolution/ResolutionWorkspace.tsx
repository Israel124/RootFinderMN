import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { HistorySection } from './HistorySection';
import { MethodsSection } from './MethodsSection';
import { ResultsSection } from './ResultsSection';
import { setActiveTab } from '@/stores/uiStore';
import { useHistory } from '@/hooks/useHistory';
import type { AppTab, CalculationResult, MethodType } from '@/types';

interface ResolutionWorkspaceProps {
  activeTab: AppTab;
  history: ReturnType<typeof useHistory>;
}

/**
 * Orquesta el flujo completo de resolución: entrada, cálculo, gráfico e historial remoto.
 */
export function ResolutionWorkspace({ activeTab, history }: ResolutionWorkspaceProps) {
  const [f, setF] = useState('x^2 - 4');
  const [a, setA] = useState('-5');
  const [b, setB] = useState('5');
  const [method, setMethod] = useState<MethodType>('bisection');
  const [tol, setTol] = useState('0.0001');
  const [maxIter, setMaxIter] = useState('100');
  const [x0, setX0] = useState('-5');
  const [x1, setX1] = useState('5');
  const [gx, setGx] = useState('');
  const [g1, setG1] = useState('');
  const [currentResult, setCurrentResult] = useState<CalculationResult | null>(null);
  const handleResult = useCallback(
    (result: CalculationResult) => {
      setCurrentResult(result);
      setActiveTab('results');
      void history.save(result).catch((error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo guardar el cálculo');
      });
    },
    [history],
  );

  const handleLoadHistory = useCallback((result: CalculationResult) => {
    setCurrentResult(result);
    setF(result.functionF);
    setMethod(result.method);
    setGx(result.functionG ?? '');

    const params = result.params;
    if (params.a !== undefined) setA(String(params.a));
    if (params.b !== undefined) setB(String(params.b));
    if (params.tol !== undefined) setTol(String(params.tol));
    if (params.maxIter !== undefined) setMaxIter(String(params.maxIter));
    if (params.x0 !== undefined) setX0(String(params.x0));
    if (params.x1 !== undefined) setX1(String(params.x1));
    if (params.g1Value !== undefined) setG1(String(params.g1Value));

    setActiveTab('results');
    toast.success('Cálculo cargado');
  }, []);

  if (activeTab === 'results') {
    return (
      <ResultsSection
        result={currentResult}
        onBackToMethods={() => setActiveTab('methods')}
      />
    );
  }

  if (activeTab === 'history') {
    return (
      <HistorySection
        history={history.items}
        onDelete={(id) => void history.delete(id)}
        onClear={() => void history.clear()}
        onLoad={handleLoadHistory}
        onUpdate={(id, label) => void history.updateLabel(id, label)}
      />
    );
  }

  return (
    <MethodsSection
      f={f}
      setF={setF}
      a={a}
      setA={setA}
      b={b}
      setB={setB}
      method={method}
      setMethod={setMethod}
      tol={tol}
      setTol={setTol}
      maxIter={maxIter}
      setMaxIter={setMaxIter}
      x0={x0}
      setX0={setX0}
      x1={x1}
      setX1={setX1}
      gx={gx}
      setGx={setGx}
      g1={g1}
      setG1={setG1}
      onResult={handleResult}
    />
  );
}
