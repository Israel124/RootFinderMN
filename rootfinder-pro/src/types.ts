export type MethodType = 'bisection' | 'false-position' | 'newton-raphson' | 'secant' | 'fixed-point';

export interface FixedPointCandidate {
  expression: string;
  lambda: number;
  derivativeAtPoint: number | null;
  convergent: boolean;
  reason: string;
}

export interface IterationData {
  iteration: number;
  [key: string]: number | string;
}

export interface CalculationResult {
  id: string;
  timestamp: number;
  method: MethodType;
  functionF: string;
  functionG?: string;
  root: number | null;
  error: number | null;
  iterations: IterationData[];
  converged: boolean;
  message: string;
  params: Record<string, any>;
  label?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: MethodType;
  functionF: string;
  root: number | null;
  converged: boolean;
}
