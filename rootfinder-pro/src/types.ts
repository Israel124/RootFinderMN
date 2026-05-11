export type MethodType = 'bisection' | 'false-position' | 'newton-raphson' | 'secant' | 'fixed-point';

export type AppTab =
  | 'taylor'
  | 'methods'
  | 'polynomial'
  | 'results'
  | 'history'
  | 'graph'
  | 'systems';

export type AppAccessTab = 'taylor' | 'methods' | 'polynomial';

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

export interface SystemIterationData {
  iteration: number;
  vector?: number[];
  fValues?: number[];
  jacobian?: number[][];
  delta?: number[];
  nextVector?: number[];
  ea: number;
  er: string;
  [key: string]: number | string | number[] | number[][];
}

export interface SystemCalculationResult {
  functionF1: string;
  functionF2: string;
  functions: string[];
  variables: string[];
  solution: ({ x?: number; y?: number; values: number[]; [key: string]: number | number[] | undefined }) | null;
  error: number | null;
  iterations: SystemIterationData[];
  converged: boolean;
  message: string;
  params: Record<string, any>;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: MethodType;
  functionF: string;
  root: number | null;
  converged: boolean;
}
