import { useDeferredValue, useEffect, useState } from 'react';
import { MathEvaluator } from '@/lib/mathEvaluator';
import { useDebounce } from './useDebounce';

interface MathEvalState {
  value: number | null;
  derivative: number | null;
  error: string | null;
  isValid: boolean;
}

/**
 * Evalúa una expresión matemática de forma reactiva con debounce y manejo consistente de errores.
 */
export function useMathEval(expression: string, x?: number, delay = 300): MathEvalState {
  const deferredExpression = useDeferredValue(expression);
  const debouncedExpression = useDebounce(deferredExpression, delay);
  const [state, setState] = useState<MathEvalState>({
    value: null,
    derivative: null,
    error: null,
    isValid: false,
  });

  useEffect(() => {
    const trimmedExpression = debouncedExpression.trim();
    if (!trimmedExpression) {
      setState({
        value: null,
        derivative: null,
        error: null,
        isValid: false,
      });
      return;
    }

    try {
      const isValid = MathEvaluator.isValid(trimmedExpression);
      if (!isValid) {
        setState({
          value: null,
          derivative: null,
          error: 'La expresión no es válida',
          isValid: false,
        });
        return;
      }

      const nextValue = typeof x === 'number' && Number.isFinite(x) ? MathEvaluator.evaluate(trimmedExpression, x) : null;
      const nextDerivative =
        typeof x === 'number' && Number.isFinite(x) ? MathEvaluator.derivative(trimmedExpression, x) : null;

      setState({
        value: nextValue,
        derivative: nextDerivative,
        error: null,
        isValid: true,
      });
    } catch (error) {
      setState({
        value: null,
        derivative: null,
        error: error instanceof Error ? error.message : 'No se pudo evaluar la expresión',
        isValid: false,
      });
    }
  }, [debouncedExpression, x]);

  return state;
}
