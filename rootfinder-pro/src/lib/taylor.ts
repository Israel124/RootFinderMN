import { MathEvaluator } from './mathEvaluator';

export type TaylorTerm = {
  order: number;
  derivativeExpression: string;
  derivativeValue: number;
  factorial: number;
  coefficient: number;
  termExpression: string;
};

export type TaylorResult = {
  terms: TaylorTerm[];
  polynomial: string;
  approximation: number;
  exactValue: number;
  absoluteError: number;
  relativeError: number;
  center: number;
  order: number;
  evaluateAt: number;
};

export const MAX_TAYLOR_ORDER = 20;

const factorialCache = new Array<number>(MAX_TAYLOR_ORDER + 1).fill(0);
factorialCache[0] = 1;
for (let index = 1; index <= MAX_TAYLOR_ORDER; index += 1) {
  factorialCache[index] = factorialCache[index - 1] * index;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(10)).toString();
}

/**
 * Retorna el factorial seguro y memoizado para la serie de Taylor.
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > MAX_TAYLOR_ORDER) {
    throw new Error(`Orden debe ser entero entre 0 y ${MAX_TAYLOR_ORDER}`);
  }

  return factorialCache[n];
}

/**
 * Construye el desarrollo de Taylor y sus métricas asociadas.
 */
export function buildTaylorResult(fx: string, center: string, order: string, evaluateAt: string): TaylorResult {
  const a = Number.parseFloat(center);
  const n = Number.parseInt(order, 10);
  const x = Number.parseFloat(evaluateAt);

  if (!fx.trim()) {
    throw new Error('Debes ingresar una funcion');
  }
  if (!MathEvaluator.isValid(fx)) {
    throw new Error('La funcion ingresada no es valida');
  }
  if (Number.isNaN(a)) {
    throw new Error('El centro a debe ser numerico');
  }
  if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error('El orden debe ser un entero no negativo');
  }
  if (n > MAX_TAYLOR_ORDER) {
    throw new Error(`El orden maximo permitido es ${MAX_TAYLOR_ORDER}`);
  }
  if (Number.isNaN(x)) {
    throw new Error('El punto de evaluacion debe ser numerico');
  }

  const terms: TaylorTerm[] = [];
  const polynomialTerms: string[] = [];
  let approximation = 0;

  for (let k = 0; k <= n; k += 1) {
    const derivativeExpression = MathEvaluator.getNthDerivativeExpression(fx, k);
    let derivativeValue: number;

    try {
      derivativeValue = MathEvaluator.evaluateNthDerivative(fx, k, { x: a });
    } catch {
      throw new Error(`La derivada de orden ${k} no existe o no es finita en a = ${formatNumber(a)}.`);
    }

    if (!Number.isFinite(derivativeValue)) {
      throw new Error(`La derivada de orden ${k} no existe o no es finita en a = ${formatNumber(a)}.`);
    }

    const factorialValue = factorial(k);
    const coefficient = derivativeValue / factorialValue;
    const centeredTerm = k === 0 ? '1' : k === 1 ? `(x - ${formatNumber(a)})` : `(x - ${formatNumber(a)})^${k}`;
    const termExpression = k === 0 ? formatNumber(derivativeValue) : `${formatNumber(coefficient)} * ${centeredTerm}`;

    terms.push({
      order: k,
      derivativeExpression,
      derivativeValue,
      factorial: factorialValue,
      coefficient,
      termExpression,
    });

    polynomialTerms.push(termExpression);
    approximation += coefficient * Math.pow(x - a, k);
  }

  const exactValue = MathEvaluator.evaluate(fx, x);
  const absoluteError = Math.abs(exactValue - approximation);
  const relativeError = exactValue !== 0 ? (absoluteError / Math.abs(exactValue)) * 100 : 0;

  return {
    terms,
    polynomial: polynomialTerms.join(' + '),
    approximation,
    exactValue,
    absoluteError,
    relativeError,
    center: a,
    order: n,
    evaluateAt: x,
  };
}
